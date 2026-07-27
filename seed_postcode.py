"""
Seed the postcode_surveyors table from the Word document.
Run once after applying the migration:
  python seed_postcode.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generate_postcode_tool import parse_doc
from core.database import AsyncSessionLocal
from models.orm import PostcodeSurveyor
from sqlalchemy import select, delete


async def seed():
    print("Parsing Word document…")
    entries = parse_doc()
    print(f"Parsed {len(entries)} entries")

    async with AsyncSessionLocal() as db:
        # Clear existing non-custom rows so re-running is safe
        await db.execute(delete(PostcodeSurveyor).where(PostcodeSurveyor.is_custom == False))
        await db.flush()

        rows = [
            PostcodeSurveyor(
                postcode_area=e["postcode_area"],
                name=e["name"],
                preferred=e["preferred"],
                coverage=e["coverage"],
                work_types=e["work_types"],
                fee_cat=e["fee_cat"],
                is_custom=False,
            )
            for e in entries
        ]
        db.add_all(rows)
        await db.commit()
        print(f"Seeded {len(rows)} rows into postcode_surveyors")


if __name__ == "__main__":
    asyncio.run(seed())
