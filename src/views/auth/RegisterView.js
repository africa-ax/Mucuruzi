// ============================================================
// RegisterView.js — Mucuruzi Registration Screen
// ============================================================

import { register, ROLES, BUSINESS_ROLES } from "/src/auth/Auth.js";

export function renderRegisterView(onLoginSuccess) {
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
          <h1 class="brand-headline">Join Rwanda's Digital Supply Chain</h1>
          <p class="brand-sub">
            Register your business and start trading with
            EBM-compliant invoices, automated VAT, and
            real-time stock management.
          </p>
          <div class="brand-badges">
            <span class="badge">RRA Compliant</span>
            <span class="badge">EBM Ready</span>
            <span class="badge">VAT Automated</span>
          </div>
        </div>
      </div>

      <!-- Right Panel: Register Form -->
      <div class="auth-form-panel">
        <div class="auth-card auth-card--register">

          <div class="auth-card-header">
            <h2>Create Account</h2>
            <p>Set up your Mucuruzi account</p>
          </div>

          <!-- Error / Success -->
          <div id="register-error" class="auth-alert auth-alert--error hidden"></div>
          <div id="register-success" class="auth-alert auth-alert--success hidden"></div>

          <div class="auth-form">

            <!-- Role Selector -->
            <div class="form-group">
              <label for="reg-role">Account Type</label>
              <div class="input-wrapper">
                <span class="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </span>
                <select id="reg-role" class="form-input form-select">
                  <option value="" disabled selected>Select your role</option>
                  <option value="manufacturer">Manufacturer</option>
                  <option value="distributor">Distributor</option>
                  <option value="retailer">Retailer</option>
                  <option value="buyer">Buyer</option>
                </select>
              </div>
            </div>

            <!-- BUSINESS FIELDS (Manufacturer / Distributor / Retailer) -->
            <div id="business-fields" class="hidden">

              <div class="form-group">
                <label for="reg-business-name">Business Name</label>
                <div class="input-wrapper">
                  <span class="input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                  </span>
                  <input type="text" id="reg-business-name" class="form-input" placeholder="e.g. Kigali Foods Ltd" />
                </div>
              </div>

              <div class="form-group">
                <label for="reg-owner-name">Owner / Director Name</label>
                <div class="input-wrapper">
                  <span class="input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                  <input type="text" id="reg-owner-name" class="form-input" placeholder="Full legal name" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="reg-tin">TIN Number</label>
                  <div class="input-wrapper">
                    <span class="input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="3" width="20" height="14" rx="2"/>
                        <path d="M8 21h8M12 17v4"/>
                      </svg>
                    </span>
                    <input type="text" id="reg-tin" class="form-input" placeholder="9-digit TIN" maxlength="9" />
                  </div>
                </div>

                <div class="form-group">
                  <label for="reg-sdc">SDC Device ID</label>
                  <div class="input-wrapper">
                    <span class="input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                      </svg>
                    </span>
                    <input type="text" id="reg-sdc" class="form-input" placeholder="SDC-XXXX" />
                  </div>
                </div>
              </div>

            </div>

            <!-- BUYER FIELDS -->
            <div id="buyer-fields" class="hidden">
              <div class="form-group">
                <label for="reg-name">Full Name</label>
                <div class="input-wrapper">
                  <span class="input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                  <input type="text" id="reg-name" class="form-input" placeholder="Your full name" />
                </div>
              </div>
            </div>

            <!-- SHARED FIELDS (always visible after role select) -->
            <div id="shared-fields" class="hidden">

              <div class="form-group">
                <label for="reg-phone">Phone Number</label>
                <div class="input-wrapper">
                  <span class="input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.61 5a2 2 0 0 1 1.99-2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.09a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                    </svg>
                  </span>
                  <input type="tel" id="reg-phone" class="form-input" placeholder="+250 7XX XXX XXX" />
                </div>
              </div>

              <div class="form-group">
                <label for="reg-email">Email Address</label>
                <div class="input-wrapper">
                  <span class="input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,12 2,6"/>
                    </svg>
                  </span>
                  <input type="email" id="reg-email" class="form-input" placeholder="you@business.com" />
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label for="reg-password">Password</label>
                  <div class="input-wrapper">
                    <span class="input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </span>
                    <input type="password" id="reg-password" class="form-input" placeholder="Min. 6 characters" />
                    <button type="button" class="input-toggle-password" id="toggle-reg-password" aria-label="Show password">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div class="form-group">
                  <label for="reg-confirm-password">Confirm Password</label>
                  <div class="input-wrapper">
                    <span class="input-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </span>
                    <input type="password" id="reg-confirm-password" class="form-input" placeholder="Re-enter password" />
                  </div>
                </div>
              </div>

              <!-- Terms -->
              <div class="form-group form-check-group">
                <label class="checkbox-label">
                  <input type="checkbox" id="reg-terms" class="form-checkbox" />
                  <span>
                    I agree to the
                    <a href="#terms" class="link-blue" id="link-terms">Terms & Conditions</a>
                    and
                    <a href="#privacy" class="link-blue" id="link-privacy">Privacy Policy</a>
                  </span>
                </label>
              </div>

              <button type="button" class="btn-primary btn-full" id="btn-register">
                <span id="reg-btn-text">Create Account</span>
                <span id="reg-btn-spinner" class="btn-spinner hidden"></span>
              </button>

            </div>

          </div>

          <div class="auth-divider">
            <span>Already have an account?</span>
          </div>

          <button type="button" class="btn-outline btn-full" id="btn-go-login">
            Sign In
          </button>

        </div>
      </div>

    </div>
  `;

  // ── Role Selector: Toggle Fields ─────────────────────────────
  document.getElementById("reg-role").addEventListener("change", (e) => {
    const role = e.target.value;
    const businessFields = document.getElementById("business-fields");
    const buyerFields = document.getElementById("buyer-fields");
    const sharedFields = document.getElementById("shared-fields");

    businessFields.classList.add("hidden");
    buyerFields.classList.add("hidden");

    if (BUSINESS_ROLES.includes(role)) {
      businessFields.classList.remove("hidden");
    } else if (role === ROLES.BUYER) {
      buyerFields.classList.remove("hidden");
    }

    sharedFields.classList.remove("hidden");
  });

  // ── Toggle Password Visibility ───────────────────────────────
  document.getElementById("toggle-reg-password").addEventListener("click", () => {
    const input = document.getElementById("reg-password");
    input.type = input.type === "password" ? "text" : "password";
  });

  // ── Register Button ──────────────────────────────────────────
  document.getElementById("btn-register").addEventListener("click", async () => {
    await handleRegister(onLoginSuccess);
  });

  // ── Go to Login ──────────────────────────────────────────────
  document.getElementById("btn-go-login").addEventListener("click", () => {
    import("./LoginView.js").then((m) => m.renderLoginView(onLoginSuccess));
  });

  // ── Terms Links (placeholders) ───────────────────────────────
  document.getElementById("link-terms").addEventListener("click", (e) => {
    e.preventDefault();
    alert("Terms & Conditions — Coming soon.");
  });

  document.getElementById("link-privacy").addEventListener("click", (e) => {
    e.preventDefault();
    alert("Privacy Policy — Coming soon.");
  });
}

// ── Handle Register ──────────────────────────────────────────
async function handleRegister(onLoginSuccess) {
  clearMessages();

  const role = document.getElementById("reg-role").value;
  if (!role) {
    showError("Please select your account type.");
    return;
  }

  const email = document.getElementById("reg-email").value.trim();
  const phone = document.getElementById("reg-phone").value.trim();
  const password = document.getElementById("reg-password").value;
  const confirmPassword = document.getElementById("reg-confirm-password").value;
  const termsChecked = document.getElementById("reg-terms").checked;

  // Validation
  if (!email || !phone || !password || !confirmPassword) {
    showError("Please fill in all required fields.");
    return;
  }

  if (password !== confirmPassword) {
    showError("Passwords do not match.");
    return;
  }

  if (password.length < 6) {
    showError("Password must be at least 6 characters.");
    return;
  }

  if (!termsChecked) {
    showError("Please accept the Terms & Conditions to continue.");
    return;
  }

  const data = { email, phone, password, role };

  if (BUSINESS_ROLES.includes(role)) {
    data.businessName = document.getElementById("reg-business-name").value.trim();
    data.ownerName = document.getElementById("reg-owner-name").value.trim();
    data.tinNumber = document.getElementById("reg-tin").value.trim();
    data.sdcId = document.getElementById("reg-sdc").value.trim();

    if (!data.businessName || !data.ownerName || !data.tinNumber) {
      showError("Please fill in all business fields.");
      return;
    }
  } else {
    data.name = document.getElementById("reg-name").value.trim();
    if (!data.name) {
      showError("Please enter your full name.");
      return;
    }
  }

  setLoading(true);

  const result = await register(data);

  setLoading(false);

  if (result.success) {
    if (role === "manufacturer") {
      // Show pending message — do not navigate
      showSuccess(
        "Account created! Your manufacturer account is pending admin approval. You will be notified once approved."
      );
      // Clear form
      document.getElementById("reg-role").value = "";
      document.getElementById("business-fields").classList.add("hidden");
      document.getElementById("shared-fields").classList.add("hidden");
    } else {
      // Navigate straight to dashboard
      onLoginSuccess(result.user);
    }
  } else {
    showError(result.error);
  }
}

// ── Helpers ──────────────────────────────────────────────────
function showError(msg) {
  const el = document.getElementById("register-error");
  el.textContent = msg;
  el.classList.remove("hidden");
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function showSuccess(msg) {
  const el = document.getElementById("register-success");
  el.textContent = msg;
  el.classList.remove("hidden");
  el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function clearMessages() {
  document.getElementById("register-error").classList.add("hidden");
  document.getElementById("register-success").classList.add("hidden");
}

function setLoading(loading) {
  const btn = document.getElementById("btn-register");
  const text = document.getElementById("reg-btn-text");
  const spinner = document.getElementById("reg-btn-spinner");
  btn.disabled = loading;
  text.textContent = loading ? "Creating account…" : "Create Account";
  spinner.classList.toggle("hidden", !loading);
    }
