# Cobalt con Docker

1. Instala Docker (Docker Desktop en Windows/Mac, o `docker` + `docker compose` en Linux).
2. En esta carpeta:
   ```
   docker compose up -d
   ```
3. Comprueba: abre http://localhost:9000 (debe devolver un JSON con la versión).

Para un servidor público: define `API_URL=https://tu-dominio/` (archivo `.env` junto al compose),
pon un proxy inverso con HTTPS y protege la instancia (ver docs de cobalt: `protect-an-instance.md`).
Para parar: `docker compose down`.

Uso responsable: no descargues contenido con derechos de autor sin permiso.
