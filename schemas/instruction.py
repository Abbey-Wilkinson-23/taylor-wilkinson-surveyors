from __future__ import annotations
from pydantic import BaseModel
from datetime import date, datetime
from decimal import Decimal
from models.orm import InstructionStatus
from schemas.client import ClientOut, ClientContactOut
from schemas.surveyor import SurveyorOut, SurveyTypeOut


# ---------------------------------------------------------------------------
# Property (embedded in instruction create/out)
# ---------------------------------------------------------------------------

class PropertyCreate(BaseModel):
    address_line_1: str
    address_line_2: str | None = None
    town:           str
    county:         str | None = None
    postcode:       str
    property_type:  str | None = None   # house | flat | bungalow | maisonette | commercial | other
    tenure:         str | None = None   # freehold | leasehold | unknown
    num_bedrooms:   int | None = None


class PropertyOut(BaseModel):
    id:             int
    address_line_1: str
    address_line_2: str | None
    town:           str
    county:         str | None
    postcode:       str
    outward_code:   str | None
    property_type:  str | None
    tenure:         str | None
    num_bedrooms:   int | None

    model_config = {"from_attributes": True}

    @property
    def full_address(self) -> str:
        parts = [
            self.address_line_1,
            self.address_line_2,
            self.town,
            self.county,
            self.postcode,
        ]
        return ", ".join(p for p in parts if p)


# ---------------------------------------------------------------------------
# Status history
# ---------------------------------------------------------------------------

class StatusHistoryOut(BaseModel):
    id:         int
    old_status: InstructionStatus | None
    new_status: InstructionStatus
    changed_by: str
    notes:      str | None
    changed_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Instruction create / update
# ---------------------------------------------------------------------------

class InstructionCreate(BaseModel):
    client_id:              int
    contact_id:             int | None = None
    survey_type_id:         int
    property:               PropertyCreate
    client_ref:             str | None = None
    borrower_name:          str | None = None
    borrower_phone:         str | None = None
    borrower_email:         str | None = None
    assigned_surveyor_id:   int | None = None
    agreed_client_fee:      Decimal | None = None
    agreed_surveyor_fee:    Decimal | None = None
    inspection_date:        date | None = None
    report_due_date:        date | None = None
    priority:               str = "standard"
    notes:                  str | None = None


class PropertyUpdate(BaseModel):
    property_type: str | None = None
    tenure:        str | None = None
    num_bedrooms:  int | None = None


class InstructionUpdate(BaseModel):
    """All fields optional — only provided fields are updated."""
    contact_id:             int | None = None
    survey_type_id:         int | None = None
    client_ref:             str | None = None
    borrower_name:          str | None = None
    borrower_phone:         str | None = None
    borrower_email:         str | None = None
    assigned_surveyor_id:   int | None = None
    agreed_client_fee:      Decimal | None = None
    agreed_surveyor_fee:    Decimal | None = None
    inspection_date:        date | None = None
    report_due_date:        date | None = None
    report_received_at:     datetime | None = None
    priority:               str | None = None
    notes:                  str | None = None


class StatusTransitionRequest(BaseModel):
    new_status: InstructionStatus
    changed_by: str
    notes:      str | None = None


# ---------------------------------------------------------------------------
# Instruction out (full response shape)
# ---------------------------------------------------------------------------

class InstructionOut(BaseModel):
    id:                     int
    our_ref:                str
    client_ref:             str | None
    client_id:              int
    contact_id:             int | None
    property_id:            int
    survey_type_id:         int
    borrower_name:          str | None
    borrower_phone:         str | None
    borrower_email:         str | None
    assigned_surveyor_id:   int | None
    agreed_client_fee:      Decimal | None
    agreed_surveyor_fee:    Decimal | None
    status:                 InstructionStatus
    received_at:            datetime
    inspection_date:        date | None
    report_due_date:        date | None
    report_received_at:     datetime | None
    invoiced_at:            datetime | None
    completed_at:           datetime | None
    priority:               str
    notes:                  str | None
    updated_at:             datetime

    # Nested objects
    client:             ClientOut | None = None
    contact:            ClientContactOut | None = None
    property:           PropertyOut | None = None
    survey_type:        SurveyTypeOut | None = None
    assigned_surveyor:  SurveyorOut | None = None
    status_history:     list[StatusHistoryOut] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Summary shape (for list view — lighter than full InstructionOut)
# ---------------------------------------------------------------------------

class InstructionSummary(BaseModel):
    id:                      int
    our_ref:                 str
    client_ref:              str | None
    borrower_name:           str | None
    status:                  InstructionStatus
    priority:                str
    received_at:             datetime
    inspection_date:         date | None
    report_due_date:         date | None = None
    client_name:             str | None = None
    survey_type_name:        str | None = None
    surveyor_name:           str | None = None
    property_address_line_1: str | None = None
    property_postcode:       str | None = None
    agreed_client_fee:       Decimal | None = None
    agreed_surveyor_fee:     Decimal | None = None

    model_config = {"from_attributes": True}
