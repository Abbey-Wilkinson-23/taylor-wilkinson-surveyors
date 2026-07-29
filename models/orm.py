import enum
from sqlalchemy import (
    Boolean, Column, Computed, Date, ForeignKey, Integer,
    Numeric, SmallInteger, Text, TIMESTAMP, UniqueConstraint,
    Enum as SAEnum,
)
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Status enum + allowed transitions
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

class UserRole(str, enum.Enum):
    developer = "developer"
    admin     = "admin"
    user      = "user"

DEVELOPER_EMAIL = "abbeywilkinson123@gmail.com"

# Pages available to each role by default (if no custom page_permissions set)
ALL_PAGES = "instructions,clients,surveyors,survey-types,postcode-coverage,stats,users"
DEFAULT_PERMISSIONS = {
    "developer": ALL_PAGES,
    "admin":     "instructions,clients,surveyors,survey-types,postcode-coverage,stats,users",
    "user":      "instructions,clients,surveyors,survey-types,postcode-coverage",
}


class User(Base):
    __tablename__ = "users"

    id               = Column(Integer, primary_key=True)
    email            = Column(Text, unique=True, nullable=False)
    role             = Column(SAEnum(UserRole, name="user_role", create_constraint=False), nullable=False, default=UserRole.user)
    is_active        = Column(Boolean, nullable=False, default=True)
    page_permissions = Column(Text, nullable=True)   # CSV of allowed page keys; NULL = use role default
    created_at       = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Status enum + allowed transitions
# ---------------------------------------------------------------------------

class InstructionStatus(str, enum.Enum):
    received          = "received"
    surveyor_assigned = "surveyor_assigned"
    booked            = "booked"
    report_received   = "report_received"
    invoiced          = "invoiced"
    complete          = "complete"
    on_hold           = "on_hold"
    cancelled         = "cancelled"


STATUS_TRANSITIONS: dict[InstructionStatus, set[InstructionStatus]] = {
    InstructionStatus.received: {
        InstructionStatus.surveyor_assigned,
        InstructionStatus.on_hold,
        InstructionStatus.cancelled,
    },
    InstructionStatus.surveyor_assigned: {
        InstructionStatus.booked,
        InstructionStatus.received,
        InstructionStatus.on_hold,
        InstructionStatus.cancelled,
    },
    InstructionStatus.booked: {
        InstructionStatus.report_received,
        InstructionStatus.surveyor_assigned,
        InstructionStatus.on_hold,
        InstructionStatus.cancelled,
    },
    InstructionStatus.report_received: {
        InstructionStatus.invoiced,
    },
    InstructionStatus.invoiced: {
        InstructionStatus.complete,
    },
    InstructionStatus.on_hold: {
        InstructionStatus.received,
        InstructionStatus.cancelled,
    },
    InstructionStatus.complete:  set(),
    InstructionStatus.cancelled: set(),
}


# ---------------------------------------------------------------------------
# Clients
# ---------------------------------------------------------------------------

class Client(Base):
    __tablename__ = "clients"

    id              = Column(Integer, primary_key=True)
    company_name    = Column(Text, nullable=False)
    type            = Column(Text, nullable=False)   # lender | broker | both
    email           = Column(Text)
    phone           = Column(Text)
    address_line_1  = Column(Text)
    address_line_2  = Column(Text)
    town            = Column(Text)
    county          = Column(Text)
    postcode        = Column(Text)
    notes           = Column(Text)
    is_active       = Column(Boolean, nullable=False, default=True)
    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())

    contacts        = relationship("ClientContact", back_populates="client")
    instructions    = relationship("Instruction", back_populates="client")


class ClientContact(Base):
    __tablename__ = "client_contacts"

    id          = Column(Integer, primary_key=True)
    client_id   = Column(Integer, ForeignKey("clients.id"), nullable=False)
    name        = Column(Text, nullable=False)
    email       = Column(Text)
    phone       = Column(Text)
    role        = Column(Text)
    is_primary  = Column(Boolean, nullable=False, default=False)
    is_active   = Column(Boolean, nullable=False, default=True)
    created_at  = Column(TIMESTAMP(timezone=True), server_default=func.now())

    client      = relationship("Client", back_populates="contacts")


# ---------------------------------------------------------------------------
# Surveyors
# ---------------------------------------------------------------------------

class Surveyor(Base):
    __tablename__ = "surveyors"

    id                    = Column(Integer, primary_key=True)
    surveyor_number       = Column(Text, unique=True)
    first_name            = Column(Text, nullable=False)
    last_name             = Column(Text, nullable=False)
    company_name          = Column(Text)
    email                 = Column(Text, nullable=False)
    phone                 = Column(Text, nullable=False)   # work phone
    personal_phone        = Column(Text)
    rics_number           = Column(Text)
    pi_cover_amount       = Column(Numeric(12, 2))
    office_address_line_1 = Column(Text)
    office_address_line_2 = Column(Text)
    office_town           = Column(Text)
    office_county         = Column(Text)
    office_postcode       = Column(Text)
    firm_type             = Column(Text)   # sole_trader | partnership | limited_company
    num_partners          = Column(Integer)
    notes                 = Column(Text)
    is_active             = Column(Boolean, nullable=False, default=True)
    created_at            = Column(TIMESTAMP(timezone=True), server_default=func.now())

    coverage          = relationship("SurveyorCoverage", back_populates="surveyor", cascade="all, delete-orphan")
    qualifications    = relationship("SurveyorQualification", back_populates="surveyor", cascade="all, delete-orphan")
    client_exclusions = relationship("SurveyorClientExclusion", back_populates="surveyor", cascade="all, delete-orphan")


class SurveyorCoverage(Base):
    __tablename__ = "surveyor_coverage"

    id              = Column(Integer, primary_key=True)
    surveyor_id     = Column(Integer, ForeignKey("surveyors.id"), nullable=False)
    outward_code    = Column(Text, nullable=False)
    distance_band   = Column(Text)   # '15', '25', '25+', or None

    surveyor        = relationship("Surveyor", back_populates="coverage")

    __table_args__  = (UniqueConstraint("surveyor_id", "outward_code"),)


class SurveyorQualification(Base):
    __tablename__ = "surveyor_qualifications"

    surveyor_id     = Column(Integer, ForeignKey("surveyors.id"), primary_key=True)
    survey_type_id  = Column(Integer, ForeignKey("survey_types.id"), primary_key=True)

    surveyor        = relationship("Surveyor", back_populates="qualifications")
    survey_type     = relationship("SurveyType")


class SurveyorClientExclusion(Base):
    __tablename__ = "surveyor_client_exclusions"

    surveyor_id = Column(Integer, ForeignKey("surveyors.id"), primary_key=True)
    client_id   = Column(Integer, ForeignKey("clients.id"), primary_key=True)

    surveyor    = relationship("Surveyor", back_populates="client_exclusions")
    client      = relationship("Client")


# ---------------------------------------------------------------------------
# Survey types
# ---------------------------------------------------------------------------

class SurveyType(Base):
    __tablename__ = "survey_types"

    id               = Column(Integer, primary_key=True)
    name             = Column(Text, nullable=False, unique=True)
    code             = Column(Text, nullable=False, unique=True)
    description      = Column(Text)
    report_due_days  = Column(Integer)
    is_active        = Column(Boolean, nullable=False, default=True)


# ---------------------------------------------------------------------------
# Properties
# ---------------------------------------------------------------------------

class Property(Base):
    __tablename__ = "properties"

    id              = Column(Integer, primary_key=True)
    address_line_1  = Column(Text, nullable=False)
    address_line_2  = Column(Text)
    town            = Column(Text, nullable=False)
    county          = Column(Text)
    postcode        = Column(Text, nullable=False)
    # Generated column — derived from postcode by the database
    outward_code    = Column(
        Text,
        Computed("UPPER(SPLIT_PART(postcode, ' ', 1))", persisted=True),
    )
    property_type   = Column(Text)   # house | flat | bungalow | maisonette | commercial | other
    tenure          = Column(Text)   # freehold | leasehold | unknown
    num_bedrooms    = Column(SmallInteger)
    created_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())


# ---------------------------------------------------------------------------
# Instructions
# ---------------------------------------------------------------------------

class Instruction(Base):
    __tablename__ = "instructions"

    id                      = Column(Integer, primary_key=True)
    our_ref                 = Column(Text, nullable=False, unique=True)
    client_ref              = Column(Text)
    client_id               = Column(Integer, ForeignKey("clients.id"), nullable=False)
    contact_id              = Column(Integer, ForeignKey("client_contacts.id"))
    property_id             = Column(Integer, ForeignKey("properties.id"), nullable=False)
    survey_type_id          = Column(Integer, ForeignKey("survey_types.id"), nullable=False)
    borrower_name           = Column(Text, nullable=True)
    borrower_phone          = Column(Text)
    borrower_email          = Column(Text)
    assigned_surveyor_id    = Column(Integer, ForeignKey("surveyors.id"))
    agreed_client_fee       = Column(Numeric(10, 2))
    agreed_surveyor_fee     = Column(Numeric(10, 2))
    status                  = Column(
        SAEnum(InstructionStatus, name="instruction_status"),
        nullable=False,
        default=InstructionStatus.received,
    )
    received_at             = Column(TIMESTAMP(timezone=True), server_default=func.now())
    inspection_date         = Column(Date)
    report_due_date         = Column(Date)
    report_received_at      = Column(TIMESTAMP(timezone=True))
    invoiced_at             = Column(TIMESTAMP(timezone=True))
    completed_at            = Column(TIMESTAMP(timezone=True))
    priority                = Column(Text, nullable=False, default="standard")
    notes                   = Column(Text)
    created_at              = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at              = Column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    client              = relationship("Client", back_populates="instructions")
    contact             = relationship("ClientContact")
    property            = relationship("Property")
    survey_type         = relationship("SurveyType")
    assigned_surveyor   = relationship("Surveyor")
    status_history      = relationship(
        "InstructionStatusHistory",
        back_populates="instruction",
        order_by="InstructionStatusHistory.changed_at",
    )


class InstructionStatusHistory(Base):
    __tablename__ = "instruction_status_history"

    id              = Column(Integer, primary_key=True)
    instruction_id  = Column(Integer, ForeignKey("instructions.id"), nullable=False)
    old_status      = Column(SAEnum(InstructionStatus, name="instruction_status"))
    new_status      = Column(SAEnum(InstructionStatus, name="instruction_status"), nullable=False)
    changed_by      = Column(Text, nullable=False)
    notes           = Column(Text)
    changed_at      = Column(TIMESTAMP(timezone=True), server_default=func.now())

    instruction     = relationship("Instruction", back_populates="status_history")


# ---------------------------------------------------------------------------
# Postcode coverage
# ---------------------------------------------------------------------------

class PostcodeWorkType(Base):
    __tablename__ = "postcode_work_types"

    id   = Column(Integer, primary_key=True)
    name = Column(Text, nullable=False, unique=True)


class PostcodeSurveyor(Base):
    __tablename__ = "postcode_surveyors"

    id               = Column(Integer, primary_key=True)
    postcode_area    = Column(Text, nullable=False)
    name             = Column(Text, nullable=False)
    surveyor_number  = Column(Text, nullable=True)
    preferred        = Column(Text, nullable=False, default="")   # "" | "#" | "##"
    coverage         = Column(Text, nullable=False, default="")
    work_types       = Column(Text, nullable=False, default="")
    fee_cat          = Column(Text, nullable=False)                # STANDARD | QUOTABLE | HIGHER
    is_custom        = Column(Boolean, nullable=False, default=False)
    created_at       = Column(TIMESTAMP(timezone=True), server_default=func.now())
