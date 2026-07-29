from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url:     str  = "postgresql+asyncpg://postgres:password@localhost:5432/tws"
    google_client_id: str  = ""
    jwt_secret:       str  = "change-me-in-production"
    # Comma-separated list of allowed frontend origins, e.g. "https://tws.example.com"
    # Defaults to localhost dev server; override in production .env
    allowed_origins:  str  = "http://localhost:5173,http://localhost:4173"
    environment:      str  = "development"   # "production" disables /docs

    # Email via Resend (https://resend.com) — leave blank to disable
    resend_api_key:   str  = ""
    smtp_from:        str  = ""   # e.g. "Taylor Wilkinson Surveyors <noreply@yourdomain.com>"
    app_url:          str  = ""   # e.g. https://tws.vercel.app

    class Config:
        env_file = ".env"


settings = Settings()
