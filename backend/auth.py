"""
backend/auth.py
Handles authentication operations for Human Drift:
- User registration (signup) with bcrypt password hashing and persistent storage in backend/data/users.json
- User authentication (login) with bcrypt verification and 7-day JWT issuance
- JWT token verification (verify_token) returning the authenticated username or raising 401
"""

import os
import json
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
from passlib.context import CryptContext
from jose import jwt, JWTError
from fastapi import HTTPException, status

# Configuration
JWT_SECRET = os.getenv("JWT_SECRET", "human-drift-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def _get_users_file_path() -> str:
    """Resolve the location of users.json."""
    data_path = os.path.join(os.path.dirname(__file__), "data", "users.json")
    if os.path.exists(data_path):
        return data_path
    root_path = os.path.join(os.path.dirname(__file__), "users.json")
    return root_path

def _read_users() -> Dict[str, Any]:
    """Read users data from the JSON file."""
    path = _get_users_file_path()
    if not os.path.exists(path):
        return {"users": []}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"users": []}

def _write_users(data: Dict[str, Any]) -> None:
    """Atomically write users data to the JSON file."""
    path = _get_users_file_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    temp_path = f"{path}.tmp"
    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    os.replace(temp_path, path)
    
    # Also sync secondary path if users.json exists in backend root
    alt_path = os.path.join(os.path.dirname(__file__), "users.json")
    if alt_path != path and os.path.exists(alt_path):
        try:
            with open(f"{alt_path}.tmp", "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            os.replace(f"{alt_path}.tmp", alt_path)
        except Exception:
            pass

def create_jwt_token(username: str) -> str:
    """Create a signed JWT token valid for 7 days."""
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": username,
        "exp": expire,
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)

def signup(username: str, password: str) -> str:
    """
    Register a new user:
    - Verifies username doesn't already exist
    - Hashes password using bcrypt
    - Appends user record to users.json
    - Returns signed 7-day JWT token
    """
    clean_username = username.strip()
    if not clean_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username cannot be empty"
        )
    if not password or len(password) < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password cannot be empty"
        )

    data = _read_users()
    users = data.get("users", [])
    
    # Check if username already taken (case-insensitive)
    for u in users:
        if u.get("username", "").lower() == clean_username.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Username already exists"
            )

    password_hash = pwd_context.hash(password)
    now_iso = datetime.now(timezone.utc).isoformat()
    new_user = {
        "username": clean_username,
        "password_hash": password_hash,
        "created_at": now_iso
    }
    users.append(new_user)
    data["users"] = users
    _write_users(data)

    return create_jwt_token(clean_username)

def login(username: str, password: str) -> str:
    """
    Authenticate an existing user:
    - Verifies credentials against users.json using bcrypt
    - Returns signed 7-day JWT token
    """
    clean_username = username.strip()
    if not clean_username or not password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    data = _read_users()
    users = data.get("users", [])
    
    matched_user = None
    for u in users:
        if u.get("username", "").lower() == clean_username.lower():
            matched_user = u
            break

    if not matched_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    if not pwd_context.verify(password, matched_user.get("password_hash", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    return create_jwt_token(matched_user["username"])

def verify_token(token: str) -> str:
    """
    Verify and decode JWT token:
    - Returns username if token is valid and unexpired
    - Raises HTTPException(401) on invalid signature, expiration, or format
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    try:
        # Strip optional "Bearer " prefix if passed in
        clean_token = token.replace("Bearer ", "").strip()
        payload = jwt.decode(clean_token, JWT_SECRET, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if username is None:
            raise credentials_exception
        return username
    except JWTError:
        raise credentials_exception
