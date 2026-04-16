// ============================================================
// app.js — Mucuruzi App Entry + Auth Router
// ============================================================

import { onAuthChange } from "./src/auth/Auth.js";
import { renderLoginView } from "./src/views/auth/LoginView.js";

// ── Boot ─────────────────────────────────────────────────────
function boot() {
  // Listen for auth state
  onAuthChange((session) => {
    if (!session) {
      // Not logged in → show login
      renderLoginView(onLoginSuccess);
    } else {
      // Logged in → route to dashboard
      routeToDashboard(session.profile);
    }
  });
}

// ── On Login Success ─────────────────────────────────────────
function onLoginSuccess(profile) {
  routeToDashboard(profile);
}

// ── Dashboard Router (role-based) ────────────────────────────
async function routeToDashboard(profile) {
  // Dashboard will be built next — placeholder for now
  const container = document.getElementById("app");
  container.innerHTML = `
    <div style="
      display:flex;
      align-items:center;
      justify-content:center;
      min-height:100vh;
      font-family:'Inter',sans-serif;
      background:#f8fafc;
    ">
      <div style="text-align:center; padding:2rem;">
        <div style="
          width:56px;height:56px;
          background:#1a6fd4;
          border-radius:14px;
          display:flex;align-items:center;justify-content:center;
          font-weight:800;font-size:1.5rem;color:white;
          margin:0 auto 1rem;
          font-family:'Plus Jakarta Sans',sans-serif;
        ">M</div>
        <h2 style="font-size:1.4rem;font-weight:700;color:#0f172a;margin-bottom:.5rem;">
          Welcome, ${profile.businessName || profile.name || profile.email}
        </h2>
        <p style="color:#64748b;font-size:.9rem;margin-bottom:1.5rem;">
          Role: <strong style="color:#1a6fd4;text-transform:capitalize;">${profile.role}</strong>
        </p>
        <p style="color:#94a3b8;font-size:.82rem;">
          Dashboard is being built. Next step coming soon.
        </p>
      </div>
    </div>
  `;
}

// ── Start ─────────────────────────────────────────────────────
boot();
