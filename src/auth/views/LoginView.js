// ============================================================
// LoginView.js — Mucuruzi Login Screen
// ============================================================

import { login, resetPassword } from "../../auth/Auth.js";

export function renderLoginView(onLoginSuccess) {
  const container = document.getElementById("app");

  container.innerHTML = `
    <div class="auth-page">

      <!-- Left Panel: Branding -->
      <div class="auth-brand">
        <div class="auth-brand-inner">
          <div class="brand-logo">
            <div class="brand-logo-icon">M</div>
            <span class="brand-logo-text">Mucuruzi</span>
          </div>
          <h1 class="brand-headline">Rwanda's Digital Supply Chain</h1>
          <p class="brand-sub">
            EBM-compliant invoicing, automated stock management,
            and real-time commerce — from Manufacturer to Buyer.
          </p>
          <div class="brand-badges">
            <span class="badge">RRA Compliant</span>
            <span class="badge">EBM Ready</span>
            <span class="badge">VAT Automated</span>
          </div>
        </div>
      </div>

      <!-- Right Panel: Login Form -->
      <div class="auth-form-panel">
        <div class="auth-card">

          <div class="auth-card-header">
            <h2>Welcome back</h2>
            <p>Sign in to your business account</p>
          </div>

          <!-- Error Message -->
          <div id="login-error" class="auth-alert auth-alert--error hidden"></div>

          <!-- Success Message (for password reset) -->
          <div id="login-success" class="auth-alert auth-alert--success hidden"></div>

          <div class="auth-form">

            <div class="form-group">
              <label for="login-email">Email Address</label>
              <div class="input-wrapper">
                <span class="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,12 2,6"/>
                  </svg>
                </span>
                <input
                  type="email"
                  id="login-email"
                  class="form-input"
                  placeholder="you@business.com"
                  autocomplete="email"
                />
              </div>
            </div>

            <div class="form-group">
              <label for="login-password">Password</label>
              <div class="input-wrapper">
                <span class="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  type="password"
                  id="login-password"
                  class="form-input"
                  placeholder="Enter your password"
                  autocomplete="current-password"
                />
                <button type="button" class="input-toggle-password" id="toggle-login-password" aria-label="Show password">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
              </div>
            </div>

            <div class="form-action-row">
              <button type="button" class="btn-link" id="btn-forgot-password">
                Forgot password?
              </button>
            </div>

            <button type="button" class="btn-primary btn-full" id="btn-login">
              <span id="login-btn-text">Sign In</span>
              <span id="login-btn-spinner" class="btn-spinner hidden"></span>
            </button>

          </div>

          <div class="auth-divider">
            <span>Don't have an account?</span>
          </div>

          <button type="button" class="btn-outline btn-full" id="btn-go-register">
            Create Account
          </button>

        </div>
      </div>

    </div>
  `;

  // ── Bind Events ─────────────────────────────────────────────

  // Toggle password visibility
  document.getElementById("toggle-login-password").addEventListener("click", () => {
    const input = document.getElementById("login-password");
    input.type = input.type === "password" ? "text" : "password";
  });

  // Login button
  document.getElementById("btn-login").addEventListener("click", async () => {
    await handleLogin(onLoginSuccess);
  });

  // Enter key on password field
  document.getElementById("login-password").addEventListener("keydown", async (e) => {
    if (e.key === "Enter") await handleLogin(onLoginSuccess);
  });

  // Forgot password
  document.getElementById("btn-forgot-password").addEventListener("click", () => {
    showResetModal();
  });

  // Go to register
  document.getElementById("btn-go-register").addEventListener("click", () => {
    import("./RegisterView.js").then((m) => m.renderRegisterView(onLoginSuccess));
  });
}

// ── Handle Login ─────────────────────────────────────────────
async function handleLogin(onLoginSuccess) {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  clearMessages();

  if (!email || !password) {
    showError("Please enter your email and password.");
    return;
  }

  setLoading(true);

  const result = await login(email, password);

  setLoading(false);

  if (result.success) {
    onLoginSuccess(result.profile);
  } else {
    showError(result.error);
  }
}

// ── Reset Password Modal ─────────────────────────────────────
function showResetModal() {
  // Remove any existing modal
  const existing = document.getElementById("reset-modal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "reset-modal";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-header">
        <h3>Reset Password</h3>
        <button class="modal-close" id="close-reset-modal">&times;</button>
      </div>
      <p class="modal-desc">Enter your email address and we'll send you a reset link.</p>
      <div class="form-group">
        <label for="reset-email">Email Address</label>
        <input type="email" id="reset-email" class="form-input" placeholder="you@business.com" />
      </div>
      <div id="reset-modal-error" class="auth-alert auth-alert--error hidden"></div>
      <div id="reset-modal-success" class="auth-alert auth-alert--success hidden"></div>
      <div class="modal-actions">
        <button class="btn-outline" id="cancel-reset">Cancel</button>
        <button class="btn-primary" id="confirm-reset">Send Reset Link</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById("close-reset-modal").addEventListener("click", () => modal.remove());
  document.getElementById("cancel-reset").addEventListener("click", () => modal.remove());

  document.getElementById("confirm-reset").addEventListener("click", async () => {
    const email = document.getElementById("reset-email").value.trim();
    const errEl = document.getElementById("reset-modal-error");
    const succEl = document.getElementById("reset-modal-success");

    errEl.classList.add("hidden");
    succEl.classList.add("hidden");

    if (!email) {
      errEl.textContent = "Please enter your email address.";
      errEl.classList.remove("hidden");
      return;
    }

    const result = await resetPassword(email);

    if (result.success) {
      succEl.textContent = "Reset link sent! Check your email.";
      succEl.classList.remove("hidden");
      setTimeout(() => modal.remove(), 3000);
    } else {
      errEl.textContent = result.error;
      errEl.classList.remove("hidden");
    }
  });
}

// ── Helpers ──────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById("login-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}

function clearMessages() {
  document.getElementById("login-error").classList.add("hidden");
  document.getElementById("login-success").classList.add("hidden");
}

function setLoading(loading) {
  const btn = document.getElementById("btn-login");
  const text = document.getElementById("login-btn-text");
  const spinner = document.getElementById("login-btn-spinner");
  btn.disabled = loading;
  text.textContent = loading ? "Signing in…" : "Sign In";
  spinner.classList.toggle("hidden", !loading);
    }
