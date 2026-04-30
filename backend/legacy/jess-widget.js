(function () {
  'use strict';

  // ─── CSS Variables & Styles ────────────────────────────────────────────────

  var STYLES = [
    ':root {',
    '  --jess-gold: #C4A06A;',
    '  --jess-gold-light: #D9BF8C;',
    '  --jess-gold-dark: #9C7A45;',
    '  --jess-dark: #1A1714;',
    '  --jess-white: #FFFFFF;',
    '  --jess-bg: #F5F3EF;',
    '  --jess-muted: #7A7068;',
    '}',

    '#jess-fab {',
    '  position: fixed;',
    '  bottom: 28px;',
    '  right: 28px;',
    '  z-index: 99998;',
    '  display: flex;',
    '  flex-direction: column;',
    '  align-items: center;',
    '  gap: 6px;',
    '  cursor: pointer;',
    '  user-select: none;',
    '}',

    '#jess-fab-circle {',
    '  width: 52px;',
    '  height: 52px;',
    '  border-radius: 50%;',
    '  background: var(--jess-gold);',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  box-shadow: 0 4px 16px rgba(196,160,106,0.45);',
    '  transition: background 0.2s, transform 0.2s, box-shadow 0.2s;',
    '  font-family: "Cormorant Garamond", Georgia, serif;',
    '  font-size: 22px;',
    '  font-weight: 700;',
    '  color: var(--jess-dark);',
    '  letter-spacing: 0;',
    '}',

    '#jess-fab:hover #jess-fab-circle {',
    '  background: var(--jess-gold-light);',
    '  transform: scale(1.06);',
    '  box-shadow: 0 6px 22px rgba(196,160,106,0.55);',
    '}',

    '#jess-fab-label {',
    '  font-size: 11px;',
    '  font-weight: 600;',
    '  letter-spacing: 0.06em;',
    '  color: var(--jess-gold-dark);',
    '  text-transform: uppercase;',
    '  background: var(--jess-white);',
    '  padding: 2px 8px;',
    '  border-radius: 20px;',
    '  box-shadow: 0 1px 6px rgba(0,0,0,0.10);',
    '}',

    '#jess-panel {',
    '  position: fixed;',
    '  bottom: 100px;',
    '  right: 28px;',
    '  z-index: 99999;',
    '  width: 320px;',
    '  height: 480px;',
    '  background: var(--jess-white);',
    '  border-radius: 16px;',
    '  box-shadow: 0 12px 48px rgba(26,23,20,0.22), 0 2px 8px rgba(26,23,20,0.10);',
    '  display: flex;',
    '  flex-direction: column;',
    '  overflow: hidden;',
    '  transform: translateY(20px);',
    '  opacity: 0;',
    '  pointer-events: none;',
    '  transition: opacity 0.25s ease, transform 0.25s ease;',
    '}',

    '#jess-panel.jess-open {',
    '  opacity: 1;',
    '  transform: translateY(0);',
    '  pointer-events: all;',
    '}',

    '#jess-header {',
    '  background: var(--jess-dark);',
    '  padding: 16px 18px 14px;',
    '  display: flex;',
    '  align-items: flex-start;',
    '  justify-content: space-between;',
    '  flex-shrink: 0;',
    '}',

    '#jess-header-text {}',

    '#jess-header-name {',
    '  font-family: "Cormorant Garamond", Georgia, serif;',
    '  font-size: 22px;',
    '  font-weight: 700;',
    '  color: var(--jess-gold-light);',
    '  line-height: 1;',
    '}',

    '#jess-header-sub {',
    '  font-size: 11px;',
    '  color: var(--jess-muted);',
    '  margin-top: 3px;',
    '  letter-spacing: 0.03em;',
    '}',

    '#jess-close {',
    '  background: none;',
    '  border: none;',
    '  cursor: pointer;',
    '  color: var(--jess-muted);',
    '  font-size: 20px;',
    '  line-height: 1;',
    '  padding: 0;',
    '  transition: color 0.15s;',
    '}',

    '#jess-close:hover { color: var(--jess-gold-light); }',

    '#jess-messages {',
    '  flex: 1;',
    '  overflow-y: auto;',
    '  padding: 14px 14px 8px;',
    '  display: flex;',
    '  flex-direction: column;',
    '  gap: 10px;',
    '  background: var(--jess-bg);',
    '}',

    '#jess-messages::-webkit-scrollbar { width: 4px; }',
    '#jess-messages::-webkit-scrollbar-track { background: transparent; }',
    '#jess-messages::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }',

    '.jess-msg {',
    '  max-width: 86%;',
    '  font-size: 13.5px;',
    '  line-height: 1.55;',
    '  padding: 9px 13px;',
    '  border-radius: 12px;',
    '}',

    '.jess-msg-jess {',
    '  background: var(--jess-white);',
    '  color: var(--jess-dark);',
    '  align-self: flex-start;',
    '  border-bottom-left-radius: 3px;',
    '  box-shadow: 0 1px 4px rgba(0,0,0,0.07);',
    '}',

    '.jess-msg-user {',
    '  background: var(--jess-gold);',
    '  color: var(--jess-dark);',
    '  align-self: flex-end;',
    '  border-bottom-right-radius: 3px;',
    '}',

    '.jess-links {',
    '  display: flex;',
    '  flex-wrap: wrap;',
    '  gap: 6px;',
    '  margin-top: 6px;',
    '}',

    '.jess-link-pill {',
    '  font-size: 11.5px;',
    '  font-weight: 600;',
    '  letter-spacing: 0.03em;',
    '  color: var(--jess-gold-dark);',
    '  background: #F0EAE0;',
    '  border: 1px solid #DDD3C0;',
    '  border-radius: 20px;',
    '  padding: 4px 11px;',
    '  text-decoration: none;',
    '  cursor: pointer;',
    '  transition: background 0.15s, color 0.15s;',
    '  display: inline-block;',
    '}',

    '.jess-link-pill:hover {',
    '  background: var(--jess-gold);',
    '  color: var(--jess-dark);',
    '  border-color: var(--jess-gold);',
    '}',

    '.jess-typing {',
    '  display: flex;',
    '  align-items: center;',
    '  gap: 4px;',
    '  padding: 10px 13px;',
    '  background: var(--jess-white);',
    '  border-radius: 12px;',
    '  border-bottom-left-radius: 3px;',
    '  align-self: flex-start;',
    '  box-shadow: 0 1px 4px rgba(0,0,0,0.07);',
    '}',

    '.jess-dot {',
    '  width: 7px;',
    '  height: 7px;',
    '  border-radius: 50%;',
    '  background: var(--jess-gold);',
    '  animation: jess-bounce 1.2s infinite;',
    '}',

    '.jess-dot:nth-child(2) { animation-delay: 0.2s; }',
    '.jess-dot:nth-child(3) { animation-delay: 0.4s; }',

    '@keyframes jess-bounce {',
    '  0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }',
    '  30% { transform: translateY(-5px); opacity: 1; }',
    '}',

    '#jess-footer {',
    '  padding: 10px 12px;',
    '  background: var(--jess-white);',
    '  border-top: 1px solid #EDE8E1;',
    '  display: flex;',
    '  gap: 8px;',
    '  align-items: center;',
    '  flex-shrink: 0;',
    '}',

    '#jess-input {',
    '  flex: 1;',
    '  border: 1.5px solid #DDD3C0;',
    '  border-radius: 8px;',
    '  padding: 9px 12px;',
    '  font-size: 13px;',
    '  color: var(--jess-dark);',
    '  background: var(--jess-bg);',
    '  outline: none;',
    '  resize: none;',
    '  transition: border-color 0.15s;',
    '  font-family: inherit;',
    '}',

    '#jess-input:focus { border-color: var(--jess-gold); }',
    '#jess-input::placeholder { color: var(--jess-muted); }',

    '#jess-send {',
    '  width: 36px;',
    '  height: 36px;',
    '  border-radius: 8px;',
    '  background: var(--jess-gold);',
    '  border: none;',
    '  cursor: pointer;',
    '  display: flex;',
    '  align-items: center;',
    '  justify-content: center;',
    '  transition: background 0.15s, transform 0.1s;',
    '  flex-shrink: 0;',
    '}',

    '#jess-send:hover { background: var(--jess-gold-dark); }',
    '#jess-send:active { transform: scale(0.94); }',
    '#jess-send:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }',

    '#jess-send svg { pointer-events: none; }',
  ].join('\n');

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function decodeJwtRole(token) {
    try {
      var parts = token.split('.');
      if (parts.length !== 3) return null;
      var payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      var padded = payload + '==='.slice((payload.length + 3) % 4);
      var decoded = JSON.parse(atob(padded));
      return decoded.role || null;
    } catch (e) {
      return null;
    }
  }

  function getGreeting() {
    var token = localStorage.getItem('accessToken');
    var role = token ? decodeJwtRole(token) : null;
    if (role === 'CLIENT') {
      return "Hi! I'm Jess, your FESTV hostess. How can I help with your event today?";
    } else if (role === 'PROVIDER') {
      return "Hi! I'm Jess. Need help setting up your profile or understanding how quoting works?";
    } else {
      return "Hi! I'm Jess, FESTV's virtual hostess. Looking to plan an event or become a vendor?";
    }
  }

  function getPageContext() {
    var path = window.location.pathname;
    var parts = path.split('/');
    var filename = parts[parts.length - 1];
    return filename || 'index.html';
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── State ─────────────────────────────────────────────────────────────────

  var conversation = [];
  var isWaiting = false;

  // ─── DOM Building ──────────────────────────────────────────────────────────

  function injectStyles() {
    var style = document.createElement('style');
    style.id = 'jess-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function buildFab() {
    var fab = document.createElement('div');
    fab.id = 'jess-fab';
    fab.setAttribute('aria-label', 'Open Jess chat');
    fab.setAttribute('role', 'button');
    fab.setAttribute('tabindex', '0');

    var circle = document.createElement('div');
    circle.id = 'jess-fab-circle';
    circle.textContent = 'J';

    var label = document.createElement('div');
    label.id = 'jess-fab-label';
    label.textContent = 'Ask Jess';

    fab.appendChild(circle);
    fab.appendChild(label);
    return fab;
  }

  function buildPanel() {
    var panel = document.createElement('div');
    panel.id = 'jess-panel';
    panel.setAttribute('aria-live', 'polite');

    // Header
    var header = document.createElement('div');
    header.id = 'jess-header';

    var headerText = document.createElement('div');
    headerText.id = 'jess-header-text';

    var name = document.createElement('div');
    name.id = 'jess-header-name';
    name.textContent = 'Jess';

    var sub = document.createElement('div');
    sub.id = 'jess-header-sub';
    sub.textContent = 'Your event planning hostess';

    headerText.appendChild(name);
    headerText.appendChild(sub);

    var closeBtn = document.createElement('button');
    closeBtn.id = 'jess-close';
    closeBtn.setAttribute('aria-label', 'Close Jess');
    closeBtn.innerHTML = '&#x2715;';

    header.appendChild(headerText);
    header.appendChild(closeBtn);

    // Messages
    var messages = document.createElement('div');
    messages.id = 'jess-messages';

    // Footer
    var footer = document.createElement('div');
    footer.id = 'jess-footer';

    var input = document.createElement('textarea');
    input.id = 'jess-input';
    input.placeholder = 'Ask Jess anything\u2026';
    input.rows = 1;
    input.setAttribute('aria-label', 'Message Jess');

    var sendBtn = document.createElement('button');
    sendBtn.id = 'jess-send';
    sendBtn.setAttribute('aria-label', 'Send message');
    sendBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M2 8L14 2L10 8L14 14L2 8Z" fill="#1A1714"/>' +
      '</svg>';

    footer.appendChild(input);
    footer.appendChild(sendBtn);

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(footer);

    return { panel: panel, closeBtn: closeBtn, messages: messages, input: input, sendBtn: sendBtn };
  }

  // ─── Message Rendering ─────────────────────────────────────────────────────

  function appendMessage(messagesEl, role, text, links) {
    var wrapper = document.createElement('div');

    var bubble = document.createElement('div');
    bubble.className = 'jess-msg ' + (role === 'jess' ? 'jess-msg-jess' : 'jess-msg-user');
    bubble.textContent = text;
    wrapper.appendChild(bubble);

    if (links && links.length > 0) {
      var linksRow = document.createElement('div');
      linksRow.className = 'jess-links';
      for (var i = 0; i < links.length; i++) {
        var pill = document.createElement('a');
        pill.className = 'jess-link-pill';
        pill.href = links[i].href;
        pill.textContent = links[i].label;
        linksRow.appendChild(pill);
      }
      wrapper.appendChild(linksRow);
    }

    messagesEl.appendChild(wrapper);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return wrapper;
  }

  function showTyping(messagesEl) {
    var typing = document.createElement('div');
    typing.className = 'jess-typing';
    typing.id = 'jess-typing-indicator';
    for (var i = 0; i < 3; i++) {
      var dot = document.createElement('div');
      dot.className = 'jess-dot';
      typing.appendChild(dot);
    }
    messagesEl.appendChild(typing);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function hideTyping(messagesEl) {
    var typing = document.getElementById('jess-typing-indicator');
    if (typing && typing.parentNode) {
      typing.parentNode.removeChild(typing);
    }
  }

  // ─── API Call ──────────────────────────────────────────────────────────────

  function sendMessage(text, messagesEl, input, sendBtn) {
    if (isWaiting || !text.trim()) return;

    var trimmed = text.trim();
    input.value = '';
    input.style.height = '';

    // Add to conversation and render user bubble
    conversation.push({ role: 'user', content: trimmed });
    appendMessage(messagesEl, 'user', trimmed, []);

    isWaiting = true;
    sendBtn.disabled = true;
    showTyping(messagesEl);

    var token = localStorage.getItem('accessToken');
    var headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }

    var body = JSON.stringify({
      messages: conversation.slice(),
      pageContext: getPageContext(),
    });

    fetch('/api/v1/jess/chat', {
      method: 'POST',
      headers: headers,
      body: body,
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        hideTyping(messagesEl);
        isWaiting = false;
        sendBtn.disabled = false;

        var message = '';
        var links = [];

        if (data && data.success && data.data) {
          message = data.data.message || '';
          links = data.data.links || [];
        } else {
          message = (data && data.error) || "I'm having a little trouble right now. Please try again in a moment.";
        }

        conversation.push({ role: 'assistant', content: message });
        appendMessage(messagesEl, 'jess', message, links);
      })
      .catch(function () {
        hideTyping(messagesEl);
        isWaiting = false;
        sendBtn.disabled = false;
        var errMsg = "I'm having trouble connecting right now. Please try again.";
        conversation.push({ role: 'assistant', content: errMsg });
        appendMessage(messagesEl, 'jess', errMsg, []);
      });
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  function init() {
    if (document.getElementById('jess-fab')) return; // already mounted

    injectStyles();

    var fab = buildFab();
    var built = buildPanel();
    var panel = built.panel;
    var closeBtn = built.closeBtn;
    var messagesEl = built.messages;
    var input = built.input;
    var sendBtn = built.sendBtn;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    var greeting = getGreeting();

    function openPanel() {
      panel.classList.add('jess-open');
      // Show greeting only on first open
      if (messagesEl.children.length === 0) {
        appendMessage(messagesEl, 'jess', greeting, []);
      }
      setTimeout(function () {
        input.focus();
      }, 260);
    }

    function closePanel() {
      panel.classList.remove('jess-open');
    }

    fab.addEventListener('click', function () {
      var isOpen = panel.classList.contains('jess-open');
      if (isOpen) {
        closePanel();
      } else {
        openPanel();
      }
    });

    fab.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fab.click();
      }
    });

    closeBtn.addEventListener('click', closePanel);

    sendBtn.addEventListener('click', function () {
      sendMessage(input.value, messagesEl, input, sendBtn);
    });

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input.value, messagesEl, input, sendBtn);
      }
    });

    // Auto-grow textarea
    input.addEventListener('input', function () {
      input.style.height = 'auto';
      var maxH = 80;
      input.style.height = Math.min(input.scrollHeight, maxH) + 'px';
    });

    // Close when clicking outside the panel and fab
    document.addEventListener('click', function (e) {
      if (
        panel.classList.contains('jess-open') &&
        !panel.contains(e.target) &&
        !fab.contains(e.target)
      ) {
        closePanel();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
