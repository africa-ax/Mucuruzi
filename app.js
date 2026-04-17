// ============================================================
// app.js — Mucuruzi App Entry + Auth Router
// ============================================================

import { onAuthChange } from "/src/auth/Auth.js";
import { renderLoginView } from "/src/views/auth/LoginView.js";
import { renderDashboard } from "/src/views/dashboard/DashboardView.js";

// ── Boot ─────────────────────────────────────────────────────
function boot() {
  onAuthChange((session) => {
    if (!session) {
      renderLoginView(onLoginSuccess);
    } else {
      renderDashboard(session.profile);
    }
  });
}

// ── On Login Success ─────────────────────────────────────────
function onLoginSuccess(profile) {
  renderDashboard(profile);
}

// ── Start ─────────────────────────────────────────────────────
boot();
