import asyncio
from sqlalchemy import text
from core.database import AsyncSessionLocal


async def run():
    async with AsyncSessionLocal() as db:
        for firm, pattern in [
            ("Graham & Sibbald", "%graham%sibbald%"),
            ("DM Hall",          "%dm hall%"),
        ]:
            result = await db.execute(text(
                "SELECT id, name, fee_cat FROM postcode_surveyors WHERE LOWER(name) LIKE :p"
            ), {"p": pattern})
            rows = result.fetchall()
            print(f"\n{firm}: {len(rows)} rows")
            for row in rows:
                if row.fee_cat != "Quotable":
                    await db.execute(text(
                        "UPDATE postcode_surveyors SET fee_cat = 'Quotable' WHERE id = :id"
                    ), {"id": row.id})
                    print(f"  [{row.id}] {row.name!r}: {row.fee_cat!r} → 'Quotable'")
                else:
                    print(f"  [{row.id}] {row.name!r}: already Quotable")

        await db.commit()
        print("\nDone.")


asyncio.run(run())
