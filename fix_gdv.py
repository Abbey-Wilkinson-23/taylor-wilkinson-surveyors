import asyncio
import re
from sqlalchemy import text
from core.database import AsyncSessionLocal

# Matches GDV or HMO (case-insensitive) optionally followed by curly or straight apostrophe + optional s/S
GDV_PATTERN = re.compile(r"GDV[\u2019']?[Ss]?", re.IGNORECASE)
HMO_PATTERN = re.compile(r"HMO[\u2019']?[Ss]?", re.IGNORECASE)


def normalise_work_types(work_types: str) -> str:
    """Split on comma or slash, normalise GDV/HMO tokens, rejoin with ', '."""
    parts = re.split(r',\s*|\s*/\s*', work_types)
    normalised = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        part = GDV_PATTERN.sub("GDV", part)
        part = HMO_PATTERN.sub("HMO", part)
        normalised.append(part)
    return ", ".join(normalised)


async def run():
    async with AsyncSessionLocal() as db:
        # Fetch all rows that contain any GDV or HMO variant
        result = await db.execute(text(
            "SELECT id, work_types FROM postcode_surveyors WHERE work_types ~* 'GDV' OR work_types ~* 'HMO'"
        ))
        rows = result.fetchall()
        print(f"Found {len(rows)} rows with GDV variants")

        updated = 0
        for row in rows:
            original = row.work_types
            fixed = normalise_work_types(original)
            if fixed != original:
                await db.execute(
                    text("UPDATE postcode_surveyors SET work_types = :wt WHERE id = :id"),
                    {"wt": fixed, "id": row.id}
                )
                print(f"  [{row.id}] {original!r} → {fixed!r}")
                updated += 1

        await db.commit()
        print(f"\nDone. Updated {updated} rows.")


asyncio.run(run())
