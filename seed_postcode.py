"""
Seed the postcode_surveyors table from the pre-generated JSON data file.
The JSON is generated locally from the Word document via generate_postcode_tool.py
and committed to the repo so Railway can run this without access to Dropbox.
"""
import asyncio
import json
from pathlib import Path

from core.database import AsyncSessionLocal
from models.orm import PostcodeSurveyor
from sqlalchemy import select, delete

SEED_FILE = Path(__file__).parent / "postcode_seed_data.json"


async def seed():
    # Skip if already seeded (non-custom rows exist)
    async with AsyncSessionLocal() as db:
        existing = await db.execute(
            select(PostcodeSurveyor).where(PostcodeSurveyor.is_custom == False).limit(1)
        )
        if existing.scalar_one_or_none() is not None:
            print("postcode_surveyors already seeded — skipping")
            return

    print("Loading seed data…")
    entries = json.loads(SEED_FILE.read_text())
    print(f"Loaded {len(entries)} entries")

    async with AsyncSessionLocal() as db:
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
