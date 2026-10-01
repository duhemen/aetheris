import os
import time
from typing import Optional, Dict, List
from urllib.parse import urlencode

import httpx
from itsdangerous import URLSafeTimedSerializer, BadSignature
from fastapi import Request, Response

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
PUBLIC_URL = os.getenv("PUBLIC_URL", "http://127.0.0.1:8000").rstrip("/")
SESSION_COOKIE = "aetheris_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 7  # 7 hari

serializer = URLSafeTimedSerializer(SECRET_KEY, salt="aetheris-auth")

PROVIDERS = {
    "google": {
        "authorize_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "userinfo_url": "https://www.googleapis.com/oauth2/v3/userinfo",
        "scope": "openid email profile",
        "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
        "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
    },
    "github": {
        "authorize_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "userinfo_url": "https://api.github.com/user",
        "scope": "read:user user:email",
        "client_id": os.getenv("GITHUB_CLIENT_ID", ""),
        "client_secret": os.getenv("GITHUB_CLIENT_SECRET", ""),
    },
    "facebook": {
        "authorize_url": "https://www.facebook.com/v19.0/dialog/oauth",
        "token_url": "https://graph.facebook.com/v19.0/oauth/access_token",
        "userinfo_url": "https://graph.facebook.com/me?fields=id,name,email,picture.type(large)",
        "scope": "email public_profile",
        "client_id": os.getenv("FACEBOOK_CLIENT_ID", ""),
        "client_secret": os.getenv("FACEBOOK_CLIENT_SECRET", ""),
    },
}


def enabled_providers() -> List[str]:
    return [name for name, cfg in PROVIDERS.items()
            if cfg["client_id"] and cfg["client_secret"]]


def build_authorize_url(provider: str, state: str) -> str:
    cfg = PROVIDERS[provider]
    params = {
        "client_id": cfg["client_id"],
        "redirect_uri": f"{PUBLIC_URL}/auth/{provider}/callback",
        "scope": cfg["scope"],
        "state": state,
        "response_type": "code",
    }
    return f"{cfg['authorize_url']}?{urlencode(params)}"


async def exchange_code(provider: str, code: str) -> Optional[str]:
    cfg = PROVIDERS[provider]
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            cfg["token_url"],
            data={
                "client_id": cfg["client_id"],
                "client_secret": cfg["client_secret"],
                "code": code,
                "redirect_uri": f"{PUBLIC_URL}/auth/{provider}/callback",
                "grant_type": "authorization_code",
            },
            headers={"Accept": "application/json"},
        )
        if r.status_code != 200:
            return None
        try:
            return r.json().get("access_token")
        except Exception:
            # GitHub bisa return text/plain kalau accept header tidak tepat
            from urllib.parse import parse_qs
            data = parse_qs(r.text)
            return (data.get("access_token") or [None])[0]


async def fetch_userinfo(provider: str, access_token: str) -> Dict:
    cfg = PROVIDERS[provider]
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/json"}
    if provider == "github":
        headers["User-Agent"] = "Aetheris/7.0"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(cfg["userinfo_url"], headers=headers)
        return r.json() if r.status_code == 200 else {}


def normalize_user(provider: str, raw: Dict) -> Dict:
    if provider == "google":
        return {
            "provider": "google",
            "id": raw.get("sub", ""),
            "email": raw.get("email", ""),
            "name": raw.get("name") or raw.get("email", "").split("@")[0] or "User",
            "avatar": raw.get("picture", ""),
        }
    if provider == "github":
        return {
            "provider": "github",
            "id": str(raw.get("id", "")),
            "email": raw.get("email") or "",
            "name": raw.get("name") or raw.get("login") or "User",
            "avatar": raw.get("avatar_url", ""),
        }
    if provider == "facebook":
        return {
            "provider": "facebook",
            "id": raw.get("id", ""),
            "email": raw.get("email", ""),
            "name": raw.get("name", "User"),
            "avatar": (raw.get("picture") or {}).get("data", {}).get("url", ""),
        }
    return {"provider": provider, "id": "", "name": "User", "avatar": ""}


def create_session(user: Dict) -> str:
    return serializer.dumps({"user": user, "iat": int(time.time())})


def read_session(token: str) -> Optional[Dict]:
    try:
        data = serializer.loads(token, max_age=SESSION_MAX_AGE)
        return data.get("user")
    except (BadSignature, Exception):
        return None


def get_user_from_request(request: Request) -> Optional[Dict]:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    return read_session(token)


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        SESSION_COOKIE, token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=PUBLIC_URL.startswith("https://"),
        path="/",
    )


def clear_session_cookie(response: Response):
    response.delete_cookie(SESSION_COOKIE, path="/")