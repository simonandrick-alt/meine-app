// ===== Meine App – Abnahmeprotokoll mit Unterschrift =====
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const B = () => window.BSDB;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => new Date().toISOString().slice(0, 10);
  const dt = s => s ? new Date(s + 'T12:00').toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit', year: 'numeric'}) : '';
  const toast = t => B() && B().toast(t);

  const CHECK = [
    ['mont', 'Montage vollständig ausgeführt'],
    ['funk', 'Funktion geprüft (Türen, Schubkästen, Beschläge)'],
    ['obfl', 'Oberflächen ohne sichtbare Beschädigung'],
    ['sauber', 'Arbeitsplatz gereinigt, Verpackung entsorgt'],
    ['pflege', 'Pflege- und Bedienhinweise übergeben']
  ];
  const ERG = {ok: ['Abgenommen ohne Mängel', '#34c759'], maengel: ['Abgenommen mit Mängeln', '#ff9500'], nein: ['Abnahme verweigert', '#ff3b30']};
  const blank = () => ({id: uid(), titel: '', kunde: '', ort: '', datum: today(), leistung: '', check: {}, maengel: [], erg: '', sigK: '', sigM: '', nameK: '', nameM: '', updated: Date.now()});

  // Prüft jede Angabe (auch beim Einspielen einer Sicherung)
  const SIG = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]{20,400000}$/;
  function clean(r) {
    const sid = x => typeof x === 'string' && /^[a-z0-9]{1,24}$/i.test(x) ? x : null;
    const s = (x, n = 200) => typeof x === 'string' ? x.slice(0, n) : '';
    if (!r || typeof r !== 'object' || !sid(r.id)) return null;
    const check = {}; CHECK.forEach(([k]) => { if (r.check && ['ja', 'nein'].includes(r.check[k])) check[k] = r.check[k]; });
    return {id: r.id, titel: s(r.titel, 120), kunde: s(r.kunde, 120), ort: s(r.ort, 160), datum: /^\d{4}-\d{2}-\d{2}$/.test(r.datum) ? r.datum : today(),
      leistung: s(r.leistung, 4000), check,
      maengel: (Array.isArray(r.maengel) ? r.maengel : []).slice(0, 60).map(m => m && sid(m.id) ? {id: m.id, text: s(m.text, 600), foto: sid(m.foto)} : null).filter(Boolean),
      erg: ERG[r.erg] ? r.erg : '', sigK: SIG.test(r.sigK || '') ? r.sigK : '', sigM: SIG.test(r.sigM || '') ? r.sigM : '',
      nameK: s(r.nameK, 80), nameM: s(r.nameM, 80), updated: Number(r.updated) || Date.now()};
  }

  let cur = null, saveT = null;
  const root = () => $('abn');
  const status = r => r.erg && r.sigK ? r.erg : 'offen';
  async function list() {
    const all = (await B().getAll('abnahme')).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const col = {ok: '#34c759', maengel: '#ff9500', nein: '#ff3b30', offen: '#8e8e93'};
    root().innerHTML = `<div class="r-top"><span class="r-h">Abnahmen</span><button class="top-btn" data-b="new"><svg class="ic"><use href="#i-plus"/></svg>Neu</button></div>` +
      (all.length ? '<div class="rows">' + all.map(r => { const st = status(r);
        return `<button class="rw" data-bopen="${esc(r.id)}"><span class="tl" style="background:${col[st]}"><svg class="ic"><use href="#i-sign"/></svg></span><span class="bd"><span class="tx"><b>${esc(r.titel || 'Ohne Bezeichnung')}</b><small>${esc([r.kunde, dt(r.datum), st === 'offen' ? 'nicht unterschrieben' : ERG[st][0]].filter(Boolean).join(' · '))}</small></span><svg class="ic chev"><use href="#i-chev"/></svg></span></button>`; }).join('') + '</div>'
        : `<div class="card"><p class="empty" style="margin:0">Noch keine Abnahme. Tippe auf „Neu“, wenn die Montage fertig ist.</p></div>`) +
      `<p class="hint" style="margin:-8px 16px 0">Grün = ohne Mängel · Orange = mit Mängeln · Rot = verweigert · Grau = noch nicht unterschrieben.</p>`;
  }
  async function open(id) {
    cur = id ? clean(await B().get('abnahme', id)) : blank();
    if (!cur) return list();
    if (!id) await B().put('abnahme', cur);
    await edit(); scrollTo(0, 0);
  }
  const seg3 = (k, v) => `<div class="ios-seg mini">${[['ja', 'Ja'], ['nein', 'Nein']].map(([x, l]) => `<button data-chk="${k}" data-v="${x}" class="${v === x ? 'on ' + x : ''}">${l}</button>`).join('')}</div>`;
  async function edit() {
    const r = cur;
    const mg = await Promise.all(r.maengel.map(async (m, i) => `<li class="mg"><span class="mg-n">${i + 1}</span><div class="t">${esc(m.text) || '<i>ohne Text</i>'}${m.foto ? `<img src="${await B().fotoURL(m.foto)}" alt="">` : ''}</div><button class="del" data-mdel="${i}" aria-label="Mangel löschen">×</button></li>`));
    root().innerHTML = `<div class="r-top"><button class="back" data-b="back"><svg class="ic"><use href="#i-back"/></svg>Abnahmen</button><button class="top-btn" data-b="pdf"><svg class="ic"><use href="#i-share"/></svg>PDF teilen</button></div>
      <div class="card"><div class="grid">
        <div class="full"><label for="b_titel">Auftrag</label><input id="b_titel" data-f="titel" type="text" placeholder="z. B. Einbauküche, Innentüren EG" value="${esc(r.titel)}"></div>
        <div><label for="b_kunde">Kunde</label><input id="b_kunde" data-f="kunde" type="text" placeholder="z. B. Müller" value="${esc(r.kunde)}"></div>
        <div><label for="b_datum">Datum</label><input id="b_datum" data-f="datum" type="date" value="${esc(r.datum)}"></div>
        <div class="full"><label for="b_ort">Ort / Adresse</label><input id="b_ort" data-f="ort" type="text" placeholder="Straße, Ort" value="${esc(r.ort)}"></div>
        <div class="full"><label for="b_leist">Ausgeführte Leistungen</label><textarea id="b_leist" data-f="leistung" rows="3" placeholder="z. B. Montage Einbauküche inkl. Arbeitsplatte, Anschluss Spüle">${esc(r.leistung)}</textarea></div>
      </div></div>
      <p class="sec-h">Prüfung</p>
      <div class="card chk">${CHECK.map(([k, t]) => `<div class="chk-r"><span>${t}</span>${seg3(k, r.check[k])}</div>`).join('')}</div>
      <p class="sec-h">Mängel & Restarbeiten</p>
      <div class="card">
        ${r.maengel.length ? `<ul class="list">${mg.join('')}</ul>` : '<p class="empty" style="margin:0 0 4px">Keine Mängel eingetragen.</p>'}
        <div class="mg-add"><input id="b_mtext" type="text" placeholder="Mangel oder Restarbeit beschreiben"><label class="top-btn" for="b_mfoto" aria-label="Foto zum Mangel"><svg class="ic"><use href="#i-camera"/></svg></label><input type="file" id="b_mfoto" accept="image/*" hidden></div>
        <div id="b_mprev"></div>
        <button class="clear" data-b="madd"><svg class="ic"><use href="#i-plus"/></svg>Mangel hinzufügen</button>
      </div>
      <p class="sec-h">Ergebnis</p>
      <div class="card erg">${Object.entries(ERG).map(([k, [t, c]]) => `<button class="erg-b ${r.erg === k ? 'on' : ''}" data-erg="${k}" style="--c:${c}"><span class="dot" style="background:${c}"></span>${t}</button>`).join('')}</div>
      <p class="sec-h">Unterschriften</p>
      <div class="card sigs">
        ${[['K', 'Auftraggeber / Kunde'], ['M', 'Monteur']].map(([w, l]) => `<div class="sig"><label for="b_name${w}">${l}</label><input id="b_name${w}" data-f="name${w}" type="text" placeholder="Name" value="${esc(r['name' + w])}">
          <button class="sig-box" data-sig="${w}">${r['sig' + w] ? `<img src="${r['sig' + w]}" alt="Unterschrift ${l}">` : '<span>Zum Unterschreiben tippen</span>'}</button></div>`).join('')}
        <p class="hint">Mit der Unterschrift bestätigt der Kunde die Abnahme der oben genannten Leistungen mit dem angegebenen Ergebnis.</p>
      </div>
      <div class="card"><button class="clear auf-del" data-b="delete">Abnahme löschen</button></div>`;
  }
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { cur.updated = Date.now(); B().put('abnahme', cur); }, 250); };
  let pendFoto = null;

  // ---------- Unterschrift ----------
  function sign(w) {
    const ov = document.createElement('div'); ov.id = 'sigpad';
    ov.innerHTML = `<div class="ann-top"><button data-s="clear">Löschen</button><span>${w === 'K' ? 'Unterschrift Kunde' : 'Unterschrift Monteur'}</span><button data-s="ok" class="ok">Fertig</button></div>
      <div class="sp-wrap"><canvas></canvas><div class="sp-line"></div><div class="sp-hint">Hier unterschreiben · iPhone gern quer halten</div></div>`;
    document.body.appendChild(ov); document.body.classList.add('ann-open');
    const cv = ov.querySelector('canvas'), wrap = ov.querySelector('.sp-wrap');
    const fit = () => { const r = wrap.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1); cv.width = r.width * dpr; cv.height = r.height * dpr; cv.style.width = r.width + 'px'; cv.style.height = r.height + 'px';
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#111'; };
    fit(); window.addEventListener('resize', fit);
    const g = cv.getContext('2d'); let last = null, drawn = false, lw = 2.6;
    const pt = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, e.timeStamp]; };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); cv.setPointerCapture(e.pointerId); last = pt(e); g.beginPath(); g.arc(last[0], last[1], 1.2, 0, 7); g.fillStyle = '#111'; g.fill(); drawn = true; });
    cv.addEventListener('pointermove', e => { if (!last) return; const p = pt(e), v = Math.hypot(p[0] - last[0], p[1] - last[1]) / Math.max(1, p[2] - last[2]);
      lw = lw * .7 + Math.max(1.2, Math.min(3.4, 3.6 - v * 1.6)) * .3; g.lineWidth = lw; g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke(); last = p; });
    const end = () => { last = null; }; cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    const close = () => { window.removeEventListener('resize', fit); ov.remove(); document.body.classList.remove('ann-open'); };
    ov.querySelector('.ann-top').addEventListener('click', e => {
      const b = e.target.closest('[data-s]'); if (!b) return;
      if (b.dataset.s === 'clear') { g.clearRect(0, 0, cv.width, cv.height); drawn = false; return; }
      if (drawn) { // auf weißem Grund als JPEG speichern
        // nur den gezeichneten Bereich (plus Rand) übernehmen
        const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let x0 = cv.width, y0 = cv.height, x1 = 0, y1 = 0;
        for (let yy = 0; yy < cv.height; yy += 2) for (let xx = 0; xx < cv.width; xx += 2) if (px[(yy * cv.width + xx) * 4 + 3] > 20) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
        const pad = Math.round(cv.width * .03); x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(cv.width, x1 + pad); y1 = Math.min(cv.height, y1 + pad);
        const bw = Math.max(10, x1 - x0), bh = Math.max(10, y1 - y0), o = document.createElement('canvas'), k = Math.min(1, 900 / bw);
        o.width = Math.round(bw * k); o.height = Math.round(bh * k);
        const og = o.getContext('2d'); og.fillStyle = '#fff'; og.fillRect(0, 0, o.width, o.height); og.drawImage(cv, x0, y0, bw, bh, 0, 0, o.width, o.height);
        cur['sig' + w] = o.toDataURL('image/jpeg', 0.85); cur.updated = Date.now(); B().put('abnahme', cur);
      }
      close(); edit();
    });
  }

  // ---------- PDF ----------
  const dataToBytes = d => { const s = atob(d.split(',')[1]), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const imgSize = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res([i.naturalWidth, i.naturalHeight]); i.onerror = rej; i.src = src; });
  async function pdf() {
    const PDF = window.MiniPDF, r = cur, d = new PDF.Doc(), W = PDF.W, M = 42, CW = W - 2 * M;
    const RED = '#9c1006', INK = '#1c1c1e', GR = '#6e6e73', LN = '#d1d1d6';
    let page = 1;
    const head = sub => { d.rect(0, 0, W, 6, RED); d.text(M, 40, 'ABNAHMEPROTOKOLL', {size: 9, bold: true, color: RED}); d.text(W - M, 40, sub, {size: 9, color: GR, align: 'right'}); };
    const foot = () => d.text(W / 2, 815, 'Erstellt am ' + new Date().toLocaleDateString('de-DE') + ' · Seite ' + page, {size: 8, color: GR, align: 'center'});
    const newPage = () => { foot(); d.add(); page++; head(r.titel || ''); return 66; };
    const need = (y, h) => y + h > 780 ? newPage() : y;
    head(dt(r.datum));
    let y = d.para(M, 66, r.titel || 'Ohne Bezeichnung', CW, {size: 22, bold: true, color: INK, lh: 26}) + 4;
    [['Kunde', r.kunde], ['Ort', r.ort], ['Datum', dt(r.datum)]].forEach(([k, v]) => { if (!v) return; d.text(M, y, k, {size: 10, bold: true, color: GR}); d.text(M + 70, y, v, {size: 10, color: INK}); y += 15; });
    y += 4; d.line(M, y, W - M, y, LN, .6); y += 18;
    if (r.leistung) { d.text(M, y, 'AUSGEFÜHRTE LEISTUNGEN', {size: 9, bold: true, color: GR}); y = d.para(M, y + 16, r.leistung, CW, {size: 10.5, color: INK, lh: 14}) + 12; }
    d.text(M, y, 'PRÜFUNG', {size: 9, bold: true, color: GR}); y += 8;
    CHECK.forEach(([k, t]) => { y += 18; const v = r.check[k]; d.line(M, y + 5, W - M, y + 5, LN, .4); d.text(M, y, t, {size: 10.5, color: INK});
      d.circle(W - M - 60, y - 3.5, 4, v === 'ja' ? '#34c759' : v === 'nein' ? '#ff3b30' : '#c7c7cc'); d.text(W - M - 50, y, v === 'ja' ? 'Ja' : v === 'nein' ? 'Nein' : '–', {size: 10.5, bold: true, color: INK}); });
    y += 28;
    y = need(y, 60); d.text(M, y, 'MÄNGEL & RESTARBEITEN', {size: 9, bold: true, color: GR}); y += 16;
    if (!r.maengel.length) { d.text(M, y, 'Keine Mängel festgestellt.', {size: 10.5, color: INK}); y += 16; }
    for (let i = 0; i < r.maengel.length; i++) {
      const m = r.maengel[i]; let ph = null;
      if (m.foto) { try { const f = await B().get('fotos', m.foto); const url = await B().fotoURL(m.foto); const [iw, ih] = await imgSize(url); ph = {bytes: new Uint8Array(await f.blob.arrayBuffer()), iw, ih}; } catch (e) {} }
      const th = ph ? Math.min(110, 150 * ph.ih / ph.iw) : 0, lines = PDF.wrap(m.text || '–', 10.5, CW - (ph ? 190 : 24));
      y = need(y, Math.max(th, lines.length * 14) + 14);
      d.text(M, y, (i + 1) + '.', {size: 10.5, bold: true, color: RED});
      lines.forEach((l, k) => d.text(M + 18, y + k * 14, l, {size: 10.5, color: INK}));
      if (ph) d.image(ph.bytes, ph.iw, ph.ih, W - M - 150, y - 9, 150, th);
      y += Math.max(th, lines.length * 14) + 12;
    }
    y += 8; y = need(y, 220);
    const e = ERG[r.erg];
    d.rect(M, y, CW, 40, '#f4f4f6'); d.rect(M, y, 4, 40, e ? e[1] : '#c7c7cc');
    d.text(M + 16, y + 16, 'ERGEBNIS', {size: 8, bold: true, color: GR}); d.text(M + 16, y + 31, e ? e[0] : 'Nicht angegeben', {size: 13, bold: true, color: INK});
    y += 62;
    const sw = (CW - 30) / 2;
    for (const [w, l, x] of [['K', 'Auftraggeber / Kunde', M], ['M', 'Monteur', M + sw + 30]]) {
      if (r['sig' + w]) { const [iw, ih] = await imgSize(r['sig' + w]); const k = Math.min(sw / iw, 68 / ih), ww = iw * k, hh = ih * k; d.image(dataToBytes(r['sig' + w]), iw, ih, x, y + 72 - hh, ww, hh); }
      d.line(x, y + 76, x + sw, y + 76, '#8e8e93', .7);
      d.text(x, y + 90, l + (r['name' + w] ? ': ' + r['name' + w] : ''), {size: 9, color: GR});
      d.text(x, y + 103, (r.ort ? r.ort.split(',').pop().trim() + ', ' : '') + dt(r.datum), {size: 9, color: GR});
    }
    foot();
    return d.blob();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const el = root(); if (!el || !window.indexedDB) return;
    const start = () => B() ? list().catch(() => {}) : setTimeout(start, 50); start();
    el.addEventListener('click', async e => {
      const o = e.target.closest('[data-bopen]'); if (o) return open(o.dataset.bopen);
      const c = e.target.closest('[data-chk]'); if (c) { cur.check[c.dataset.chk] = cur.check[c.dataset.chk] === c.dataset.v ? undefined : c.dataset.v; if (!cur.check[c.dataset.chk]) delete cur.check[c.dataset.chk]; save(); return edit(); }
      const g = e.target.closest('[data-erg]'); if (g) { cur.erg = g.dataset.erg; save(); return edit(); }
      const s = e.target.closest('[data-sig]'); if (s) return sign(s.dataset.sig);
      const md = e.target.closest('[data-mdel]'); if (md) { if (!confirm('Mangel löschen?')) return; const m = cur.maengel.splice(+md.dataset.mdel, 1)[0]; if (m && m.foto) await B().del('fotos', m.foto); save(); return edit(); }
      const b = e.target.closest('[data-b]'); if (!b) return;
      const a = b.dataset.b;
      if (a === 'new') return open(null);
      if (a === 'back') { clearTimeout(saveT); cur.updated = Date.now(); await B().put('abnahme', cur); cur = null; return list(); }
      if (a === 'madd') {
        const t = $('b_mtext').value.trim(); if (!t && !pendFoto) return toast('Bitte Mangel beschreiben');
        cur.maengel.push({id: uid(), text: t.slice(0, 600), foto: pendFoto}); pendFoto = null; save(); return edit();
      }
      if (a === 'pdf') {
        if (!cur.sigK && !confirm('Der Kunde hat noch nicht unterschrieben. Trotzdem PDF erstellen?')) return;
        try { toast('PDF wird erstellt …'); const name = (cur.titel || 'Abnahme').replace(/[^\wäöüÄÖÜß-]+/g, '_').slice(0, 40);
          await window.ShareFiles({title: 'Abnahmeprotokoll ' + (cur.titel || ''), text: 'Abnahmeprotokoll ' + (cur.titel || '') + ' vom ' + dt(cur.datum), files: [new File([await pdf()], `Abnahme_${name}.pdf`, {type: 'application/pdf'})]});
        } catch (err) { if (!(err && (err.name === 'AbortError' || /cancel/i.test(err.message || '')))) toast('PDF konnte nicht erstellt werden'); }
        return;
      }
      if (a === 'delete') {
        if (!confirm('Diese Abnahme löschen?')) return;
        for (const m of cur.maengel) if (m.foto) await B().del('fotos', m.foto);
        await B().del('abnahme', cur.id); cur = null; list(); toast('Abnahme gelöscht');
      }
    });
    el.addEventListener('input', e => { if (cur && e.target.dataset.f) { cur[e.target.dataset.f] = e.target.value; save(); } });
    el.addEventListener('change', async e => {
      if (e.target.id !== 'b_mfoto' || !e.target.files[0]) return;
      try { const s = await B().shrink(e.target.files[0]), id = uid(); await B().put('fotos', {id, blob: s.blob}); pendFoto = id;
        $('b_mprev').innerHTML = `<div class="mg-prev"><img src="${await B().fotoURL(id)}" alt="">Foto wird mit dem nächsten Mangel gespeichert</div>`; } catch (err) { toast('Foto konnte nicht geladen werden'); }
      e.target.value = '';
    });
  });
  window.Abnahme = {clean, refresh: () => { if (!cur && root() && B()) list(); }, pdf: () => pdf()};
})();
