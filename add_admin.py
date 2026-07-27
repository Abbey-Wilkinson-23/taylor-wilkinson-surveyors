import asyncio
from core.database import AsyncSessionLocal
from models.orm import User, UserRole

async def main():
    async with AsyncSessionLocal() as db:
        user = User(email="abbeywilkinson123@gmail.com", role=UserRole.admin)
        db.add(user)
        await db.commit()
        print("User added!")

asyncio.run(main())
