# Security Compliance — `control-flotilla`

**Fecha última revisión:** 2026-04-24
**Contexto:** app client-only intranet, offline-first, sin backend propio

---

## Compliance vs 10 reglas security-first

### ✅ Rule 1 — Input Validation & Sanitization

| Surface | Validation |
|---------|------------|
| XLSX upload | Magic bytes PK\x03\x04 (ZIP header) before SheetJS parse (`src/io/excelLoader.ts:42`) |
| ZIP upload | EOCD + CD validated (`src/io/zipReader.ts`) — 22+65536 max scan |
| Manual photo upload | accept="image/jpeg,png,gif,webp" + magic bytes check + 10MB/20-file caps |
| Form inputs (taller/semanales) | Type=date/number native browser validation + `safeUnitArray` guards |
| Type safety | TS strict + `noUncheckedIndexedAccess` + Zod-style guards en `src/main.ts` |

### ✅ Rule 2 — Injection Prevention

| Vector | Defense |
|--------|---------|
| XSS via innerHTML | `escHtml()` + `escAttr()` en todos outputs dinámicos |
| XSS via onclick dynamic | Event delegation `data-action` — 32 sites migrados (audit-p1 #5) |
| XSS via analyzeRow findings | Text sanitized before DOM insertion |
| SQL | N/A (IndexedDB client-only, no SQL) |
| Command injection | N/A (no exec/eval/system) |
| XXE | N/A (no XML parsing) |
| Path traversal | N/A (client-only, no server paths) |

### ⚪ Rule 3 — Auth/Authz

**N/A — app client-only, single-device.** Datos en IndexedDB local al browser del dispositivo. Sin backend, sin sesiones, sin login. Control de acceso = control físico al dispositivo.

### ⚪ Rule 4 — Cryptography

**N/A — no credentials stored.** App NO almacena passwords, tokens, API keys. TLS responsabilidad del reverse proxy upstream (Caddy/nginx corporativo) — documentado en `DEPLOYMENT_GUIDE.md` sección 2.5.

### ✅ Rule 5 — Data Protection

- Zero hardcoded credentials (audit grep limpio)
- `console.*` stripped en prod build vía esbuild drop
- Logs no incluyen PII más allá de placas visibles (dato público sin PII sensible)
- Sin variables .env commiteadas (`.env*` gitignored excepto .env.example)
- Datos operadores solo en IDB local browser, no viajan

### ✅ Rule 6 — Error Handling

- `runSafe()` wrapper global (`window.runSafe`) — try/catch unificado
- `window.onerror` + `unhandledrejection` listeners capturan fallas ambiente
- `_sanitizeErrorMsg()` oculta stack traces / paths / URLs internas al user
- User ve mensaje genérico + técnico en `console.error` (dev/debug only, prod stripped)
- Fail-secure: loader se oculta en error, app retorna a estado seguro

### ✅ Rule 7 — Security Headers & Cookies

| Header | Configurado en |
|--------|---------------|
| Strict-Transport-Security | nginx.conf (HSTS 2 años + preload + subdomains) |
| Content-Security-Policy | HTML meta + nginx (dual defense) — default-src 'self' |
| X-Frame-Options | nginx SAMEORIGIN |
| X-Content-Type-Options | nginx nosniff |
| Referrer-Policy | nginx strict-origin-when-cross-origin |
| Permissions-Policy | nginx: camera/mic/geo/payment/usb deshabilitados |
| Cross-Origin-Opener-Policy | nginx same-origin |
| Cross-Origin-Resource-Policy | nginx same-origin |

**Cookies:** N/A (app sin backend, no session cookies).
**CSRF:** N/A (sin state-change endpoints).
**Rate limiting:** nginx `limit_req_zone` — general 30 r/s, healthz 60 r/min, upload 3 r/s (reservado).

### ✅ Rule 8 — File Operations

| File type | Validation |
|-----------|-----------|
| XLSX mensual | Magic bytes + SheetJS validate + row count sanity check (`excelLoader.ts`) |
| ZIP semanal | EOCD scan + entries validate (`zipReader.ts` + `zipLoader.ts`) |
| Manual photo | Magic bytes JPEG/PNG/GIF/WebP + 10MB max + 20 files/op |
| Filename policy | Random UIDs generados (`manual_${Date.now().toString(36)}${Math.random()}`) |
| Storage | IndexedDB local — fuera de cualquier webroot |
| Execution | Nunca se ejecuta contenido uploaded (solo parse) |
| Size limits | nginx `client_max_body_size 200m` + app 10MB/photo |

### ⚪ Rule 9 — API Security

**N/A — app 100% client-side.** nginx `/api/` → 404 explícito para evitar masquerade si se monta detrás de proxy que enrute /api a backend que no existe.

### ✅ Rule 10 — Dependency Management

**Estado 2026-04-24:** `npm audit --omit=dev` → **0 vulnerabilities** ✓

| Dep | Versión | Notas |
|-----|---------|-------|
| xlsx | 0.20.3 (SheetJS CDN tgz) | Registry npm solo hostea <=0.18.5; 0.20.3 fixes CVE prototype pollution + ReDoS |
| jspdf | 4.2.1 | Pulls dompurify@>=3.2.4 (fix 7 DOMPurify XSS) |
| echarts | 6.0.0 | Pin exacto |
| Resto | Caret pins | Build-time solo (devDeps) |

Scripts audit:
- `npm run audit:deps` — `npm audit --omit=dev` (high+ only rompe build)
- `npm run audit:xss` — custom scan innerHTML patterns HTML legado
- `npm run audit:baseline` — snapshot check contra CI baseline
- `npm run audit:all` — compone los 3

---

## Gaps explícitamente aceptados

### CSP `unsafe-inline` presente

**Riesgo:** inline event handlers + inline styles pueden ejecutar si XSS encuentra bypass.
**Mitigación activa:**
- Event delegation refactor (audit-p1 #5) — zero dynamic inline handlers restantes
- `escHtml()` en todos outputs DOM
- CSP `default-src 'self'` + `connect-src 'self'` bloquea exfiltración
**Remediation:** sin timeline — requiere migrar 100+ inline styles HTML legado a clases CSS.

### IndexedDB unencrypted

**Riesgo:** attacker físico con acceso al dispositivo puede leer DB.
**Mitigación:** control físico del dispositivo es responsabilidad operacional.
**Remediation:** no implementada — encryption-at-rest sin auth sería security theater.

### No 2FA

**Justificación:** rule #3 N/A (no authn). Si se expone multi-user en futuro, requerirá sistema authn separado.

---

## Scripts de verificación

```bash
# Full compliance check:
npm run audit:all

# Individual:
npm run audit:deps   # CVE scan runtime deps
npm run audit:xss    # innerHTML pattern scan HTML legado
npm run audit:baseline  # snapshot diff contra estado conocido

# CI debería correr estos en cada PR (pendiente billing resuelto)
```

---

## Pipeline validation (2026-04-24)

- typecheck ✓
- vitest 519/519 ✓
- e2e 21/21 (13 core + 8 visual-smoke) ✓
- `npm audit --omit=dev`: **0 vulnerabilities**
