"""
FastAPI application entrypoint for Smart Routing Simulator.
"""

from __future__ import annotations

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import comparison, links, routes, routing_tables, topology

app = FastAPI(
    title="Smart Routing Simulator API",
    description=(
        "Backend REST API for comparing computer network routing algorithms "
        "(Dijkstra, Bellman-Ford, Distance Vector, and Link State) on a 5-node topology. "
        "Supports dynamic link failures, real-time metric modification, and routing table inspection."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ---------------------------------------------------------------------------
# CORS Configuration
# ---------------------------------------------------------------------------

allowed_origins_env = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
)
allowed_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Mount Routers under /api
# ---------------------------------------------------------------------------

app.include_router(routes.router, prefix="/api")
app.include_router(topology.router, prefix="/api")
app.include_router(links.router, prefix="/api")
app.include_router(comparison.router, prefix="/api")
app.include_router(routing_tables.router, prefix="/api")


@app.get("/")
def root():
    return {
        "service": "Smart Routing Simulator Backend",
        "status": "online",
        "docs": "/docs",
        "version": "1.0.0",
    }
