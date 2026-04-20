import { describe, expect, it, vi } from "vitest";
import {
  renderPeriodoBar,
  renderWeeklyPeriodoBar,
  type MonthlyPeriodo,
} from "../src/weekly/renderPeriodoBar";
import type { WeeklyPeriodo } from "../src/weekly/weeklyStore";
import type { Unit, WeeklyEntry } from "../src/types";

function mkUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    uid: "u",
    eco: "A-1",
    risk: "OK",
    F: [],
    T: {},
    minT: null,
    ...overrides,
  };
}

function mkMonthly(overrides: Partial<MonthlyPeriodo> = {}): MonthlyPeriodo {
  return {
    id: "2026-04",
    label: "Abril 2026",
    mes: 4,
    anio: 2026,
    units: [mkUnit()],
    ...overrides,
  };
}

function mkEntry(overrides: Partial<WeeklyEntry> = {}): WeeklyEntry {
  return {
    uid: "e",
    aceiteRisk: "OK",
    radiadorRisk: "OK",
    carroceriaRisk: "OK",
    llantaRisk: "OK",
    ...overrides,
  };
}

function mkWeekly(overrides: Partial<WeeklyPeriodo> = {}): WeeklyPeriodo {
  return { id: "p1", label: "2026-W16", entries: [], ...overrides };
}

function setup() {
  document.body.replaceChildren();
  const bar = document.createElement("div");
  bar.id = "periodo-bar";
  const chips = document.createElement("div");
  chips.id = "periodo-chips";
  const btnT = document.createElement("button");
  btnT.id = "btn-tendencias";
  btnT.style.display = "none";
  document.body.append(bar, chips, btnT);
  return { bar, chips, btnT };
}

// ═══════════════════════════════════════════════════════════════
//  renderPeriodoBar (mensual)
// ═══════════════════════════════════════════════════════════════

describe("renderPeriodoBar", () => {
  it("sin periodos → bar sin clase visible, chips vacios, btnT oculto", () => {
    const { bar, chips, btnT } = setup();
    renderPeriodoBar({
      bar,
      chips,
      btnTendencias: btnT,
      periodos: [],
      activeId: null,
      onSwitch: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(bar.classList.contains("visible")).toBe(false);
    expect(chips.textContent).toBe("");
    expect(btnT.style.display).toBe("none");
  });

  it("1-4 periodos → render plano, chip por periodo + boton del", () => {
    const { bar, chips, btnT } = setup();
    renderPeriodoBar({
      bar,
      chips,
      btnTendencias: btnT,
      periodos: [mkMonthly({ id: "a" }), mkMonthly({ id: "b" })],
      activeId: "a",
      onSwitch: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(bar.classList.contains("visible")).toBe(true);
    expect(chips.querySelectorAll(".periodo-chip:not(.del)").length).toBe(2);
    expect(chips.querySelectorAll(".periodo-chip.del").length).toBe(2);
  });

  it("periodo activo recibe clase 'active'", () => {
    const { bar, chips, btnT } = setup();
    renderPeriodoBar({
      bar,
      chips,
      btnTendencias: btnT,
      periodos: [mkMonthly({ id: "a" }), mkMonthly({ id: "b" })],
      activeId: "b",
      onSwitch: vi.fn(),
      onDelete: vi.fn(),
    });
    const active = chips.querySelectorAll(".periodo-chip.active");
    expect(active.length).toBe(1);
    expect((active[0] as HTMLElement).textContent).toContain("Abril");
  });

  it("btnTendencias visible solo con >=2 periodos", () => {
    const { bar, chips, btnT } = setup();
    renderPeriodoBar({
      bar,
      chips,
      btnTendencias: btnT,
      periodos: [mkMonthly({ id: "a" })],
      activeId: "a",
      onSwitch: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(btnT.style.display).toBe("none");
    renderPeriodoBar({
      bar,
      chips,
      btnTendencias: btnT,
      periodos: [mkMonthly({ id: "a" }), mkMonthly({ id: "b" })],
      activeId: "a",
      onSwitch: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(btnT.style.display).toBe("inline-block");
  });

  it("click chip dispara onSwitch", () => {
    const { bar, chips, btnT } = setup();
    const onSwitch = vi.fn();
    renderPeriodoBar({
      bar,
      chips,
      btnTendencias: btnT,
      periodos: [mkMonthly({ id: "X" })],
      activeId: null,
      onSwitch,
      onDelete: vi.fn(),
    });
    (chips.querySelector(".periodo-chip:not(.del)") as HTMLElement).click();
    expect(onSwitch).toHaveBeenCalledWith("X");
  });

  it("click del dispara onDelete y NO onSwitch", () => {
    const { bar, chips, btnT } = setup();
    const onSwitch = vi.fn();
    const onDelete = vi.fn();
    renderPeriodoBar({
      bar,
      chips,
      btnTendencias: btnT,
      periodos: [mkMonthly({ id: "X" })],
      activeId: null,
      onSwitch,
      onDelete,
    });
    (chips.querySelector(".periodo-chip.del") as HTMLElement).click();
    expect(onDelete).toHaveBeenCalledWith("X");
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it(">4 periodos → agrupa por año con separadores", () => {
    const { bar, chips, btnT } = setup();
    const periodos = [
      mkMonthly({ id: "2025-01", mes: 1, anio: 2025 }),
      mkMonthly({ id: "2025-02", mes: 2, anio: 2025 }),
      mkMonthly({ id: "2026-01", mes: 1, anio: 2026 }),
      mkMonthly({ id: "2026-02", mes: 2, anio: 2026 }),
      mkMonthly({ id: "2026-03", mes: 3, anio: 2026 }),
    ];
    renderPeriodoBar({
      bar,
      chips,
      btnTendencias: btnT,
      periodos,
      activeId: null,
      onSwitch: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(chips.textContent).toContain("2025:");
    expect(chips.textContent).toContain("2026:");
    expect(chips.textContent).toContain("│");
    expect(chips.querySelectorAll(".periodo-chip:not(.del)").length).toBe(5);
  });

  it("dotColor rojo cuando urgente>20%", () => {
    const { bar, chips, btnT } = setup();
    const units = [
      mkUnit({ uid: "1", risk: "Urgente" }),
      mkUnit({ uid: "2", risk: "Urgente" }),
      mkUnit({ uid: "3", risk: "OK" }),
    ];
    renderPeriodoBar({
      bar,
      chips,
      btnTendencias: btnT,
      periodos: [
        mkMonthly({ id: "a", units }),
        mkMonthly({ id: "b" }),
        mkMonthly({ id: "c" }),
        mkMonthly({ id: "d" }),
        mkMonthly({ id: "e" }),
      ],
      activeId: null,
      onSwitch: vi.fn(),
      onDelete: vi.fn(),
    });
    const firstChip = chips.querySelector(".periodo-chip:not(.del)") as HTMLElement;
    const dot = firstChip.querySelector("span") as HTMLElement;
    expect(dot.style.cssText).toContain("var(--R)");
  });

  it("XSS safe — label con HTML no ejecuta", () => {
    const { bar, chips, btnT } = setup();
    renderPeriodoBar({
      bar,
      chips,
      btnTendencias: btnT,
      periodos: [mkMonthly({ id: "x", label: "<img onerror=x>", mes: undefined })],
      activeId: null,
      onSwitch: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(chips.querySelector("img")).toBeFalsy();
    expect(chips.textContent).toContain("<img onerror=x>");
  });

  it("reemplaza contenido previo", () => {
    const { bar, chips, btnT } = setup();
    chips.innerHTML = "<span>STALE</span>";
    renderPeriodoBar({
      bar,
      chips,
      btnTendencias: btnT,
      periodos: [mkMonthly()],
      activeId: null,
      onSwitch: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(chips.textContent).not.toContain("STALE");
  });
});

// ═══════════════════════════════════════════════════════════════
//  renderWeeklyPeriodoBar
// ═══════════════════════════════════════════════════════════════

describe("renderWeeklyPeriodoBar", () => {
  function setupChips() {
    document.body.replaceChildren();
    const c = document.createElement("div");
    document.body.appendChild(c);
    return c;
  }

  it("sin periodos → placeholder 'Sin períodos cargados'", () => {
    const chips = setupChips();
    renderWeeklyPeriodoBar({
      chips,
      periodos: [],
      activeId: null,
      onSwitch: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(chips.textContent).toContain("Sin períodos cargados");
  });

  it("renderiza chip + del por periodo", () => {
    const chips = setupChips();
    renderWeeklyPeriodoBar({
      chips,
      periodos: [mkWeekly({ id: "a" }), mkWeekly({ id: "b", label: "2026-W17" })],
      activeId: "a",
      onSwitch: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(chips.querySelectorAll(".sw-periodo-chip").length).toBe(2);
    expect(chips.querySelectorAll(".sw-periodo-del").length).toBe(2);
  });

  it("periodo activo tiene clase 'active'", () => {
    const chips = setupChips();
    renderWeeklyPeriodoBar({
      chips,
      periodos: [mkWeekly({ id: "a" }), mkWeekly({ id: "b" })],
      activeId: "b",
      onSwitch: vi.fn(),
      onDelete: vi.fn(),
    });
    const active = chips.querySelectorAll(".sw-periodo-chip.active");
    expect(active.length).toBe(1);
  });

  it("muestra tag rojo con count de urgentes", () => {
    const chips = setupChips();
    renderWeeklyPeriodoBar({
      chips,
      periodos: [
        mkWeekly({
          entries: [
            mkEntry({ aceiteRisk: "Urgente" }),
            mkEntry({ radiadorRisk: "Urgente" }),
            mkEntry(),
          ],
        }),
      ],
      activeId: null,
      onSwitch: vi.fn(),
      onDelete: vi.fn(),
    });
    const chip = chips.querySelector(".sw-periodo-chip") as HTMLElement;
    expect(chip.textContent).toContain("2");
    expect(chip.querySelector("i[data-lucide='zap']")).toBeTruthy();
  });

  it("sin urgentes → sin tag", () => {
    const chips = setupChips();
    renderWeeklyPeriodoBar({
      chips,
      periodos: [mkWeekly({ entries: [mkEntry()] })],
      activeId: null,
      onSwitch: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(chips.querySelector("i[data-lucide='zap']")).toBeFalsy();
  });

  it("click chip dispara onSwitch", () => {
    const chips = setupChips();
    const onSwitch = vi.fn();
    renderWeeklyPeriodoBar({
      chips,
      periodos: [mkWeekly({ id: "X" })],
      activeId: null,
      onSwitch,
      onDelete: vi.fn(),
    });
    (chips.querySelector(".sw-periodo-chip") as HTMLElement).click();
    expect(onSwitch).toHaveBeenCalledWith("X");
  });

  it("click del dispara onDelete y NO onSwitch", () => {
    const chips = setupChips();
    const onSwitch = vi.fn();
    const onDelete = vi.fn();
    renderWeeklyPeriodoBar({
      chips,
      periodos: [mkWeekly({ id: "X" })],
      activeId: null,
      onSwitch,
      onDelete,
    });
    (chips.querySelector(".sw-periodo-del") as HTMLElement).click();
    expect(onDelete).toHaveBeenCalledWith("X");
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("XSS safe — label con HTML no ejecuta", () => {
    const chips = setupChips();
    renderWeeklyPeriodoBar({
      chips,
      periodos: [mkWeekly({ label: "<img onerror=x>" })],
      activeId: null,
      onSwitch: vi.fn(),
      onDelete: vi.fn(),
    });
    expect(chips.querySelector("img")).toBeFalsy();
    expect(chips.textContent).toContain("<img onerror=x>");
  });
});
