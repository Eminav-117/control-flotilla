import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  nextStatus,
  renderActions,
  STATUS_LABELS,
  type Action,
  type ActionsDB,
} from "../src/ui/detail/renderActions";
import type { Unit } from "../src/types";

function makeUnit(overrides: Partial<Unit> = {}): Unit {
  return {
    uid: "u1",
    risk: "OK",
    F: [],
    T: {},
    minT: null,
    ...overrides,
  };
}

function mkAction(overrides: Partial<Action> = {}): Action {
  return {
    id: "a1",
    findingText: "Arreglar llanta",
    status: "pendiente",
    assignee: "Juan",
    notes: "",
    createdAt: "2026-04-15T10:00:00Z",
    updatedAt: "2026-04-15T10:00:00Z",
    ...overrides,
  };
}

function setupContainer(): HTMLElement {
  document.body.replaceChildren();
  const c = document.createElement("div");
  document.body.appendChild(c);
  return c;
}

function fixedDate(_iso: string): string {
  return "15 abr";
}

describe("nextStatus", () => {
  it("pendiente → en_progreso", () => expect(nextStatus("pendiente")).toBe("en_progreso"));
  it("en_progreso → resuelto", () => expect(nextStatus("en_progreso")).toBe("resuelto"));
  it("resuelto → null (terminal)", () => expect(nextStatus("resuelto")).toBeNull());
});

describe("renderActions", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("empty state sin acciones → mensaje + botón manual", () => {
    const c = setupContainer();
    renderActions(c, { unit: makeUnit(), formatDate: fixedDate });
    expect(c.textContent).toContain("No hay acciones registradas");
    expect(c.querySelector("button")?.textContent).toContain("Agregar accion manual");
  });

  it("summary bar cuenta por estado", () => {
    const c = setupContainer();
    const db: ActionsDB = {
      u1: [
        mkAction({ id: "1", status: "pendiente" }),
        mkAction({ id: "2", status: "pendiente" }),
        mkAction({ id: "3", status: "en_progreso" }),
        mkAction({ id: "4", status: "resuelto" }),
      ],
    };
    renderActions(c, { unit: makeUnit(), actionsDB: db, formatDate: fixedDate });
    expect(c.textContent).toContain("2 pendientes");
    expect(c.textContent).toContain("1 en progreso");
    expect(c.textContent).toContain("1 resuelto");
  });

  it("summary singular/plural", () => {
    const c = setupContainer();
    const db: ActionsDB = { u1: [mkAction({ status: "pendiente" })] };
    renderActions(c, { unit: makeUnit(), actionsDB: db, formatDate: fixedDate });
    expect(c.textContent).toContain("1 pendiente");
    expect(c.textContent).not.toContain("1 pendientes");
  });

  it("chips desde hallazgos Urgente/Revisar (máx 6)", () => {
    const c = setupContainer();
    const u = makeUnit({
      F: [
        { cat: "Llantas", text: "u1", lv: "Urgente" },
        { cat: "Llantas", text: "u2", lv: "Urgente" },
        { cat: "Fluidos", text: "r1", lv: "Revisar" },
        { cat: "Documentos", text: "c1", lv: "Completar" }, // no urg/rev → skip
      ],
    });
    renderActions(c, { unit: u, formatDate: fixedDate });
    const chipBtns = [...c.querySelectorAll("button")].filter((b) =>
      b.textContent?.startsWith("+") && b.textContent.length < 50,
    );
    // Botones: 3 chips + 1 manual add
    expect(chipBtns.length).toBe(4);
  });

  it("click chip dispara onAdd con uid + findingText", () => {
    const c = setupContainer();
    const onAdd = vi.fn();
    const u = makeUnit({
      F: [{ cat: "Llantas", text: "revisar piloto", lv: "Urgente" }],
    });
    renderActions(c, { unit: u, onAdd, formatDate: fixedDate });
    const chipBtn = [...c.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("revisar piloto"),
    ) as HTMLButtonElement;
    chipBtn.click();
    expect(onAdd).toHaveBeenCalledWith("u1", "revisar piloto");
  });

  it("click botón manual dispara onAdd con texto vacío", () => {
    const c = setupContainer();
    const onAdd = vi.fn();
    renderActions(c, { unit: makeUnit(), onAdd, formatDate: fixedDate });
    const manualBtn = [...c.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("manual"),
    ) as HTMLButtonElement;
    manualBtn.click();
    expect(onAdd).toHaveBeenCalledWith("u1", "");
  });

  it("action card muestra status label, assignee, notes, fecha formatted", () => {
    const c = setupContainer();
    const db: ActionsDB = {
      u1: [
        mkAction({
          status: "en_progreso",
          assignee: "Maria",
          notes: "llamar proveedor",
          findingText: "cambiar batería",
        }),
      ],
    };
    renderActions(c, { unit: makeUnit(), actionsDB: db, formatDate: fixedDate });
    expect(c.textContent).toContain(STATUS_LABELS.en_progreso);
    expect(c.textContent).toContain("cambiar batería");
    expect(c.textContent).toContain("Maria");
    expect(c.textContent).toContain("llamar proveedor");
    expect(c.textContent).toContain("15 abr");
  });

  it("pendiente → botón 'En Progreso' dispara onUpdateStatus", () => {
    const c = setupContainer();
    const onUpdateStatus = vi.fn();
    const db: ActionsDB = { u1: [mkAction({ id: "a1", status: "pendiente" })] };
    renderActions(c, {
      unit: makeUnit(),
      actionsDB: db,
      onUpdateStatus,
      formatDate: fixedDate,
    });
    const advanceBtn = [...c.querySelectorAll("button")].find(
      (b) => b.textContent === "En Progreso",
    ) as HTMLButtonElement;
    advanceBtn.click();
    expect(onUpdateStatus).toHaveBeenCalledWith("u1", "a1", "en_progreso");
  });

  it("en_progreso → botón 'Resuelto' dispara onUpdateStatus", () => {
    const c = setupContainer();
    const onUpdateStatus = vi.fn();
    const db: ActionsDB = { u1: [mkAction({ id: "a1", status: "en_progreso" })] };
    renderActions(c, { unit: makeUnit(), actionsDB: db, onUpdateStatus, formatDate: fixedDate });
    const advanceBtn = [...c.querySelectorAll("button")].find(
      (b) => b.textContent === "Resuelto",
    ) as HTMLButtonElement;
    advanceBtn.click();
    expect(onUpdateStatus).toHaveBeenCalledWith("u1", "a1", "resuelto");
  });

  it("resuelto → SIN botón advance (terminal)", () => {
    const c = setupContainer();
    const db: ActionsDB = { u1: [mkAction({ id: "a1", status: "resuelto" })] };
    renderActions(c, { unit: makeUnit(), actionsDB: db, formatDate: fixedDate });
    const advanceBtn = [...c.querySelectorAll("button")].find(
      (b) => b.textContent === "En Progreso" || b.textContent === "Resuelto",
    );
    expect(advanceBtn).toBeUndefined();
  });

  it("botón ✕ dispara onDelete", () => {
    const c = setupContainer();
    const onDelete = vi.fn();
    const db: ActionsDB = { u1: [mkAction({ id: "action-xyz" })] };
    renderActions(c, { unit: makeUnit(), actionsDB: db, onDelete, formatDate: fixedDate });
    const delBtn = [...c.querySelectorAll("button")].find((b) => b.textContent === "✕") as HTMLButtonElement;
    delBtn.click();
    expect(onDelete).toHaveBeenCalledWith("u1", "action-xyz");
  });

  it("ordena pendiente → en_progreso → resuelto", () => {
    const c = setupContainer();
    const db: ActionsDB = {
      u1: [
        mkAction({ id: "1", status: "resuelto", findingText: "zzz" }),
        mkAction({ id: "2", status: "pendiente", findingText: "aaa" }),
        mkAction({ id: "3", status: "en_progreso", findingText: "mmm" }),
      ],
    };
    renderActions(c, { unit: makeUnit(), actionsDB: db, formatDate: fixedDate });
    const texts = c.textContent || "";
    expect(texts.indexOf("aaa")).toBeLessThan(texts.indexOf("mmm"));
    expect(texts.indexOf("mmm")).toBeLessThan(texts.indexOf("zzz"));
  });

  it("input hostil en findingText/assignee/notes → textContent safe", () => {
    const c = setupContainer();
    const db: ActionsDB = {
      u1: [
        mkAction({
          findingText: '<img src=x onerror=alert(1)>',
          assignee: '<script>evil</script>',
          notes: "<svg onload=x>",
        }),
      ],
    };
    renderActions(c, { unit: makeUnit(), actionsDB: db, formatDate: fixedDate });
    expect(c.querySelector("img")).toBeNull();
    expect(c.querySelector("script")).toBeNull();
    expect(c.querySelector("svg")).toBeNull();
  });

  it("re-render reemplaza contenido", () => {
    const c = setupContainer();
    renderActions(c, {
      unit: makeUnit(),
      actionsDB: { u1: [mkAction()] },
      formatDate: fixedDate,
    });
    expect(c.textContent).toContain("Arreglar llanta");
    renderActions(c, { unit: makeUnit(), actionsDB: {}, formatDate: fixedDate });
    expect(c.textContent).not.toContain("Arreglar llanta");
    expect(c.textContent).toContain("No hay acciones");
  });
});
