// ===== Meine App – Schutz: PIN-Sperre, Einbettungs-Schutz =====
(function () {
  'use strict';
  const PKEY = 'meine-app-pin', FKEY = 'meine-app-pin-fehler';
  const AUTOLOCK_MS = 60 * 1000; // nach 1 Minute im Hintergrund sperren
  const ITER = 150000;
  const rd = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const wr = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const hasPin = () => { const p = rd(PKEY); return !!(p && p.hash && p.salt); };

  // Schutz gegen Einbetten in fremde Seiten (Clickjacking)
  if (window.top !== window.self) {
    document.documentElement.style.display = 'none';
    try { window.top.location = window.self.location; } catch (e) {}
    return;
  }
  // Sofort verdecken, bevor irgendetwas sichtbar wird
  if (hasPin()) document.documentElement.classList.add('locked');

  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function derive(pin, salt) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
    return b64(await crypto.subtle.deriveBits({name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256'}, key, 256));
  }
  async function savePin(pin) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    wr(PKEY, {salt: b64(salt), hash: await derive(pin, salt), iter: ITER});
  }
  async function checkPin(pin) {
    const p = rd(PKEY); if (!p) return true;
    const h = await derive(pin, unb64(p.salt));
    let diff = h.length ^ p.hash.length; // Vergleich in konstanter Zeit
    for (let i = 0; i < Math.min(h.length, p.hash.length); i++) diff |= h.charCodeAt(i) ^ p.hash.charCodeAt(i);
    return diff === 0;
  }
  // ===== Face ID / Touch ID / Fingerabdruck (Passkey, nur auf diesem Gerät) =====
  const BKEY = 'meine-app-bio';
  const bioOn = () => { const b = rd(BKEY); return !!(b && b.id && b.pk) && hasPin(); };
  let bioAvailable = false;
  const bioName = () => /iPhone|iPad|Macintosh/.test(navigator.userAgent) ? 'Face ID' : 'Fingerabdruck';
  async function bioCheckAvail() {
    try { bioAvailable = !!(window.PublicKeyCredential && window.isSecureContext && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); }
    catch (e) { bioAvailable = false; }
  }
  async function bioSetup() {
    const cred = await navigator.credentials.create({publicKey: {
      rp: {name: 'Meine App', id: location.hostname},
      user: {id: crypto.getRandomValues(new Uint8Array(16)), name: 'Meine App', displayName: 'Meine App'},
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      pubKeyCredParams: [{type: 'public-key', alg: -7}],
      authenticatorSelection: {authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged'},
      timeout: 60000, attestation: 'none'
    }});
    const r = cred.response;
    if (!r.getPublicKey || r.getPublicKeyAlgorithm() !== -7) throw new Error('Dieses Gerät wird nicht unterstützt.');
    wr(BKEY, {id: b64(cred.rawId), pk: b64(r.getPublicKey())});
  }
  // ECDSA-Signatur (DER) in das Rohformat r||s umwandeln
  function derToRaw(der) {
    let i = 2; if (der[1] & 0x80) i += der[1] & 0x7f;
    const part = () => { i++; const len = der[i++]; let v = der.slice(i, i + len); i += len; while (v.length > 32 && v[0] === 0) v = v.slice(1); const o = new Uint8Array(32); o.set(v, 32 - v.length); return o; };
    const r = part(), s2 = part(), out = new Uint8Array(64); out.set(r); out.set(s2, 32); return out;
  }
  const b64u = u => b64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  // Prüft die Antwort des Geräts vollständig selbst (Signatur, Absender, Gesichts-/Fingerprüfung)
  async function bioVerify() {
    const b = rd(BKEY); if (!b) return false;
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const a = await navigator.credentials.get({publicKey: {challenge, rpId: location.hostname,
      allowCredentials: [{type: 'public-key', id: unb64(b.id)}], userVerification: 'required', timeout: 60000}});
    const r = a.response;
    const cd = JSON.parse(new TextDecoder().decode(r.clientDataJSON));
    if (cd.type !== 'webauthn.get' || cd.challenge !== b64u(challenge) || cd.origin !== location.origin) return false;
    const ad = new Uint8Array(r.authenticatorData);
    if ((ad[32] & 0x05) !== 0x05) return false; // anwesend UND Face ID/Fingerabdruck geprüft
    const rp = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(location.hostname)));
    for (let i = 0; i < 32; i++) if (ad[i] !== rp[i]) return false;
    const cdh = new Uint8Array(await crypto.subtle.digest('SHA-256', r.clientDataJSON));
    const data = new Uint8Array(ad.length + 32); data.set(ad); data.set(cdh, ad.length);
    const key = await crypto.subtle.importKey('spki', unb64(b.pk), {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
    return crypto.subtle.verify({name: 'ECDSA', hash: 'SHA-256'}, key, derToRaw(new Uint8Array(r.signature)), data);
  }
  let bioBusy = false;
  async function tryBio(auto) {
    if (bioBusy || mode !== 'unlock' || !bioOn()) return;
    bioBusy = true;
    try {
      if (await bioVerify()) unlockOk();
      else msg(bioName() + ' fehlgeschlagen – bitte PIN eingeben');
    } catch (e) { if (!auto) msg(bioName() + ' abgebrochen – bitte PIN eingeben'); }
    bioBusy = false;
  }
  function unlockOk() { wr(FKEY, null); document.documentElement.classList.remove('locked'); close(); }

  // Zu viele Fehlversuche -> Wartezeit (30 s, 60 s, 120 s …)
  const waitLeft = () => { const f = rd(FKEY); return f && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0; };
  function fail() {
    const f = rd(FKEY) || {n: 0, until: 0}; f.n++;
    if (f.n >= 5) f.until = Date.now() + 30000 * Math.pow(2, Math.min(f.n - 5, 6));
    wr(FKEY, f);
  }

  let mode = null, entry = '', first = '', onDone = null, timer = null;
  const TXT = {
    unlock: 'PIN eingeben', set1: 'Neue PIN wählen (4–6 Ziffern)', set2: 'Neue PIN wiederholen',
    old: 'Aktuelle PIN eingeben', remove: 'PIN zum Entfernen eingeben'
  };

  function build() {
    const el = document.createElement('div');
    el.id = 'lock';
    el.innerHTML = `
      <div class="lk-box">
        <img src="icon.svg" alt="" class="lk-icon">
        <div class="lk-title" id="lk_t"></div>
        <div class="lk-dots" id="lk_d"></div>
        <div class="lk-msg" id="lk_m"></div>
        <div class="lk-pad">
          ${[1,2,3,4,5,6,7,8,9].map(n => `<button data-k="${n}">${n}</button>`).join('')}
          <button data-k="back" aria-label="Löschen">⌫</button><button data-k="0">0</button><button data-k="ok" class="lk-ok" aria-label="Bestätigen">✓</button>
        </div>
        <button class="lk-bio" id="lk_b"></button>
        <button class="lk-link" id="lk_x">Abbrechen</button>
        <button class="lk-link" id="lk_f">PIN vergessen?</button>
      </div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { const k = e.target.closest('[data-k]'); if (k) key(k.dataset.k); });
    document.getElementById('lk_x').onclick = () => close();
    document.getElementById('lk_f').onclick = forgot;
    document.getElementById('lk_b').onclick = () => tryBio(false);
    document.addEventListener('keydown', e => {
      if (!mode) return;
      if (/^[0-9]$/.test(e.key)) key(e.key); else if (e.key === 'Backspace') key('back'); else if (e.key === 'Enter') key('ok');
    });
  }
  function show(m, done) {
    mode = m; entry = ''; onDone = done || null;
    document.getElementById('lock').classList.add('on');
    document.getElementById('lk_x').style.display = m === 'unlock' ? 'none' : '';
    document.getElementById('lk_f').style.display = m === 'unlock' ? '' : 'none';
    const bb = document.getElementById('lk_b');
    bb.style.display = (m === 'unlock' && bioOn()) ? '' : 'none';
    bb.textContent = 'Mit ' + bioName() + ' entsperren';
    msg(''); draw(); tick();
    if (m === 'unlock' && bioOn()) setTimeout(() => tryBio(true), 350);
  }
  function close() {
    mode = null; entry = ''; first = ''; clearInterval(timer);
    document.getElementById('lock').classList.remove('on');
  }
  const msg = t => { document.getElementById('lk_m').textContent = t; };
  function draw() {
    document.getElementById('lk_t').textContent = TXT[mode] || '';
    const n = Math.max(4, entry.length);
    document.getElementById('lk_d').innerHTML = Array.from({length: n}, (_, i) => `<i class="${i < entry.length ? 'on' : ''}"></i>`).join('');
  }
  function tick() {
    clearInterval(timer);
    const upd = () => { const w = waitLeft(); if (w && (mode === 'unlock' || mode === 'old' || mode === 'remove')) msg(`Zu viele Fehlversuche. Bitte ${w} s warten.`); else if (/warten/.test(document.getElementById('lk_m').textContent)) msg(''); };
    upd(); timer = setInterval(upd, 1000);
  }
  let busy = false;
  async function key(k) {
    if (!mode || busy) return;
    if (k === 'back') { entry = entry.slice(0, -1); return draw(); }
    if (k !== 'ok') { if (entry.length < 6) entry += k; draw(); if (entry.length < 6) return; if (mode === 'set1' || mode === 'set2') return; }
    if (entry.length < 4) { msg('Mindestens 4 Ziffern'); return; }
    if (mode === 'set1') { first = entry; mode = 'set2'; entry = ''; msg(''); return draw(); }
    if (mode === 'set2') {
      if (entry !== first) { mode = 'set1'; entry = ''; first = ''; msg('Die PINs stimmen nicht überein. Nochmal.'); return draw(); }
      busy = true; await savePin(entry); busy = false; close(); toast2('PIN gespeichert'); renderCard(); return;
    }
    // Prüfen (unlock / old / remove)
    if (waitLeft()) { entry = ''; draw(); return; }
    busy = true; msg('Prüfe …'); const ok = await checkPin(entry); busy = false;
    if (!ok) { fail(); entry = ''; draw(); msg(waitLeft() ? '' : 'Falsche PIN'); tick(); navigator.vibrate?.(200); return; }
    wr(FKEY, null);
    if (mode === 'unlock') { unlockOk(); return; }
    if (mode === 'remove') { wr(PKEY, null); wr(BKEY, null); close(); toast2('PIN entfernt'); renderCard(); return; }
    if (mode === 'old') { mode = 'set1'; entry = ''; first = ''; msg(''); return draw(); }
  }
  function forgot() {
    if (!confirm('PIN vergessen?\n\nDie App kann nur zurückgesetzt werden. Dabei werden ALLE Einträge auf diesem Handy gelöscht (Touren, Schwimmen, Spiele, Freunde, Einkaufsliste).')) return;
    if (!confirm('Wirklich alles löschen? Das kann nicht rückgängig gemacht werden.\nTipp: Mit einer Sicherungsdatei kannst du die Daten danach wiederherstellen.')) return;
    try { Object.keys(localStorage).filter(k => k.startsWith('meine-app')).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    location.reload();
  }
  function lockNow() { if (!hasPin()) return; document.documentElement.classList.add('locked'); show('unlock'); }
  const toast2 = t => { const el = document.getElementById('toast'); if (!el) return; el.textContent = t; el.classList.add('on'); setTimeout(() => el.classList.remove('on'), 2200); };

  function renderCard() {
    const c = document.getElementById('sec_card'); if (!c) return;
    const on = hasPin();
    c.innerHTML = `<h2><svg class="ic"><use href="#i-shield"/></svg>Sicherheit</h2>
      <p class="hint" style="margin-top:0">${on
        ? 'Die PIN-Sperre ist <b>aktiv</b>. Die App sperrt sich beim Öffnen und nach 1 Minute im Hintergrund.'
        : 'Die PIN-Sperre ist <b>nicht aktiv</b>. Jeder, der dein Handy entsperrt in der Hand hat, kann deine Einträge sehen.'}</p>
      ${on ? `<button class="add" data-sec="lock">Jetzt sperren</button>
              ${bioOn() ? `<p class="hint">${bioName()} ist <b>aktiv</b>.</p><button class="clear" data-sec="biooff">${bioName()} ausschalten</button>`
                : bioAvailable ? `<button class="add" data-sec="bioon">${bioName()} einschalten</button>`
                : `<p class="hint">${bioName()} ist in diesem Browser nicht verfügbar. Öffne die App über die Internet-Adresse (https) auf dem Handy.</p>`}
              <button class="clear" data-sec="change">PIN ändern</button>
              <button class="clear" data-sec="remove">PIN entfernen</button>`
           : `<button class="add" data-sec="set">PIN-Sperre einrichten</button>`}
      <p class="hint">Außerdem aktiv: Die App lädt nur Dateien von ihrer eigenen Adresse und darf keine Daten an fremde Seiten senden. Sie lässt sich nicht in fremde Seiten einbetten, und importierte Sicherungen werden geprüft.</p>`;
    const hb = document.getElementById('hdr_lock'); if (hb) hb.style.display = on ? '' : 'none';
  }

  document.addEventListener('DOMContentLoaded', () => {
    build();
    const hb = document.createElement('button');
    hb.id = 'hdr_lock'; hb.className = 'hdr-lock'; hb.setAttribute('aria-label', 'App sperren'); hb.innerHTML = '<svg class="ic"><use href="#i-lock"/></svg>';
    hb.onclick = lockNow; document.querySelector('header')?.appendChild(hb);
    renderCard();
    bioCheckAvail().then(renderCard);
    document.getElementById('sec_card')?.addEventListener('click', e => {
      const b = e.target.closest('[data-sec]'); if (!b) return;
      ({lock: lockNow, set: () => show('set1'), change: () => show('old'), remove: () => show('remove'),
        bioon: async () => {
          try { await bioSetup(); toast2(bioName() + ' eingeschaltet'); }
          catch (err) { alert(bioName() + ' konnte nicht eingeschaltet werden.' + (err && err.name === 'NotAllowedError' ? ' (abgebrochen)' : '')); }
          renderCard();
        },
        biooff: () => { if (confirm(bioName() + ' ausschalten? Danach entsperrst du nur noch mit der PIN.')) { wr(BKEY, null); renderCard(); } }
      })[b.dataset.sec]?.();
    });
    if (hasPin()) show('unlock');
  });
  // Automatisch sperren, wenn die App länger im Hintergrund war
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hasPin() && hiddenAt && Date.now() - hiddenAt > AUTOLOCK_MS && mode !== 'unlock') lockNow();
  });
})();
