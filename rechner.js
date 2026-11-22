// ===== Meine App – Werkstatt-Rechner =====
(function () {
  'use strict';
  const SKEY = 'meine-app-rechner';
  const UNITS = {mm: 1, cm: 10, m: 1000};
  const DEG = Math.PI / 180;
  let S = {unit: 'mm', v: {}, prices: {}, open: ''};
  try { Object.assign(S, JSON.parse(localStorage.getItem(SKEY) || '{}')); } catch (e) {}
  if (!UNITS[S.unit]) S.unit = 'mm';
  const save = () => { try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch (e) {} };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const nf = (x, d = 2) => (isFinite(x) ? x : 0).toLocaleString('de-DE', {maximumFractionDigits: d});
  const nf0 = (x, d = 2) => (isFinite(x) ? x : 0).toLocaleString('de-DE', {minimumFractionDigits: d, maximumFractionDigits: d});
  const eur = x => x.toLocaleString('de-DE', {style: 'currency', currency: 'EUR'});
  const LD = {mm: 1, cm: 2, m: 3};
  const len = mm => nf(mm / UNITS[S.unit], LD[S.unit]) + ' ' + S.unit;
  const deg = x => nf(x, 2) + '°';
  const area = mm2 => mm2 >= 1e4 ? nf(mm2 / 1e6, 4) + ' m²' : mm2 >= 100 ? nf(mm2 / 100, 2) + ' cm²' : nf(mm2, 2) + ' mm²';

  // ---- Rechnen in Feldern: 2440-2*10, 3x600, (1200+40)/2 ----
  function parse(str) {
    let s = String(str ?? '').trim();
    if (!s) return NaN;
    s = s.replace(/[×xX*·]/g, '*').replace(/[÷:]/g, '/').replace(/[−–]/g, '-');
    const tok = []; const re = /\s*(\d+(?:[.,]\d*)?|[.,]\d+|[-+*/()])/y; let m;
    re.lastIndex = 0;
    while (re.lastIndex < s.length) { m = re.exec(s); if (!m) return NaN; tok.push(m[1]); if (/^\s*$/.test(s.slice(re.lastIndex))) break; }
    let i = 0;
    const peek = () => tok[i];
    function expr() { let v = term(); while (peek() === '+' || peek() === '-') { const o = tok[i++]; const r = term(); v = o === '+' ? v + r : v - r; } return v; }
    function term() { let v = fac(); while (peek() === '*' || peek() === '/') { const o = tok[i++]; const r = fac(); v = o === '*' ? v * r : v / r; } return v; }
    function fac() {
      const t = tok[i++];
      if (t === '-') return -fac(); if (t === '+') return fac();
      if (t === '(') { const v = expr(); if (tok[i++] !== ')') return NaN; return v; }
      if (t != null && /^[\d.,]/.test(t)) return parseFloat(t.replace(',', '.'));
      return NaN;
    }
    const v = expr();
    return i === tok.length && isFinite(v) ? v : NaN;
  }
  const isExpr = s => /\d\s*[-+*/×xX÷:·]\s*[\d(.,]|\(/.test(String(s || ''));

  // ---- Rechner-Definitionen ----
  const HOLZ = [['Fichte / Tanne', 470], ['Kiefer', 520], ['Lärche', 590], ['Douglasie', 530], ['Eiche', 690], ['Buche', 720],
    ['Ahorn', 650], ['Nussbaum', 640], ['Kirsche', 560], ['Esche', 680], ['MDF', 750], ['Spanplatte', 650], ['Multiplex Birke', 680], ['OSB', 620]];
  const C = {};
  const def = (id, o) => { C[id] = Object.assign({id}, o); };

  def('vol', {g: 'Holz', icon: 'i-cube', t: 'Volumen & Gewicht', d: 'm³, kg und Preis',
    f: [{k: 'l', l: 'Länge', u: 'len', v: 2000}, {k: 'b', l: 'Breite', u: 'len', v: 200}, {k: 'd', l: 'Stärke', u: 'len', v: 27},
      {k: 'n', l: 'Stück', v: 1}, {k: 'h', l: 'Holzart', sel: HOLZ.map(h => h[0]), v: 'Fichte / Tanne'}, {k: 'p', l: 'Preis (€/m³)', v: '', ph: 'z. B. 1800'}],
    calc(g) {
      const n = g('n', 1) || 1, m3 = g('l') * g('b') * g('d') / 1e9 * n;
      const dens = (HOLZ.find(h => h[0] === g.raw('h')) || HOLZ[0])[1], p = g('p', 0);
      return {big: nf(m3, 4) + ' m³', rows: [['Gewicht ca.', nf(m3 * dens, 1) + ' kg'], ['Fläche (eine Seite)', nf(g('l') * g('b') / 1e6 * n, 3) + ' m²'],
        ['Rohdichte', dens + ' kg/m³'], ...(p ? [['Preis', eur(m3 * p)]] : [])]};
    }});
  def('fla', {g: 'Holz', icon: 'i-area', t: 'Fläche', d: 'm² mit Verschnitt',
    f: [{k: 'l', l: 'Länge', u: 'len', v: 2440}, {k: 'b', l: 'Breite', u: 'len', v: 1220}, {k: 'n', l: 'Stück', v: 1},
      {k: 'v', l: 'Verschnitt (%)', v: 10}, {k: 'p', l: 'Preis (€/m²)', v: '', ph: 'z. B. 35', full: 1}],
    calc(g) {
      const m2 = g('l') * g('b') / 1e6 * (g('n', 1) || 1), mit = m2 * (1 + g('v', 0) / 100), p = g('p', 0);
      return {big: nf(m2, 3) + ' m²', rows: [['Mit Verschnitt', nf(mit, 3) + ' m²'], ...(p ? [['Preis (mit Verschnitt)', eur(mit * p)]] : [])]};
    }});
  def('lfm', {g: 'Holz', icon: 'i-ruler', t: 'Laufende Meter', d: 'lfm, Stangen, Preis',
    f: [{k: 'l', l: 'Länge je Stück', u: 'len', v: 2400}, {k: 'n', l: 'Stück', v: 10}, {k: 'v', l: 'Verschnitt (%)', v: 10},
      {k: 'p', l: 'Preis (€/lfm)', v: '', ph: 'z. B. 4,50'}, {k: 's', l: 'Lieferlänge Stangen', u: 'len', v: '', ph: 'optional', full: 1}],
    calc(g) {
      const n = g('n', 1) || 1, L = g('l'), m = L * n / 1000, mit = m * (1 + g('v', 0) / 100), p = g('p', 0), s = g('s', 0);
      const rows = [['Mit Verschnitt', nf(mit, 2) + ' lfm']];
      if (s > 0 && L > 0) { if (L > s) rows.push(['Stangen', 'Teil länger als Stange']); else { const per = Math.floor(s / L); rows.push(['Stück je Stange', per], ['Stangen nötig', Math.ceil(n / per)], ['Rest je Stange', len(s - per * L)]); } }
      if (p) rows.push(['Preis (mit Verschnitt)', eur(mit * p)]);
      return {big: nf(m, 2) + ' lfm', rows};
    }});
  def('pla', {g: 'Holz', icon: 'i-panel', t: 'Plattenzuschnitt', d: 'Wie viele Platten?',
    f: [{k: 'L', l: 'Platte Länge', u: 'len', v: 2800}, {k: 'B', l: 'Platte Breite', u: 'len', v: 2070},
      {k: 'l', l: 'Teil Länge', u: 'len', v: 600}, {k: 'b', l: 'Teil Breite', u: 'len', v: 400},
      {k: 'n', l: 'Benötigte Teile', v: 20}, {k: 'k', l: 'Schnittfuge', u: 'len', v: 4},
      {k: 'r', l: 'Besäumen je Seite', u: 'len', v: 10}, {k: 'rot', l: 'Teile drehen?', sel: ['Ja (ohne Maserung)', 'Nein (Maserung)'], v: 'Ja (ohne Maserung)'}],
    calc(g) {
      const k = g('k', 0), r = g('r', 0), PL = g('L'), PB = g('B'), L = PL - 2 * r, B = PB - 2 * r, need = g('n', 1) || 1;
      const fit = (a, b) => a > 0 && b > 0 ? [Math.floor((L + k) / (a + k)), Math.floor((B + k) / (b + k))] : [0, 0];
      let pl = g('l'), pb = g('b'), [cx, cy] = fit(pl, pb), rot = false;
      if (g.raw('rot').startsWith('Ja')) { const [x2, y2] = fit(pb, pl); if (x2 * y2 > cx * cy) { cx = x2; cy = y2; [pl, pb] = [pb, pl]; rot = true; } }
      const per = cx * cy;
      if (per < 1) return {err: 'Das Teil ist größer als die nutzbare Platte.'};
      const plates = Math.ceil(need / per), used = need * g('l') * g('b'), total = plates * PL * PB;
      // Skizze
      const W = 320, sc = W / PL, H = PB * sc;
      let rects = '';
      for (let y = 0; y < cy && y < 40; y++) for (let x = 0; x < cx && x < 40; x++) {
        const idx = y * cx + x; rects += `<rect x="${(r + x * (pl + k)) * sc}" y="${(r + y * (pb + k)) * sc}" width="${pl * sc}" height="${pb * sc}" class="${idx < need ? 'pt' : 'pt pe'}"/>`;
      }
      const svg = `<svg viewBox="-2 -2 ${W + 4} ${H + 4}" class="sk"><rect x="0" y="0" width="${W}" height="${H}" class="pl"/>${rects}</svg>`;
      return {big: plates + (plates > 1 ? ' Platten' : ' Platte'), svg, rows: [['Teile je Platte', per + ' (' + cx + ' × ' + cy + ')' + (rot ? ', gedreht' : '')],
        ['Teile möglich', plates * per], ['Ausnutzung', nf(used / total * 100, 1) + ' %'], ['Verschnitt', nf((total - used) / 1e6, 2) + ' m²']],
        note: 'Einfache Rasteraufteilung. Ein Zuschnittprogramm schafft oft etwas mehr.'};
    }});

  def('dre', {g: 'Geometrie', icon: 'i-tri', t: 'Dreieck', d: 'Aus 3 Werten alles',
    f: [{k: 'a', l: 'Seite a', u: 'len', v: ''}, {k: 'A', l: 'Winkel α (°)', v: ''},
      {k: 'b', l: 'Seite b', u: 'len', v: ''}, {k: 'B', l: 'Winkel β (°)', v: ''},
      {k: 'c', l: 'Seite c', u: 'len', v: ''}, {k: 'C', l: 'Winkel γ (°)', v: ''}],
    intro: 'Gib genau <b>3 Werte</b> ein, davon mindestens eine Seite. Winkel α liegt gegenüber Seite a, β gegenüber b, γ gegenüber c. Für ein rechtwinkliges Dreieck setze γ = 90.',
    calc(g) {
      const s = ['a', 'b', 'c'].map(k => g(k, NaN)), w = ['A', 'B', 'C'].map(k => g(k, NaN));
      const sols = solveTri(s, w);
      if (sols.err) return {err: sols.err, hint: true};
      const one = t => {
        const [a, b, c] = t.s, [A, B, Cc] = t.w, U = a + b + c, F = 0.5 * a * b * Math.sin(Cc * DEG);
        const typ = [];
        if ([A, B, Cc].some(x => Math.abs(x - 90) < 1e-7)) typ.push('rechtwinklig'); else if ([A, B, Cc].some(x => x > 90)) typ.push('stumpfwinklig'); else typ.push('spitzwinklig');
        const eq = (x, y) => Math.abs(x - y) < 1e-6 * Math.max(x, y);
        if (eq(a, b) && eq(b, c)) typ.push('gleichseitig'); else if (eq(a, b) || eq(b, c) || eq(a, c)) typ.push('gleichschenklig');
        return {svg: triSvg(t.s, t.w), rows: [['Seite a', len(a)], ['Seite b', len(b)], ['Seite c', len(c)],
          ['Winkel α', deg(A)], ['Winkel β', deg(B)], ['Winkel γ', deg(Cc)],
          ['Umfang', len(U)], ['Fläche', area(F)],
          ['Höhe auf a', len(2 * F / a)], ['Höhe auf b', len(2 * F / b)], ['Höhe auf c', len(2 * F / c)],
          ['Inkreis-Radius', len(2 * F / U)], ['Umkreis-Radius', len(a / (2 * Math.sin(A * DEG)))], ['Art', typ.join(', ')]]};
      };
      if (sols.length === 1) { const o = one(sols[0]); return {big: 'Dreieck berechnet', svg: o.svg, rows: o.rows}; }
      const o1 = one(sols[0]), o2 = one(sols[1]);
      return {big: '2 Lösungen möglich', note: 'Mit zwei Seiten und einem nicht eingeschlossenen Winkel gibt es hier zwei passende Dreiecke.',
        groups: [{t: 'Lösung 1', ...o1}, {t: 'Lösung 2', ...o2}]};
    }});
  def('win', {g: 'Geometrie', icon: 'i-roof', t: 'Neigung & Schräge', d: 'Dach, Rampe, Gefälle',
    f: [{k: 'h', l: 'Höhe', u: 'len', v: 1000}, {k: 'l', l: 'Waagerechte Länge', u: 'len', v: 3000}, {k: 'w', l: 'Winkel (°)', v: '', full: 1}],
    intro: 'Gib <b>2 der 3 Werte</b> ein.',
    calc(g) {
      let h = g('h', NaN), l = g('l', NaN), w = g('w', NaN);
      const has = [h, l, w].filter(isFinite).length;
      if (has < 2) return {err: 'Bitte 2 Werte eingeben.'};
      if (isFinite(h) && isFinite(l)) w = Math.atan2(h, l) / DEG;
      else if (isFinite(w) && isFinite(l)) h = Math.tan(w * DEG) * l;
      else h = h, l = h / Math.tan(w * DEG);
      if (!(w > 0 && w < 90) || !(h > 0) || !(l > 0)) return {err: 'Die Werte ergeben keine gültige Neigung.'};
      const sl = Math.hypot(h, l);
      return {big: deg(w) + ' · ' + nf(h / l * 100, 1) + ' %', svg: triSvg([h, l, sl], [w, 90 - w, 90], ['', '', ''], true),
        rows: [['Neigung', deg(w)], ['Steigung', nf(h / l * 100, 2) + ' %'], ['Höhe', len(h)], ['Waagerechte Länge', len(l)], ['Schräge Länge', len(sl)],
          ['Verhältnis', '1 : ' + nf(l / h, 2)]], note: isFinite(g('w', NaN)) && has === 3 ? 'Es wurden Höhe und Länge verwendet, der Winkel wurde neu berechnet.' : ''};
    }});
  def('geh', {g: 'Geometrie', icon: 'i-miter', t: 'Gehrung & Vieleck', d: 'Sägewinkel, Seitenlänge',
    f: [{k: 'n', l: 'Anzahl Ecken', v: 4}, {k: 'e', l: 'oder Eckwinkel (°)', v: '', ph: 'z. B. 135'},
      {k: 's', l: 'Seitenlänge', u: 'len', v: '', ph: 'optional'}, {k: 'd', l: 'Umkreis-Ø', u: 'len', v: '', ph: 'optional'}],
    intro: 'Für Rahmen, Kästen und Vielecke. Gibst du einen Eckwinkel ein (z. B. 135° für eine Ecke über Eck), wird die Anzahl der Ecken ignoriert.',
    calc(g) {
      const n = Math.round(g('n', 0)), eIn = g('e', NaN);
      const eck = isFinite(eIn) ? eIn : (n >= 3 ? 180 * (n - 2) / n : NaN);
      if (!(eck > 0 && eck < 360)) return {err: 'Bitte Anzahl Ecken (ab 3) oder einen Eckwinkel eingeben.'};
      const rows = [['Eckwinkel', deg(eck)], ['Gehrung je Teil', deg(eck / 2)], ['Kappsäge einstellen', deg(Math.abs(90 - eck / 2)) + ' (0° = rechtwinklig)']];
      if (!isFinite(eIn) && n >= 3) {
        const s = g('s', NaN), d = g('d', NaN), k = Math.sin(Math.PI / n);
        if (isFinite(s)) rows.push(['Umkreis-Ø', len(s / k)], ['Inkreis-Ø (Schlüsselweite)', len(s / Math.tan(Math.PI / n))]);
        else if (isFinite(d)) rows.push(['Seitenlänge', len(d * k)], ['Inkreis-Ø (Schlüsselweite)', len(d * Math.cos(Math.PI / n))]);
      }
      return {big: 'Säge: ' + deg(Math.abs(90 - eck / 2)), rows};
    }});
  def('ver', {g: 'Geometrie', icon: 'i-dist', t: 'Gleichmäßig verteilen', d: 'Sprossen, Latten, Bohrungen',
    f: [{k: 'L', l: 'Gesamtlänge', u: 'len', v: 1000}, {k: 't', l: 'Breite je Teil', u: 'len', v: 40},
      {k: 'n', l: 'Anzahl Teile', v: '', ph: 'oder leer lassen'}, {k: 'm', l: 'max. Abstand', u: 'len', v: 120, ph: 'z. B. 120'},
      {k: 'r', l: 'Am Rand', sel: ['Abstand wie zwischen den Teilen', 'Teile bündig am Rand'], v: 'Abstand wie zwischen den Teilen', full: 1}],
    intro: 'Gib die Anzahl Teile ein, oder lass sie leer und gib einen maximalen Abstand an (z. B. 120 mm bei Geländern).',
    calc(g) {
      const L = g('L'), t = g('t', 0), mx = g('m', NaN), edge = g.raw('r').startsWith('Abstand');
      let n = Math.round(g('n', NaN));
      if (!isFinite(n) || n < 1) {
        if (!(mx > 0)) return {err: 'Bitte Anzahl Teile oder einen maximalen Abstand eingeben.'};
        n = edge ? Math.ceil((L - mx) / (t + mx)) : Math.ceil((L + mx) / (t + mx));
        n = Math.max(n, edge ? 1 : 2);
      }
      const gaps = edge ? n + 1 : n - 1;
      if (gaps < 1) return {err: 'Für „bündig am Rand“ werden mindestens 2 Teile gebraucht.'};
      const gap = (L - n * t) / gaps;
      if (gap < 0) return {err: 'Die Teile passen nicht in die Gesamtlänge.'};
      const xs = Array.from({length: n}, (_, i) => (edge ? gap : 0) + i * (t + gap));
      const show = a => a.slice(0, 40).map(x => nf(x / UNITS[S.unit], LD[S.unit])).join(' · ') + (a.length > 40 ? ' …' : '');
      const W = 320, sc = W / L;
      const svg = `<svg viewBox="-2 -2 ${W + 4} 44" class="sk"><rect x="0" y="14" width="${W}" height="12" class="pl"/>${xs.slice(0, 200).map(x => `<rect x="${x * sc}" y="4" width="${Math.max(t * sc, 1.5)}" height="32" class="pt"/>`).join('')}</svg>`;
      return {big: n + ' Teile · Abstand ' + len(gap), svg, rows: [['Anzahl Teile', n], ['Lichter Abstand', len(gap)], ['Achsmaß (Mitte zu Mitte)', len(t + gap)],
        ...(mx > 0 && gap > mx + 1e-9 ? [['Achtung', 'Abstand größer als ' + len(mx)]] : [])],
        list: [['Anriss linke Kante (' + S.unit + ' ab Anfang)', show(xs)], ['Mitte der Teile (' + S.unit + ')', show(xs.map(x => x + t / 2))]]};
    }});

  def('tre', {g: 'Werkstatt', icon: 'i-stairs', t: 'Treppe', d: 'Steigung, Auftritt, Lauflänge',
    f: [{k: 'H', l: 'Geschosshöhe', u: 'len', v: 2750}, {k: 's', l: 'Wunsch-Steigung', u: 'len', v: 180}, {k: 'm', l: 'Schrittmaß', u: 'len', v: 630, full: 1}],
    calc(g) {
      const H = g('H'), s0 = g('s', 180) || 180, M = g('m', 630) || 630;
      if (!(H > 0)) return {err: 'Bitte Geschosshöhe eingeben.'};
      const n = Math.max(2, Math.round(H / s0)), h = H / n, a = M - 2 * h, sm = 2 * h + a;
      const ck = (ok, v) => (ok ? '✓ ' : '✗ ') + v;
      return {big: n + ' Steigungen à ' + len(h), rows: [['Auftritte', (n - 1) + ' à ' + len(a)], ['Lauflänge', len((n - 1) * a)], ['Steigungswinkel', deg(Math.atan(h / a) / DEG)],
        ['Schrittmaß 2h+a (590–650)', ck(sm >= 590 && sm <= 650, nf(sm, 0) + ' mm')], ['Sicherheit a+h ≈ 460', ck(Math.abs(a + h - 460) <= 20, nf(a + h, 0) + ' mm')],
        ['Bequemlichkeit a−h ≈ 120', ck(Math.abs(a - h - 120) <= 20, nf(a - h, 0) + ' mm')], ['Steigung Wohnhaus 140–200', ck(h >= 140 && h <= 200, nf(h, 0) + ' mm')],
        ['Auftritt Wohnhaus 230–370', ck(a >= 230 && a <= 370, nf(a, 0) + ' mm')]], note: 'Prüfe immer die DIN 18065 und die Landesbauordnung.'};
    }});
  def('obf', {g: 'Werkstatt', icon: 'i-brush', t: 'Öl & Lack', d: 'Menge und Gebinde',
    f: [{k: 'F', l: 'Fläche (m²)', v: 2}, {k: 'z', l: 'Seiten', sel: ['einseitig', 'beidseitig'], v: 'beidseitig'},
      {k: 'x', l: 'Anstriche', v: 2}, {k: 'c', l: 'Verbrauch (ml/m²)', v: 80},
      {k: 'g', l: 'Gebinde (Liter)', v: '0,75'}, {k: 'p', l: 'Preis je Gebinde (€)', v: '', ph: 'optional'}],
    intro: 'Den Verbrauch findest du auf der Dose. Öl: etwa 30–60 ml/m², Lack: etwa 80–120 ml/m².',
    calc(g) {
      const F = g('F', 0) * (g.raw('z') === 'beidseitig' ? 2 : 1), l = F * g('x', 1) * g('c', 0) / 1000, gb = g('g', 0), p = g('p', 0);
      const anz = gb > 0 ? Math.ceil(l / gb - 1e-9) : 0;
      return {big: nf(l, 2) + ' Liter', rows: [['Gesamtfläche', nf(F, 2) + ' m²'], ...(gb > 0 ? [['Gebinde', anz + ' × ' + nf(gb, 2) + ' l']] : []), ...(p && anz ? [['Kosten', eur(anz * p)]] : [])]};
    }});
  def('ang', {g: 'Werkstatt', icon: 'i-doc', t: 'Angebot', d: 'Material + Lohn + MwSt',
    f: [{k: 'm', l: 'Material netto (€)', v: '', ph: 'z. B. 450'}, {k: 'z', l: 'Material-Zuschlag (%)', v: 15},
      {k: 'h', l: 'Stunden', v: '', ph: 'z. B. 12'}, {k: 's', l: 'Stundensatz (€)', v: 58},
      {k: 'x', l: 'Sonstiges netto (€)', v: '', ph: 'Anfahrt …'}, {k: 't', l: 'MwSt (%)', v: 19}],
    calc(g) {
      const mat = g('m', 0) * (1 + g('z', 0) / 100), lohn = g('h', 0) * g('s', 0), so = g('x', 0), net = mat + lohn + so, mw = net * g('t', 0) / 100;
      return {big: eur(net + mw) + ' brutto', rows: [['Material inkl. Zuschlag', eur(mat)], ['Lohn', eur(lohn)], ...(so ? [['Sonstiges', eur(so)]] : []),
        ['Netto', eur(net)], ['MwSt ' + nf(g('t', 0), 1) + ' %', eur(mw)], ['Brutto', eur(net + mw)]]};
    }});

  // ---- Dreieck lösen ----
  function solveTri(s, w) {
    const ns = s.filter(isFinite).length, nw = w.filter(isFinite).length;
    if (s.some(x => isFinite(x) && x <= 0) || w.some(x => isFinite(x) && (x <= 0 || x >= 180))) return {err: 'Seiten müssen größer als 0 sein, Winkel zwischen 0 und 180°.'};
    if (ns + nw < 3) return {err: 'Bitte noch ' + (3 - ns - nw) + ' Wert' + (3 - ns - nw > 1 ? 'e' : '') + ' eingeben.'};
    if (ns + nw > 3) return {err: 'Bitte genau 3 Werte eingeben (zu viele Felder ausgefüllt).'};
    if (ns === 0) return {err: 'Mindestens eine Seite wird gebraucht.'};
    const ok = t => t.s.every(x => x > 0 && isFinite(x)) && t.w.every(x => x > 1e-9 && x < 180);
    const sss = S3 => { const [a, b, c] = S3; if (a + b <= c || a + c <= b || b + c <= a) return null;
      const A = Math.acos((b * b + c * c - a * a) / (2 * b * c)) / DEG, B = Math.acos((a * a + c * c - b * b) / (2 * a * c)) / DEG; return {s: S3, w: [A, B, 180 - A - B]}; };
    if (ns === 3) { const t = sss(s); return t ? [t] : {err: 'Mit diesen Seiten gibt es kein Dreieck (zwei Seiten zusammen müssen länger sein als die dritte).'}; }
    if (nw === 2) {
      const W = w.slice(); const mi = W.findIndex(x => !isFinite(x)); W[mi] = 180 - W.reduce((a, x) => a + (isFinite(x) ? x : 0), 0);
      if (W[mi] <= 0) return {err: 'Die Winkel ergeben zusammen schon 180° oder mehr.'};
      const si = s.findIndex(isFinite), k = s[si] / Math.sin(W[si] * DEG);
      return [{s: W.map(x => k * Math.sin(x * DEG)), w: W}];
    }
    // 2 Seiten + 1 Winkel
    const wi = w.findIndex(isFinite), miss = s.findIndex(x => !isFinite(x));
    if (wi === miss) { // eingeschlossener Winkel (SWS)
      const [i, j] = [0, 1, 2].filter(x => x !== miss), S3 = s.slice();
      S3[miss] = Math.sqrt(s[i] ** 2 + s[j] ** 2 - 2 * s[i] * s[j] * Math.cos(w[wi] * DEG));
      const t = sss(S3); return t ? [t] : {err: 'Keine Lösung.'};
    }
    // SSW: Winkel liegt einer bekannten Seite gegenüber
    const j = [0, 1, 2].find(x => x !== wi && x !== miss);
    const sinj = s[j] * Math.sin(w[wi] * DEG) / s[wi];
    if (sinj > 1 + 1e-12) return {err: 'Mit diesen Werten gibt es kein Dreieck (die Seite ist zu kurz).'};
    const wj1 = Math.asin(Math.min(1, sinj)) / DEG, out = [];
    for (const wj of (Math.abs(wj1 - 90) < 1e-9 ? [wj1] : [wj1, 180 - wj1])) {
      const W = [0, 0, 0]; W[wi] = w[wi]; W[j] = wj; W[miss] = 180 - w[wi] - wj;
      if (W[miss] <= 1e-9) continue;
      const S3 = s.slice(); S3[miss] = s[wi] * Math.sin(W[miss] * DEG) / Math.sin(w[wi] * DEG);
      const t = {s: S3, w: W}; if (ok(t)) out.push(t);
    }
    return out.length ? out : {err: 'Mit diesen Werten gibt es kein Dreieck.'};
  }
  // Skizze: A links unten, B rechts unten, C oben; Seite c unten
  function triSvg(s3, w3, names, right) {
    const [a, b, c] = s3, A = w3[0] * DEG;
    let P;
    if (right) P = [[0, 0], [b, 0], [b, a]]; // Neigung: waagerecht b, Höhe a
    else P = [[0, 0], [c, 0], [b * Math.cos(A), b * Math.sin(A)]];
    const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
    const W = 320, H = 190, pad = 30, minx = Math.min(...xs), maxx = Math.max(...xs), maxy = Math.max(...ys);
    const sc = Math.min((W - 2 * pad) / (maxx - minx || 1), (H - 2 * pad) / (maxy || 1));
    const ox = (W - (maxx - minx) * sc) / 2 - minx * sc, oy = H - pad;
    const Q = P.map(([x, y]) => [ox + x * sc, oy - y * sc]);
    const cx = (Q[0][0] + Q[1][0] + Q[2][0]) / 3, cy = (Q[0][1] + Q[1][1] + Q[2][1]) / 3;
    const away = (x, y, d) => { const dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy) || 1; return [x + dx / l * d, y + dy / l * d]; };
    const lab = (x, y, t, cls) => `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="${cls}" text-anchor="middle" dominant-baseline="middle">${t}</text>`;
    let out = `<svg viewBox="0 0 ${W} ${H}" class="sk"><polygon points="${Q.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}" class="tri"/>`;
    if (right) {
      out += lab(...away((Q[0][0] + Q[1][0]) / 2, Q[0][1], 14), 'Länge', 'sl') + lab(...away(Q[1][0], (Q[1][1] + Q[2][1]) / 2, 22), 'Höhe', 'sl') + lab(...away(Q[0][0], Q[0][1], 16), nf(w3[0], 1) + '°', 'vl');
    } else {
      const vn = ['A', 'B', 'C'], gn = ['α', 'β', 'γ'], sn = ['a', 'b', 'c'];
      Q.forEach((q, i) => { out += lab(...away(q[0], q[1], 16), vn[i], 'vl'); });
      // Seiten: a = BC, b = AC, c = AB
      const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      [[1, 2], [0, 2], [0, 1]].forEach(([p, q], i) => { const m = mid(Q[p], Q[q]); out += lab(...away(m[0], m[1], 13), sn[i], 'sl'); });
      Q.forEach((q, i) => { const [x, y] = [q[0] + (cx - q[0]) * .28, q[1] + (cy - q[1]) * .28]; out += lab(x, y, gn[i], 'al'); });
    }
    return out + '</svg>';
  }

  // ---- Werte ----
  const vals = id => (S.v[id] ||= {});
  function initVals(id) {
    const v = vals(id);
    C[id].f.forEach(fd => { if (v[fd.k] === undefined) v[fd.k] = fd.u === 'len' && fd.v !== '' ? nf(fd.v / UNITS[S.unit], 4).replace(/\./g, '') : String(fd.v ?? ''); });
  }
  function getter(id) {
    const v = vals(id);
    const g = (k, d = 0) => { const fd = C[id].f.find(x => x.k === k); let x = parse(v[k]); if (!isFinite(x)) return d; if (fd && fd.u === 'len') x *= UNITS[S.unit]; return x; };
    g.raw = k => v[k] ?? '';
    return g;
  }
  function setUnit(u) {
    if (!UNITS[u] || u === S.unit) return;
    for (const id in C) {
      const v = vals(id);
      C[id].f.forEach(fd => { if (fd.u !== 'len' || v[fd.k] === undefined) return; const x = parse(v[fd.k]); if (isFinite(x)) v[fd.k] = nf(x * UNITS[S.unit] / UNITS[u], 4).replace(/\./g, ''); });
    }
    S.unit = u; save(); render();
  }

  // ---- Anzeige ----
  const root = () => document.getElementById('rech');
  const unitSeg = () => `<div class="seg" role="group" aria-label="Einheit">${Object.keys(UNITS).map(u => `<button data-unit="${u}" class="${u === S.unit ? 'on' : ''}">${u}</button>`).join('')}</div>`;
  function render() {
    const el = root(); if (!el) return;
    if (!S.open || !C[S.open]) {
      const groups = {};
      Object.values(C).forEach(c => (groups[c.g] ||= []).push(c));
      el.innerHTML = `<div class="r-top"><h2 class="r-h">Werkstatt-Rechner</h2>${unitSeg()}</div>` +
        Object.entries(groups).map(([gname, cs]) => `<h3 class="r-g">${esc(gname)}</h3><div class="tiles">${cs.map(c =>
          `<button class="tile" data-open="${c.id}"><svg class="ic"><use href="#${c.icon}"/></svg><b>${esc(c.t)}</b><small>${esc(c.d)}</small></button>`).join('')}</div>`).join('') +
        `<p class="hint">Tipp: In jedes Zahlenfeld kannst du rechnen, z. B. <b>2440-2×10</b> oder <b>3×600+20</b>.</p>`;
      return;
    }
    const c = C[S.open]; initVals(c.id); const v = vals(c.id);
    el.innerHTML = `<div class="r-top"><button class="back" data-back="1">‹ Alle Rechner</button>${unitSeg()}</div>
      <div class="card"><h2><svg class="ic"><use href="#${c.icon}"/></svg>${esc(c.t)}</h2>${c.intro ? `<p class="hint" style="margin-top:0">${c.intro}</p>` : ''}
      <div class="grid">${c.f.map(fd => {
        const idf = `r_${c.id}_${fd.k}`, lab = esc(fd.l).replace(/([αβγ])|^(Seite )([abc])$/g, (m, g1, p, s) => g1 ? `<span class="gk">${g1}</span>` : `${p}<span class="gk">${s}</span>`) + (fd.u === 'len' ? ` <span class="gk">(${S.unit})</span>` : '');
        if (fd.sel) return `<div class="${fd.full ? 'full' : ''}"><label for="${idf}">${lab}</label><select id="${idf}" data-k="${fd.k}">${fd.sel.map(o => `<option ${o === v[fd.k] ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
        return `<div class="fld ${fd.full ? 'full' : ''}"><label for="${idf}">${lab}</label><input id="${idf}" data-k="${fd.k}" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="${esc(v[fd.k])}" placeholder="${esc(fd.ph || '')}"><small class="pv" data-pv="${fd.k}"></small></div>`;
      }).join('')}</div>
      <div id="r_out"></div>
      <div class="r-act"><button class="clear" data-reset="1">Zurücksetzen</button><button class="clear r-share" data-share="1">Teilen</button></div></div>`;
    update();
  }
  let lastResult = null;
  function update() {
    const c = C[S.open]; if (!c) return; const v = vals(c.id);
    // Vorschau bei Rechenausdrücken
    root().querySelectorAll('[data-pv]').forEach(sm => { const raw = v[sm.dataset.pv]; const x = parse(raw); sm.textContent = isExpr(raw) ? (isFinite(x) ? '= ' + nf(x, 4) : 'Rechnung unvollständig') : ''; });
    let r; try { r = c.calc(getter(c.id)); } catch (e) { r = {err: 'Bitte Eingaben prüfen.'}; }
    lastResult = r;
    const rows = rs => rs.map(([a, b]) => `<div class="row"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('');
    let h;
    if (r.err) h = `<div class="res res-err">${esc(r.err)}</div>`;
    else {
      h = r.groups ? `<p class="r-sol">${esc(r.big)}</p>` : `<div class="res"><div class="big">${esc(r.big)}</div>${r.svg || ''}${r.rows ? rows(r.rows) : ''}${(r.list || []).map(([t, x]) => `<div class="r-list"><span>${esc(t)}</span><div>${esc(x)}</div></div>`).join('')}</div>`;
      if (r.groups) h += r.groups.map(gp => `<div class="res"><div class="big">${esc(gp.t)}</div>${gp.svg || ''}${rows(gp.rows)}</div>`).join('');
      if (r.note) h += `<p class="hint">${esc(r.note)}</p>`;
    }
    document.getElementById('r_out').innerHTML = h;
  }
  function shareText() {
    const c = C[S.open], v = vals(c.id), r = lastResult || {};
    const ins = c.f.filter(fd => String(v[fd.k] ?? '').trim() !== '').map(fd => `${fd.l}${fd.u === 'len' ? ' (' + S.unit + ')' : ''}: ${v[fd.k]}`);
    const lines = [c.t, ...ins, '—'];
    if (r.err) lines.push(r.err);
    else { lines.push(r.big); (r.rows || []).forEach(([a, b]) => lines.push(`${a}: ${b}`)); (r.groups || []).forEach(gp => { lines.push('', gp.t); gp.rows.forEach(([a, b]) => lines.push(`${a}: ${b}`)); }); (r.list || []).forEach(([a, b]) => lines.push(`${a}: ${b}`)); }
    return lines.join('\n');
  }
  function toast(t) { const el = document.getElementById('toast'); if (!el) return; el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200); }

  // ---- Rechenzeichen-Leiste über dem aktiven Feld ----
  let bar = null;
  function showBar(inp) {
    if (!bar) {
      bar = document.createElement('div'); bar.className = 'opbar';
      bar.innerHTML = ['+', '−', '×', '÷', '(', ')'].map(o => `<button type="button" data-op="${o}">${o}</button>`).join('');
      bar.addEventListener('pointerdown', e => e.preventDefault());
      bar.addEventListener('mousedown', e => e.preventDefault());
      bar.addEventListener('click', e => {
        const b = e.target.closest('[data-op]'); const inp2 = bar.previousElementSibling; if (!b || !inp2) return;
        const op = {'−': '-', '×': '×', '÷': '÷'}[b.dataset.op] || b.dataset.op;
        let st = inp2.selectionStart ?? inp2.value.length, en = inp2.selectionEnd ?? st; if (st === 0 && en === 0 && inp2.value) st = en = inp2.value.length;
        inp2.setRangeText(op, st, en, 'end'); inp2.focus(); inp2.dispatchEvent(new Event('input', {bubbles: true}));
      });
    }
    inp.after(bar);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const el = root(); if (!el) return;
    render();
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-open],[data-back],[data-unit],[data-reset],[data-share]'); if (!t) return;
      if (t.dataset.open) { S.open = t.dataset.open; save(); render(); scrollTo(0, 0); }
      else if (t.dataset.back) { S.open = ''; save(); render(); scrollTo(0, 0); }
      else if (t.dataset.unit) setUnit(t.dataset.unit);
      else if (t.dataset.reset) { S.v[S.open] = {}; save(); render(); }
      else if (t.dataset.share) {
        const txt = shareText();
        if (navigator.share) navigator.share({text: txt}).catch(() => {});
        else navigator.clipboard?.writeText(txt).then(() => toast('Ergebnis kopiert'), () => toast('Kopieren nicht möglich'));
      }
    });
    el.addEventListener('input', e => {
      const k = e.target.dataset.k; if (!k || !C[S.open]) return;
      vals(S.open)[k] = e.target.value;
      // Holzpreis je Holzart merken
      if (S.open === 'vol' && k === 'p') S.prices[vals('vol').h] = e.target.value;
      save(); update();
    });
    el.addEventListener('change', e => {
      const k = e.target.dataset.k; if (!k || e.target.tagName !== 'SELECT') return;
      vals(S.open)[k] = e.target.value;
      if (S.open === 'vol' && k === 'h') { const p = S.prices[e.target.value] ?? ''; vals('vol').p = p; const pi = document.getElementById('r_vol_p'); if (pi) pi.value = p; }
      save(); update();
    });
    el.addEventListener('focusin', e => { if (e.target.matches('input[data-k]')) showBar(e.target); });
    el.addEventListener('focusout', e => { setTimeout(() => { if (bar && !el.contains(document.activeElement)) bar.remove(); else if (bar && document.activeElement && !document.activeElement.matches('input[data-k]')) bar.remove(); }, 150); });
  });
  window.Rechner = {parse, solveTri, render};
})();
