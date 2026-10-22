from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import (
    auth,
    cook_logs,
    diet,
    health,
    households,
    ingredients,
    pantry_items,
    recipes,
)
from app.core.config import get_settings
from app.services.errors import (
    AuthError,
    ConflictError,
    InvalidInputError,
    NotFoundError,
    ServiceError,
)

settings = get_settings()

app = FastAPI(title="Chef API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_STATUS_BY_ERROR = {
    NotFoundError: status.HTTP_404_NOT_FOUND,
    ConflictError: status.HTTP_409_CONFLICT,
    AuthError: status.HTTP_401_UNAUTHORIZED,
    InvalidInputError: status.HTTP_422_UNPROCESSABLE_CONTENT,
}


@app.exception_handler(ServiceError)
def handle_service_error(_: Request, exc: ServiceError) -> JSONResponse:
    code = _STATUS_BY_ERROR.get(type(exc), status.HTTP_400_BAD_REQUEST)
    return JSONResponse(status_code=code, content={"detail": exc.detail})


for module in (health, auth, households, ingredients, pantry_items, recipes, diet, cook_logs):
    app.include_router(module.router, prefix="/api")
