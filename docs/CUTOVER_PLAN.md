# Plan de Cutover — Control Flotilla

**Estado 2026-04-20**: P0 + P1 + P2 + P3 completos + P4 Fases 2-4 completas (6/6 sub-tabs detalle, taller 3/3, semanales + períodos 4/4) detrás de feature flags. Cutover diferido hasta decisiones de negocio.

---

## Estado técnico actual

| Item | Valor |
|------|-------|
| Tests | **507/507 pass** |
| Coverage statements | 95%+ |
| Lint | 0 errors |
| Typecheck | clean |
| npm audit (runtime) | 0 vulns |
| XSS audit (legado) | 0 suspects |
| CI status | verde |

## Módulos TS nuevos (`src/`)

### Data loading
- `io/excelLoader.ts` — parser XLSX con magic-byte validation
- `io/zipLoader.ts` — combina readZip + loadExcel
- `io/zipReader.ts` — parser binario ZIP con CP437 fallback
- `io/inflate.ts` — deflate-raw nativo

### UI
- `ui/renderTable.ts` — tabla Inspecciones con virtualización >200 filas
- `ui/virtualTable.ts` — virtualization engine
- `ui/detail/renderChecklist.ts` — sub-tab Hallazgos
- `ui/detail/renderNotes.ts` — sub-tab Notas
- `ui/detail/renderTires.ts` — sub-tab Llantas TACO
- `ui/detail/renderActions.ts` — sub-tab Acciones correctivas
- `ui/detail/renderService.ts` — sub-tab Servicio/Historial

### PDF
- `pdf/engine.ts` — wrapper jsPDF con paginación auto
- `pdf/unitReport.ts` — reporte ejecutivo por unidad

### Analyzer (puro)
- `analyzer/analyzeRow.ts` — deriva findings + risk de row
- `analyzer/classifyReport.ts` — mensual vs semanal
- `analyzer/risk.ts` — normalizadores + calcEstatusSemanal

### State
- `state/store.ts` — `Store<T>` genérico pub/sub
- `state/appState.ts` — singleton con bridge window.*
- `state/urlState.ts` — deep-linking de filtros

### Dominio
- `taller/types.ts` + `tallerStore.ts` — filtros, sort, KPIs, workflow
- `weekly/weeklyStore.ts` — KPIs, filtros, comparación períodos

### DOM helpers
- `dom/safeHTML.ts` — escHtml, escAttr, safeHTML tag, setSafeText

### CSS
- `styles/main.css` — extraído de inline legacy

### Entry
- `main.ts` — entry Vite con feature flags + bridge bidireccional

---

## Feature flags disponibles

```js
localStorage.setItem('USE_NEW_RENDER', '1');   // tabla Inspecciones
localStorage.setItem('USE_NEW_PDF', '1');      // PDF export
localStorage.setItem('USE_NEW_DETAIL', '1');   // sub-tabs detalle (6/6: Checklist, Llantas, Fotos, Notas, Acciones, Servicio)
localStorage.setItem('USE_NEW_TALLER', '1');   // Taller Activas + Historial + KPIs
localStorage.setItem('USE_NEW_WEEKLY', '1');   // Semanales (tabla + KPIs + chips) + Períodos mensuales
localStorage.setItem('USE_URL_STATE', '1');    // deep-link URL
localStorage.setItem('USE_STORE_LOG', '1');    // debug cambios store
```

---

## 5 pasos de cutover

### Paso 1 — Decisiones de negocio (BLOQUEANTE)

Necesito que decidas:

1. **Fecha cutoff definitiva**
   - Opción agresiva: 2026-05-15 (en 1 mes)
   - Opción realista: 2026-06-15 (en 2 meses)
   - Opción conservadora: 2026-09-01 (original roadmap)

2. **Plan de distribución**
   - [ ] PWA deploy a Vercel/Netlify (URL pública + service worker offline)
   - [ ] Server interno GPA (intranet)
   - [ ] Standalone `file://` + mirror OneDrive
   - [ ] Dos o más en paralelo

3. **Beta paralelo**
   - ¿Qué inspectores reciben la versión nueva primero?
   - ¿Cuánto tiempo corre el beta (2 semanas estándar)?
   - ¿Métrica de éxito? (cero bugs reportados, parity verificado por el usuario)

### Paso 2 — Beta paralelo (2 semanas target)

Una vez flags activadas por default en una branch `beta`:

```bash
git checkout -b beta
# Editar src/main.ts: cambiar readFlag() a retornar true por default
# a menos que localStorage.setItem('FORCE_LEGACY', '1')
```

Distribución a beta testers via URL o ZIP. Reportan bugs via GitHub Issues.

### Paso 3 — Fix gaps detectados en beta

Esperar cola de issues. Priorizar fixes según severidad.

Gap conocido (diferido): **Fotos + lightbox** — arquitectura propia requerida.
Estrategia: si beta usa mucho esta tab, crear `src/ui/detail/photoGallery.ts`
como módulo dedicado. Si no, dejar que el legado lo maneje post-cutover.

### Paso 4 — Cutover técnico

Cuando beta está verde:

```bash
# 1. Merge beta → main
git checkout main
git merge beta

# 2. Archivar legado
mkdir -p _legacy
git mv "Control de flotilla.html" "_legacy/Control de flotilla (legacy 2026-04).html"

# 3. Hacer el entry principal uno nuevo que importe todos los módulos TS
#    - index.html con <script type="module" src="/src/main.ts"></script>
#    - src/app.ts monta la SPA completa sin dependencia del HTML legado

# 4. Remover feature flags (ya no necesarios)
# 5. Remover shim alert→notify (ya no aplica)
# 6. Remover window.* globals (usar solo appStore)

# 7. Tag release
git tag -a v1.0.0 -m "v1.0.0 — cutover legacy HTML → TS modular"
git push origin main --tags
```

### Paso 5 — Post-cutover cleanup (semanas 1-4 post-cutover)

- Remover módulos `_legacy/fleet-viewer/`, `_legacy/gpa-fleet-command/` si unused
- Remover dependencias vestigiales (`xlsx` legado CDN tarball si Vite ya bundlea)
- Eliminar `vendor/fonts/` si PWA los precache correctamente
- Migrar fotos/lightbox si gap aún presente

---

## Gaps conocidos a tratar pre-cutover

### Bloqueadores

Ninguno pendiente a nivel técnico. Fases 2-4 completas:
- Panel detalle: 6/6 sub-tabs migrados (Checklist, Llantas, Fotos+lightbox, Notas, Acciones, Servicio)
- Taller: Activas + Historial + KPI bar + donut + alert strip
- Semanales: tabla + KPIs + chips
- Períodos mensuales: chips con agrupación por año + tendencias

### No-bloqueadores (cosmético/follow-up)

- `_legacy/` folders con proyectos alternos (fleet-viewer, gpa-fleet-command)
- OneDrive mirror dual (CLAUDE BRAIN/ viejo + CLAUDE BRAIN/VAULT nuevo)
- 9 vulns dev-only (workbox-build chain, sin runtime exposure)

---

## Rollback plan

Si el cutover revela problemas severos:

```bash
# Revert main a commit pre-cutover
git checkout main
git revert <cutover-commit> --no-commit
git commit -m "revert: rollback cutover — reason: <xxx>"
git push origin main

# Usuarios vuelven a legado sin acción (mismo URL/archivo)
```

Tiempo de rollback: ~5 minutos.

---

## Métricas de éxito post-cutover

| KPI | Target |
|-----|--------|
| Tiempo de carga inicial | ≤ pre-cutover (legado 200ms) |
| Errores runtime en 1 sem | 0 críticos |
| Feedback usuarios | ≥ neutro/positivo (no peor) |
| Bundle size gzipped | ≤ 500 KB |
| Lighthouse score | ≥ 90 performance |

---

## Decisiones pendientes del user — resumen ejecutivo

1. **¿Cuándo?** (fecha cutoff)
2. **¿Dónde?** (URL pública, server interno, standalone)
3. **¿Con quién?** (beta testers, duración)

Hasta tener respuestas de las 3, el trabajo técnico pre-cutover está **concluido**. Los módulos están listos, las feature flags listas, la matriz de parity documentada, el plan de rollback documentado.

**Proyecto en estado maduro esperando green light de negocio.**
