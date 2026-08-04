from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field, model_validator


# ---------------------------------------------------------------------------
# Surveyor list / basic output (no relationship data)
# ---------------------------------------------------------------------------

class SurveyorOut(BaseModel):
    id:                   int
    surveyor_number:      str | None
    first_name:           str
    last_name:            str
    company_name:         str | None
    email:                str
    phone:                str
    personal_phone:       str | None
    qualification:        str | None = None
    pi_cover_amount:      Decimal | None
    pi_expiry_date:       date | None = None
    firm_type:            str | None
    is_active:            bool
    coverage:             list[dict] = []

    model_config = {"from_attributes": True, "populate_by_name": True}

    @model_validator(mode='before')
    @classmethod
    def extract_fields(cls, obj):
        if isinstance(obj, dict):
            return obj
        data = {f: getattr(obj, f, None) for f in [
            'id', 'surveyor_number', 'first_name', 'last_name', 'company_name',
            'email', 'phone', 'personal_phone', 'pi_cover_amount', 'pi_expiry_date', 'firm_type', 'is_active',
        ]}
        data['qualification'] = getattr(obj, 'rics_number', None)
        cov = getattr(obj, 'coverage', None) or []
        data['coverage'] = [{'code': c.outward_code, 'distance_band': c.distance_band} for c in cov]
        return data


# ---------------------------------------------------------------------------
# Surveyor detail (single fetch with relationship data)
# ---------------------------------------------------------------------------

class SurveyorDetail(BaseModel):
    id:                   int
    surveyor_number:      str | None
    first_name:           str
    last_name:            str
    company_name:         str | None
    email:                str
    phone:                str
    personal_phone:       str | None
    qualification:        str | None
    pi_cover_amount:      Decimal | None
    pi_expiry_date:       date | None
    office_address_line_1: str | None
    office_address_line_2: str | None
    office_town:          str | None
    office_county:        str | None
    office_postcode:      str | None
    base_postcode:        str | None
    work_types:           str | None
    fee_cat:              str | None
    firm_type:            str | None
    num_partners:         int | None
    notes:                str | None
    is_active:            bool
    # Relationship summaries
    coverage:             list[dict]
    excluded_client_ids:         list[int]
    excluded_client_names:       list[str]

    model_config = {"from_attributes": True}

    @model_validator(mode='before')
    @classmethod
    def expand_relationships(cls, obj):
        if isinstance(obj, dict):
            return obj
        flat_fields = [
            'id', 'surveyor_number', 'first_name', 'last_name', 'company_name',
            'email', 'phone', 'personal_phone', 'pi_cover_amount', 'pi_expiry_date',
            'office_address_line_1', 'office_address_line_2', 'office_town',
            'office_county', 'office_postcode', 'base_postcode', 'work_types', 'fee_cat', 'firm_type', 'num_partners',
            'notes', 'is_active',
        ]
        data = {f: getattr(obj, f, None) for f in flat_fields}
        data['qualification'] = getattr(obj, 'rics_number', None)
        cov = getattr(obj, 'coverage', None) or []
        excls = getattr(obj, 'client_exclusions', None) or []
        data['coverage'] = [{'code': c.outward_code, 'distance_band': c.distance_band} for c in cov]
        data['excluded_client_ids'] = [e.client_id for e in excls]
        data['excluded_client_names'] = [
            e.client.company_name for e in excls if e.client
        ]
        return data


# ---------------------------------------------------------------------------
# Create / Update
# ---------------------------------------------------------------------------

class SurveyorCreate(BaseModel):
    surveyor_number:      str | None = None
    first_name:           str
    last_name:            str
    company_name:         str | None = None
    email:                str
    phone:                str
    personal_phone:       str | None = None
    qualification:        str | None = None
    pi_cover_amount:      Decimal | None = None
    pi_expiry_date:       date | None = None
    office_address_line_1: str | None = None
    office_address_line_2: str | None = None
    office_town:          str | None = None
    office_county:        str | None = None
    office_postcode:      str | None = None
    base_postcode:        str | None = None
    work_types:           str | None = None
    fee_cat:              str | None = None
    firm_type:            str | None = None
    num_partners:         int | None = None
    notes:                str | None = None


class SurveyorUpdate(BaseModel):
    surveyor_number:      str | None = None
    first_name:           str | None = None
    last_name:            str | None = None
    company_name:         str | None = None
    email:                str | None = None
    phone:                str | None = None
    personal_phone:       str | None = None
    qualification:        str | None = None
    pi_cover_amount:      Decimal | None = None
    pi_expiry_date:       date | None = None
    office_address_line_1: str | None = None
    office_address_line_2: str | None = None
    office_town:          str | None = None
    office_county:        str | None = None
    office_postcode:      str | None = None
    base_postcode:        str | None = None
    work_types:           str | None = None
    fee_cat:              str | None = None
    firm_type:            str | None = None
    num_partners:         int | None = None
    notes:                str | None = None


# ---------------------------------------------------------------------------
# Survey type schemas
# ---------------------------------------------------------------------------

class SurveyTypeOut(BaseModel):
    id:              int
    name:            str
    code:            str
    description:     str | None
    report_due_days: int | None
    is_active:       bool

    model_config = {"from_attributes": True}


class SurveyTypeCreate(BaseModel):
    name:            str
    code:            str
    description:     str | None = None
    report_due_days: int | None = None


class SurveyTypeUpdate(BaseModel):
    name:            str | None = None
    code:            str | None = None
    description:     str | None = None
    report_due_days: int | None = None
