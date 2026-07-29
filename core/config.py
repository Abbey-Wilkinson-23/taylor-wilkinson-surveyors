from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url:     str  = "postgresql+asyncpg://postgres:password@localhost:5432/tws"
    google_client_id: str  = ""
    jwt_secret:       str  = "change-me-in-production"
    # Comma-separated list of allowed frontend origins, e.g. "https://tws.example.com"
    # Defaults to localhost dev server; override in production .env
    allowed_origins:  str  = "http://localhost:5173,http://localhost:4173"
    environment:      str  = "development"   # "production" disables /docs

    # SMTP — leave blank to disable email sending
    smtp_host:        str  = ""
    smtp_port:        int  = 587
    smtp_user:        str  = ""
    smtp_pass:        str  = ""
    smtp_from:        str  = ""   # display name + address, e.g. "TWS <you@gmail.com>"
    app_url:          str  = ""   # e.g. https://tws.vercel.app

    class Config:
        env_file = ".env"


settings = Settings()
