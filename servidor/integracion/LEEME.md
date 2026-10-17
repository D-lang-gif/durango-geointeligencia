# Servidor de integración (red municipal)

Servicio **opcional** en FastAPI para cuando Seguridad Pública adopte Durango GeoInteligencia.

## Qué hace

- Guarda la configuración C4/API/CCTV **cifrada en reposo** (Fernet / AES).
- Endpoint `POST /api/integracion/probar`: prueba de conexión **desde la red municipal** (sin CORS del navegador).
- Proxy `GET /api/c4/{salud|incidentes|unidades|camaras}` hacia los endpoints configurados.
- Escaneo **solo** de hosts/CIDR privados `/24`–`/30` autorizados por el Director (puertos HTTP/S, RTSP, ONVIF comunes).
- Bitácora append-only, llaves públicas del Director y registro de credenciales firmadas.

## Qué NO hace

- No inventa incidentes ni patrullas.
- No escanea internet ni redes que el Director no listó.
- No sustituye el IdP municipal (LDAP/AD/OAuth): el token de sesión es de demostración.

## Arranque

```bash
cd servidor/integracion
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.ejemplo .env   # edite secretos
export $(grep -v '^#' .env | xargs)
uvicorn app.main:app --host 0.0.0.0 --port 8443
```

En el panel (pestaña Integración) el Director escribe la URL de este servidor y pulsa «Conectar servidor».

## Límite honesto

GitHub Pages **no puede** alcanzar la LAN municipal. Este servidor debe vivir en la red de Seguridad Pública (o VPN).
