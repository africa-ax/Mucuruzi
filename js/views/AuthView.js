// ============================================================
//  MUCURUZI — AuthView.js
//  Renders Login, Register, and Forgot Password screens.
// ============================================================

const AuthView = (() => {

  const _root = () => document.getElementById('app-root');

  const DISTRICTS = [
    'Bugesera','Burera','Gakenke','Gasabo','Gatsibo','Gicumbi','Gisagara',
    'Huye','Kamonyi','Karongi','Kayonza','Kicukiro','Kirehe','Muhanga',
    'Musanze','Ngoma','Ngororero','Nyabihu','Nyagatare','Nyamagabe',
    'Nyamasheke','Nyanza','Nyarugenge','Nyaruguru','Rubavu','Ruhango',
    'Rulindo','Rusizi','Rutsiro','Rwamagana',
  ];

  const _districtOptions = () =>
    DISTRICTS.map(d => `<option value="${d}">${d}</option>`).join('');

  const _shell = (content) => `
    <div class="auth-page">
      <div class="auth-bg"></div>
      <div class="auth-container">
        <div class="auth-brand">
          <div class="auth-logo">M</div>
          <div>
            <h1 class="auth-brand-name">${APP.NAME}</h1>
            <p class="auth-brand-tagline">${APP.TAGLINE}</p>
          </div>
        </div>
        <div class="auth-card">${content}</div>
      </div>
    </div>
  `;

  // ── Login ────────────────────────────────────────────────────
  const showLogin = () => {
    _root().innerHTML = _shell(`
      <h2 class="auth-title">Welcome back</h2>
      <p class="auth-subtitle">Sign in to your account</p>
      <div id="auth-error" class="auth-error hidden"></div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input id="login-email" type="email" class="form-input" placeholder="your@email.com" autocomplete="email" />
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <div class="input-password-wrap">
          <input id="login-password" type="password" class="form-input" placeholder="Your password" />
          <button type="button" class="btn-eye" onclick="AuthView._togglePassword('login-password',this)">👁</button>
        </div>
      </div>
      <div class="auth-forgot">
        <a href="#" onclick="AuthView.showForgotPassword();return false;">Forgot password?</a>
      </div>
      <button id="login-btn" class="btn btn-primary btn-block btn-lg" onclick="AuthView._handleLogin()">Sign In</button>
      <div class="auth-divider"><span>or</span></div>
      <button class="btn btn-google btn-block" onclick="AuthView._handleGoogle()">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
          <path d="M3.964 10.707A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>
      <p class="auth-switch">Don't have an account? <a href="#" onclick="AuthView.showRegister();return false;">Register here</a></p>
    `);
    document.getElementById('login-password')
      .addEventListener('keydown', e => { if (e.key === 'Enter') AuthView._handleLogin(); });
  };

  // ── Register ─────────────────────────────────────────────────
  const showRegister = () => {
    _root().innerHTML = _shell(`
      <h2 class="auth-title">Create account</h2>
      <p class="auth-subtitle">Join Mucuruzi — Rwanda's supply chain platform</p>
      <div id="auth-error" class="auth-error hidden"></div>
      <div class="form-group">
        <label class="form-label">I am a</label>
        <div class="role-selector" id="role-selector">
          ${Object.entries(ROLE_LABELS).map(([val, label]) => `
            <button type="button" class="role-btn ${val==='buyer'?'active':''}"
              data-role="${val}" onclick="AuthView._selectRole('${val}')">
              <span class="role-btn-icon">${_roleIcon(val)}</span>
              <span>${label}</span>
            </button>
          `).join('')}
        </div>
        <input type="hidden" id="reg-role" value="buyer" />
      </div>
      <div class="form-group">
        <label class="form-label">Business / Full Name</label>
        <input id="reg-name" type="text" class="form-input" placeholder="e.g. Kigali Fresh Foods Ltd" />
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input id="reg-email" type="email" class="form-input" placeholder="your@email.com" />
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <div class="input-password-wrap">
          <input id="reg-password" type="password" class="form-input" placeholder="Min. 6 characters" />
          <button type="button" class="btn-eye" onclick="AuthView._togglePassword('reg-password',this)">👁</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Phone Number</label>
        <input id="reg-phone" type="tel" class="form-input" placeholder="e.g. 0788123456" />
      </div>
      <div class="form-group">
        <label class="form-label">District</label>
        <select id="reg-district" class="form-select">
          <option value="">Select district</option>
          ${_districtOptions()}
        </select>
      </div>
      <div id="seller-fields" class="hidden">
        <div class="form-group">
          <label class="form-label">TIN Number</label>
          <input id="reg-tin" type="text" class="form-input" placeholder="9-digit TIN e.g. 100000001" maxlength="9" />
          <p class="form-hint">Your Rwanda Revenue Authority Tax Identification Number</p>
        </div>
        <div class="form-group">
          <label class="form-label">SDC Device ID</label>
          <input id="reg-sdc" type="text" class="form-input" placeholder="e.g. SDC-001-2024" />
          <p class="form-hint">Your EBM Smart Device Controller ID from RRA</p>
        </div>
      </div>
      <div class="form-group auth-terms">
        <label class="checkbox-label">
          <input type="checkbox" id="reg-terms" />
          <span>I agree to the
            <a href="#" onclick="AuthView._openTerms();return false;">Terms & Conditions</a>
            and
            <a href="#" onclick="AuthView._openPrivacy();return false;">Privacy Policy</a>
          </span>
        </label>
      </div>
      <button id="register-btn" class="btn btn-primary btn-block btn-lg" onclick="AuthView._handleRegister()">Create Account</button>
      <p class="auth-switch">Already have an account? <a href="#" onclick="AuthView.showLogin();return false;">Sign in</a></p>
    `);
  };

  // ── Forgot Password ──────────────────────────────────────────
  const showForgotPassword = () => {
    _root().innerHTML = _shell(`
      <h2 class="auth-title">Reset password</h2>
      <p class="auth-subtitle">Enter your email and we'll send you a reset link</p>
      <div id="auth-error" class="auth-error hidden"></div>
      <div id="auth-success" class="auth-success hidden"></div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input id="reset-email" type="email" class="form-input" placeholder="your@email.com" />
      </div>
      <button id="reset-btn" class="btn btn-primary btn-block btn-lg" onclick="AuthView._handleReset()">Send Reset Link</button>
      <p class="auth-switch"><a href="#" onclick="AuthView.showLogin();return false;">← Back to Sign In</a></p>
    `);
    document.getElementById('reset-email')
      .addEventListener('keydown', e => { if (e.key === 'Enter') AuthView._handleReset(); });
  };

  // ── Handlers ─────────────────────────────────────────────────
  const _handleLogin = async () => {
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) return _showError('Please enter your email and password.');
    _setLoading('login-btn', true, 'Signing in...');
    const result = await AuthService.login(email, password);
    _setLoading('login-btn', false, 'Sign In');
    if (!result.success) _showError(result.error);
  };

  const _handleGoogle = async () => {
    const result = await AuthService.loginWithGoogle();
    if (!result.success) {
      _showError(result.needsRegistration
        ? result.error + ' Click "Register here" to create an account.'
        : result.error);
    }
  };

  const _handleRegister = async () => {
    const role         = document.getElementById('reg-role').value;
    const businessName = document.getElementById('reg-name').value.trim();
    const email        = document.getElementById('reg-email').value.trim();
    const password     = document.getElementById('reg-password').value;
    const phone        = document.getElementById('reg-phone').value.trim();
    const district     = document.getElementById('reg-district').value;
    const tinNumber    = document.getElementById('reg-tin')?.value.trim() || '';
    const sdcId        = document.getElementById('reg-sdc')?.value.trim() || '';
    const termsChecked = document.getElementById('reg-terms').checked;

    if (!businessName) return _showError('Please enter your business or full name.');
    if (!email)        return _showError('Please enter your email address.');
    if (!password || password.length < 6) return _showError('Password must be at least 6 characters.');
    if (!phone)        return _showError('Please enter your phone number.');
    if (!district)     return _showError('Please select your district.');
    if (!termsChecked) return _showError('You must agree to the Terms & Conditions to continue.');

    if (ROLE_CAN_SELL.includes(role)) {
      if (!tinNumber || !/^\d{9}$/.test(tinNumber)) return _showError('TIN must be exactly 9 digits.');
      if (!sdcId) return _showError('Please enter your SDC Device ID.');
    }

    _setLoading('register-btn', true, 'Creating account...');
    const result = await AuthService.register({ email, password, businessName, role, phone, district, tinNumber, sdcId });
    _setLoading('register-btn', false, 'Create Account');
    if (!result.success) _showError(result.error);
  };

  const _handleReset = async () => {
    const email = document.getElementById('reset-email').value.trim();
    if (!email) return _showError('Please enter your email address.');
    _setLoading('reset-btn', true, 'Sending...');
    const result = await AuthService.sendPasswordReset(email);
    _setLoading('reset-btn', false, 'Send Reset Link');
    if (result.success) {
      _hideError();
      const s = document.getElementById('auth-success');
      if (s) { s.textContent = result.message; s.classList.remove('hidden'); }
    } else {
      _showError(result.error);
    }
  };

  // ── UI Helpers ────────────────────────────────────────────────
  const _selectRole = (role) => {
    document.getElementById('reg-role').value = role;
    document.querySelectorAll('.role-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.role === role)
    );
    const sf = document.getElementById('seller-fields');
    if (sf) sf.classList.toggle('hidden', !ROLE_CAN_SELL.includes(role));
  };

  const _togglePassword = (inputId, btn) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPass = input.type === 'password';
    input.type   = isPass ? 'text' : 'password';
    btn.textContent = isPass ? '🙈' : '👁';
  };

  const _roleIcon = (role) =>
    ({ manufacturer:'🏭', distributor:'🚛', retailer:'🏪', buyer:'🛒' }[role] || '👤');

  const _showError = (msg) => {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  };

  const _hideError = () => {
    const el = document.getElementById('auth-error');
    if (el) { el.textContent = ''; el.classList.add('hidden'); }
  };

  const _setLoading = (btnId, loading, label) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled    = loading;
    btn.textContent = label;
  };

  const _openTerms   = () => Toast.show('Terms & Conditions — coming soon.', 'info');
  const _openPrivacy = () => Toast.show('Privacy Policy — coming soon.', 'info');

  return {
    showLogin, showRegister, showForgotPassword,
    _handleLogin, _handleGoogle, _handleRegister, _handleReset,
    _selectRole, _togglePassword, _openTerms, _openPrivacy,
  };

})();
