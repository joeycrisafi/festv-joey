(function () {
  'use strict';

  // ── Inject styles ──────────────────────────────────────────────────────────
  var style = document.createElement('style');
  style.textContent = [
    '#pm-wrap { position: relative; display: inline-flex; }',

    '#pm-dropdown {',
    '  position: absolute;',
    '  top: calc(100% + 10px);',
    '  right: 0;',
    '  min-width: 210px;',
    '  background: #fff;',
    '  border: 1px solid rgba(0,0,0,0.09);',
    '  border-radius: 10px;',
    '  box-shadow: 0 8px 32px rgba(0,0,0,0.13);',
    '  z-index: 500;',
    '  overflow: hidden;',
    '  opacity: 0;',
    '  transform: translateY(-6px);',
    '  pointer-events: none;',
    '  transition: opacity 0.18s ease, transform 0.18s ease;',
    '}',

    '#pm-dropdown.pm-open {',
    '  opacity: 1;',
    '  transform: translateY(0);',
    '  pointer-events: all;',
    '}',

    '#pm-header {',
    '  padding: 0.85rem 1.1rem 0.7rem;',
    '  border-bottom: 1px solid rgba(0,0,0,0.07);',
    '}',

    '#pm-name {',
    '  font-size: 0.82rem;',
    '  font-weight: 700;',
    '  color: #1A1714;',
    '  white-space: nowrap;',
    '  overflow: hidden;',
    '  text-overflow: ellipsis;',
    '}',

    '#pm-role {',
    '  font-size: 0.65rem;',
    '  font-weight: 600;',
    '  letter-spacing: 0.1em;',
    '  text-transform: uppercase;',
    '  color: #C4A06A;',
    '  margin-top: 2px;',
    '}',

    '#pm-items {',
    '  padding: 0.4rem 0;',
    '}',

    '.pm-item {',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 0.65rem;',
    '  width: 100%;',
    '  padding: 0.6rem 1.1rem;',
    '  background: none;',
    '  border: none;',
    '  cursor: pointer;',
    '  font-family: inherit;',
    '  font-size: 0.78rem;',
    '  font-weight: 600;',
    '  color: #3A3530;',
    '  text-decoration: none;',
    '  text-align: left;',
    '  transition: background 0.15s, color 0.15s;',
    '  line-height: 1;',
    '}',

    '.pm-item:hover { background: #F5F3EF; color: #1A1714; }',

    '.pm-item svg {',
    '  width: 15px; height: 15px;',
    '  stroke: currentColor; fill: none;',
    '  stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round;',
    '  flex-shrink: 0; opacity: 0.7;',
    '}',

    '.pm-item.pm-muted { color: #7A7068; }',
    '.pm-item.pm-muted:hover { color: #7A7068; background: #F5F3EF; cursor: default; }',

    '.pm-divider {',
    '  height: 1px;',
    '  background: rgba(0,0,0,0.07);',
    '  margin: 0.3rem 0;',
    '}',

    '.pm-item.pm-signout { color: #B84040; }',
    '.pm-item.pm-signout:hover { background: #fff5f5; color: #B84040; }',

    '.pm-section-label {',
    '  font-size: 0.58rem;',
    '  font-weight: 700;',
    '  letter-spacing: 0.16em;',
    '  text-transform: uppercase;',
    '  color: #C4A06A;',
    '  padding: 0.55rem 1.1rem 0.3rem;',
    '}',

    '.pm-item.pm-dev {',
    '  color: #1A1714;',
    '  background: rgba(196,160,106,0.06);',
    '}',
    '.pm-item.pm-dev:hover { background: rgba(196,160,106,0.16); color: #1A1714; }',
  ].join('\n');
  document.head.appendChild(style);

  // ── Decode JWT for user info ───────────────────────────────────────────────
  function getUser() {
    try {
      var token = localStorage.getItem('accessToken');
      if (!token) return null;
      var payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp && payload.exp * 1000 < Date.now()) return null;
      return payload;
    } catch (e) { return null; }
  }

  function hasRole(user, role) {
    if (!user) return false;
    if (user.role === role) return true;
    if (Array.isArray(user.roles) && user.roles.indexOf(role) !== -1) return true;
    return false;
  }

  // ── SVG icons ──────────────────────────────────────────────────────────────
  var ICONS = {
    dashboard: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    preview:   '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
    settings:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    signin:    '<svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>',
    signup:    '<svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    signout:   '<svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    chart:     '<svg viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    database:  '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6"/></svg>',
  };

  function makeItem(icon, label, onClick, extraClass) {
    var btn = document.createElement('button');
    btn.className = 'pm-item' + (extraClass ? ' ' + extraClass : '');
    btn.innerHTML = ICONS[icon] + '<span>' + label + '</span>';
    btn.addEventListener('click', onClick);
    return btn;
  }

  function makeLinkItem(icon, label, href, extraClass) {
    var a = document.createElement('a');
    a.className = 'pm-item' + (extraClass ? ' ' + extraClass : '');
    a.href = href;
    a.innerHTML = ICONS[icon] + '<span>' + label + '</span>';
    return a;
  }

  function divider() {
    var d = document.createElement('div');
    d.className = 'pm-divider';
    return d;
  }

  // ── Sign out ───────────────────────────────────────────────────────────────
  function signOut() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('token');
    localStorage.removeItem('authToken');
    window.location.href = 'festv-index.html';
  }

  // ── Build dropdown contents ────────────────────────────────────────────────
  function buildDropdown(user, itemsEl, nameEl, roleEl) {
    itemsEl.innerHTML = '';

    if (!user) {
      // Guest
      nameEl.textContent = 'Welcome to FESTV';
      roleEl.textContent = 'Not signed in';
      itemsEl.appendChild(makeLinkItem('signin', 'Sign In', 'signin.html'));
      itemsEl.appendChild(makeLinkItem('signup', 'Create Account', 'accounttype.html'));
      return;
    }

    var isProvider = hasRole(user, 'PROVIDER');
    var isClient   = hasRole(user, 'CLIENT');
    var fullName   = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'My Account';
    var roleLabel  = isProvider && isClient ? 'Vendor & Planner' : isProvider ? 'Vendor' : 'Planner';

    nameEl.textContent = fullName;
    roleEl.textContent = roleLabel;

    // Dashboard
    var dashHref = isProvider ? 'vendordashboard.html' : 'plannerdashboard.html';
    itemsEl.appendChild(makeLinkItem('dashboard', 'My Dashboard', dashHref));

    // Vendor: preview public profile
    if (isProvider) {
      itemsEl.appendChild(makeLinkItem('preview', 'Preview My Profile', '#'));
      // Resolve actual profile ID async
      var previewLink = itemsEl.lastChild;
      var token = localStorage.getItem('accessToken');
      if (token) {
        fetch('/api/v1/providers/profile/me', { headers: { 'Authorization': 'Bearer ' + token } })
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.data && d.data.id) previewLink.href = 'vendorprofile.html?id=' + d.data.id;
          })
          .catch(function () {});
      }
    }

    itemsEl.appendChild(divider());

    // Account settings (coming soon)
    var settingsBtn = makeItem('settings', 'Account Settings', function () {}, 'pm-muted');
    var settingsSpan = settingsBtn.querySelector('span');
    settingsSpan.innerHTML = 'Account Settings <span style="font-size:0.58rem;font-weight:700;letter-spacing:0.08em;color:#C4A06A;margin-left:4px;">SOON</span>';
    itemsEl.appendChild(settingsBtn);

    itemsEl.appendChild(divider());

    // Sign out
    itemsEl.appendChild(makeItem('signout', 'Sign Out', signOut, 'pm-signout'));

    // ── DEV section (admin emails + test users) ──
    // Hidden by default; shown only after /auth/dev-access returns canAccessDev=true.
    // Inserted just BEFORE the divider that precedes Sign Out.
    var devToken = localStorage.getItem('accessToken');
    if (devToken) {
      fetch('/api/v1/auth/dev-access', {
        headers: { 'Authorization': 'Bearer ' + devToken }
      })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (!data || !data.data || !data.data.canAccessDev) return;
        var children = Array.prototype.slice.call(itemsEl.children);
        // Last item is Sign Out, second-to-last is the divider before it.
        var preSignoutDivider = children[children.length - 2];
        if (!preSignoutDivider) return;
        var devLabel = document.createElement('div');
        devLabel.className = 'pm-section-label';
        devLabel.textContent = 'Dev';
        itemsEl.insertBefore(devLabel,                                 preSignoutDivider);
        itemsEl.insertBefore(makeLinkItem('chart',    'Planner',  'planner.html',  'pm-dev'), preSignoutDivider);
        itemsEl.insertBefore(makeLinkItem('database', 'Database', 'database.html', 'pm-dev'), preSignoutDivider);
        itemsEl.insertBefore(divider(),                                preSignoutDivider);
      })
      .catch(function () { /* silent — dev access just won't show */ });
    }
  }

  // ── Mount on profile button ────────────────────────────────────────────────
  function mount() {
    // Find the profile icon button — it's the one with title="Profile"
    var profileBtn = document.querySelector('button[title="Profile"]');
    if (!profileBtn) return;

    // Wrap it
    var wrap = document.createElement('div');
    wrap.id = 'pm-wrap';
    profileBtn.parentNode.insertBefore(wrap, profileBtn);
    wrap.appendChild(profileBtn);

    // Build dropdown
    var dropdown = document.createElement('div');
    dropdown.id = 'pm-dropdown';
    dropdown.innerHTML = '<div id="pm-header"><div id="pm-name"></div><div id="pm-role"></div></div><div id="pm-items"></div>';
    wrap.appendChild(dropdown);

    var nameEl  = dropdown.querySelector('#pm-name');
    var roleEl  = dropdown.querySelector('#pm-role');
    var itemsEl = dropdown.querySelector('#pm-items');

    var user = getUser();
    buildDropdown(user, itemsEl, nameEl, roleEl);

    // Toggle on click
    profileBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('pm-open');
    });

    // Close on outside click
    document.addEventListener('click', function () {
      dropdown.classList.remove('pm-open');
    });

    dropdown.addEventListener('click', function (e) {
      e.stopPropagation();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
