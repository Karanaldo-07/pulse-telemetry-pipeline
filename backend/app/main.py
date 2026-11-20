from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import psycopg

from app.core.config import settings
from app.core.database import pool, get_db_conn
from app.api.routes import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    pool.open()
    yield
    pool.close()


app = FastAPI(
    title="Pulse Telemetry & Anomaly API",
    version="1.0.0",
    lifespan=lifespan,
)

allowed_origins = [
    "http://localhost:3000",
    settings.FRONTEND_URL.rstrip("/"),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health_check(conn: psycopg.Connection = Depends(get_db_conn)):
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1;")
        return {"status": "healthy", "database": "connected"}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"DB error: {str(exc)}")