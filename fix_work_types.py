"""
Rename work types:
  Homebuyers / Homebuyer  → L2
  Building Survey         → L3

Then delete the old work type rows from postcode_work_types.
"""
import asyncio
from sqlalchemy import text
from core.database import AsyncSessionLocal

RENAMES = [
    # (old pattern fragments to match, new name)
    ("Homebuyer",        "L2"),
    ("Building Survey",  "L3"),
]


async def run():
    async with AsyncSessionLocal() as db:
        for old, new in RENAMES:
            # 1. Rename in postcode_surveyors.work_types (CSV field, split on comma or slash)
            result = await db.execute(text(
                "SELECT id, work_types FROM postcode_surveyors WHERE work_types ILIKE :p"
            ), {"p": f"%{old}%"})
            rows = result.fetchall()
            print(f"\n'{old}' → '{new}': {len(rows)} rows")
            for row in rows:
                parts = [p.strip() for p in __import__('re').split(r',|\s*/\s*', row.work_types)]
                fixed_parts = []
                for p in parts:
                    if p.lower().startswith(old.lower()):
                        fixed_parts.append(new)
                    else:
                        fixed_parts.append(p)
                fixed = ', '.join(fixed_parts)
                if fixed != row.work_types:
                    await db.execute(
                        text("UPDATE postcode_surveyors SET work_types = :wt WHERE id = :id"),
                        {"wt": fixed, "id": row.id}
                    )
                    print(f"  [{row.id}] {row.work_types!r} → {fixed!r}")

            # 2. Rename the work type option itself (so it shows as L2/L3 in the UI)
            await db.execute(
                text("UPDATE postcode_work_types SET name = :new WHERE name ILIKE :old"),
                {"new": new, "old": f"%{old}%"}
            )

        await db.commit()
        print("\nDone.")


asyncio.run(run())
