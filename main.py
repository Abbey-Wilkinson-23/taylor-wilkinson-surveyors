from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.auth import get_current_user, require_admin
from core.config import settings
from routers import auth, instructions, clients, surveyors, survey_types, stats, postcode

# Hide API docs in production so the endpoint structure isn't publicly browsable
_docs = None if settings.environment == "production" else "/docs"
_redoc = None if settings.environment == "production" else "/redoc"

app = FastAPI(
    title="Taylor Wilkinson Surveyors",
    description="Internal instruction management system",
    version="0.1.0",
    docs_url=_docs,
    redoc_url=_redoc,
)

# Only allow requests from the known frontend origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth endpoints — no token required
app.include_router(auth.router)

# All other endpoints require a valid token
_auth = [Depends(get_current_user)]
app.include_router(instructions.router,  dependencies=_auth)
app.include_router(clients.router,       dependencies=_auth)
app.include_router(surveyors.router,     dependencies=_auth)
app.include_router(survey_types.router,  dependencies=_auth)

# Stats — admin only
app.include_router(stats.router, dependencies=[Depends(require_admin)])

# Postcode coverage — all authenticated users can read; edit restricted in router
app.include_router(postcode.router, dependencies=_auth)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
