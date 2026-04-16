// main.ts — entry point Vite-served. Cargado por el legado via
// `<script type="module" src="/src/main.ts"></script>` (Vite lo resuelve en
// dev; para file:// no hace nada, el legado sigue usando su renderTable inline).
//
// Feature flag para probar módulos nuevos sin romper producción:
//   localStorage.setItem('USE_NEW_RENDER', '1')  →  usa src/ui/renderTable
//   localStorage.removeItem('USE_NEW_RENDER')    →  legado (default)

import { renderTable as renderTableNew } from "./ui/renderTable";
import { buildUnitReport } from "./pdf/unitReport";
import type { Unit, ChecklistDB } from "./types";

declare global {
  interface Window {
    units?: Unit[];
    selId?: string | null;
    checklistDB?: ChecklistDB;
    hasZip?: boolean;
    isUnitEnTaller?: (u: Unit) => boolean;
    parseSvcDate?: (s: string) => Date | null;
    selUnit?: (uid: string) => void;
    /** override del legado — si feature flag activa. */
    renderTable?: () => void;
    exportPDF?: () => void | Promise<void>;
    filt?: () => Unit[];
    /** flag interno para detectar si el module-script se cargó. */
    __newRenderAvailable?: boolean;
  }
}

window.__newRenderAvailable = true;

const flag = (() => {
  try {
    return localStorage.getItem("USE_NEW_RENDER") === "1";
  } catch {
    return false;
  }
})();

if (flag) {
  const legacyRenderTable = window.renderTable;

  window.renderTable = function renderTableShim() {
    const tbody = document.getElementById("tbody");
    if (!tbody) return;
    const rows = window.filt ? window.filt() : window.units ?? [];
    const rcnt = document.getElementById("rcnt");
    if (rcnt) rcnt.textContent = `${rows.length}/${(window.units ?? []).length}`;
    try {
      renderTableNew(tbody, {
        units: rows,
        selectedUid: window.selId ?? null,
        checklistDB: window.checklistDB ?? {},
        hasZip: window.hasZip ?? false,
        isUnitEnTaller: window.isUnitEnTaller,
        parseSvcDate: window.parseSvcDate,
        onSelect: window.selUnit,
      });
    } catch (err) {
      console.error("[renderTable/new] falló, fallback a legado:", err);
      if (legacyRenderTable) legacyRenderTable.call(window);
    }
  };

  console.info(
    "[control-flotilla] USE_NEW_RENDER activo — tabla Inspecciones usa src/ui/renderTable.ts. " +
    "Desactiva con: localStorage.removeItem('USE_NEW_RENDER')",
  );
}

// ─── Feature flag: PDF export (P2.2d) ──────────────────────────────────
const pdfFlag = (() => {
  try {
    return localStorage.getItem("USE_NEW_PDF") === "1";
  } catch {
    return false;
  }
})();

if (pdfFlag) {
  const legacyExportPDF = window.exportPDF;

  window.exportPDF = async function exportPDFShim() {
    const units = window.units ?? [];
    const selId = window.selId ?? null;
    const unit = units.find((u) => u.uid === selId);
    if (!unit) {
      alert("Selecciona una unidad primero.");
      return;
    }
    try {
      const doc = buildUnitReport(unit, {
        checklistDB: window.checklistDB ?? {},
        generatedAt: new Date(),
      });
      const filename = `reporte_${unit.eco || unit.plate || unit.uid}_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error("[exportPDF/new] falló, fallback a legado:", err);
      if (legacyExportPDF) await legacyExportPDF.call(window);
    }
  };

  console.info(
    "[control-flotilla] USE_NEW_PDF activo — exportPDF usa src/pdf/unitReport.ts. " +
    "Desactiva con: localStorage.removeItem('USE_NEW_PDF')",
  );
}
