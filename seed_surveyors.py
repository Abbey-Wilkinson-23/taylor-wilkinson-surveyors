#!/usr/bin/env python3
"""
Seed surveyor data from the TWS members document (plain text export).
Usage: python seed_surveyors.py [--dry-run]
"""
import re
import sys
import httpx

BASE = "http://localhost:8000"
DOC_PATH = "/Users/abbeywilkinson./Dropbox/MEMBERS/MEMBERS OFFICE DETAILS 1 - 500 - MAR 22.doc"
TXT_PATH = "/Users/abbeywilkinson./.claude/projects/-Users-abbeywilkinson--dev/5785d1da-1366-4624-876f-0138dc577267/tool-results/b2m9llwhw.txt"


# ---------------------------------------------------------------------------
# Postcode helpers
# ---------------------------------------------------------------------------

def expand_postcodes(text: str) -> list[str]:
    """Extract and expand all outward postcode codes from a text block."""
    results = set()

    # Normalise separators
    text = text.replace("–", "-").replace("—", "-").replace(";", ",")

    # Find all "LETTERS NUMBERS" groups (possibly with ranges)
    # Pattern: letter(s) optionally space then digits, optionally -digits
    token_re = re.compile(r'\b([A-Z]{1,2})\s*(\d{1,2})\s*(?:-\s*(\d{1,2}))?', re.I)

    for m in token_re.finditer(text):
        prefix = m.group(1).upper()
        lo = int(m.group(2))
        hi = int(m.group(3)) if m.group(3) else lo
        if hi < lo:
            hi = lo  # malformed range
        for n in range(lo, hi + 1):
            results.add(f"{prefix}{n}")

    return sorted(results)


def classify_band(line: str) -> str | None:
    """
    Return the distance band for a heading line, or None if not a band heading.
    '15'  = within 15 miles
    '25'  = within 25 miles (over 15), or WITHIN 15-25 MILES, or OVER 25 MILES / CHECK DISTANCE
    """
    lu = line.strip().upper()
    # WITHIN 15 MILES (but not 15-25)
    if re.search(r'WITHIN\s+15\s+MILES?', lu) and '15-25' not in lu and '15 - 25' not in lu:
        return '15'
    # WITHIN 15-25 MILES → these are the further ones
    if re.search(r'WITHIN\s+15\s*[-–]\s*25\s+MILES?', lu):
        return '25'
    # WITHIN 25 MILES (may be only section — default to '15' since it's their primary range)
    if re.search(r'WITHIN\s+25\s+MILES?', lu):
        return '15'
    # WITHIN 30 MILES — treat as primary (15 band)
    if re.search(r'WITHIN\s+\d+\s+MILES?', lu):
        return '15'
    # OVER 25 MILES / CHECK DISTANCE → further band
    if re.search(r'OVER\s+25|CHECK\s+DISTANCE', lu):
        return '25'
    return None


def extract_postcode_section(block: str) -> list[dict]:
    """
    Find postcode coverage lines in an entry block, tracking distance bands.
    Returns list of {code, distance_band} dicts.
    """
    entries: list[dict] = []
    lines = block.splitlines()

    in_coverage = False
    current_band = '15'  # default

    for line in lines:
        ls = line.strip()
        lu = ls.upper()

        # Check if this line is a band heading
        band = classify_band(ls)
        if band is not None:
            in_coverage = True
            current_band = band
            # Also parse anything on the same line after the heading
            # (some entries jam postcodes onto the heading line)
            heading_re = re.sub(
                r'WITHIN\s+[\d\s\-–]+MILES?|OVER\s+25\s+MILES?|CHECK\s+DISTANCE',
                '', lu, flags=re.I
            ).strip()
            if heading_re:
                for code in expand_postcodes(heading_re):
                    entries.append({'code': code, 'distance_band': current_band})
            continue

        if in_coverage:
            if not ls:
                continue
            # Lines that signal we've left the postcode section entirely
            if re.search(
                r'^(MIN\s|NO\s[A-Z]|HOMEBUYER|BUILDING|COMMERCIAL|RESIDENTIAL|'
                r'STRUCTURAL|SCHEDULE|RENT\s|GDV|HMO|QUOTABL|SURVEY|'
                r'INDUSTRIAL|FARM|RATING|WILL\s|DOES\s|AND\s|AS\s+FROM|'
                r'NOTE|CARE\s|COPY\s|PLEASE\s|SEE\s)',
                lu
            ):
                in_coverage = False
                continue
            parsed = expand_postcodes(ls)
            for code in parsed:
                entries.append({'code': code, 'distance_band': current_band})

    # De-duplicate — first occurrence wins (preserves band info)
    seen: set[str] = set()
    unique = []
    for e in entries:
        if e['code'] not in seen:
            seen.add(e['code'])
            unique.append(e)
    return unique


# ---------------------------------------------------------------------------
# Field extractors
# ---------------------------------------------------------------------------

def extract_email(block: str) -> str | None:
    # HYPERLINK "mailto:x"
    m = re.search(r'HYPERLINK\s+"mailto:([^"]+)"', block)
    if m:
        return m.group(1).strip().lower()
    # Bare email
    m = re.search(r'[\w.+-]+@[\w.-]+\.[a-z]{2,}', block, re.I)
    if m:
        return m.group(0).strip().lower()
    return None


def extract_phones(block: str) -> tuple[str | None, str | None]:
    """Return (work_phone, mobile)."""
    # Find mobiles (07xxx)
    mobiles = re.findall(r'\b(07\d{3}[\s\d]{6,9})\b', block)
    mobile = re.sub(r'\s+', ' ', mobiles[0]).strip() if mobiles else None

    # Find landlines (01xxx, 02xxx, 03xxx)
    landlines = re.findall(r'\b(0[123]\d[\d\s]{7,11})\b', block)
    # Filter out fax lines
    landline = None
    for ll in landlines:
        # Skip if "Fax" appears right before it on the same line
        context = block[max(0, block.find(ll.strip()[:6]) - 10):block.find(ll.strip()[:6]) + 5]
        if 'fax' not in context.lower():
            landline = re.sub(r'\s+', ' ', ll).strip()
            break

    return landline, mobile


def extract_pi_cover(block: str) -> float | None:
    m = re.search(r'PI\s*COVER[^\n]*\n?\s*£([\d.]+)\s*([MK]?)', block, re.I)
    if not m:
        m = re.search(r'PI\s*COVER\s*£([\d.]+)\s*([MK]?)', block, re.I)
    if not m:
        # Look for "£XM" pattern anywhere near PI
        m = re.search(r'£([\d.]+)\s*([MKmk])', block)
    if not m:
        return None
    val = float(m.group(1))
    unit = m.group(2).upper()
    if unit == 'M':
        val *= 1_000_000
    elif unit == 'K':
        val *= 1_000
    return val


def extract_name_and_rics(block: str) -> tuple[str, str, str | None]:
    """Return (first_name, last_name, rics_number)."""
    # Look for lines with FRICS/MRICS/AssocRICS
    m = re.search(
        r'([A-Z][a-z]+(?:\s+[A-Z][a-z\'-]+)+)\s+(F|M|Assoc)\s*RICS',
        block
    )
    if m:
        name_parts = m.group(1).split()
        rics = m.group(2) + "RICS"
        return name_parts[0], " ".join(name_parts[1:]), rics

    # Name on own line followed by RICS on next
    lines = block.splitlines()
    for i, line in enumerate(lines):
        ls = line.strip()
        if re.match(r'^(F|M|Assoc)\s*RICS$', ls, re.I) and i > 0:
            prev = lines[i - 1].strip()
            parts = prev.split()
            if 2 <= len(parts) <= 4 and prev[0].isupper() and not any(
                kw in prev.upper() for kw in ['HYPERLINK', 'PARTNER', 'DIRECTOR', 'BSC', 'CEng']
            ):
                return parts[0], " ".join(parts[1:]), re.sub(r'\s+', '', ls)

    # AssocRICS on separate line
    for i, line in enumerate(lines):
        ls = line.strip()
        if re.match(r'^AssocRICS$', ls, re.I) and i > 0:
            prev = lines[i - 1].strip()
            parts = prev.split()
            if 2 <= len(parts) <= 4 and prev[0].isupper():
                return parts[0], " ".join(parts[1:]), "AssocRICS"

    return "", "", None


def extract_firm_info(block: str) -> tuple[str | None, str | None, int | None]:
    """Return (company_name, firm_type, num_partners)."""
    m = re.search(r'(\d+)\s*(?:PARTNER|DIRECTOR)S?', block, re.I)
    num = int(m.group(1)) if m else None

    lines = block.splitlines()

    # Company name: ALL-CAPS line that looks like a firm name
    company = None
    for line in lines[:30]:
        ls = line.strip()
        if not ls or len(ls) < 4:
            continue
        if ls == ls.upper() and re.search(r'[A-Z]{3}', ls):
            # Skip obvious non-company lines
            if any(kw in ls for kw in [
                'PARTNER', 'DIRECTOR', 'SOLE TRADER', 'HYPERLINK', 'HOME',
                'POSTCODE', 'RICS', 'COVER', 'MILE', 'WITHIN', 'FAX',
                'HEAD OFFICE', 'LOCATION', 'SURVEYOR', 'CONTACT', 'TYPE OF',
                'POST CODE',
            ]):
                continue
            # Skip pure numbers, dates, cross-references
            if re.match(r'^[\d\s/,\-&.]+$', ls):
                continue
            # Skip lines that start with digits mixed with letters (cross-refs jammed together)
            if re.match(r'^\d', ls):
                continue
            # Skip location/area names (single word, no spaces needed but check length)
            # Company names usually have multiple words OR known suffixes
            has_company_indicator = any(kw in ls for kw in [
                ' & ', ' AND ', 'LTD', 'LLP', 'HALL', 'PARK', 'GROUP', 'HOUSE',
                'PROPERTY', 'CONSULT', 'CHARTERED', 'DILLON', 'SMITH', 'ROBERTS',
                'HUNT', 'BRANKIN', 'LEVENE', 'WATT', 'COPELAND', 'GRAHAM',
            ])
            if not has_company_indicator and ' ' not in ls:
                continue  # single-word location name, skip
            company = ls.title()
            break

    # Firm type
    block_u = block.upper()
    if 'LTD' in block_u or 'LIMITED' in block_u or 'LLP' in block_u:
        firm_type = 'limited_company'
    elif num and num >= 2:
        firm_type = 'partnership'
    elif 'SOLE TRADER' in block_u or num == 1:
        firm_type = 'sole_trader'
    else:
        firm_type = None

    return company, firm_type, num


def extract_address(block: str) -> dict:
    """Extract office address fields."""
    lines = block.splitlines()
    # Find a full postcode line (e.g. "SA9 1NT") — office postcode
    postcode = None
    postcode_idx = None
    for i, line in enumerate(lines[:40]):
        ls = line.strip()
        # Full postcode pattern (not home postcode context)
        context_before = " ".join(l.strip() for l in lines[max(0,i-2):i]).upper()
        if re.match(r'^[A-Z]{1,2}\d{1,2}[A-Z]?\s+\d[A-Z]{2}$', ls, re.I):
            if 'HOME' not in context_before and 'MUM' not in context_before:
                postcode = ls.upper()
                postcode_idx = i
                break

    if postcode_idx is None:
        return {'office_postcode': None, 'office_address_line_1': None,
                'office_address_line_2': None, 'office_town': None, 'office_county': None}

    # Address is the 3-5 lines before the postcode
    addr_lines = []
    for line in lines[max(0, postcode_idx - 6):postcode_idx]:
        ls = line.strip()
        if not ls:
            continue
        lu = ls.upper()
        # Skip lines that are clearly not address
        if any(kw in lu for kw in [
            'PARTNER', 'DIRECTOR', 'HYPERLINK', 'HEAD OFFICE',
            'SOLE TRADER', 'RICS', '&', 'OFFICE'
        ]):
            continue
        if re.match(r'^\d{1,3}$', ls):  # bare entry number
            continue
        if re.match(r'^[\d\s/,\-&.]+$', ls):  # date/number only
            continue
        addr_lines.append(ls)

    result = {'office_postcode': postcode}
    if len(addr_lines) >= 3:
        result['office_address_line_1'] = addr_lines[-3]
        result['office_address_line_2'] = addr_lines[-2] if len(addr_lines) > 3 else None
        result['office_town'] = addr_lines[-2] if len(addr_lines) == 3 else addr_lines[-1]
        result['office_county'] = addr_lines[-1] if len(addr_lines) >= 4 else None
        if len(addr_lines) >= 4:
            result['office_address_line_1'] = addr_lines[0]
            result['office_address_line_2'] = addr_lines[1] if len(addr_lines) > 4 else None
            result['office_town'] = addr_lines[-2]
            result['office_county'] = addr_lines[-1]
    elif len(addr_lines) == 2:
        result['office_address_line_1'] = addr_lines[0]
        result['office_address_line_2'] = None
        result['office_town'] = addr_lines[1]
        result['office_county'] = None
    elif len(addr_lines) == 1:
        result['office_address_line_1'] = addr_lines[0]
        result['office_address_line_2'] = None
        result['office_town'] = None
        result['office_county'] = None
    else:
        result.update({'office_address_line_1': None, 'office_address_line_2': None,
                       'office_town': None, 'office_county': None})

    return result


def is_inactive(block: str) -> bool:
    markers = [
        'NO LONGER ACTIVE', 'RETIRED', 'DECEASED', 'HAS LEFT', 'HAVE LEFT',
        'SEMI-RETIRED', 'LEFT THE PANEL', 'REMOVED FROM', 'DO NOT USE',
        'GONE', 'CANCELLED', 'NOT AVAILABLE', 'CEASED TRADING',
    ]
    bu = block.upper()
    for m in markers:
        if m in bu:
            return True
    return False


def extract_notes(block: str) -> str | None:
    """Collect key notes: exclusions, min fees, special instructions."""
    note_lines = []
    seen = set()
    for line in block.splitlines():
        ls = line.strip()
        lu = ls.upper()
        if not ls or len(ls) < 5:
            continue
        # Skip HYPERLINK lines
        if 'HYPERLINK' in ls:
            continue
        # Capture lines with key note indicators
        triggers = [
            'NO ', 'DO NOT USE', 'MIN FEE', 'MIN ', 'CARE –', 'CARE -',
            'ONLY WORKS', 'QUOTABLE', 'QUOTEABLE', 'SEMI-RETIRED',
            'NOTE:', 'COPY IN', 'COUNTERSIGNATURE', 'LAST RESORT',
            'DON\'T USE', 'DONT USE',
        ]
        for t in triggers:
            if lu.startswith(t) or (t in lu and len(ls) < 120):
                if ls not in seen:
                    seen.add(ls)
                    note_lines.append(ls)
                break

    return '; '.join(note_lines) if note_lines else None


# ---------------------------------------------------------------------------
# Entry splitter
# ---------------------------------------------------------------------------

def split_entries(text: str) -> dict[str, str]:
    """
    Split the document into {surveyor_number: block_text} entries.
    Handles entries that start with a bare number on its own line.
    """
    lines = text.splitlines()
    entries: dict[str, str] = {}
    current_num = None
    current_lines: list[str] = []

    for i, line in enumerate(lines):
        stripped = line.strip()
        # A new entry starts when we see a line that is just a number 2-500
        # (possibly with leading/trailing whitespace only)
        if re.match(r'^\d{1,3}$', stripped):
            num = int(stripped)
            if 2 <= num <= 500:
                # Save previous
                if current_num is not None and current_lines:
                    block = '\n'.join(current_lines)
                    # Only save if not already saved (avoid duplicates from cross-refs)
                    if current_num not in entries:
                        entries[current_num] = block
                current_num = str(num)
                current_lines = [line]
                continue

        if current_num is not None:
            current_lines.append(line)

    # Save last
    if current_num is not None and current_lines and current_num not in entries:
        entries[current_num] = '\n'.join(current_lines)

    return entries


# ---------------------------------------------------------------------------
# Main parser
# ---------------------------------------------------------------------------

def parse_all(text: str) -> list[dict]:
    entries = split_entries(text)
    surveyors = []

    for num, block in sorted(entries.items(), key=lambda x: int(x[0])):
        first, last, rics = extract_name_and_rics(block)
        if not first or not last:
            # Can't identify a person — skip (likely a cross-reference block)
            continue

        company, firm_type, num_partners = extract_firm_info(block)
        addr = extract_address(block)
        email = extract_email(block)
        phone, mobile = extract_phones(block)
        pi = extract_pi_cover(block)
        notes = extract_notes(block)
        coverage = extract_postcode_section(block)
        active = not is_inactive(block)

        surveyors.append({
            'surveyor_number': num,
            'first_name': first,
            'last_name': last,
            'company_name': company,
            'email': email,
            'phone': phone,
            'personal_phone': mobile,
            'rics_number': rics,
            'pi_cover_amount': pi,
            **addr,
            'firm_type': firm_type,
            'num_partners': num_partners,
            'notes': notes,
            'is_active': active,
            'coverage': coverage,
        })

    return surveyors


# ---------------------------------------------------------------------------
# Seed API
# ---------------------------------------------------------------------------

def seed(surveyors: list[dict], dry_run: bool = False):
    print(f"Found {len(surveyors)} surveyors to import.")
    if dry_run:
        for s in surveyors:
            status = 'INACTIVE' if not s['is_active'] else 'active'
            n15 = sum(1 for c in s['coverage'] if c['distance_band'] == '15')
            n25 = sum(1 for c in s['coverage'] if c['distance_band'] == '25')
            print(f"  [{status}] #{s['surveyor_number']} {s['first_name']} {s['last_name']} "
                  f"({s['company_name']}) — {n15} ×15mi, {n25} ×25mi")
        return

    client = httpx.Client(base_url=BASE, timeout=30)
    ok = fail = 0

    for s in surveyors:
        is_active = s.pop('is_active')
        coverage = s.pop('coverage')

        # Remove None email/phone — API requires them
        payload = {k: v for k, v in s.items() if v is not None or k in ('email', 'phone')}
        if not payload.get('email'):
            payload['email'] = f"unknown{s['surveyor_number']}@placeholder.tws"
        if not payload.get('phone'):
            payload['phone'] = 'N/A'

        resp = client.post('/surveyors/', json=payload)
        if resp.status_code != 201:
            print(f"  [FAIL] #{s['surveyor_number']} {s['first_name']} {s['last_name']}: {resp.status_code} {resp.text[:150]}")
            fail += 1
            continue

        sid = resp.json()['id']
        print(f"  [OK]  #{s['surveyor_number']} {s['first_name']} {s['last_name']} -> id={sid}"
              + (' (INACTIVE)' if not is_active else ''))
        ok += 1

        if not is_active:
            client.delete(f'/surveyors/{sid}')

        if coverage:
            cov = client.put(f'/surveyors/{sid}/coverage', json={'coverage': coverage})
            if cov.status_code != 200:
                print(f"         coverage failed: {cov.text[:100]}")

    print(f"\nDone — {ok} created, {fail} failed.")
    client.close()


if __name__ == '__main__':
    dry_run = '--dry-run' in sys.argv

    text = open(TXT_PATH, encoding='utf-8', errors='replace').read()
    surveyors = parse_all(text)
    seed(surveyors, dry_run=dry_run)
