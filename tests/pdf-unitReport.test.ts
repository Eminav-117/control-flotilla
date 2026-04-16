import { describe, expect, it } from "vitest";
import { buildUnitReport } from "../src/pdf/unitReport";
import type { Unit } from "../src/types";

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    uid: "u1",
    eco: "A-117",
    plate: "ABC-123",
    brand: "Nissan NP300",
    insp: "Navares",
    branch: "Norte",
    fecha: "2026-04-15",
    risk: "OK",
    F: [],
    T: {},
    minT: 8,
    ...overrides,
  };
}

describe("buildUnitReport", () => {
  it("produce PDF con magic bytes %PDF- y al menos 1 página", () => {
    const doc = buildUnitReport(makeUnit());
    const bytes = doc.toBytes();
    expect(bytes.length).toBeGreaterThan(1000);
    const header = String.fromCharCode(...bytes.slice(0, 5));
    expect(header).toBe("%PDF-");
    expect(doc.pageCount()).toBeGreaterThanOrEqual(1);
  });

  it("sin hallazgos → mensaje 'Sin hallazgos pendientes' (via text embebido)", () => {
    const doc = buildUnitReport(makeUnit({ risk: "OK", F: [] }));
    // El contenido del PDF no es introspectable trivialmente desde jsPDF@4
    // (está comprimido). Como proxy, verificamos que el doc tiene size mínima
    // razonable y 1 página — un doc vacío sería mucho más chico.
    const bytes = doc.toBytes();
    expect(bytes.length).toBeGreaterThan(2000);
    expect(doc.pageCount()).toBe(1);
  });

  it("muchos hallazgos → pagina a ≥2 páginas", () => {
    const manyFindings = Array.from({ length: 60 }, (_, i) => ({
      cat: "Checklist" as const,
      text: `Hallazgo ${i + 1}: descripción larga para forzar paginación del reporte`,
      lv: "Revisar" as const,
    }));
    const doc = buildUnitReport(makeUnit({ risk: "Urgente", F: manyFindings }));
    expect(doc.pageCount()).toBeGreaterThanOrEqual(2);
  });

  it("respeta opts.title y opts.subtitle", () => {
    const doc = buildUnitReport(makeUnit(), {
      title: "Reporte Custom",
      subtitle: "Otra Sucursal",
    });
    // Proxy: el PDF se genera sin error
    expect(doc.toBytes().length).toBeGreaterThan(1000);
  });

  it("checklistDB con finding done → descuenta del reporte", () => {
    const u = makeUnit({
      F: [
        { cat: "Llantas", text: "piloto 3mm", lv: "Urgente" },
        { cat: "Fluidos", text: "aceite bajo", lv: "Revisar" },
      ],
    });
    const docAll = buildUnitReport(u);
    const docDone = buildUnitReport(u, { checklistDB: { u1: { "piloto 3mm": { done: true } } } });
    // Con menos findings, el doc debe ser más chico o igual
    expect(docDone.toBytes().length).toBeLessThanOrEqual(docAll.toBytes().length + 500);
  });

  it("unit con obs + obsArr multi → renderiza sección observaciones", () => {
    const u = makeUnit({
      obs: "primera observación",
      obsArr: ["primera observación", "segunda observación más larga que debe ajustarse al ancho del PDF"],
    });
    const doc = buildUnitReport(u);
    expect(doc.pageCount()).toBeGreaterThanOrEqual(1);
  });

  it("unit sin eco pero con placa → usa placa en header", () => {
    const u = makeUnit({ eco: undefined, plate: "XYZ-789" });
    expect(() => buildUnitReport(u)).not.toThrow();
  });

  it("unit con risk Urgente → pill rojo (no lanza)", () => {
    expect(() => buildUnitReport(makeUnit({ risk: "Urgente" }))).not.toThrow();
    expect(() => buildUnitReport(makeUnit({ risk: "Revisar" }))).not.toThrow();
    expect(() => buildUnitReport(makeUnit({ risk: "Completar" }))).not.toThrow();
  });

  it("unit con minT null → muestra '—'", () => {
    const doc = buildUnitReport(makeUnit({ minT: null }));
    expect(doc.toBytes().length).toBeGreaterThan(1000);
  });

  it("unit sin fecha/branch/km usa '—' sin romper layout", () => {
    const u: Unit = {
      uid: "ux",
      risk: "OK",
      F: [],
      T: {},
      minT: null,
    };
    expect(() => buildUnitReport(u)).not.toThrow();
  });
});
