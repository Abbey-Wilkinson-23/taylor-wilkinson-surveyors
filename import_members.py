"""
Parse MEMBERS OFFICE DETAILS doc and import surveyors into the database.
Run: railway run python import_members.py

The doc is uploaded to Railway as members.txt (converted via textutil).
"""
import asyncio
import re
from sqlalchemy import select, text
from core.database import AsyncSessionLocal
from models.orm import Surveyor

DOC_PATH = "/app/members.txt"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clean_hyperlinks(s):
    """Remove HYPERLINK "..." prefix and naked http links."""
    s = re.sub(r'HYPERLINK\s+"[^"]*"\s*', '', s)
    s = re.sub(r'https?://\S+', '', s)
    return s

def clean(s):
    if not s:
        return s
    s = clean_hyperlinks(s)
    return re.sub(r'\s+', ' ', s).strip()

QUAL_RE = re.compile(
    r'\b(FRICS|MRICS|AssocRICS|F\.?R\.?I\.?C\.?S|M\.?R\.?I\.?C\.?S'
    r'|BSc|CEng|MICE|MIStructE|AMS|C\.Env|FIQ|FCABE|FAAV|ACABE)\b',
    re.IGNORECASE
)

SKIP_LINE_RE = re.compile(
    r'HYPERLINK|PI\s+COVER|RICS\s+Member|Member\s+since'
    r'|^Fax\b|^Home\s+Postcode|^Base\s+Postcode|^WITHIN|^OVER\s+\d'
    r'|^DO\s+NOT|^NO\s+[A-Z]|^CHECK\s+|^MIN\s+|PAGE\b|\bDATE\b'
    r'|^UAV$|^Mob:|^\d{5,}',
    re.IGNORECASE
)

POSTCODE_RE = re.compile(r'^[A-Z]{1,2}\d[\d\w]?\s*\d[A-Z]{2}$', re.IGNORECASE)

NAME_WORDS_TO_STRIP = {
    'frics', 'mrics', 'assocrics', 'bsc', 'ceng', 'mice', 'mistructe', 'ams',
    'c.env', 'fiq', 'fcabe', 'director', 'consultant', 'mob:', 'mobile:',
    'faav', 'acabe',
}

# ---------------------------------------------------------------------------
# Split text into records
# ---------------------------------------------------------------------------

def split_records(raw):
    record_start = re.compile(r'^\s*(\d{1,3})\s*$')
    lines = raw.split('\n')
    records = []
    current_num = None
    current_lines = []

    for line in lines:
        stripped = line.strip()
        # Skip lines like "& 52" or "& 131" — these are aliases, not new records
        if re.match(r'^&\s*\d', stripped):
            continue
        m = record_start.match(stripped)
        if m:
            n = int(m.group(1))
            if 1 <= n <= 500:
                if current_num is not None and current_lines:
                    records.append((str(current_num), '\n'.join(current_lines)))
                current_num = n
                current_lines = []
                continue
        if current_num is not None:
            current_lines.append(line)

    if current_num is not None and current_lines:
        records.append((str(current_num), '\n'.join(current_lines)))

    return records

# ---------------------------------------------------------------------------
# Field extractors
# ---------------------------------------------------------------------------

def extract_email(block):
    # Clean hyperlinks first then find email
    cleaned = clean_hyperlinks(block)
    m = re.search(r'[\w.\-+]+@[\w.\-]+\.[a-zA-Z]{2,}', cleaned)
    return m.group(0).lower() if m else None

def extract_mobile(block):
    m = re.search(r'07\d{9}|07\d[\d\s]{8,10}', block)
    if m:
        return re.sub(r'\s+', '', m.group(0))[:11]
    return None

def extract_office_phone(block):
    # UK landline: 01xxx, 02xxx, 03xxx (but not 07xxx)
    m = re.search(r'0[123]\d{2}[\s\d]{7,10}', block)
    if m:
        return re.sub(r'\s+', ' ', m.group(0)).strip()
    return None

def extract_base_postcode(block):
    m = re.search(
        r'(?:Base\s+Postcode|Home\s+Postcode|Home\s+postcode)\s*[:\-]?\s*'
        r'([A-Z]{1,2}\d[\d\w]?\s*\d[A-Z]{2})',
        block, re.IGNORECASE
    )
    return re.sub(r'\s+', ' ', m.group(1)).upper().strip() if m else None

def extract_pi_cover(block):
    m = re.search(r'PI\s+COVER\s*[:\-]?\s*[£$]?([\d.]+)\s*([MmKk]?)', block)
    if m:
        val = float(m.group(1))
        suffix = m.group(2).upper()
        if suffix == 'M':
            val *= 1_000_000
        elif suffix == 'K':
            val *= 1_000
        return val
    return None

def extract_firm_type(block):
    b = block.lower()
    if re.search(r'\bsole\s+trader\b|^1\s+partner\b', b, re.MULTILINE):
        return 'sole_trader'
    m = re.search(r'(\d+)\s+partner', b)
    if m and int(m.group(1)) >= 2:
        return 'partnership'
    if re.search(r'\bltd\b|\bllp\b|\blimited\b|\bplc\b', b):
        return 'limited_company'
    return None

def extract_num_partners(block):
    m = re.search(r'(\d+)\s+PARTNER', block, re.IGNORECASE)
    if m:
        return int(m.group(1))
    if re.search(r'SOLE\s+TRADER|1\s+PARTNER', block, re.IGNORECASE):
        return 1
    return None

def extract_name(lines):
    """Find surveyor name. Qual on same line or line after."""
    for i, line in enumerate(lines[:25]):
        l = line.strip()
        if not l or SKIP_LINE_RE.search(l):
            continue
        if re.search(r'@', l):
            continue
        if re.match(r'^0[0-9]', l):  # phone
            continue
        if re.match(r'\d{2}/\d{2}', l):  # date
            continue

        # Check if this line or the next contains a qualification
        next_line = lines[i+1].strip() if i+1 < len(lines) else ''
        has_qual_here = bool(QUAL_RE.search(l))
        has_qual_next = bool(QUAL_RE.search(next_line))

        if has_qual_here or has_qual_next:
            # Strip qual words and clean the name
            name = QUAL_RE.sub('', l).strip()
            name = re.sub(r'\s+', ' ', name).strip().rstrip(',').strip()
            # Filter short/empty/junk
            if len(name) < 3 or re.search(r'[0-9]{4}|OFFICE|PARTNER|HOLDING|GROUP|LTD|SOLE', name, re.IGNORECASE):
                continue
            return name

        # No qual found — try heuristic: 2-4 capitalised words that look like a name
        if re.match(r'^[A-Z][a-z]+(?:[\s\-][A-Z][a-z]+){1,3}$', l):
            # Make sure it doesn't look like a place/firm name
            if not re.search(r'Chartered|Surveyors|Holdings|Group|House|Road|Street|Lane|Close|Avenue|Drive', l):
                return l

    return None

def extract_company(lines, name_index):
    """Look for company name before the surveyor name line."""
    COMPANY_SKIP = re.compile(
        r'HYPERLINK|@|^0[0-9]|^Fax|PI\s+COVER|RICS\s+Member|Member\s+since'
        r'|^Home|^Base|PARTNER|SOLE\s+TRADER|DIRECTOR|^\d{2}/\d{2}|^PAGE',
        re.IGNORECASE
    )
    candidates = []
    for line in lines[max(0, name_index-6):name_index]:
        l = line.strip()
        if not l or COMPANY_SKIP.search(l):
            continue
        if POSTCODE_RE.match(l):
            continue
        if len(l) > 3:
            candidates.append(l)

    # The last non-blank non-skip line before name is likely company
    return candidates[-1] if candidates else None

def extract_address(lines):
    """Find office postcode and work backwards for address."""
    for i, line in enumerate(lines[:30]):
        l = line.strip()
        if POSTCODE_RE.match(l.upper()):
            # Check it doesn't look like a home/base postcode context
            prev = lines[i-1].strip() if i > 0 else ''
            if re.search(r'Home|Base', prev, re.IGNORECASE):
                continue
            # Gather up to 4 address lines above
            addr = []
            for prev_line in lines[max(0, i-5):i]:
                pl = prev_line.strip()
                if pl and not SKIP_LINE_RE.search(pl) and not re.search(r'@|HYPERLINK', pl):
                    addr.append(pl)
            addr.append(l.upper())
            if len(addr) >= 2:
                return addr
    return []

def parse_record(num, block):
    raw_lines = block.split('\n')
    # Remove HYPERLINK lines entirely for name/address parsing
    lines = [clean_hyperlinks(l) for l in raw_lines]

    name_str = extract_name(lines)
    name_idx = 0
    if name_str:
        for i, l in enumerate(lines):
            if name_str in clean_hyperlinks(l):
                name_idx = i
                break

    company_str = extract_company(lines, name_idx) if name_str else None

    # Parse first/last from name
    first_name, last_name = 'Unknown', f'(#{num})'
    if name_str:
        parts = [p for p in name_str.split() if p.lower() not in NAME_WORDS_TO_STRIP]
        if parts:
            first_name = parts[0]
            last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

    addr_lines = extract_address(lines)
    postcode = addr_lines[-1].upper() if addr_lines else None
    town = addr_lines[-2] if len(addr_lines) >= 2 else None
    addr1 = addr_lines[0] if len(addr_lines) >= 3 else None
    addr2 = addr_lines[1] if len(addr_lines) >= 4 else None

    email = extract_email(block)
    mobile = extract_mobile(block)
    office_phone = extract_office_phone(block)
    phone = mobile or office_phone or '—'

    return {
        'surveyor_number': str(num),
        'first_name': first_name,
        'last_name': last_name,
        'company_name': clean(company_str),
        'email': email or f'unknown-{num}@placeholder.invalid',
        'phone': phone,
        'office_address_line_1': clean(addr1),
        'office_address_line_2': clean(addr2),
        'office_town': clean(town),
        'office_postcode': postcode,
        'base_postcode': extract_base_postcode(block),
        'pi_cover_amount': extract_pi_cover(block),
        'rics_number': None,  # stored via qualification field
        'firm_type': extract_firm_type(block),
        'num_partners': extract_num_partners(block),
        'is_active': True,
    }

# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------

async def run():
    with open(DOC_PATH, encoding='utf-8', errors='replace') as f:
        raw = f.read()

    records = split_records(raw)
    print(f"Found {len(records)} records")

    async with AsyncSessionLocal() as db:
        added = 0
        skipped = 0
        for num, block in records:
            existing = (await db.execute(
                select(Surveyor).where(Surveyor.surveyor_number == str(num))
            )).scalar_one_or_none()
            if existing:
                skipped += 1
                continue

            parsed = parse_record(num, block)
            s = Surveyor(**parsed)
            db.add(s)
            added += 1
            if added % 50 == 0:
                await db.commit()
                print(f"  {added} added...")

        await db.commit()
        print(f"\nImport done. Added: {added}, Skipped (exist): {skipped}")

    # Sync work_types + fee_cat from postcode_surveyors
    print("\nSyncing work_types and fee_cat from postcode coverage...")
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("""
            UPDATE surveyors s
            SET
                work_types = p.work_types,
                fee_cat    = p.fee_cat
            FROM (
                SELECT DISTINCT ON (surveyor_number)
                    surveyor_number, work_types, fee_cat
                FROM postcode_surveyors
                WHERE surveyor_number IS NOT NULL
                  AND (work_types IS NOT NULL OR fee_cat IS NOT NULL)
                ORDER BY surveyor_number, id
            ) p
            WHERE s.surveyor_number = p.surveyor_number
        """))
        await db.commit()
        print(f"Synced {result.rowcount} surveyors")

asyncio.run(run())
