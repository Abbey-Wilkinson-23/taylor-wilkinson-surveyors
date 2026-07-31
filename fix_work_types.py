"""
Rename work type tokens in postcode_surveyors.work_types:
  Homebuyers / Homebuyer  → L2  (exact token match only)
  Building Survey         → L3  (exact token match only)

Then delete the old work type options from postcode_work_types
(L2 and L3 already exist, so we just remove the old names).
"""
import asyncio
import re
from sqlalchemy import text
from core.database import AsyncSessionLocal

RENAMES = [
    (re.compile(r'^Homebuyers?$', re.IGNORECASE), "L2", "%Homebuyer%"),
    (re.compile(r'^Building Survey$', re.IGNORECASE), "L3", "%Building Survey%"),
]


async def run():
    async with AsyncSessionLocal() as db:
        # 1. Fetch all rows once
        result = await db.execute(text("SELECT id, work_types FROM postcode_surveyors"))
        rows = result.fetchall()

        for token_pattern, new, option_pattern in RENAMES:
            updated = 0
            for row in rows:
                parts = [p.strip() for p in re.split(r',\s*|\s*/\s*', row.work_types)]
                fixed_parts = [new if token_pattern.match(p) else p for p in parts]
                fixed = ', '.join(p for p in fixed_parts if p)
                if fixed != row.work_types:
                    await db.execute(
                        text("UPDATE postcode_surveyors SET work_types = :wt WHERE id = :id"),
                        {"wt": fixed, "id": row.id}
                    )
                    print(f"  [{row.id}] {row.work_types!r} → {fixed!r}")
                    updated += 1
            print(f"'{new}': {updated} rows updated in postcode_surveyors")

            # 2. Delete the old option — L2/L3 already exist so no need to rename
            res = await db.execute(
                text("DELETE FROM postcode_work_types WHERE name ILIKE :p RETURNING name"),
                {"p": option_pattern}
            )
            deleted = [r.name for r in res.fetchall()]
            if deleted:
                print(f"  Deleted old option(s): {deleted}")
            else:
                print(f"  No old option found matching {option_pattern!r} (already cleaned up?)")

        await db.commit()
        print("\nDone.")


asyncio.run(run())
