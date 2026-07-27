from pydantic import BaseModel
from datetime import datetime


class ClientContactOut(BaseModel):
    id:         int
    name:       str
    email:      str | None
    phone:      str | None
    role:       str | None
    is_primary: bool

    model_config = {"from_attributes": True}


class ClientContactCreate(BaseModel):
    name:       str
    email:      str | None = None
    phone:      str | None = None
    role:       str | None = None
    is_primary: bool = False


class ClientOut(BaseModel):
    id:             int
    company_name:   str
    type:           str
    email:          str | None
    phone:          str | None
    address_line_1: str | None
    address_line_2: str | None
    town:           str | None
    county:         str | None
    postcode:       str | None
    notes:          str | None
    is_active:      bool
    contacts:       list[ClientContactOut] = []

    model_config = {"from_attributes": True}


class ClientCreate(BaseModel):
    company_name:   str
    type:           str   # lender | broker | both
    email:          str | None = None
    phone:          str | None = None
    address_line_1: str | None = None
    address_line_2: str | None = None
    town:           str | None = None
    county:         str | None = None
    postcode:       str | None = None
    notes:          str | None = None


class ClientUpdate(BaseModel):
    company_name:   str | None = None
    type:           str | None = None
    email:          str | None = None
    phone:          str | None = None
    address_line_1: str | None = None
    address_line_2: str | None = None
    town:           str | None = None
    county:         str | None = None
    postcode:       str | None = None
    notes:          str | None = None
