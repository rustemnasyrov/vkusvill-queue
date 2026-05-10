import os
import socket
from typing import Any, Dict

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def _tcp_check(host: str, port: int, timeout: float = 1.5) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def _health_payload() -> Dict[str, Any]:
    pg_host = os.getenv("PGHOST", "localhost")
    pg_port = int(os.getenv("PGPORT", "5432"))
    redis_host = os.getenv("REDIS_HOST", "localhost")
    redis_port = int(os.getenv("REDIS_PORT", "6379"))

    db_ok = _tcp_check(pg_host, pg_port)
    redis_ok = _tcp_check(redis_host, redis_port)

    status = "ok" if db_ok and redis_ok else "degraded"
    return {
        "status": status,
        "checks": {
            "postgres": "up" if db_ok else "down",
            "redis": "up" if redis_ok else "down",
        },
    }


app = FastAPI(title="Vkusvill Slot Manager API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Dev only; tighten in later stages.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root() -> Dict[str, str]:
    return {"service": "vkusvill-slot-manager", "docs": "/docs", "health": "/health"}


@app.get("/health")
def health() -> Dict[str, Any]:
    return _health_payload()
