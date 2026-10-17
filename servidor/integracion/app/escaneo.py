"""Escaneo SOLO de redes/hosts que el Director autorizó (privadas, CIDR /24–/30)."""
from __future__ import annotations
import asyncio, ipaddress, socket
from typing import Iterable
import httpx

PUERTOS_COMUNES = [80, 443, 8080, 8443, 8000, 554, 8554, 37777, 34567]  # HTTP/S, RTSP, DVR comunes
RUTAS_SALUD = ["/", "/salud", "/salud.json", "/health", "/api/health", "/status", "/onvif/device_service"]

def _privado(ip: ipaddress.IPv4Address) -> bool:
    return ip.is_private and not ip.is_loopback and not ip.is_link_local

def expandir(redes: list[dict]) -> list[str]:
    hosts: list[str] = []
    for r in redes or []:
        v = (r.get("valor") or "").strip()
        if r.get("tipo") == "cidr" or "/" in v:
            try:
                red = ipaddress.ip_network(v, strict=False)
            except ValueError:
                continue
            if red.prefixlen < 24 or red.prefixlen > 30:
                continue  # rechazo duro: no escanear redes grandes
            if not isinstance(red, ipaddress.IPv4Network) or not _privado(red.network_address):
                continue
            for ip in red.hosts():
                hosts.append(str(ip))
        else:
            # hostname o IP suelta
            try:
                ip = ipaddress.ip_address(v)
                if isinstance(ip, ipaddress.IPv4Address) and _privado(ip):
                    hosts.append(str(ip))
            except ValueError:
                if v and ".." not in v and len(v) < 253:
                    hosts.append(v.lower())
    # dedup preservando orden
    vistos, out = set(), []
    for h in hosts:
        if h not in vistos:
            vistos.add(h); out.append(h)
    return out[:512]  # tope de seguridad

async def _puerto_abierto(host: str, puerto: int, timeout=0.6) -> bool:
    try:
        fut = asyncio.open_connection(host, puerto)
        reader, writer = await asyncio.wait_for(fut, timeout=timeout)
        writer.close(); await writer.wait_closed()
        return True
    except Exception:
        return False

async def _http_salud(client: httpx.AsyncClient, host: str, puerto: int) -> dict | None:
    esquema = "https" if puerto in (443, 8443) else "http"
    for ruta in RUTAS_SALUD:
        url = f"{esquema}://{host}:{puerto}{ruta}"
        try:
            r = await client.get(url, timeout=2.0)
            if r.status_code in (200, 401, 403) or "onvif" in ruta:
                tipo = "onvif" if "onvif" in ruta else ("rtsp_hint" if puerto in (554, 8554) else "rest_salud")
                return {"host": host, "puerto": puerto, "url": url, "tipo": tipo, "status": r.status_code}
        except Exception:
            continue
    return None

async def escanear(redes: list[dict]) -> list[dict]:
    hosts = expandir(redes)
    hallazgos: list[dict] = []
    limits = asyncio.Semaphore(32)
    async with httpx.AsyncClient(verify=False, follow_redirects=True) as client:
        async def uno(h: str):
            async with limits:
                for p in PUERTOS_COMUNES:
                    if await _puerto_abierto(h, p):
                        if p in (554, 8554):
                            hallazgos.append({"id": f"H-{h}-{p}", "host": h, "puerto": p, "url": f"rtsp://{h}:{p}/", "tipo": "rtsp", "status": 0})
                        else:
                            hit = await _http_salud(client, h, p)
                            if hit:
                                hit["id"] = f"H-{h}-{p}"
                                hallazgos.append(hit)
                            else:
                                hallazgos.append({"id": f"H-{h}-{p}", "host": h, "puerto": p, "url": f"http://{h}:{p}/", "tipo": "puerto_abierto", "status": 0})
        await asyncio.gather(*(uno(h) for h in hosts))
    return hallazgos
