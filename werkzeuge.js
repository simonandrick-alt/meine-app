// ===== Meine App – Werkzeuge: Wasserwaage & Montage-Spickzettel =====
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const nf = (x, d = 1) => (isFinite(x) ? x : 0).toLocaleString('de-DE', {minimumFractionDigits: d, maximumFractionDigits: d});
  const DEG = 180 / Math.PI;
  const CKEY = 'meine-app-libelle';

  // ---------- Wasserwaage ----------
  let on = false, g = null, cal = {fx: 0, fy: 0, e: 0};
  try { Object.assign(cal, JSON.parse(localStorage.getItem(CKEY) || '{}')); } catch (e) {}
  function onMotion(ev) {
    const a = ev.accelerationIncludingGravity; if (!a || a.x == null) return;
    const k = 0.18; // Glättung
    g = g ? {x: g.x + (a.x - g.x) * k, y: g.y + (a.y - g.y) * k, z: g.z + (a.z - g.z) * k} : {x: a.x, y: a.y, z: a.z};
    draw();
  }
  function angles() {
    if (!g) return null;
    const flat = Math.abs(g.z) > 7.0; // liegt flach
    if (flat) {
      const z = Math.abs(g.z);
      return {flat, x: Math.atan2(g.x, z) * DEG - cal.fx, y: Math.atan2(g.y, z) * DEG - cal.fy};
    }
    const a = Math.atan2(g.x, -g.y) * DEG; // 0° = hochkant, ±90° = quer
    const dev = a - 90 * Math.round(a / 90);
    return {flat, e: dev - cal.e, mode: Math.abs(Math.round(a / 90)) % 2 ? 'Waagerecht (quer)' : 'Lot (hochkant)'};
  }
  function draw() {
    const v = angles(), el = $('lv_box'); if (!el || !v) return;
    const mmm = d => Math.tan(Math.abs(d) / DEG) * 1000;
    if (v.flat) {
      const r = Math.hypot(v.x, v.y), cx = Math.max(-1, Math.min(1, v.x / 10)), cy = Math.max(-1, Math.min(1, -v.y / 10));
      const ok = r < 0.3;
      el.innerHTML = `<div class="lv-dose ${ok ? 'ok' : ''}"><i class="ring"></i><i class="bub" style="transform:translate(${cx * 70}px,${cy * 70}px)"></i></div>
        <div class="lv-big ${ok ? 'ok' : ''}">${nf(r, 1)}°</div><div class="lv-sub">Flach · ${nf(mmm(r), 1)} mm/m</div>`;
    } else {
      const d = v.e, ok = Math.abs(d) < 0.15, px = Math.max(-1, Math.min(1, d / 5)) * 120;
      el.innerHTML = `<div class="lv-tube ${ok ? 'ok' : ''}"><i class="mk l"></i><i class="mk r"></i><i class="bub" style="transform:translateX(${px}px)"></i></div>
        <div class="lv-big ${ok ? 'ok' : ''}">${nf(Math.abs(d), 1)}°</div><div class="lv-sub">${v.mode} · ${nf(mmm(d), 1)} mm/m · ${nf(Math.tan(Math.abs(d) / DEG) * 100, 2)} %</div>`;
    }
  }
  async function start() {
    try {
      if (window.DeviceMotionEvent && typeof DeviceMotionEvent.requestPermission === 'function') {
        const r = await DeviceMotionEvent.requestPermission(); if (r !== 'granted') { alert('Ohne Zugriff auf den Lagesensor funktioniert die Wasserwaage nicht.'); return; }
      }
    } catch (e) {}
    if (!on) { window.addEventListener('devicemotion', onMotion); on = true; }
    $('lv_start').style.display = 'none'; $('lv_live').style.display = '';
    setTimeout(() => { if (!g) $('lv_box').innerHTML = '<p class="empty">Kein Lagesensor gefunden. Die Wasserwaage funktioniert nur auf dem iPhone.</p>'; }, 1500);
  }
  function stop() { window.removeEventListener('devicemotion', onMotion); on = false; g = null; $('lv_start').style.display = ''; $('lv_live').style.display = 'none'; }
  function zero() {
    const v = angles(); if (!v) return;
    if (v.flat) { cal.fx += v.x; cal.fy += v.y; } else cal.e += v.e;
    try { localStorage.setItem(CKEY, JSON.stringify(cal)); } catch (e) {}
    draw(); toast('Kalibriert');
  }
  function reset() { cal = {fx: 0, fy: 0, e: 0}; try { localStorage.removeItem(CKEY); } catch (e) {} draw(); toast('Kalibrierung zurückgesetzt'); }
  function toast(t) { const el = $('toast'); if (!el) return; el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200); }

  // ---------- Spickzettel ----------
  const tbl = (head, rows) => `<div class="tbl"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const SPICK = [
    {t: 'Innentüren nach DIN 18101', c: '#007aff', i: 'i-door', h:
      tbl(['Baurichtmaß', 'Wandöffnung', 'Türblatt (Außenmaß)', 'Zargenfalz'], [
        ['625 × 2000', '635 × 2005', '610 × 1985', '591 × 1972'],
        ['750 × 2000', '760 × 2005', '735 × 1985', '716 × 1972'],
        ['875 × 2000', '885 × 2005', '860 × 1985', '841 × 1972'],
        ['1000 × 2000', '1010 × 2005', '985 × 1985', '966 × 1972'],
        ['… × 2125', '… × 2130', '… × 2110', '… × 2097']]) +
      '<p class="hint">Alle Maße in mm, Breite × Höhe. Höhe der Wandöffnung ab Oberkante Fertigfußboden. Wandöffnung mit Toleranz +10/−0 mm. Herstellerangaben haben Vorrang.</p>'},
    {t: 'Dübel & Bohren je Untergrund', c: '#ff9500', i: 'i-drill', h:
      tbl(['Untergrund', 'Dübel', 'Bohren'], [
        ['Beton', 'Spreizdübel (Nylon), Schwerlast: Stahlanker', 'Mit Schlag, Bohrer = Dübel-Ø'],
        ['Vollziegel / Kalksandstein voll', 'Spreiz- oder Universaldübel', 'Mit Schlag (KS) bzw. wenig Schlag'],
        ['Lochziegel / Hohlblock', 'Universal- oder Langschaftdübel, Injektion', '<b>Ohne Schlag</b>, nur drehend'],
        ['Porenbeton', 'Porenbetondübel', '<b>Ohne Schlag</b>, oft kleiner vorbohren'],
        ['Gipskarton', 'Hohlraum-Metalldübel, Kippdübel', 'Ohne Schlag, Plattenstärke beachten'],
        ['Holz / Ständer', 'Kein Dübel – direkt schrauben', 'Vorbohren je nach Holzart']]) +
      tbl(['Dübel-Ø', 'Schrauben-Ø', 'Bohrloch'], [['5 mm', '3–4 mm', 'Dübellänge + 10 mm'], ['6 mm', '4–5 mm', 'Dübellänge + 10 mm'], ['8 mm', '5–6 mm', 'Dübellänge + 10 mm'], ['10 mm', '7–8 mm', 'Dübellänge + 10 mm'], ['12 mm', '8–10 mm', 'Dübellänge + 10 mm']]) +
      '<p class="hint">Faustwerte. Schraube muss durch das Anbauteil plus volle Dübellänge reichen. Bei Lasten immer Zulassung und Herstellerangaben beachten.</p>'},
    {t: 'Schrauben in Holz', c: '#a2845e', i: 'i-screw', h:
      '<ul class="spick"><li><b>Vorbohren</b> bei Hartholz (Eiche, Buche) und nahe am Rand: Bohrer ca. 60–70 % des Schrauben-Ø.</li><li>Bei Weichholz mit modernen Spanplattenschrauben meist ohne Vorbohren.</li><li><b>Randabstand</b> mind. 5 × Schrauben-Ø, in Faserrichtung eher mehr – sonst reißt das Holz.</li><li><b>Länge:</b> mindestens etwa zwei Drittel der Schraube sollten im tragenden Teil sitzen.</li><li>Bei Massivholz Quellen und Schwinden einplanen: Langlöcher oder Nutklötze statt starr verschrauben.</li></ul>'},
    {t: 'Fugen & Abstände', c: '#5856d6', i: 'i-gap', h:
      '<ul class="spick"><li><b>Fugenmasse:</b> Fuge etwa doppelt so breit wie tief ausbilden, Hinterfüllprofil verwenden. Den Bedarf rechnet der Rechner „Fugenmasse“ in der Werkstatt aus.</li><li><b>Silikon</b> in Nass- und Bewegungsfugen, <b>Acryl</b> für überstreichbare Fugen ohne viel Bewegung.</li><li><b>Laminat / Parkett:</b> Randabstand zur Wand nach Herstellerangabe, meist 8–15 mm.</li><li>Fensteranschluss nach RAL-Leitfaden: innen dichter als außen.</li></ul>'}
  ];
  function renderSpick() {
    const el = $('spick'); if (!el) return;
    el.innerHTML = SPICK.map((s, n) => `<details class="sp"><summary class="rw"><span class="tl" style="background:${s.c}"><svg class="ic"><use href="#${s.i}"/></svg></span><span class="bd"><span class="tx"><b>${s.t}</b></span><svg class="ic chev"><use href="#i-chev"/></svg></span></summary><div class="sp-in">${s.h}</div></details>`).join('');
  }

  document.addEventListener('DOMContentLoaded', () => {
    renderSpick();
    const el = $('tools'); if (!el) return;
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-lv]'); if (!b) return;
      ({start, stop, zero, reset})[b.dataset.lv]();
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden && on) stop(); });
  });
})();
