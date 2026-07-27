import asyncio
from core.database import AsyncSessionLocal
from models.orm import User

async def main():
    async with AsyncSessionLocal() as db:
        user = User(email="abbeywilkinson123@gmail.com", is_admin=True)
        db.add(user)
        await db.commit()
        print("User added!")

asyncio.run(main())
