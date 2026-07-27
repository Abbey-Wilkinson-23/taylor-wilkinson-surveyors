from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from core.database import get_db
from models.orm import Client, ClientContact
from schemas.client import ClientCreate, ClientUpdate, ClientOut, ClientContactCreate, ClientContactOut

router = APIRouter(prefix="/clients", tags=["clients"])


@router.post("/", response_model=ClientOut, status_code=201)
async def create_client(payload: ClientCreate, db: AsyncSession = Depends(get_db)):
    client = Client(**payload.model_dump())
    db.add(client)
    await db.commit()
    result = await db.execute(
        select(Client).where(Client.id == client.id).options(selectinload(Client.contacts))
    )
    return result.scalar_one()


@router.get("/", response_model=list[ClientOut])
async def list_clients(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    query = select(Client).options(selectinload(Client.contacts))
    if active_only:
        query = query.where(Client.is_active == True)
    result = await db.execute(query.order_by(Client.company_name))
    return result.scalars().all()


@router.get("/{id}", response_model=ClientOut)
async def get_client(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Client).where(Client.id == id).options(selectinload(Client.contacts))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    return client


@router.patch("/{id}", response_model=ClientOut)
async def update_client(
    id: int,
    payload: ClientUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Client).where(Client.id == id).options(selectinload(Client.contacts))
    )
    client = result.scalar_one_or_none()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(client, field, value)
    await db.commit()
    result = await db.execute(
        select(Client).where(Client.id == id).options(selectinload(Client.contacts))
    )
    return result.scalar_one()


@router.delete("/{id}", status_code=204)
async def delete_client(id: int, db: AsyncSession = Depends(get_db)):
    client = await db.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.is_active = False
    await db.commit()


@router.post("/{id}/restore", response_model=ClientOut)
async def restore_client(id: int, db: AsyncSession = Depends(get_db)):
    client = await db.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    client.is_active = True
    await db.commit()
    result = await db.execute(
        select(Client).where(Client.id == id).options(selectinload(Client.contacts))
    )
    return result.scalar_one()


@router.post("/{id}/contacts", response_model=ClientContactOut, status_code=201)
async def add_contact(
    id: int,
    payload: ClientContactCreate,
    db: AsyncSession = Depends(get_db),
):
    client = await db.get(Client, id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    contact = ClientContact(client_id=id, **payload.model_dump())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact
