// renderActions — sub-tab "Acciones correctivas" del panel detalle.
// Reemplaza `renderActionsTab(u, body)` del legado (línea ~3013). DOM-API puro.
//
// Workflow: pendiente → en_progreso → resuelto
// Permite: crear acción desde hallazgo no-resuelto, botón "Agregar manual",
// transición de estado, eliminar.

import type { Finding, Unit } from "../../types";

export type ActionStatus = "pendiente" | "en_progreso" | "resuelto";

export type Action = {
  id: string;
  findingText: string;
  status: ActionStatus;
  assignee: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ActionsDB = Record<string, Action[]>;

const STATUS_COLORS: Record<ActionStatus, string> = {
  pendiente: "var(--R)",
  en_progreso: "var(--A)",
  resuelto: "var(--G)",
};
const STATUS_LABELS: Record<ActionStatus, string> = {
  pendiente: "Pendiente",
  en_progreso: "En Progreso",
  resuelto: "Resuelto",
};
const STATUS_ORDER: Record<ActionStatus, number> = {
  pendiente: 0,
  en_progreso: 1,
  resuelto: 2,
};

export type RenderActionsDeps = {
  unit: Unit;
  actionsDB?: ActionsDB;
  /** Callback para crear una acción (abre prompt, persiste, re-render). */
  onAdd?: (uid: string, findingText: string) => void;
  /** Callback para avanzar estado. */
  onUpdateStatus?: (uid: string, actionId: string, newStatus: ActionStatus) => void;
  /** Callback para eliminar. */
  onDelete?: (uid: string, actionId: string) => void;
  /** Para tests: override formateo de fecha. */
  formatDate?: (iso: string) => string;
};

function defaultFormatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function lucideIcon(name: string, size = 10, color?: string, fill?: string): HTMLElement {
  const i = document.createElement("i");
  i.setAttribute("data-lucide", name);
  let style = `width:${size}px;height:${size}px;vertical-align:-1px`;
  if (color) style += `;color:${color}`;
  if (fill) style += `;fill:${fill}`;
  i.style.cssText = style;
  return i;
}

function statusIcon(status: ActionStatus): HTMLElement {
  const color = STATUS_COLORS[status];
  if (status === "resuelto") return lucideIcon("check-circle-2", 11, color);
  return lucideIcon("circle", 10, color, color);
}

function summaryBar(actions: Action[]): HTMLElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "display:flex;gap:8px;margin-bottom:10px;font-size:10px";

  const counts: Record<ActionStatus, number> = { pendiente: 0, en_progreso: 0, resuelto: 0 };
  for (const a of actions) counts[a.status]++;

  const make = (status: ActionStatus, label: string): HTMLElement => {
    const span = document.createElement("span");
    span.style.cssText = `color:${STATUS_COLORS[status]};font-weight:600;display:inline-flex;align-items:center;gap:4px`;
    span.appendChild(statusIcon(status));
    span.appendChild(document.createTextNode(` ${counts[status]} ${label}`));
    return span;
  };

  wrap.appendChild(make("pendiente", counts.pendiente !== 1 ? "pendientes" : "pendiente"));
  wrap.appendChild(make("en_progreso", "en progreso"));
  wrap.appendChild(make("resuelto", counts.resuelto !== 1 ? "resueltos" : "resuelto"));
  return wrap;
}

function findingChipsSection(
  unit: Unit,
  onAdd?: (uid: string, findingText: string) => void,
): HTMLElement | null {
  const unresolved = unit.F.filter((f: Finding) => f.lv === "Urgente" || f.lv === "Revisar");
  if (unresolved.length === 0) return null;

  const wrap = document.createElement("div");
  wrap.style.marginBottom = "10px";

  const title = document.createElement("div");
  title.style.cssText = "font-size:10px;color:var(--s2);margin-bottom:4px;font-weight:600";
  title.textContent = "Crear accion desde hallazgo:";
  wrap.appendChild(title);

  const chips = document.createElement("div");
  chips.style.cssText = "display:flex;flex-wrap:wrap;gap:4px";

  for (const f of unresolved.slice(0, 6)) {
    const btn = document.createElement("button");
    const isUrg = f.lv === "Urgente";
    const color = isUrg ? "var(--R)" : "var(--A)";
    const bgColor = isUrg ? "var(--Rd)" : "var(--Ad)";
    const lnColor = isUrg ? "var(--Rl)" : "var(--Al)";
    btn.style.cssText = `padding:3px 8px;border:1px solid ${lnColor};border-radius:5px;font-size:9px;background:${bgColor};color:${color};cursor:pointer;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap`;
    btn.title = f.text;
    btn.textContent = `+ ${f.text.substring(0, 30)}`;
    if (onAdd) btn.addEventListener("click", () => onAdd(unit.uid, f.text));
    chips.appendChild(btn);
  }
  wrap.appendChild(chips);
  return wrap;
}

function emptyState(): HTMLElement {
  const empty = document.createElement("div");
  empty.style.cssText = "text-align:center;padding:24px;color:var(--s3);font-size:11px";
  empty.appendChild(document.createTextNode("No hay acciones registradas."));
  empty.appendChild(document.createElement("br"));
  empty.appendChild(
    document.createTextNode("Crea una accion desde los hallazgos o con el boton +"),
  );
  return empty;
}

function nextStatus(status: ActionStatus): ActionStatus | null {
  if (status === "pendiente") return "en_progreso";
  if (status === "en_progreso") return "resuelto";
  return null;
}

function actionCard(
  action: Action,
  uid: string,
  formatDate: (iso: string) => string,
  onUpdateStatus?: (uid: string, actionId: string, newStatus: ActionStatus) => void,
  onDelete?: (uid: string, actionId: string) => void,
): HTMLElement {
  const color = STATUS_COLORS[action.status] ?? "var(--s2)";
  const card = document.createElement("div");
  card.style.cssText = `padding:8px 10px;background:var(--bg2);border-radius:8px;margin-bottom:6px;border-left:3px solid ${color}`;

  // Top row: status label + action buttons
  const top = document.createElement("div");
  top.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-bottom:4px";

  const statusSpan = document.createElement("span");
  statusSpan.style.cssText = `font-size:10px;font-weight:700;color:${color};display:inline-flex;align-items:center;gap:4px`;
  statusSpan.appendChild(statusIcon(action.status));
  statusSpan.appendChild(document.createTextNode(` ${STATUS_LABELS[action.status]}`));
  top.appendChild(statusSpan);

  const btns = document.createElement("div");
  btns.style.cssText = "display:flex;gap:4px";

  const next = nextStatus(action.status);
  if (next && onUpdateStatus) {
    const advance = document.createElement("button");
    advance.style.cssText = `padding:2px 6px;border:1px solid ${STATUS_COLORS[next]};border-radius:4px;font-size:9px;background:none;color:${STATUS_COLORS[next]};cursor:pointer`;
    advance.textContent = STATUS_LABELS[next];
    advance.addEventListener("click", () => onUpdateStatus(uid, action.id, next));
    btns.appendChild(advance);
  }

  if (onDelete) {
    const del = document.createElement("button");
    del.style.cssText = "padding:2px 5px;border:none;background:none;color:var(--s3);cursor:pointer;font-size:10px";
    del.textContent = "✕";
    del.addEventListener("click", () => onDelete(uid, action.id));
    btns.appendChild(del);
  }

  top.appendChild(btns);
  card.appendChild(top);

  // Finding text
  const findingText = document.createElement("div");
  findingText.style.cssText = "font-size:11px;color:var(--w1);margin-bottom:3px";
  findingText.textContent = action.findingText;
  card.appendChild(findingText);

  // Assignee + notes
  const assigneeRow = document.createElement("div");
  assigneeRow.style.cssText = "font-size:10px;color:var(--s2);display:flex;align-items:center;gap:5px";
  assigneeRow.appendChild(lucideIcon("user", 11));
  assigneeRow.appendChild(document.createTextNode(` ${action.assignee}`));
  if (action.notes) {
    assigneeRow.appendChild(document.createTextNode(` · ${action.notes}`));
  }
  card.appendChild(assigneeRow);

  // Date
  const dateRow = document.createElement("div");
  dateRow.style.cssText = "font-size:9px;color:var(--s3);margin-top:2px";
  dateRow.textContent = `Creado: ${formatDate(action.createdAt)}`;
  card.appendChild(dateRow);

  return card;
}

function manualAddButton(uid: string, onAdd?: (uid: string, text: string) => void): HTMLElement {
  const btn = document.createElement("button");
  btn.style.cssText = "margin-top:6px;padding:6px 12px;border:1px dashed var(--ln);border-radius:6px;font-size:10px;background:none;color:var(--s1);cursor:pointer;width:100%";
  btn.textContent = "+ Agregar accion manual";
  if (onAdd) btn.addEventListener("click", () => onAdd(uid, ""));
  return btn;
}

// ═══════════════════════════════════════════════════════════════
//  renderActions — entry point
// ═══════════════════════════════════════════════════════════════

export function renderActions(container: HTMLElement, deps: RenderActionsDeps): void {
  const {
    unit,
    actionsDB = {},
    onAdd,
    onUpdateStatus,
    onDelete,
    formatDate = defaultFormatDate,
  } = deps;

  container.replaceChildren();

  const actions = actionsDB[unit.uid] ?? [];

  // Summary bar
  container.appendChild(summaryBar(actions));

  // Chips para crear desde hallazgo (si hay unresolved)
  const chips = findingChipsSection(unit, onAdd);
  if (chips) container.appendChild(chips);

  // Cards o empty state
  if (actions.length === 0) {
    container.appendChild(emptyState());
  } else {
    const sorted = [...actions].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    for (const a of sorted) {
      container.appendChild(actionCard(a, unit.uid, formatDate, onUpdateStatus, onDelete));
    }
  }

  // Botón manual siempre al final
  container.appendChild(manualAddButton(unit.uid, onAdd));
}

// Export helpers para reuso desde main.ts (avance de estado, constantes, etc.)
export { STATUS_COLORS, STATUS_LABELS, nextStatus };
