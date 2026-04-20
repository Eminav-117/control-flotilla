// renderPeriodoBar — barras de chips de periodo (mensual + semanal).
// DOM via createElement (XSS-safe).

import type { Unit } from "../types";
import { effRisk } from "./weeklyStore";
import type { WeeklyPeriodo } from "./weeklyStore";

// ═══════════════════════════════════════════════════════════════
//  Mensual
// ═══════════════════════════════════════════════════════════════

export type MonthlyPeriodo = {
  id: string;
  label: string;
  mes?: number;
  anio?: number | string;
  units: Unit[];
};

const MES_NAMES = [
  "",
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function urgentePct(units: Unit[]): number {
  if (!units.length) return 0;
  return Math.round((units.filter((u) => u.risk === "Urgente").length / units.length) * 100);
}

function makeChip(
  label: string,
  isActive: boolean,
  title: string | undefined,
  dotColor: string | undefined,
  onClick: () => void,
): HTMLElement {
  const chip = document.createElement("span");
  chip.className = "periodo-chip" + (isActive ? " active" : "");
  if (title) chip.title = title;
  chip.addEventListener("click", onClick);
  if (dotColor) {
    const dot = document.createElement("span");
    dot.style.cssText = `display:inline-block;width:5px;height:5px;border-radius:50%;background:${dotColor};margin-right:3px`;
    chip.appendChild(dot);
  }
  chip.appendChild(document.createTextNode(label));
  return chip;
}

function makeDelBtn(title: string, onClick: () => void): HTMLElement {
  const btn = document.createElement("button");
  btn.className = "periodo-chip del";
  btn.title = title;
  btn.textContent = "✕";
  btn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    onClick();
  });
  return btn;
}

export type RenderPeriodoBarDeps = {
  bar: HTMLElement | null;
  chips: HTMLElement | null;
  btnTendencias: HTMLElement | null;
  periodos: MonthlyPeriodo[];
  activeId: string | null;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
};

export function renderPeriodoBar(deps: RenderPeriodoBarDeps): void {
  const { bar, chips, btnTendencias, periodos, activeId, onSwitch, onDelete } = deps;
  if (!bar || !chips) return;

  if (periodos.length < 1) {
    bar.classList.remove("visible");
    chips.textContent = "";
    if (btnTendencias) btnTendencias.style.display = "none";
    return;
  }
  bar.classList.add("visible");
  chips.textContent = "";

  if (periodos.length > 4) {
    const byYear = new Map<string, MonthlyPeriodo[]>();
    for (const p of periodos) {
      const yr = String(p.anio ?? p.id.slice(0, 4) ?? "?");
      const arr = byYear.get(yr);
      if (arr) arr.push(p);
      else byYear.set(yr, [p]);
    }
    const years = [...byYear.keys()].sort();
    years.forEach((yr, yi) => {
      if (yi > 0) {
        const sep = document.createElement("span");
        sep.style.cssText = "color:var(--ln);margin:0 2px";
        sep.textContent = "│";
        chips.appendChild(sep);
      }
      const yrLbl = document.createElement("span");
      yrLbl.style.cssText =
        "font-size:9px;font-weight:700;color:var(--s2);padding:2px 4px;letter-spacing:.5px";
      yrLbl.textContent = yr + ":";
      chips.appendChild(yrLbl);
      for (const p of byYear.get(yr)!) {
        const isActive = p.id === activeId;
        const shortLabel = p.mes ? MES_NAMES[p.mes]!.substring(0, 3) : p.label;
        const pct = urgentePct(p.units);
        const dotColor = pct > 20 ? "var(--R)" : pct > 10 ? "var(--A)" : "var(--G)";
        const title = `${p.label} · ${p.units.length} unidades · ${pct}% urgente`;
        chips.appendChild(makeChip(shortLabel, isActive, title, dotColor, () => onSwitch(p.id)));
        chips.appendChild(makeDelBtn("Eliminar periodo", () => onDelete(p.id)));
      }
    });
  } else {
    for (const p of periodos) {
      const isActive = p.id === activeId;
      chips.appendChild(makeChip(p.label, isActive, undefined, undefined, () => onSwitch(p.id)));
      chips.appendChild(makeDelBtn("Eliminar periodo", () => onDelete(p.id)));
    }
  }

  if (btnTendencias) {
    btnTendencias.style.display = periodos.length >= 2 ? "inline-block" : "none";
  }
}

// ═══════════════════════════════════════════════════════════════
//  Semanal
// ═══════════════════════════════════════════════════════════════

export type RenderWeeklyPeriodoBarDeps = {
  chips: HTMLElement | null;
  periodos: WeeklyPeriodo[];
  activeId: string | null;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
};

export function renderWeeklyPeriodoBar(deps: RenderWeeklyPeriodoBarDeps): void {
  const { chips, periodos, activeId, onSwitch, onDelete } = deps;
  if (!chips) return;
  chips.textContent = "";

  if (!periodos.length) {
    const s = document.createElement("span");
    s.style.cssText = "font-size:10px;color:var(--s3)";
    s.textContent = "Sin períodos cargados";
    chips.appendChild(s);
    return;
  }

  for (const p of periodos) {
    const isActive = p.id === activeId;
    const chip = document.createElement("span");
    chip.className = "sw-periodo-chip" + (isActive ? " active" : "");
    chip.addEventListener("click", () => onSwitch(p.id));
    chip.appendChild(document.createTextNode(p.label));

    const nUrg = p.entries.filter((e) => effRisk(e) === "Urgente").length;
    if (nUrg) {
      const tag = document.createElement("span");
      tag.style.cssText =
        "background:var(--R);color:#fff;border-radius:6px;padding:0 4px;font-size:8px;margin-left:3px;display:inline-flex;align-items:center;gap:2px";
      tag.textContent = String(nUrg);
      const i = document.createElement("i");
      i.setAttribute("data-lucide", "zap");
      i.style.cssText = "width:8px;height:8px";
      tag.appendChild(i);
      chip.appendChild(tag);
    }
    chips.appendChild(chip);

    const del = document.createElement("span");
    del.className = "sw-periodo-del";
    del.title = "Eliminar período";
    del.textContent = "✕";
    del.addEventListener("click", (ev) => {
      ev.stopPropagation();
      onDelete(p.id);
    });
    chips.appendChild(del);
  }
}
