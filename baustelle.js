// ===== Meine App – Baustelle: Aufmaß mit Diagonalen-Check und Foto-Aufmaß =====
(function () {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const nf = (x, d = 1) => (isFinite(x) ? x : 0).toLocaleString('de-DE', {maximumFractionDigits: d});
  const mm = x => nf(x, 1) + ' mm';
  const P = s => { const p = window.Rechner && window.Rechner.parse; const v = p ? p(s) : parseFloat(String(s || '').replace(',', '.')); return isFinite(v) ? v : NaN; };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => new Date().toISOString().slice(0, 10);
  const dt = s => s ? new Date(s + 'T12:00').toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'}) : '';
  const $ = id => document.getElementById(id);
  function toast(t) { const el = $('toast'); if (!el) return; el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200); }

  // ---------- Dateien teilen ----------
  const blobToB64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = rej; r.readAsDataURL(blob); });
  async function shareFiles({title, text, files}) {
    const C = window.Capacitor, native = C && C.isNativePlatform && C.isNativePlatform();
    const FS = native && C.Plugins && C.Plugins.Filesystem, SH = native && C.Plugins && C.Plugins.Share;
    if (FS && SH) {
      const uris = [];
      for (const f of files) { const r = await FS.writeFile({path: f.name, data: await blobToB64(f), directory: 'CACHE'}); uris.push(r.uri); }
      await SH.share({title, text, files: uris, dialogTitle: title});
      return 'shared';
    }
    if (navigator.canShare && navigator.canShare({files})) { await navigator.share({title, text, files}); return 'shared'; }
    for (const f of files) { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
    return 'downloaded';
  }
  window.ShareFiles = shareFiles;

  // ---------- Speicher (IndexedDB, nur auf diesem Gerät) ----------
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open('meine-app-baustelle', 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('aufmass', {keyPath: 'id'}); d.createObjectStore('fotos', {keyPath: 'id'}); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store), r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); });
  }
  const getAll = s => tx(s, 'readonly', st => st.getAll());
  const get = (s, id) => tx(s, 'readonly', st => st.get(id));
  const put = (s, v) => tx(s, 'readwrite', st => st.put(v));
  const del = (s, id) => tx(s, 'readwrite', st => st.delete(id));

  // ---------- Felder ----------
  const F = {
    bo: 'Breite oben', bm: 'Breite Mitte', bu: 'Breite unten',
    hl: 'Höhe links', hm: 'Höhe Mitte', hr: 'Höhe rechts',
    d1: 'Diagonale ↘', d2: 'Diagonale ↙', to: 'Tiefe oben', tu: 'Tiefe unten',
    fs: 'Fuge je Seite', fo: 'Fuge oben', fu: 'Fuge unten'
  };
  const GROUPS = [
    {t: 'Breite', h: 'Innen, von Wand zu Wand', k: ['bo', 'bm', 'bu'], l: ['oben', 'Mitte', 'unten']},
    {t: 'Höhe', h: 'Vom Boden bis Decke bzw. Sturz', k: ['hl', 'hm', 'hr'], l: ['links', 'Mitte', 'rechts']},
    {t: 'Diagonalen', h: 'Ecke zu Ecke, für den Winkel-Check', k: ['d1', 'd2'], l: ['↘ links oben → rechts unten', '↙ rechts oben → links unten']},
    {t: 'Tiefe', h: 'Optional', k: ['to', 'tu'], l: ['oben', 'unten']},
    {t: 'Fuge / Luft fürs Bauteil', h: 'Wird vom kleinsten Maß abgezogen', k: ['fs', 'fo', 'fu'], l: ['je Seite', 'oben', 'unten']}
  ];
  const blank = () => ({id: uid(), titel: '', ort: '', datum: today(), m: {fs: '3', fo: '3', fu: '0'}, notiz: '', fotos: [], updated: Date.now()});

  // ---------- Auswertung ----------
  function analyze(m) {
    const v = k => P(m[k]);
    const B = ['bo', 'bm', 'bu'].map(v), H = ['hl', 'hm', 'hr'].map(v);
    const Bf = B.filter(isFinite), Hf = H.filter(isFinite);
    const out = {msgs: [], rows: [], status: 'ok', ready: Bf.length > 0 && Hf.length > 0};
    if (!out.ready) { out.wait = 'Trag mindestens eine Breite und eine Höhe ein.'; return out; }
    const worst = s => { const o = {ok: 0, warn: 1, bad: 2}; if (o[s] > o[out.status]) out.status = s; };
    const minB = Math.min(...Bf), maxB = Math.max(...Bf), minH = Math.min(...Hf), maxH = Math.max(...Hf);
    const bMean = Bf.reduce((a, x) => a + x, 0) / Bf.length, hMean = Hf.reduce((a, x) => a + x, 0) / Hf.length;
    out.minB = minB; out.minH = minH;
    // Breite: Verjüngung
    if (Bf.length > 1) {
      const d = maxB - minB;
      if (d < 1) out.msgs.push(['ok', 'Breite überall gleich (' + mm(minB) + ').']);
      else {
        const where = ['oben', 'in der Mitte', 'unten'][B.indexOf(minB)];
        out.msgs.push([d > 5 ? 'bad' : 'warn', `Am schmalsten ${where}: ${mm(minB)} – ${mm(d)} Unterschied.`]); worst(d > 5 ? 'bad' : 'warn');
        if (isFinite(B[0]) && isFinite(B[2]) && isFinite(B[1]) && B[1] < Math.min(B[0], B[2]) - 1) out.msgs.push(['warn', 'Wand in der Mitte bauchig nach innen.']);
        if (isFinite(B[0]) && isFinite(B[2]) && isFinite(B[1]) && B[1] > Math.max(B[0], B[2]) + 1) out.msgs.push(['warn', 'Wand in der Mitte hohl nach außen.']);
      }
    }
    // Höhe: Boden/Decke schief
    if (isFinite(H[0]) && isFinite(H[2])) {
      const d = H[2] - H[0], ad = Math.abs(d);
      if (ad < 1) out.msgs.push(['ok', 'Höhe links und rechts gleich.']);
      else {
        const per = ad / bMean * 1000;
        out.msgs.push([ad > 5 ? 'bad' : 'warn', `${d > 0 ? 'Rechts' : 'Links'} ${mm(ad)} höher – Boden oder Decke ${nf(per, 1)} mm/m schief.`]); worst(ad > 5 ? 'bad' : 'warn');
      }
    } else if (Hf.length > 1 && maxH - minH >= 1) { out.msgs.push(['warn', `Höhenunterschied ${mm(maxH - minH)}.`]); worst('warn'); }
    // Diagonalen: Winkel und Lot
    const d1 = v('d1'), d2 = v('d2');
    if (isFinite(d1) && isFinite(d2)) {
      const dd = d1 - d2, ad = Math.abs(dd), exp = Math.hypot(bMean, hMean), avg = (d1 + d2) / 2;
      if (Math.abs(avg - exp) > Math.max(12, exp * 0.006)) {
        out.msgs.push(['bad', `Diagonalen passen nicht zu Breite und Höhe (erwartet ≈ ${mm(exp)}). Bitte nachmessen.`]); worst('bad');
      } else if (ad <= 2) out.msgs.push(['ok', `Im Winkel – Diagonalen nur ${mm(ad)} Unterschied.`]);
      else {
        const shift = (d1 * d1 - d2 * d2) / (4 * bMean);
        const st = ad > 5 ? 'bad' : 'warn'; worst(st);
        out.msgs.push([st, `Nicht im Winkel: ${mm(ad)} Diagonalen-Unterschied.`]);
        out.msgs.push([st, `Seiten ca. ${mm(Math.abs(shift))} aus dem Lot (oben nach ${shift > 0 ? 'rechts' : 'links'} versetzt, auf ${nf(hMean / 1000, 2)} m Höhe).`]);
      }
      out.shift = (d1 * d1 - d2 * d2) / (4 * bMean);
    }
    // Bauteil-Maß
    const fs = isFinite(v('fs')) ? v('fs') : 0, fo = isFinite(v('fo')) ? v('fo') : 0, fu = isFinite(v('fu')) ? v('fu') : 0;
    out.bauteil = {b: minB - 2 * fs, h: minH - fo - fu};
    const T = ['to', 'tu'].map(v).filter(isFinite); if (T.length) out.minT = Math.min(...T);
    out.rows = [['Lichte Breite (kleinste)', mm(minB)], ['Lichte Höhe (kleinste)', mm(minH)], ...(isFinite(out.minT) ? [['Tiefe (kleinste)', mm(out.minT)]] : []),
      ['Bauteil max. Breite', mm(out.bauteil.b)], ['Bauteil max. Höhe', mm(out.bauteil.h)]];
    return out;
  }

  // ---------- Skizze ----------
  // C: Farben – am Bildschirm CSS-Variablen, beim Export feste Werte
  const SCREEN = {wall: 'var(--bg2)', line: 'var(--ink2)', dim: 'var(--muted)', txt: 'var(--ink)', red: 'var(--brass)', ok: 'var(--good)', bg: 'transparent', font: 'Lato, sans-serif'};
  const PRINT = {wall: '#f1eeea', line: '#292e2c', dim: '#6e6e6c', txt: '#292e2c', red: '#9c1006', ok: '#3d7a3a', bg: '#ffffff', font: 'Helvetica, Arial, sans-serif'};
  function sketch(m, a, C = SCREEN, hl = '') {
    const W = 340, H = 250, x0 = 62, y0 = 40, w = 216, h = 160, x1 = x0 + w, y1 = y0 + h;
    const val = k => { const x = P(m[k]); return isFinite(x) ? nf(x, 1) : '?'; };
    const has = k => isFinite(P(m[k]));
    const minK = (ks) => { let best = null, bv = Infinity; ks.forEach(k => { const x = P(m[k]); if (isFinite(x) && x < bv) { bv = x; best = k; } }); return ks.filter(k => has(k)).length > 1 ? best : null; };
    const nb = minK(['bo', 'bm', 'bu']), nh = minK(['hl', 'hm', 'hr']);
    const col = k => k === hl ? C.red : (k === nb || k === nh) ? C.red : has(k) ? C.txt : C.dim;
    const wt = k => k === hl ? 900 : (k === nb || k === nh) ? 700 : 400;
    const T = (x, y, t, k, anc = 'middle', rot = 0) => `<text data-k="${k || ''}" x="${x}" y="${y}" text-anchor="${anc}" dominant-baseline="middle" style="fill:${col(k)};font:${wt(k)} 12px ${C.font}"${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${esc(t)}</text>`;
    const L = (xa, ya, xb, yb, k, dash) => `<line data-k="${k}" x1="${xa}" y1="${ya}" x2="${xb}" y2="${yb}" style="stroke:${k === hl ? C.red : has(k) ? C.line : C.dim};stroke-width:${k === hl ? 2.2 : 1};${dash ? 'stroke-dasharray:4 3;' : ''}"/>`;
    // Verzerrung andeuten (übertrieben), wenn Diagonalen schief
    const sh = a && isFinite(a.shift) ? Math.max(-14, Math.min(14, a.shift * 2)) : 0;
    let o = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W * 2}" height="${H * 2}" class="sk auf-sk"><rect width="${W}" height="${H}" style="fill:${C.bg}"/>`;
    // Wand (Laibung)
    o += `<path d="M${x0 - 18} ${y0 - 18}H${x1 + 18}V${y1 + 6}H${x1}V${y0}H${x0}V${y1 + 6}H${x0 - 18}Z" style="fill:${C.wall};stroke:${C.dim};stroke-width:.8"/>`;
    o += `<path d="M${x0 - 30} ${y1 + 6}H${x1 + 30}" style="stroke:${C.line};stroke-width:1.4"/>`;
    o += `<polygon points="${x0 + sh},${y0} ${x1 + sh},${y0} ${x1},${y1} ${x0},${y1}" style="fill:none;stroke:${a && a.status === 'bad' ? C.red : C.line};stroke-width:1.6"/>`;
    // Breiten
    const yb = [y0 + 14, (y0 + y1) / 2, y1 - 14];
    ['bo', 'bm', 'bu'].forEach((k, i) => { o += L(x0 + 4, yb[i], x1 - 4, yb[i], k, i === 1) + `<path d="M${x0 + 4} ${yb[i] - 4}v8M${x1 - 4} ${yb[i] - 4}v8" style="stroke:${k === hl ? C.red : C.dim}"/>` + T((x0 + x1) / 2, yb[i] - 8, val(k), k); });
    // Höhen
    const xh = [x0 - 34, (x0 + x1) / 2, x1 + 34];
    ['hl', 'hm', 'hr'].forEach((k, i) => {
      if (i === 1) { o += L(xh[1] + 40, y0 + 4, xh[1] + 40, y1 - 4, k, true) + T(xh[1] + 50, (y0 + y1) / 2 + 30, val(k), k, 'start'); return; }
      o += L(xh[i], y0, xh[i], y1, k) + `<path d="M${xh[i] - 4} ${y0}h8M${xh[i] - 4} ${y1}h8" style="stroke:${k === hl ? C.red : C.dim}"/>` + T(xh[i] + (i ? 12 : -12), (y0 + y1) / 2, val(k), k, 'middle', -90);
    });
    // Diagonalen
    o += L(x0 + 6, y0 + 6, x1 - 6, y1 - 6, 'd1', true) + L(x1 - 6, y0 + 6, x0 + 6, y1 - 6, 'd2', true);
    o += T(x0 + w * .3, y0 + h * .38, '↘ ' + val('d1'), 'd1') + T(x1 - w * .3, y0 + h * .38, '↙ ' + val('d2'), 'd2');
    // Tiefe
    if (has('to') || has('tu') || hl === 'to' || hl === 'tu') o += T(x1 + 18, y0 - 26, 'Tiefe ' + (has('to') ? val('to') : '?') + ' / ' + (has('tu') ? val('tu') : '?'), hl === 'to' || hl === 'tu' ? hl : 'to', 'end');
    o += `<text x="${x0 - 30}" y="${H - 10}" style="fill:${C.dim};font:400 10px ${C.font}">Maße in mm · rot = kleinstes Maß</text>`;
    return o + '</svg>';
  }

  // ---------- Zustand & Anzeige ----------
  let cur = null, saveT = null, focusK = '';
  const root = () => $('auf');
  async function list() {
    const all = (await getAll('aufmass')).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const COLS = {ok: '#34c759', warn: '#ff9500', bad: '#ff3b30', wait: '#8e8e93'};
    root().innerHTML = `<div class="r-top"><span class="r-h">Aufmaß</span><button class="top-btn" data-a="new"><svg class="ic"><use href="#i-plus"/></svg>Neu</button></div>` +
      (all.length ? `<div class="rows">` + all.map(r => {
        const a = analyze(r.m), st = a.ready ? a.status : 'wait';
        return `<button class="rw" data-open="${esc(r.id)}"><span class="tl" style="background:${COLS[st]}"><svg class="ic"><use href="#i-ruler"/></svg></span>` +
          `<span class="bd"><span class="tx"><b>${esc(r.titel || 'Ohne Bezeichnung')}</b><small>${esc([r.ort, dt(r.datum), (r.fotos || []).length ? (r.fotos.length + ' Foto' + (r.fotos.length > 1 ? 's' : '')) : ''].filter(Boolean).join(' · '))}</small></span>` +
          (a.ready ? `<span class="v">${nf(a.minB, 0)} × ${nf(a.minH, 0)}</span>` : '') + `<svg class="ic chev"><use href="#i-chev"/></svg></span></button>`;
      }).join('') + `</div>` : `<div class="card"><p class="empty" style="margin:0">Noch kein Aufmaß. Tippe auf „Neu“, um eine Nische oder Öffnung aufzumessen.</p></div>`) +
      `<p class="hint" style="margin:-8px 16px 0">Grün = im Winkel · Orange = leicht schief · Rot = deutlich schief. Alles bleibt nur auf diesem Gerät.</p>`;
  }
  async function open(id) {
    cur = id ? await get('aufmass', id) : blank();
    if (!cur) return list();
    if (!id) await put('aufmass', cur);
    renderEdit();
    scrollTo(0, 0);
  }
  function renderEdit() {
    const r = cur;
    root().innerHTML = `<div class="r-top"><button class="back" data-a="back"><svg class="ic"><use href="#i-back"/></svg>Aufmaß</button><button class="top-btn" data-a="share"><svg class="ic"><use href="#i-share"/></svg>PDF teilen</button></div>
      <div class="card">
        <div class="grid">
          <div class="full"><label for="a_titel">Bezeichnung</label><input id="a_titel" data-f="titel" type="text" placeholder="z. B. Nische Kühlschrank" value="${esc(r.titel)}"></div>
          <div><label for="a_ort">Kunde / Baustelle</label><input id="a_ort" data-f="ort" type="text" placeholder="z. B. Müller" value="${esc(r.ort)}"></div>
          <div><label for="a_datum">Datum</label><input id="a_datum" data-f="datum" type="date" value="${esc(r.datum)}"></div>
        </div>
      </div>
      <div class="card auf-main">
        <div class="fig-box"><div id="a_sk"></div><div class="fig-res" id="a_head"></div></div>
        <div id="a_msgs"></div>
        ${GROUPS.map(g => `<h3 class="r-g">${g.t}</h3><p class="hint auf-h">${g.h}</p><div class="auf-grid n${g.k.length}">${g.k.map((k, i) =>
          `<div><label for="a_${k}">${g.l[i]}</label><input id="a_${k}" data-k="${k}" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="next" value="${esc(r.m[k] ?? '')}" placeholder="mm"></div>`).join('')}</div>`).join('')}
        <div id="a_rows"></div>
      </div>
      <div class="card">
        <h2><svg class="ic"><use href="#i-camera"/></svg>Fotos</h2>
        <div class="auf-fotos" id="a_fotos"></div>
        <label class="add" for="a_file"><svg class="ic"><use href="#i-camera"/></svg>Foto aufnehmen</label>
        <input type="file" id="a_file" accept="image/*" hidden>
        <p class="hint">Tippe auf ein Foto, um Maßlinien einzuzeichnen.</p>
      </div>
      <div class="card"><label for="a_notiz">Notiz</label><textarea id="a_notiz" data-f="notiz" rows="3" placeholder="Steckdosen, Leitungen, Besonderheiten …">${esc(r.notiz)}</textarea>
        <button class="clear auf-del" data-a="delete">Aufmaß löschen</button></div>`;
    update(); renderFotos();
  }
  function update() {
    const a = analyze(cur.m);
    $('a_sk').innerHTML = sketch(cur.m, a, SCREEN, focusK);
    const hd = $('a_head');
    if (!a.ready) { hd.className = 'fig-res wait'; hd.textContent = a.wait; }
    else { hd.className = 'fig-res'; hd.textContent = 'Bauteil max. ' + nf(a.bauteil.b, 1) + ' × ' + nf(a.bauteil.h, 1) + ' mm'; }
    $('a_msgs').innerHTML = a.msgs.map(([s, t]) => `<div class="auf-msg ${s}"><span class="dot ${s}"></span>${esc(t)}</div>`).join('');
    $('a_rows').innerHTML = a.ready ? `<div class="res">${a.rows.map(([x, y]) => `<div class="row"><span>${esc(x)}</span><b>${esc(y)}</b></div>`).join('')}</div>` : '';
  }
  function save() { clearTimeout(saveT); saveT = setTimeout(() => { cur.updated = Date.now(); put('aufmass', cur).catch(() => toast('Speichern nicht möglich')); }, 250); }

  // ---------- Fotos ----------
  const urls = {};
  async function fotoURL(id) { if (urls[id]) return urls[id]; const f = await get('fotos', id); if (!f) return ''; return (urls[id] = URL.createObjectURL(f.blob)); }
  async function renderFotos() {
    const box = $('a_fotos'); if (!box) return;
    if (!cur.fotos.length) { box.innerHTML = '<p class="empty" style="margin:0">Noch keine Fotos.</p>'; return; }
    const items = await Promise.all(cur.fotos.map(async (f, i) => `<div class="auf-foto"><button data-ann="${i}" aria-label="Maßlinien einzeichnen"><img src="${await fotoURL(f.id)}" alt="Foto ${i + 1}"><span class="n">${(f.lines || []).length ? f.lines.length + ' Maß' + (f.lines.length > 1 ? 'e' : '') : 'Maße einzeichnen'}</span></button><button class="x" data-fdel="${i}" aria-label="Foto löschen">×</button></div>`));
    box.innerHTML = items.join('');
  }
  function shrink(file) {
    return new Promise((res, rej) => {
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u);
        c.toBlob(b => b ? res({blob: b, w: c.width, h: c.height}) : rej(), 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(u); rej(); };
      img.src = u;
    });
  }
  async function addFoto(file) {
    try {
      const s = await shrink(file), id = uid();
      await put('fotos', {id, blob: s.blob});
      cur.fotos.push({id, w: s.w, h: s.h, lines: []}); cur.updated = Date.now(); await put('aufmass', cur);
      await renderFotos(); annotate(cur.fotos.length - 1);
    } catch (e) { toast('Foto konnte nicht geladen werden'); }
  }

  // ---------- Maßlinien aufs Foto zeichnen ----------
  function linesSvg(f, sel = -1) {
    const sw = Math.max(f.w, f.h) / 260, fs = Math.max(f.w, f.h) / 34;
    return (f.lines || []).map((l, i) => {
      const dx = l.x2 - l.x1, dy = l.y2 - l.y1, L = Math.hypot(dx, dy) || 1, tx = -dy / L * sw * 4, ty = dx / L * sw * 4;
      const mx = (l.x1 + l.x2) / 2, my = (l.y1 + l.y2) / 2, t = l.t || '?', tw = t.length * fs * .58 + fs * .8;
      const c = i === sel ? '#ffd24a' : '#e8281a';
      return `<g data-li="${i}"><line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="#fff" stroke-width="${sw * 2.6}" stroke-linecap="round" opacity=".85"/>` +
        `<line x1="${l.x1}" y1="${l.y1}" x2="${l.x2}" y2="${l.y2}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round"/>` +
        `<path d="M${l.x1 - tx} ${l.y1 - ty}L${l.x1 + tx} ${l.y1 + ty}M${l.x2 - tx} ${l.y2 - ty}L${l.x2 + tx} ${l.y2 + ty}" stroke="${c}" stroke-width="${sw}"/>` +
        `<rect x="${mx - tw / 2}" y="${my - fs * .72}" width="${tw}" height="${fs * 1.44}" rx="${fs * .25}" fill="${c}"/>` +
        `<text x="${mx}" y="${my}" fill="#fff" font-size="${fs}" font-weight="700" font-family="Helvetica, Arial, sans-serif" text-anchor="middle" dominant-baseline="central">${esc(t)}</text></g>`;
    }).join('');
  }
  async function annotate(i) {
    const f = cur.fotos[i]; if (!f) return;
    const ov = document.createElement('div'); ov.id = 'ann';
    ov.innerHTML = `<div class="ann-top"><button data-x="undo">Rückgängig</button><span>Linie ziehen, dann Maß eingeben</span><button data-x="done" class="ok">Fertig</button></div>
      <div class="ann-wrap"><div class="ann-pic"><img alt="" src="${await fotoURL(f.id)}"><svg viewBox="0 0 ${f.w} ${f.h}" preserveAspectRatio="none"></svg></div></div>`;
    document.body.appendChild(ov); document.body.classList.add('ann-open');
    const svg = ov.querySelector('svg'), pic = ov.querySelector('.ann-pic');
    const draw = (tmp) => { svg.innerHTML = linesSvg(f) + (tmp ? linesSvg({w: f.w, h: f.h, lines: [tmp]}, 0) : ''); };
    draw();
    const pt = e => { const r = pic.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * f.w, (e.clientY - r.top) / r.height * f.h]; };
    let st = null, tmp = null;
    pic.addEventListener('pointerdown', e => { e.preventDefault(); pic.setPointerCapture(e.pointerId); st = pt(e); tmp = null; });
    pic.addEventListener('pointermove', e => { if (!st) return; const p = pt(e); tmp = {x1: st[0], y1: st[1], x2: p[0], y2: p[1], t: ''}; draw(tmp); });
    pic.addEventListener('pointerup', e => {
      if (!st) return; const p = pt(e), s0 = st; st = null;
      const len = Math.hypot(p[0] - s0[0], p[1] - s0[1]);
      if (len < Math.max(f.w, f.h) / 25) { // Tippen: vorhandene Linie bearbeiten
        draw();
        const hit = (f.lines || []).findIndex(l => { const mx = (l.x1 + l.x2) / 2, my = (l.y1 + l.y2) / 2; return Math.hypot(mx - p[0], my - p[1]) < Math.max(f.w, f.h) / 14; });
        if (hit >= 0) { const nv = prompt('Maß ändern (leer lassen = Linie löschen):', f.lines[hit].t); if (nv !== null) { if (nv.trim()) f.lines[hit].t = nv.trim().slice(0, 24); else f.lines.splice(hit, 1); draw(); } }
        return;
      }
      const t = prompt('Maß für diese Linie (z. B. 842 oder 84,2 cm):', '');
      if (t && t.trim()) { f.lines.push({x1: s0[0], y1: s0[1], x2: p[0], y2: p[1], t: (/^\s*[\d.,]+\s*$/.test(t) ? t.trim() + ' mm' : t.trim()).slice(0, 24)}); }
      draw();
    });
    ov.querySelector('.ann-top').addEventListener('click', async e => {
      const b = e.target.closest('[data-x]'); if (!b) return;
      if (b.dataset.x === 'undo') { f.lines.pop(); draw(); return; }
      cur.updated = Date.now(); await put('aufmass', cur); ov.remove(); document.body.classList.remove('ann-open'); renderFotos();
    });
  }
  async function fotoWithLines(f) {
    const img = new Image(); img.src = await fotoURL(f.id); await img.decode();
    const c = document.createElement('canvas'); c.width = f.w; c.height = f.h; const g = c.getContext('2d'); g.drawImage(img, 0, 0, f.w, f.h);
    if ((f.lines || []).length) { const ov = await svgToImg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f.w} ${f.h}" width="${f.w}" height="${f.h}">${linesSvg(f)}</svg>`); g.drawImage(ov, 0, 0, f.w, f.h); }
    return new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
  }
  function svgToImg(s) { return new Promise((res, rej) => { const u = URL.createObjectURL(new Blob([s], {type: 'image/svg+xml'})), i = new Image(); i.onload = () => { res(i); setTimeout(() => URL.revokeObjectURL(u), 1000); }; i.onerror = rej; i.src = u; }); }
  async function sketchPng() {
    const img = await svgToImg(sketch(cur.m, analyze(cur.m), PRINT)); const c = document.createElement('canvas'); c.width = 1020; c.height = 750;
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return new Promise(r => c.toBlob(r, 'image/png'));
  }

  // ---------- PDF-Bericht ----------
  async function sketchJpeg() {
    const img = await svgToImg(sketch(cur.m, analyze(cur.m), PRINT)); const c = document.createElement('canvas'); c.width = 1360; c.height = 1000;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return {blob: await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9)), w: c.width, h: c.height};
  }
  const bytes = async blob => new Uint8Array(await blob.arrayBuffer());
  async function pdfReport() {
    const PDF = window.MiniPDF, r = cur, a = analyze(r.m), d = new PDF.Doc(), W = PDF.W, M = 42, CW = W - 2 * M;
    const RED = '#9c1006', INK = '#1c1c1e', GR = '#6e6e73', LN = '#d1d1d6';
    const v = k => isFinite(P(r.m[k])) ? nf(P(r.m[k]), 1) : '–';
    const head = (sub) => { d.rect(0, 0, W, 6, RED); d.text(M, 40, 'AUFMASS', {size: 9, bold: true, color: RED}); d.text(W - M, 40, sub, {size: 9, color: GR, align: 'right'}); };
    let page = 1; const foot = () => d.text(W / 2, 815, 'Erstellt am ' + new Date().toLocaleDateString('de-DE') + ' · Seite ' + page, {size: 8, color: GR, align: 'center'});
    head(dt(r.datum));
    let y = d.para(M, 66, r.titel || 'Ohne Bezeichnung', CW, {size: 22, bold: true, color: INK, lh: 26});
    if (r.ort) { d.text(M, y + 2, 'Baustelle / Kunde: ' + r.ort, {size: 11, color: GR}); y += 18; }
    y += 8; d.line(M, y, W - M, y, LN, .6); y += 14;
    // Skizze links, Bauteilmaß rechts
    const sk = await sketchJpeg(), skW = 300, skH = skW * sk.h / sk.w;
    d.image(await bytes(sk.blob), sk.w, sk.h, M - 6, y, skW, skH);
    const bx = M + skW + 10, bw = W - M - bx;
    if (a.ready) {
      d.rect(bx, y + 6, bw, 74, '#f6efee'); d.rect(bx, y + 6, 3, 74, RED);
      d.text(bx + 12, y + 24, 'BAUTEIL MAX.', {size: 8, bold: true, color: RED});
      d.text(bx + 12, y + 48, nf(a.bauteil.b, 1) + ' × ' + nf(a.bauteil.h, 1), {size: 18, bold: true, color: INK});
      d.text(bx + 12, y + 66, 'mm (B × H), Fuge abgezogen', {size: 8, color: GR});
      const st = {ok: ['Im Winkel', '#34c759'], warn: ['Leicht schief', '#ff9500'], bad: ['Deutlich schief', '#ff3b30']}[a.status];
      d.circle(bx + 16, y + 102, 5, st[1]); d.text(bx + 28, y + 105, st[0], {size: 11, bold: true, color: INK});
    }
    y += Math.max(skH, 130) + 10;
    // Messwerte
    d.text(M, y, 'MESSWERTE (mm)', {size: 9, bold: true, color: GR}); y += 8;
    const rowsM = [['Breite', 'oben ' + v('bo'), 'Mitte ' + v('bm'), 'unten ' + v('bu')], ['Höhe', 'links ' + v('hl'), 'Mitte ' + v('hm'), 'rechts ' + v('hr')],
      ['Diagonalen', '\\ ' + v('d1'), '/ ' + v('d2'), ''], ['Tiefe', 'oben ' + v('to'), 'unten ' + v('tu'), ''], ['Fuge', 'Seite ' + v('fs'), 'oben ' + v('fo'), 'unten ' + v('fu')]];
    rowsM.forEach(rw => { y += 18; d.line(M, y + 5, W - M, y + 5, LN, .4); d.text(M, y, rw[0], {size: 10, bold: true, color: INK}); rw.slice(1).forEach((c, i) => d.text(M + 110 + i * 135, y, c, {size: 10, color: INK})); });
    y += 28;
    // Auswertung
    if (a.ready && a.msgs.length) {
      d.text(M, y, 'AUSWERTUNG', {size: 9, bold: true, color: GR}); y += 16;
      a.msgs.forEach(([s, t]) => { d.circle(M + 4, y - 3.5, 3.2, {ok: '#34c759', warn: '#ff9500', bad: '#ff3b30'}[s] || GR); y = d.para(M + 14, y, t, CW - 14, {size: 10, color: INK, bold: s === 'bad', lh: 13.5}) + 5; });
      y += 8;
    }
    if (r.notiz) { d.text(M, y, 'NOTIZ', {size: 9, bold: true, color: GR}); y = d.para(M, y + 16, r.notiz, CW, {size: 10, color: INK, lh: 13.5}) + 6; }
    foot();
    // Fotos: zwei pro Seite
    for (let i = 0; i < r.fotos.length; i++) {
      if (i % 2 === 0) { d.add(); page++; head((r.titel || '') + ' · Fotos'); foot(); }
      const f = r.fotos[i], jb = await fotoWithLines(f), boxY = i % 2 === 0 ? 62 : 432, maxW = CW, maxH = 340;
      const k = Math.min(maxW / f.w, maxH / f.h), w = f.w * k, h = f.h * k;
      d.image(await bytes(jb), f.w, f.h, M + (maxW - w) / 2, boxY, w, h);
      d.text(M, boxY + h + 14, 'Foto ' + (i + 1) + ((f.lines || []).length ? ' · ' + f.lines.map(l => l.t).join(', ') : ''), {size: 9, color: GR});
    }
    return d.blob();
  }

  // ---------- Teilen ----------
  function shareText() {
    const r = cur, a = analyze(r.m), v = k => isFinite(P(r.m[k])) ? nf(P(r.m[k]), 1) : '–';
    const L = [`AUFMASS: ${r.titel || 'Ohne Bezeichnung'}`, r.ort ? `Baustelle: ${r.ort}` : '', `Datum: ${dt(r.datum)}`, '',
      `Breite oben / Mitte / unten: ${v('bo')} / ${v('bm')} / ${v('bu')} mm`,
      `Höhe links / Mitte / rechts: ${v('hl')} / ${v('hm')} / ${v('hr')} mm`,
      `Diagonalen ↘ / ↙: ${v('d1')} / ${v('d2')} mm`];
    if (isFinite(P(r.m.to)) || isFinite(P(r.m.tu))) L.push(`Tiefe oben / unten: ${v('to')} / ${v('tu')} mm`);
    if (a.ready) { L.push('', 'Auswertung:', ...a.msgs.map(([, t]) => '• ' + t), `Fuge: ${v('fs')} je Seite, ${v('fo')} oben, ${v('fu')} unten`, `→ Bauteil max. ${nf(a.bauteil.b, 1)} × ${nf(a.bauteil.h, 1)} mm`); }
    if (r.notiz) L.push('', 'Notiz: ' + r.notiz);
    return L.filter((x, i) => x !== '' || L[i - 1] !== '').join('\n');
  }
  async function share() {
    const text = shareText(), name = (cur.titel || 'Aufmass').replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 40);
    try {
      toast('PDF wird erstellt …');
      const files = [new File([await pdfReport()], `Aufmass_${name}.pdf`, {type: 'application/pdf'})];
      const C = window.Capacitor, native = C && C.isNativePlatform && C.isNativePlatform();
      if (native || (navigator.canShare && navigator.canShare({files}))) { await shareFiles({title: 'Aufmaß ' + (cur.titel || ''), text, files}); return; }
      if (navigator.share) { await navigator.share({title: 'Aufmaß', text}); return; }
    } catch (e) { if (e && (e.name === 'AbortError' || /cancel/i.test(e.message || ''))) return; }
    try { await navigator.clipboard.writeText(text); toast('Aufmaß als Text kopiert'); } catch (e) { toast('Teilen nicht möglich'); }
  }

  // ---------- Ereignisse ----------
  document.addEventListener('DOMContentLoaded', () => {
    const el = root(); if (!el) return;
    if (!window.indexedDB) { el.innerHTML = '<div class="card"><p class="empty">Speicher nicht verfügbar.</p></div>'; return; }
    list().catch(() => { el.innerHTML = '<div class="card"><p class="empty">Speicher nicht verfügbar (privates Surfen?).</p></div>'; });
    el.addEventListener('click', async e => {
      const t = e.target.closest('[data-a],[data-open],[data-ann],[data-fdel]'); if (!t) return;
      if (t.dataset.open) return open(t.dataset.open);
      if (t.dataset.ann) return annotate(+t.dataset.ann);
      if (t.dataset.fdel) {
        if (!confirm('Foto löschen?')) return;
        const f = cur.fotos.splice(+t.dataset.fdel, 1)[0]; if (f) { await del('fotos', f.id); if (urls[f.id]) { URL.revokeObjectURL(urls[f.id]); delete urls[f.id]; } }
        cur.updated = Date.now(); await put('aufmass', cur); return renderFotos();
      }
      const a = t.dataset.a;
      if (a === 'new') return open(null);
      if (a === 'back') { clearTimeout(saveT); cur.updated = Date.now(); await put('aufmass', cur); cur = null; await list(); scrollTo(0, 0); return; }
      if (a === 'share') return share();
      if (a === 'delete') {
        if (!confirm('Dieses Aufmaß mit allen Fotos löschen?')) return;
        for (const f of cur.fotos) await del('fotos', f.id);
        await del('aufmass', cur.id); cur = null; await list(); toast('Aufmaß gelöscht');
      }
    });
    el.addEventListener('input', e => {
      if (!cur) return; const t = e.target;
      if (t.dataset.k) { cur.m[t.dataset.k] = t.value; update(); save(); }
      else if (t.dataset.f) { cur[t.dataset.f] = t.value; save(); }
    });
    el.addEventListener('change', e => { if (e.target.id === 'a_file' && e.target.files[0]) { addFoto(e.target.files[0]); e.target.value = ''; } });
    el.addEventListener('focusin', e => { const k = e.target.dataset && e.target.dataset.k; if (k && cur) { focusK = k; $('a_sk').innerHTML = sketch(cur.m, analyze(cur.m), SCREEN, focusK); } });
    el.addEventListener('focusout', e => { if (e.target.dataset && e.target.dataset.k && cur) { focusK = ''; setTimeout(() => { if (!focusK && $('a_sk')) $('a_sk').innerHTML = sketch(cur.m, analyze(cur.m), SCREEN, ''); }, 50); } });
    // Enter springt ins nächste Maßfeld
    el.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || !e.target.dataset.k) return;
      const ins = [...el.querySelectorAll('input[data-k]')], i = ins.indexOf(e.target);
      if (i >= 0 && ins[i + 1]) { e.preventDefault(); ins[i + 1].focus(); }
    });
  });
  // ---------- Sicherung ----------
  async function exportData() {
    const aufmass = await getAll('aufmass'), fotos = [];
    for (const f of await getAll('fotos')) fotos.push({id: f.id, type: f.blob.type || 'image/jpeg', b64: await blobToB64(f.blob)});
    return {aufmass, fotos};
  }
  // Prüft jede Angabe, damit eine präparierte Datei nichts anrichten kann
  const sid = x => typeof x === 'string' && /^[a-z0-9]{1,24}$/i.test(x) ? x : null;
  const sstr = (x, n = 200) => typeof x === 'string' || typeof x === 'number' ? String(x).slice(0, n) : '';
  const snum = (x, lo, hi) => { const v = Number(x); return isFinite(v) && v >= lo && v <= hi ? v : null; };
  function cleanRec(r) {
    if (!r || typeof r !== 'object' || !sid(r.id)) return null;
    const m = {}; Object.keys(F).forEach(k => { if (r.m && r.m[k] != null) m[k] = sstr(r.m[k], 40); });
    const fotos = (Array.isArray(r.fotos) ? r.fotos : []).slice(0, 50).map(f => {
      if (!f || !sid(f.id)) return null; const w = snum(f.w, 1, 10000), h = snum(f.h, 1, 10000); if (!w || !h) return null;
      const lines = (Array.isArray(f.lines) ? f.lines : []).slice(0, 100).map(l => {
        if (!l) return null; const c = ['x1', 'y1', 'x2', 'y2'].map(k => snum(l[k], -1e5, 1e5)); if (c.some(v => v === null)) return null;
        return {x1: c[0], y1: c[1], x2: c[2], y2: c[3], t: sstr(l.t, 24)};
      }).filter(Boolean);
      return {id: f.id, w, h, lines};
    }).filter(Boolean);
    return {id: r.id, titel: sstr(r.titel, 120), ort: sstr(r.ort, 120), datum: /^\d{4}-\d{2}-\d{2}$/.test(r.datum) ? r.datum : today(),
      m, notiz: sstr(r.notiz, 4000), fotos, updated: snum(r.updated, 0, 1e14) || Date.now()};
  }
  async function importData(j) {
    let n = 0, nf = 0;
    const recs = (Array.isArray(j.aufmass) ? j.aufmass : []).slice(0, 2000).map(cleanRec).filter(Boolean);
    const need = new Set(recs.flatMap(r => r.fotos.map(f => f.id)));
    for (const f of (Array.isArray(j.fotos) ? j.fotos : [])) {
      if (!f || !sid(f.id) || !need.has(f.id) || typeof f.b64 !== 'string' || !/^image\/(jpeg|png)$/.test(f.type)) continue;
      try { const bin = atob(f.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
        await put('fotos', {id: f.id, blob: new Blob([u], {type: f.type})}); nf++; } catch (e) {}
    }
    for (const r of recs) { await put('aufmass', r); n++; }
    if (root()) { cur = null; await list(); }
    return {aufmass: n, fotos: nf};
  }

  window.Baustelle = {analyze, sketch, exportData, importData, pdfReport: () => pdfReport()};
})();
