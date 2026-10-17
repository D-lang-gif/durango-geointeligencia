# Durango GeoInteligencia v4 · Centro de mando — listo para integración

**Sitio de demostración:** https://d-lang-gif.github.io/durango-geointeligencia/v4/

**Autor: Raúl Muñoz Villa** · Gómez Palacio, Durango · © 2026

> ⚠️ Por defecto el sitio público está en **modo demostración** (simulación local). No hay datos reales de C4/C5/911. El banner lo indica claramente.

## Cómo activa el Director la integración

1. Entra **Alfa** (Raúl) y abre la pestaña **Integración**.
2. Da de alta al **Director(a) de Seguridad Pública** (el Director escribe su propia contraseña; se genera una llave de firma Ed25519/ES256 cifrada en el navegador).
3. El Director entra con su usuario (o Alfa inicia el **Recorrido demo del Director**).
4. En Integración escribe la **IP/URL del C4/API**, endpoints de salud/incidentes/unidades/cámaras y, si aplica, la llave API (se guarda **cifrada** en este navegador; nunca se sube al repositorio).
5. Pulsa **Probar conexión**. Si el navegador no alcanza la red municipal (CORS, LAN privada, contenido mixto), el panel lo explica y ofrece la prueba vía el **servidor de integración** (`servidor/integracion/`).
6. Con prueba correcta, el Director escribe la frase `ACTIVAR MODO OPERATIVO` y confirma. Entonces:
   - se oculta el chip de simulación,
   - se detienen los generadores simulados de patrullas/incidentes,
   - se consultan en un temporizador los endpoints configurados;
   - si responden vacíos o con error → **«Esperando datos del C4»** (nunca se inventan incidentes).

### Auto-escaneo (solo redes autorizadas)

El Director lista hosts o CIDR privados `/24`–`/30` y marca la casilla de autorización. El escaneo busca puertos HTTP/S, RTSP y rutas ONVIF/REST de salud **solo** en esas redes. Cada hallazgo se aprueba o descarta uno por uno antes de registrarse como cámara.

### Credenciales firmadas + QR

En **Credenciales**, el Director emite usuarios (nombre, nº de empleado, rol, vencimiento). Cada credencial lleva un token `DGI1.<payload>.<firma>` (Ed25519 o ES256) y un QR. La página pública [`verificar.html`](https://d-lang-gif.github.io/durango-geointeligencia/v4/verificar.html) muestra válido/inválido, emisor y si la huella de la llave es de confianza en ese equipo. Soft-delete: el Director **revoca**.

### Traspaso de mando

Botón **Transferir mando a Seguridad Pública** (frase `TRANSFIERO EL MANDO A SEGURIDAD PÚBLICA` + contraseña del Director). Alfa queda como **última instancia** y no puede entrar ni reactivarse solo; solo el Director puede reactivarlo. La bitácora es **append-only** (hash encadenado + ancla).

## Recorrido demo del Director

En modo demostración, Alfa puede pulsar **Recorrido Director**. Usa un arenero (`dgi_v4_rec_*`) que se borra al salir. Los botones funcionan; el endpoint de demo (`demo_c4/`) responde **listas vacías** a propósito (no inventa delitos).

## Producción en la red municipal

GitHub Pages **no puede** escanear la LAN de Seguridad Pública. Para autoconfiguración real:

```bash
cd servidor/integracion
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.ejemplo .env   # secretos propios
uvicorn app.main:app --host 0.0.0.0 --port 8443
```

En el panel, el Director pone esa URL y usa «Conectar servidor» / «Probar desde el servidor».

## Límites honestos

| Capacidad | En GitHub Pages | Con servidor en su red |
|---|---|---|
| Probar URL pública HTTPS | Sí (si CORS lo permite) | Sí |
| Probar C4 en LAN privada | No (navegador / CORS / Private Network Access) | Sí |
| Escanear CIDR / ONVIF | No | Sí (solo rangos autorizados) |
| Guardar llave API | Cifrada en localStorage del navegador | Cifrada en reposo en el servidor |
| Inventar incidentes en modo operativo | **Nunca** | **Nunca** |

Las contraseñas de demo están **solo** en `privado/CREDENCIALES_V4_ROLES_NO_SUBIR.txt` (nunca se publican). En el sitio solo hay verificadores PBKDF2.

## Archivos nuevos (v4 integración)

- `sitio/js/firma.js`, `sitio/js/integracion.js`
- `sitio/verificar.html`, `sitio/demo_c4/*`, `sitio/vendor/qrcode.js`
- `servidor/integracion/` (FastAPI)
- Pestañas Integración / Credenciales / Traspaso en `sitio/index.html`

Ver también el [README](README.md) del prototipo y el [plan de escalamiento](documentos/Plan_Escalamiento_GeoInteligencia_2026-10-08.md).
