"""
backend/main.py
FastAPI entry point for the Human Drift backend service:
- Provides /auth/signup, /auth/login, and /auth/me endpoints
- Implements JWT security middleware that protects all non-public endpoints
- Public routes: /auth/signup, /auth/login (plus OpenAPI schema documentation routes)
- Integrates with backend/auth.py and backend/data/users.json
"""

import os
from typing import Optional
from fastapi import FastAPI, Request, HTTPException, status, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from backend.auth import signup, login, verify_token

app = FastAPI(
    title="Human Drift API",
    description="Plan-execution drift research and session logging backend with local JWT authentication",
    version="1.0.0"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Schemas
class AuthRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=200)

class AuthResponse(BaseModel):
    token: str
    username: str

class UserResponse(BaseModel):
    username: str

# Public path whitelist
PUBLIC_PATHS = {
    "/auth/signup",
    "/auth/login",
    "/docs",
    "/openapi.json",
    "/redoc",
    "/api/health"
}

@app.middleware("http")
async def jwt_auth_middleware(request: Request, call_next):
    """
    Middleware protecting all endpoints except explicit public routes:
    - Checks Authorization: Bearer <token> header
    - Rejects unauthorized requests with 401
    """
    path = request.url.path
    if path in PUBLIC_PATHS or request.method == "OPTIONS":
        return await call_next(request)

    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Missing or invalid authorization header"},
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = auth_header.split(" ", 1)[1]
    try:
        username = verify_token(token)
        # Attach authenticated user to request state
        request.state.username = username
    except HTTPException as e:
        return JSONResponse(
            status_code=e.status_code,
            content={"detail": e.detail},
            headers={"WWW-Authenticate": "Bearer"}
        )
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"detail": "Authentication failed"},
            headers={"WWW-Authenticate": "Bearer"}
        )

    return await call_next(request)

# Dependency for route handlers
def get_current_user(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.split(" ", 1)[1]
    return verify_token(token)

# Auth Endpoints
@app.post("/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def auth_signup(payload: AuthRequest):
    """Register a new user, return JWT and username."""
    token = signup(payload.username, payload.password)
    return AuthResponse(token=token, username=payload.username.strip())

@app.post("/auth/login", response_model=AuthResponse)
def auth_login(payload: AuthRequest):
    """Authenticate user credentials, return JWT and username."""
    token = login(payload.username, payload.password)
    return AuthResponse(token=token, username=payload.username.strip())

@app.get("/auth/me", response_model=UserResponse)
def auth_me(username: str = Depends(get_current_user)):
    """Return the authenticated user's username."""
    return UserResponse(username=username)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "Human Drift API"}
