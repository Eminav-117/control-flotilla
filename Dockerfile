# Etapa 1: Build
# NOTA: para build reproducible, reemplazar tag por digest:
#   FROM node:20.18.0-alpine@sha256:<digest>
# Obtener digest: docker manifest inspect node:20.18.0-alpine
FROM node:20.18.0-alpine AS build

WORKDIR /app

# Instalar dependencias (lockfile estricto)
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copiar código fuente y assets
COPY . .

# Build de la aplicación (Vite genera la carpeta dist/)
RUN npm run build && \
    test -f dist/index.html && \
    test -d dist/assets || (echo "Build artifacts faltantes" && exit 1)

# Etapa 2: Runtime
# NOTA: pin digest en producción — ver comentario etapa build.
FROM nginx:1.27.3-alpine AS runtime

# Copiar configuración personalizada de Nginx (server block)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Worker tuning + rate limit zones (scope http{}, no server{}).
# `auto` = 1 worker/CPU. 2048 connections = ~4k concurrent/2-core (intranet sufficient).
# Rate limit zones:
#   general: 30 req/s por IP (navegación normal)
#   upload:  3 req/s por IP (protege endpoints grandes)
#   healthz: 60 req/min por IP (evita abuse /healthz polling)
RUN sed -i 's/^worker_processes.*$/worker_processes auto;/' /etc/nginx/nginx.conf && \
    sed -i 's/worker_connections  *1024/worker_connections 2048/' /etc/nginx/nginx.conf && \
    sed -i '/http {/a\    limit_req_zone $binary_remote_addr zone=general:10m rate=30r/s;\n    limit_req_zone $binary_remote_addr zone=upload:10m rate=3r/s;\n    limit_req_zone $binary_remote_addr zone=healthz:1m rate=60r/m;' /etc/nginx/nginx.conf

# Copiar los archivos estáticos desde la etapa de build
COPY --from=build /app/dist /usr/share/nginx/html

# Drop privilegios — nginx:alpine corre como root por default.
# Worker procs lo bajan a usuario nginx automáticamente, pero el master corre root.
# Para hardening completo usar nginxinc/nginx-unprivileged.

# Exponer el puerto 80 para el servidor interno
EXPOSE 80

# Salud del contenedor — golpea endpoint dedicado /healthz (no SPA index).
# timeout=10s tolera picos CPU (workers saturados procesando upload ZIP grande).
# Antes era 5s — demasiado agresivo, generaba falsos positivos.
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
