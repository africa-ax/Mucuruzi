// ============================================================
// app.js — Mucuruzi App Entry + Auth Router
// ============================================================

import { onAuthChange } from "/src/auth/Auth.js";
import { renderLoginView } from "/src/views/auth/LoginView.js";
import { renderDashboard } from "/src/views/dashboard/DashboardView.js";

function boot() {
  onAuthChange((session) => {
    if (!session) {
      renderLoginView(onLoginSuccess);
    } else if (session.profile.status === "pending") {
      renderPendingScreen(session.profile);
    } else {
      renderDashboard(session.profile);
    }
  });
}

function onLoginSuccess(profile) {
  if (profile.status === "pending") {
    renderPendingScreen(profile);
  } else {
    renderDashboard(profile);
  }
}

function renderPendingScreen(profile) {
  document.getElementById("app").innerHTML = `
    <div style="
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#f8fafc;
      padding:1.5rem;
      font-family:'Inter',sans-serif;
    ">
      <div style="
        background:#fff;
        border-radius:16px;
        padding:2rem 1.75rem;
        max-width:380px;
        width:100%;
        text-align:center;
        box-shadow:0 4px 24px rgba(0,0,0,.08);
        border:1.5px solid #e2e8f0;
      ">
        <div style="
          width:64px;height:64px;
          background:#fff7ed;
          border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          margin:0 auto 1.25rem;
          font-size:1.75rem;
        ">⏳</div>

        <h2 style="
          font-family:'Plus Jakarta Sans',sans-serif;
          font-size:1.25rem;
          font-weight:800;
          color:#0f172a;
          margin-bottom:.5rem;
          letter-spacing:-.02em;
        ">Awaiting Approval</h2>

        <p style="
          font-size:.875rem;
          color:#64748b;
          line-height:1.7;
          margin-bottom:1.5rem;
        ">
          Your manufacturer account for
          <strong style="color:#0f172a;">${profile.businessName || "your business"}</strong>
          has been submitted and is pending admin review.
          <br><br>
          You will be able to log in once your account is approved.
        </p>

        <div style="
          background:#f1f5f9;
          border-radius:10px;
          padding:.875rem 1rem;
          margin-bottom:1.5rem;
          text-align:left;
        ">
          <div style="font-size:.72rem;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem;">Submitted Details</div>
          <div style="font-size:.82rem;color:#334155;font-weight:500;">${profile.businessName || "—"}</div>
          <div style="font-size:.78rem;color:#64748b;">${profile.email || "—"}</div>
          <div style="font-size:.78rem;color:#64748b;">TIN: ${profile.tinNumber || "—"}</div>
        </div>

        <button onclick="handleLogout()" style="
          width:100%;
          height:44px;
          background:#f1f5f9;
          color:#475569;
          border:none;
          border-radius:10px;
          font-size:.875rem;
          font-weight:600;
          font-family:'Inter',sans-serif;
          cursor:pointer;
        ">Sign Out</button>
      </div>
    </div>
  `;

  window.handleLogout = async () => {
    const { logout } = await import("/src/auth/Auth.js");
    await logout();
  };
}

boot();
