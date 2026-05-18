import time

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.auth import service
from app.auth.blacklist import blacklist_token
from app.auth.dependencies import get_current_user
from app.auth.rate_limiter import is_rate_limited
from app.auth.schemas import UserCreate, UserLogin, UserOut
from app.db.session import get_db
from app.models.user import User

router = APIRouter()


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)):
    if service.get_user_by_email(db, data.email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    return service.register_user(db, data.email, data.password)


@router.post("/login")
def login(request: Request, data: UserLogin, response: Response, db: Session = Depends(get_db)):
    client_ip = request.client.host if request.client else "unknown"
    if is_rate_limited(f"login:{client_ip}"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again in 5 minutes.",
        )
    user = service.get_user_by_email(db, data.email)
    if not user or not service.verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token = service.create_access_token(user.id)
    response.set_cookie(
        key="tradeops_token",
        value=token,
        httponly=True,
        samesite="strict",
        max_age=service.ACCESS_TOKEN_EXPIRE_SECONDS,
        path="/",
    )
    return {"message": "Login successful"}


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response):
    token = request.cookies.get("tradeops_token")
    if token:
        payload = service.decode_token_raw(token)
        if payload:
            jti = payload.get("jti")
            exp = payload.get("exp")
            if jti and exp:
                remaining = int(exp - time.time())
                if remaining > 0:
                    blacklist_token(jti, remaining)
    response.delete_cookie("tradeops_token", path="/")


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user
