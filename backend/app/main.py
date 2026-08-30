from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import router
from app.core.settings import get_cors_origins

app = FastAPI(
    title="FinPath API",
    version="1.0.0",
    description="Deterministic financial-path engine with optional AI scenario parsing.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _error(code: str, message: str, details: dict | None = None) -> dict:
    return {"error": {"code": code, "message": message, "details": details or {}}}


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=_error(
            "VALIDATION_ERROR",
            "입력값을 확인해주세요.",
            {"errors": jsonable_encoder(exc.errors())},
        ),
    )


@app.exception_handler(HTTPException)
async def http_error_handler(_request: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail
    if isinstance(detail, str):
        message = detail
        details = {}
    else:
        message = "요청을 처리할 수 없습니다."
        details = {"detail": jsonable_encoder(detail)}
    return JSONResponse(
        status_code=exc.status_code,
        content=_error("HTTP_ERROR", message, details),
        headers=exc.headers,
    )


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(router)
