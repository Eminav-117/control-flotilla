// Modal de login vanilla TS. Aparece al boot si !isLoggedIn().
// Form simple email + password. Al success cierra modal y resuelve la Promise.
//
// XSS-safe: usa textContent + appendChild (no innerHTML con input usuario).
// Estilo: inline minimal — heredado del CSS app (--bg, --ac, etc.).

import { login } from "../api/auth";

export interface AuthModalOptions {
  /** Mensaje arriba del form (ej: "Sesión expirada"). Default: "Inicia sesión". */
  title?: string;
  /** Email pre-llenado para reintento tras error. */
  prefillEmail?: string;
}

/**
 * Muestra el modal y resuelve cuando login es exitoso.
 * El modal queda en DOM hasta success — sin opción de cerrar/cancelar.
 * Para logout flow, llamar logout() y re-mostrar este modal.
 */
export function showAuthModal(opts: AuthModalOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    // Backdrop fixed full-screen.
    const backdrop = document.createElement("div");
    backdrop.id = "auth-modal-backdrop";
    backdrop.style.cssText = [
      "position:fixed",
      "inset:0",
      "background:rgba(6,9,15,0.85)",
      "z-index:100000",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "backdrop-filter:blur(8px)",
    ].join(";");

    // Card.
    const card = document.createElement("div");
    card.style.cssText = [
      "background:var(--bg)",
      "border:1px solid var(--ln)",
      "border-radius:12px",
      "padding:32px",
      "min-width:340px",
      "max-width:90vw",
      "box-shadow:0 20px 40px rgba(0,0,0,0.5)",
      "font-family:Inter,system-ui,sans-serif",
    ].join(";");

    // Header.
    const h = document.createElement("h2");
    h.style.cssText = "margin:0 0 6px 0;font-size:20px;font-weight:600;color:var(--w1)";
    h.textContent = opts.title ?? "Control Flotilla";
    card.appendChild(h);

    const sub = document.createElement("p");
    sub.style.cssText = "margin:0 0 24px 0;font-size:13px;color:var(--s1)";
    sub.textContent = "Inicia sesión para continuar";
    card.appendChild(sub);

    // Email input.
    const emailLabel = document.createElement("label");
    emailLabel.style.cssText =
      "display:block;font-size:11px;font-weight:600;color:var(--s1);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px";
    emailLabel.textContent = "Email";
    card.appendChild(emailLabel);

    const emailInput = document.createElement("input");
    emailInput.type = "email";
    emailInput.autocomplete = "username";
    emailInput.required = true;
    emailInput.value = opts.prefillEmail ?? "";
    emailInput.style.cssText = [
      "width:100%",
      "padding:10px 12px",
      "font-size:14px",
      "background:var(--bg2)",
      "border:1px solid var(--ln)",
      "border-radius:8px",
      "color:var(--w1)",
      "margin-bottom:16px",
      "box-sizing:border-box",
      "font-family:inherit",
    ].join(";");
    card.appendChild(emailInput);

    // Password input.
    const passLabel = document.createElement("label");
    passLabel.style.cssText = emailLabel.style.cssText;
    passLabel.textContent = "Password";
    card.appendChild(passLabel);

    const passInput = document.createElement("input");
    passInput.type = "password";
    passInput.autocomplete = "current-password";
    passInput.required = true;
    passInput.style.cssText = emailInput.style.cssText;
    passInput.style.marginBottom = "20px";
    card.appendChild(passInput);

    // Error message holder.
    const err = document.createElement("div");
    err.style.cssText =
      "font-size:12px;color:var(--R);margin-bottom:12px;min-height:18px;line-height:1.4";
    card.appendChild(err);

    // Submit button.
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = "Iniciar sesión";
    btn.style.cssText = [
      "width:100%",
      "padding:11px",
      "background:var(--ac)",
      "color:#fff",
      "border:none",
      "border-radius:8px",
      "font-size:14px",
      "font-weight:600",
      "cursor:pointer",
      "transition:background 0.12s",
      "font-family:inherit",
    ].join(";");
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "var(--ac2)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "var(--ac)";
    });
    card.appendChild(btn);

    backdrop.appendChild(card);
    document.body.appendChild(backdrop);

    // Auto-focus email (o password si email pre-llenado).
    setTimeout(() => {
      if (opts.prefillEmail) passInput.focus();
      else emailInput.focus();
    }, 50);

    // Submit handler.
    const handleSubmit = async (): Promise<void> => {
      const email = emailInput.value.trim();
      const password = passInput.value;
      if (!email || !password) {
        err.textContent = "Email y password requeridos";
        return;
      }
      btn.disabled = true;
      btn.textContent = "Verificando...";
      err.textContent = "";
      try {
        await login(email, password);
        backdrop.remove();
        resolve();
      } catch (e) {
        err.textContent = (e as Error).message || "Error de autenticación";
        btn.disabled = false;
        btn.textContent = "Iniciar sesión";
        passInput.value = "";
        passInput.focus();
      }
    };

    btn.addEventListener("click", handleSubmit);
    // Enter en cualquier input dispara submit.
    [emailInput, passInput].forEach((inp) => {
      inp.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          void handleSubmit();
        }
      });
    });
  });
}
