import asyncio
import re
from sqlalchemy import text
from core.database import AsyncSessionLocal

async def run():
    async with AsyncSessionLocal() as db:
        # Show exactly what's stored for any row containing GDV
        result = await db.execute(text(
            "SELECT id, name, work_types FROM postcode_surveyors WHERE work_types ILIKE '%gdv%'"
        ))
        rows = result.fetchall()
        print(f'Found {len(rows)} rows with GDV:')
        for row in rows:
            wt = row.work_types
            print(f'  [{row.id}] {row.name}: {wt!r}')
            # Show hex of each char around GDV
            for i, ch in enumerate(wt):
                if ch.upper() == 'G':
                    snippet = wt[i:i+6]
                    print(f'    hex: {[hex(ord(c)) for c in snippet]}')

asyncio.run(run())
