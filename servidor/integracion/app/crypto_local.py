"""Cifrado en reposo (Fernet / AES-128-CBC+HMAC vía cryptography) y tokens de sesión."""
from __future__ import annotations
import base64, hashlib, hmac, json, os, secrets, time
from cryptography.fernet import Fernet

def _fernet(master: bytes) -> Fernet:
    # Deriva una clave Fernet (32 url-safe base64) a partir del secreto maestro
    dig = hashlib.sha256(master).digest()
    return Fernet(base64.urlsafe_b64encode(dig))

def cargar_o_crear_maestro(ruta: str, env_b64: str | None) -> bytes:
    if env_b64:
        return base64.b64decode(env_b64)
    if os.path.exists(ruta):
        return open(ruta, "rb").read()
    key = secrets.token_bytes(32)
    os.makedirs(os.path.dirname(ruta) or ".", exist_ok=True)
    open(ruta, "wb").write(key)
    try: os.chmod(ruta, 0o600)
    except OSError: pass
    return key

def sellar(master: bytes, obj) -> str:
    return _fernet(master).encrypt(json.dumps(obj, ensure_ascii=False).encode("utf-8")).decode("ascii")

def abrir(master: bytes, token: str):
    return json.loads(_fernet(master).decrypt(token.encode("ascii")).decode("utf-8"))

def token_sesion(secret: bytes, claims: dict, ttl=86400) -> str:
    body = {**claims, "exp": int(time.time()) + ttl}
    payload = base64.urlsafe_b64encode(json.dumps(body, separators=(",", ":")).encode()).decode().rstrip("=")
    sig = hmac.new(secret, payload.encode(), hashlib.sha256).digest()
    return payload + "." + base64.urlsafe_b64encode(sig).decode().rstrip("=")

def leer_token(secret: bytes, token: str) -> dict:
    try:
        payload, sig = token.split(".", 1)
        esperada = base64.urlsafe_b64encode(hmac.new(secret, payload.encode(), hashlib.sha256).digest()).decode().rstrip("=")
        if not hmac.compare_digest(sig, esperada):
            raise ValueError("firma")
        pad = "=" * (-len(payload) % 4)
        body = json.loads(base64.urlsafe_b64decode(payload + pad))
        if body.get("exp", 0) < time.time():
            raise ValueError("expirado")
        return body
    except Exception as e:
        raise ValueError("token inválido") from e
