from pydantic import BaseModel
from datetime import datetime


class PostcodeSurveyorOut(BaseModel):
    id:               int
    postcode_area:    str
    name:             str
    surveyor_number:  str | None
    preferred:        str
    coverage:         str
    work_types:       str
    fee_cat:          str
    base_postcode:    str | None
    is_custom:        bool
    created_at:       datetime

    model_config = {"from_attributes": True}


class PostcodeSurveyorCreate(BaseModel):
    postcode_area:   str
    name:            str
    surveyor_number: str | None = None
    preferred:       str = ""
    coverage:        str = ""
    work_types:      str = ""
    fee_cat:         str
    base_postcode:   str | None = None


class PostcodeAreaEntry(BaseModel):
    postcode_area: str
    coverage:      str = ""


class PostcodeSurveyorBulkCreate(BaseModel):
    name:            str
    surveyor_number: str | None = None
    preferred:       str = ""
    work_types:      str = ""
    fee_cat:         str
    base_postcode:   str | None = None
    areas:           list[PostcodeAreaEntry]


class PostcodeSurveyorUpdate(BaseModel):
    postcode_area:   str | None = None
    name:            str | None = None
    surveyor_number: str | None = None
    preferred:       str | None = None
    coverage:        str | None = None
    work_types:      str | None = None
    fee_cat:         str | None = None
    base_postcode:   str | None = None
