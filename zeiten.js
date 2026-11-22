// ===== Meine App – Stempeluhr & Stundenzettel =====
(function () {
  'use strict';
  const KEY = 'meine-app-zeiten';
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = n => String(n).padStart(2, '0');
  const hm = ms => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const dur = min => { min = Math.max(0, Math.round(min)); return Math.floor(min / 60) + ':' + pad(min % 60) + ' h'; };
  const dec = min => (Math.max(0, min) / 60).toLocaleString('de-DE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  const dayKey = ms => { const d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const dayName = k => new Date(k + 'T12:00').toLocaleDateString('de-DE', {weekday: 'long', day: '2-digit', month: '2-digit'});
  function toast(t) { const el = $('toast'); if (!el) return; el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200); }

  // ISO-Kalenderwoche
  function weekStart(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d.getTime(); }
  function isoWeek(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7); const w1 = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - w1) / 864e5 - 3 + (w1.getDay() + 6) % 7) / 7); }

  // ---------- Speicher ----------
  let Z = {run: null, list: []};
  try { Z = clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  function clean(o) {
    const s = (x, n = 120) => typeof x === 'string' ? x.slice(0, n) : '';
    const t = x => { const v = Number(x); return isFinite(v) && v > 1e12 && v < 4e12 ? v : null; };
    const list = (Array.isArray(o && o.list) ? o.list : []).slice(0, 20000).map(e => {
      if (!e) return null; const a = t(e.start), b = t(e.end); if (!a || !b || b <= a || b - a > 864e5) return null;
      const p = Number(e.pause); return {id: typeof e.id === 'string' && /^[a-z0-9]{1,24}$/i.test(e.id) ? e.id : uid(), bs: s(e.bs), start: a, end: b, pause: isFinite(p) && p >= 0 && p < 1440 ? Math.round(p) : 0, notiz: s(e.notiz, 300)};
    }).filter(Boolean);
    const run = o && o.run && t(o.run.start) ? {bs: s(o.run.bs), start: t(o.run.start)} : null;
    return {run, list};
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(Z)); } catch (e) { toast('Speichern nicht möglich'); } };
  const net = e => (e.end - e.start) / 6e4 - (e.pause || 0);

  // ---------- Anzeige ----------
  let week = weekStart(Date.now()), tick = null;
  const recent = () => [...new Set([...(Z.run ? [Z.run.bs] : []), ...Z.list.slice().sort((a, b) => b.start - a.start).map(e => e.bs)].filter(Boolean))].slice(0, 12);
  function render() {
    const el = $('zeit'); if (!el) return;
    const ws = week, we = ws + 7 * 864e5;
    const items = Z.list.filter(e => e.start >= ws && e.start < we).sort((a, b) => a.start - b.start);
    const days = {}; items.forEach(e => (days[dayKey(e.start)] ||= []).push(e));
    const total = items.reduce((s, e) => s + net(e), 0);
    const perBs = {}; items.forEach(e => { perBs[e.bs || 'Ohne Baustelle'] = (perBs[e.bs || 'Ohne Baustelle'] || 0) + net(e); });
    el.innerHTML = `
      <div class="card clock ${Z.run ? 'running' : ''}">
        <h2><svg class="ic"><use href="#i-clock"/></svg>Stempeluhr</h2>
        ${Z.run ? `<div class="clk-bs">${esc(Z.run.bs || 'Ohne Baustelle')}</div><div class="clk-t" id="z_live">0:00:00</div><div class="clk-s">seit ${hm(Z.run.start)} Uhr</div>
          <button class="add stop" data-z="stop"><svg class="ic"><use href="#i-stop"/></svg>Stopp</button>`
        : `<label for="z_bs">Baustelle</label><input id="z_bs" type="text" list="z_bsl" placeholder="z. B. Müller, Küche" autocomplete="off">
          <datalist id="z_bsl">${recent().map(b => `<option value="${esc(b)}">`).join('')}</datalist>
          ${recent().length ? `<div class="chips z-chips">${recent().slice(0, 4).map(b => `<button class="chip" data-zbs="${esc(b)}">${esc(b)}</button>`).join('')}</div>` : ''}
          <button class="add go" data-z="start"><svg class="ic"><use href="#i-play"/></svg>Start</button>`}
      </div>
      <div class="wk-nav"><button class="top-btn" data-z="prev" aria-label="Vorherige Woche"><svg class="ic"><use href="#i-back"/></svg></button>
        <div><b>KW ${isoWeek(ws)}</b><small>${new Date(ws).toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'})} – ${new Date(we - 864e5).toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'})}</small></div>
        <button class="top-btn" data-z="next" aria-label="Nächste Woche"><svg class="ic"><use href="#i-chev"/></svg></button></div>
      <div class="stats"><div class="stat"><b>${dur(total)}</b><span>diese Woche</span></div><div class="stat"><b>${dec(total)}</b><span>Stunden (dezimal)</span></div></div>
      ${Object.keys(days).length ? Object.entries(days).map(([k, es]) => `<p class="sec-h">${esc(dayName(k))} · ${dur(es.reduce((s, e) => s + net(e), 0))}</p>
        <div class="card"><ul class="list">${es.map(e => `<li><div class="t"><b>${hm(e.start)} – ${hm(e.end)}</b> · ${dur(net(e))}<small>${esc(e.bs || 'Ohne Baustelle')}${e.pause ? ' · Pause ' + e.pause + ' min' : ''}${e.notiz ? ' · ' + esc(e.notiz) : ''}</small></div><button class="del" data-zdel="${e.id}" aria-label="Löschen">×</button></li>`).join('')}</ul></div>`).join('')
        : `<div class="card"><p class="empty" style="margin:0">Keine Zeiten in dieser Woche.</p></div>`}
      ${Object.keys(perBs).length > 1 ? `<p class="sec-h">Nach Baustelle</p><div class="card"><ul class="list">${Object.entries(perBs).sort((a, b) => b[1] - a[1]).map(([b, m]) => `<li><div class="t"><b>${esc(b)}</b></div><span>${dur(m)}</span></li>`).join('')}</ul></div>` : ''}
      <div class="card">
        <h2><svg class="ic"><use href="#i-plus"/></svg>Zeit nachtragen</h2>
        <div class="grid">
          <div class="full"><label for="zn_bs">Baustelle</label><input id="zn_bs" type="text" list="z_bsl" autocomplete="off" placeholder="z. B. Müller, Küche"></div>
          <div class="full"><label for="zn_d">Datum</label><input id="zn_d" type="date" value="${dayKey(Date.now())}"></div>
          <div><label for="zn_a">Von</label><input id="zn_a" type="time" value="07:00"></div>
          <div><label for="zn_b">Bis</label><input id="zn_b" type="time" value="16:00"></div>
          <div><label for="zn_p">Pause (Min.)</label><input id="zn_p" type="number" inputmode="numeric" value="30"></div>
          <div><label for="zn_n">Notiz</label><input id="zn_n" type="text" placeholder="optional"></div>
        </div>
        <button class="clear" data-z="add">Eintragen</button>
      </div>
      <button class="add" data-z="share"><svg class="ic"><use href="#i-share"/></svg>Stundenzettel KW ${isoWeek(ws)} teilen</button>`;
    live();
  }
  function live() {
    clearInterval(tick);
    if (!Z.run) return;
    const up = () => { const el = $('z_live'); if (!el) return clearInterval(tick); const s = Math.max(0, Math.floor((Date.now() - Z.run.start) / 1000)); el.textContent = Math.floor(s / 3600) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); };
    up(); tick = setInterval(up, 1000);
  }
  function shareText() {
    const ws = week, we = ws + 7 * 864e5, items = Z.list.filter(e => e.start >= ws && e.start < we).sort((a, b) => a.start - b.start);
    const L = [`STUNDENZETTEL KW ${isoWeek(ws)} (${new Date(ws).toLocaleDateString('de-DE')} – ${new Date(we - 864e5).toLocaleDateString('de-DE')})`, ''];
    let last = '';
    items.forEach(e => { const k = dayKey(e.start); if (k !== last) { L.push(dayName(k)); last = k; }
      L.push(`  ${hm(e.start)}–${hm(e.end)}  Pause ${e.pause || 0} min  = ${dur(net(e))}  ${e.bs || ''}${e.notiz ? ' (' + e.notiz + ')' : ''}`); });
    const total = items.reduce((s, e) => s + net(e), 0);
    L.push('', `Summe: ${dur(total)} (${dec(total)} Std.)`);
    return L.join('\n');
  }
  async function shareTxt(title, text) {
    const C = window.Capacitor, SH = C && C.isNativePlatform && C.isNativePlatform() && C.Plugins && C.Plugins.Share;
    try {
      if (SH) return await SH.share({title, text, dialogTitle: title});
      if (navigator.share) return await navigator.share({title, text});
    } catch (e) { return; }
    try { await navigator.clipboard.writeText(text); toast('Stundenzettel kopiert'); } catch (e) { toast('Teilen nicht möglich'); }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const el = $('zeit'); if (!el) return;
    render();
    el.addEventListener('click', e => {
      const c = e.target.closest('[data-zbs]'); if (c) { const i = $('z_bs'); if (i) i.value = c.dataset.zbs; return; }
      const d = e.target.closest('[data-zdel]');
      if (d) { if (confirm('Eintrag löschen?')) { Z.list = Z.list.filter(x => x.id !== d.dataset.zdel); save(); render(); } return; }
      const b = e.target.closest('[data-z]'); if (!b) return;
      const a = b.dataset.z;
      if (a === 'start') { Z.run = {bs: ($('z_bs').value || '').trim().slice(0, 120), start: Date.now()}; save(); render(); toast('Stempeluhr läuft'); }
      else if (a === 'stop') {
        const mins = (Date.now() - Z.run.start) / 6e4;
        if (mins < 1) { if (confirm('Weniger als 1 Minute – Stempeluhr verwerfen?')) { Z.run = null; save(); render(); } return; }
        const def = mins > 9 * 60 ? 45 : mins > 6 * 60 ? 30 : 0;
        const p = prompt('Pause in Minuten?', String(def)); if (p === null) return;
        const pv = Math.max(0, Math.min(Math.round(mins) - 1, parseInt(p, 10) || 0));
        Z.list.push({id: uid(), bs: Z.run.bs, start: Z.run.start, end: Date.now(), pause: pv, notiz: ''}); Z.run = null; save();
        week = weekStart(Date.now()); render(); toast('Zeit gespeichert');
      }
      else if (a === 'prev') { week -= 7 * 864e5; render(); }
      else if (a === 'next') { week += 7 * 864e5; render(); }
      else if (a === 'add') {
        const dv = $('zn_d').value, av = $('zn_a').value, bv = $('zn_b').value;
        if (!dv || !av || !bv) return alert('Bitte Datum, Von und Bis eintragen.');
        const s = new Date(dv + 'T' + av).getTime(); let en = new Date(dv + 'T' + bv).getTime();
        if (en <= s) en += 864e5; // über Mitternacht
        const p = Math.max(0, parseInt($('zn_p').value, 10) || 0);
        if (p >= (en - s) / 6e4) return alert('Die Pause ist länger als die Arbeitszeit.');
        Z.list.push({id: uid(), bs: $('zn_bs').value.trim().slice(0, 120), start: s, end: en, pause: p, notiz: $('zn_n').value.trim().slice(0, 300)});
        save(); week = weekStart(s); render(); toast('Eingetragen');
      }
      else if (a === 'share') shareTxt('Stundenzettel KW ' + isoWeek(week), shareText());
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) live(); });
  });
  window.Zeiten = {export: () => Z, import: o => { const n = clean(o || {}); const ids = new Set(Z.list.map(e => e.id)); n.list.forEach(e => { if (!ids.has(e.id)) Z.list.push(e); }); if (!Z.run && n.run) Z.run = n.run; save(); render(); return n.list.length; }};
})();
