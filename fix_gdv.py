import asyncio
from sqlalchemy import text
from core.database import AsyncSessionLocal

async def run():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text("""
            UPDATE postcode_surveyors
            SET work_types = regexp_replace(work_types, 'GDV''?[Ss]?', 'GDV', 'g')
            WHERE work_types ~* 'GDV''?s?'
        """))
        await db.commit()
        print(f'Done - {result.rowcount} rows updated')

asyncio.run(run())
