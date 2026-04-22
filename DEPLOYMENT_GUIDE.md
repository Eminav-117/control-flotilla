# 🚀 Guía de Despliegue: Control de Flotilla GPA

Esta guía detalla cómo poner en producción la aplicación en los servidores internos de la empresa utilizando la infraestructura Docker + Nginx que hemos configurado.

## 📦 1. Construcción de la Imagen
Ejecuta este comando en la raíz del proyecto para generar el contenedor industrial:
```bash
docker build -t control-flotilla .
```

## 🧪 2. Verificación de Seguridad (CSP) Post-Deploy
Antes de subir al servidor, verifica que la **Política de Seguridad de Contenido** no bloquee funciones críticas:
```bash
docker run -d -p 8080:80 --name test-flotilla control-flotilla
```

**Checklist de smoke post-deploy:**
1. `curl -sI http://localhost:8080/ | grep -i "content-security-policy"` — CSP header presente con `default-src 'self'`.
2. `curl -sI http://localhost:8080/ | grep -iE "x-content-type-options|referrer-policy|permissions-policy"` — headers de hardening presentes.
3. `curl -s http://localhost:8080/healthz` — devuelve `200 ok`.
4. `curl -sI http://localhost:8080/api/foo` — devuelve `404` (API masquerade bloqueado).
5. Abre `http://localhost:8080` en navegador (F12 → Console):
   - Sin errores "Refused to load …" (CSP bloqueando recursos legítimos).
   - Sin errores "Mixed content" (http:// en página https://).
   - No aparece header `Server: nginx/x.y.z` (server_tokens off).
6. Prueba cargar ZIP ≥100MB — `client_max_body_size 200m` debe permitirlo (no `413`).
7. Test CORS: `fetch("https://cdn.cualquiera.com")` desde DevTools → bloqueado por `connect-src 'self'`.

## 🔐 2.5 TLS / HTTPS (OBLIGATORIO para multi-usuario)

> [!WARNING]
> La imagen expone **puerto 80 sin TLS** por simplicidad. Si la app va a servirse a más de un usuario
> o a cualquier equipo fuera del host local, **debes poner TLS delante** o las credenciales/sesión
> viajarán en claro dentro de la red intranet.

**Opciones recomendadas (orden de menor a mayor fricción):**

1. **Reverse proxy interno existente** (si la empresa tiene nginx/traefik/caddy corporativo):
   ```
   https://flotilla.gpa.local  → (TLS terminated) → http://docker-host:80
   ```
2. **Caddy en paralelo** (cert self-signed o ACME interno):
   ```bash
   docker run -d --name tls-front -p 443:443 -v caddy_data:/data \
     --link gpa-flotilla:backend caddy caddy reverse-proxy --from :443 --to backend:80
   ```
3. **Publicar puerto 443 directo** desde el contenedor requiere rebuild con listen 443 ssl + mount de certs.

**Activar HSTS una vez servido sobre HTTPS:** descomenta la línea en `nginx.conf`:
```
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## 🌐 3. Despliegue en Servidor de Intranet (Air-gap)
Si tu servidor interno no tiene acceso a internet para descargar imágenes de Node o Nginx:

**En tu máquina local:**
```powershell
# Exportar la imagen completa a un archivo
docker save control-flotilla | gzip > control-flotilla.tar.gz
```

**En el servidor interno:**
```powershell
# Cargar la imagen desde el archivo .tar.gz
docker load < control-flotilla.tar.gz

# Iniciar la aplicación en el puerto 80 con reinicio automático
docker run -d -p 80:80 --restart always --name gpa-flotilla control-flotilla
```

## 🛠️ 4. Configuración Técnica Incluida
*   **Base URL:** Configurada como `./` para funcionar en cualquier subdirectorio del servidor.
*   **PWA:** Service Worker configurado para actualizarse automáticamente cuando detecte cambios en el servidor interno.
*   **Seguridad:** Nginx bloquea `iframes` externos y ejecuciones de scripts no autorizados para proteger los datos de GPA.

---
> [!IMPORTANT]
> **Mantenimiento:** Al ser una aplicación estática (SPA), no necesitas configurar bases de datos SQL en el servidor. Todo se gestiona vía IndexedDB en el cliente, lo que hace que el servidor sea extremadamente ligero y fácil de escalar.
