/**
 * auth-chip.js
 * Injects a "signed in as Name · Role" chip into the page header.
 * Include on any page that has a <header> element.
 */
(function () {
  var token = localStorage.getItem('accessToken');
  if (!token) return;

  fetch('/api/v1/auth/me', { headers: { 'Authorization': 'Bearer ' + token } })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      var user = (res && res.data) ? res.data : res;
      if (!user || !user.firstName) return;

      var roles      = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
      var isProvider = roles.indexOf('PROVIDER') !== -1;
      var roleLabel  = isProvider ? 'Vendor' : 'Planner';
      var roleColor  = isProvider ? '#9C7A45' : '#3A8A55';
      var roleBg     = isProvider ? 'rgba(196,160,106,0.15)' : 'rgba(58,138,85,0.1)';
      var roleBorder = isProvider ? 'rgba(196,160,106,0.35)' : 'rgba(58,138,85,0.25)';
      var initial    = (user.firstName || '?')[0].toUpperCase();

      var chip = document.createElement('div');
      chip.id = 'auth-chip';
      chip.style.cssText = 'display:flex;align-items:center;gap:0.5rem;flex-shrink:0;';
      chip.innerHTML =
        '<div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#E8E0D4,#D5C9BA);display:flex;align-items:center;justify-content:center;font-size:0.68rem;font-weight:700;color:#3A3530;flex-shrink:0;">' + initial + '</div>'
        + '<span style="font-size:0.72rem;font-weight:600;color:#1A1714;white-space:nowrap;">' + user.firstName + '</span>'
        + '<span style="font-size:0.58rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:0.18rem 0.5rem;border-radius:999px;background:' + roleBg + ';color:' + roleColor + ';border:1px solid ' + roleBorder + ';white-space:nowrap;">' + roleLabel + '</span>'
        + '<a href="signin.html" id="auth-chip-signout" style="font-size:0.63rem;color:#7A7068;text-decoration:none;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;padding:0.2rem 0.55rem;border:1px solid rgba(0,0,0,0.1);border-radius:3px;white-space:nowrap;transition:all 0.15s;">Sign Out</a>';

      // Sign out clears token
      chip.querySelector('#auth-chip-signout').addEventListener('click', function () {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('pendingEvent');
      });

      chip.querySelector('#auth-chip-signout').addEventListener('mouseover', function () {
        this.style.color = '#B84040';
        this.style.borderColor = 'rgba(184,64,64,0.3)';
      });
      chip.querySelector('#auth-chip-signout').addEventListener('mouseout', function () {
        this.style.color = '#7A7068';
        this.style.borderColor = 'rgba(0,0,0,0.1)';
      });

      // Inject into header — wrap alongside existing right-side element if present
      var header  = document.querySelector('header');
      if (!header) return;

      var rightEl = header.querySelector('.back-link, .header-right, .header-icons');
      if (rightEl) {
        // Wrap existing right element + chip together
        var wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;align-items:center;gap:1.25rem;';
        rightEl.parentNode.insertBefore(wrapper, rightEl);
        wrapper.appendChild(chip);
        wrapper.appendChild(rightEl);
      } else {
        header.appendChild(chip);
      }
    })
    .catch(function () { /* silently fail — don't break the page */ });
})();
