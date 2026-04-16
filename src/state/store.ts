// Store central tipado con pub/sub. Reemplaza gradualmente el estado global
// del legado (`window.units`, `window.selId`, `window.checklistDB`, etc.)
// por un objeto único al que los módulos nuevos se suscriben.
//
// Patrón: Store<T> genérico. Inmutable por update (shallow): cada `set`/
// `update` produce una nueva referencia de `State` para que los suscriptores
// comparen con `===` y decidan re-render.
//
// Coexistencia con legado: `bindWindowGlobals()` monta/desmonta espejos
// bidireccionales entre el store y `window.*`. Así los feature flags pueden
// activar módulos nuevos sin romper los callers legados que siguen leyendo
// `window.units` directamente.

export type Listener<T> = (state: T, prev: T) => void;
export type KeyListener<T, K extends keyof T> = (value: T[K], prev: T[K]) => void;

export class Store<T extends object> {
  private _state: T;
  private readonly _all = new Set<Listener<T>>();
  private readonly _byKey = new Map<keyof T, Set<(v: unknown, p: unknown) => void>>();

  constructor(initial: T) {
    this._state = { ...initial };
  }

  /** Snapshot actual (readonly por convención — no mutes). */
  get state(): Readonly<T> {
    return this._state;
  }

  get<K extends keyof T>(key: K): T[K] {
    return this._state[key];
  }

  /** Actualiza una clave; notifica subscribers globales + por-clave. */
  set<K extends keyof T>(key: K, value: T[K]): void {
    const prev = this._state;
    if (prev[key] === value) return;
    this._state = { ...prev, [key]: value };
    this._emit(prev, [key]);
  }

  /** Merge parcial (shallow). Útil para actualizar varios campos atómicamente. */
  update(partial: Partial<T>): void {
    const prev = this._state;
    const keys = Object.keys(partial) as Array<keyof T>;
    let changed = false;
    for (const k of keys) {
      if (partial[k] !== prev[k]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this._state = { ...prev, ...partial };
    this._emit(prev, keys);
  }

  /** Suscribe a cualquier cambio. Devuelve función de unsubscribe. */
  subscribe(listener: Listener<T>): () => void {
    this._all.add(listener);
    return () => this._all.delete(listener);
  }

  /** Suscribe solo a cambios de una clave específica. */
  subscribeKey<K extends keyof T>(key: K, listener: KeyListener<T, K>): () => void {
    let set = this._byKey.get(key);
    if (!set) {
      set = new Set();
      this._byKey.set(key, set);
    }
    set.add(listener as (v: unknown, p: unknown) => void);
    return () => set!.delete(listener as (v: unknown, p: unknown) => void);
  }

  /** Resetea a un nuevo estado inicial. Útil para tests. */
  reset(next: T): void {
    const prev = this._state;
    this._state = { ...next };
    const changedKeys = (Object.keys(next) as Array<keyof T>).filter(
      (k) => next[k] !== prev[k],
    );
    this._emit(prev, changedKeys);
  }

  private _emit(prev: T, changedKeys: Array<keyof T>): void {
    for (const l of this._all) l(this._state, prev);
    for (const k of changedKeys) {
      const subs = this._byKey.get(k);
      if (!subs) continue;
      const v = this._state[k];
      const p = prev[k];
      for (const sub of subs) sub(v as unknown, p as unknown);
    }
  }
}
