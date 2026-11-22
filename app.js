const $ = id => document.getElementById(id);
const num = id => { const v = parseFloat(String($(id).value).replace(',', '.')); return isNaN(v) ? 0 : v; };
const f = (x, d = 2) => x.toLocaleString('de-DE', {minimumFractionDigits: d, maximumFractionDigits: d});
const eur = x => x.toLocaleString('de-DE', {style: 'currency', currency: 'EUR'});
const row = (a, b) => `<div class="row"><span>${a}</span><b>${b}</b></div>`;

const KEY = 'meine-app-werte';

// ===== Freizeit-Daten =====
const DKEY = 'meine-app-daten';
let D = {rad: [], sch: [], spi: [], fre: []};
// Daten prüfen und bereinigen (schützt vor manipulierten Sicherungsdateien)
function clean(d){
  const arr = x => Array.isArray(x) ? x.slice(0, 5000) : [];
  const str = (x, n = 200) => (typeof x === 'string' || typeof x === 'number') ? String(x).slice(0, n) : '';
  const nr = x => { const v = Number(x); return isFinite(v) && v >= 0 && v < 1e7 ? v : 0; };
  const date = x => /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : '';
  const id = x => /^[a-z0-9]{1,24}$/i.test(x) ? x : Math.random().toString(36).slice(2, 12);
  const ob = x => (x && typeof x === 'object') ? x : {};
  return {
    rad: arr(d && d.rad).map(ob).map(e => ({id: id(e.id), d: date(e.d), km: nr(e.km), min: nr(e.min), hm: nr(e.hm), n: str(e.n)})).filter(e => e.km > 0),
    sch: arr(d && d.sch).map(ob).map(e => ({id: id(e.id), d: date(e.d), b: nr(e.b), m: nr(e.m), min: nr(e.min), n: str(e.n)})).filter(e => e.m > 0),
    spi: arr(d && d.spi).map(ob).map(e => ({id: id(e.id), d: date(e.d), g: str(e.g, 100), who: arr(e.who).map(x => str(x, 60)).filter(Boolean).slice(0, 30), w: str(e.w, 60)})).filter(e => e.g),
    fre: arr(d && d.fre).map(ob).map(e => ({id: id(e.id), n: str(e.n, 60), x: str(e.x)})).filter(e => e.n)
  };
}
try { D = clean(JSON.parse(localStorage.getItem(DKEY) || '{}')); } catch (e) {}
const store = () => { try { localStorage.setItem(DKEY, JSON.stringify(D)); } catch (e) { alert('Speichern nicht möglich.'); } };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => new Date().toISOString().slice(0, 10);
const dt = s => s ? new Date(s + 'T12:00').toLocaleDateString('de-DE', {weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit'}) : '';
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const year = new Date().getFullYear();
const thisYear = arr => arr.filter(e => (e.d || '').startsWith(String(year)));
const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
const byDate = arr => [...arr].sort((a, b) => (b.d || '').localeCompare(a.d || ''));
const del = (k, id) => { if (confirm('Eintrag löschen?')) { D[k] = D[k].filter(e => e.id !== id); store(); renderAll(); } };
const val = id => $(id).value.trim();

function renderRad(){
  const y = thisYear(D.rad), km = y.reduce((s, e) => s + e.km, 0), min = y.reduce((s, e) => s + (e.min || 0), 0);
  const kmMin = y.filter(e => e.min).reduce((s, e) => s + e.km, 0);
  const best = Math.max(0, ...D.rad.map(e => e.km));
  $('rad_stats').innerHTML = stat(f(km, 0) + ' km', 'gefahren ' + year) + stat(y.length, 'Touren ' + year) +
    stat(min ? f(kmMin / (min / 60), 1) + ' km/h' : '–', 'Ø Tempo') + stat(f(best, 0) + ' km', 'längste Tour');
  $('rad_list').innerHTML = D.rad.length ? byDate(D.rad).map(e => `<li><div class="t"><b>${f(e.km, 1)} km</b>${e.min ? ' · ' + e.min + ' min · ' + f(e.km / (e.min / 60), 1) + ' km/h' : ''}${e.hm ? ' · ' + e.hm + ' hm' : ''}<small>${dt(e.d)}${e.n ? ' · ' + esc(e.n) : ''}</small></div><button class="del" aria-label="Löschen" data-del="rad" data-id="${e.id}">×</button></li>`).join('') : '<li class="empty">Noch keine Touren. Viel Spaß beim Fahren!</li>';
}
function renderSch(){
  const y = thisYear(D.sch), m = y.reduce((s, e) => s + e.m, 0);
  const tm = y.filter(e => e.min), pace = tm.length ? tm.reduce((s, e) => s + e.min, 0) / tm.reduce((s, e) => s + e.m, 0) * 100 : 0;
  const pf = p => { const s = Math.round(p * 60); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  $('sch_stats').innerHTML = stat(f(m / 1000, 1) + ' km', 'geschwommen ' + year) + stat(y.length, 'Trainings ' + year) +
    stat(pace ? pf(pace) + ' min' : '–', 'Ø pro 100 m') + stat(f(Math.max(0, ...D.sch.map(e => e.m)), 0) + ' m', 'Bestleistung');
  $('sch_list').innerHTML = D.sch.length ? byDate(D.sch).map(e => `<li><div class="t"><b>${f(e.m, 0)} m</b> · ${e.b} Bahnen${e.min ? ' · ' + e.min + ' min · ' + pf(e.min / e.m * 100) + '/100 m' : ''}<small>${dt(e.d)}${e.n ? ' · ' + esc(e.n) : ''}</small></div><button class="del" aria-label="Löschen" data-del="sch" data-id="${e.id}">×</button></li>`).join('') : '<li class="empty">Noch keine Trainings eingetragen.</li>';
}
function bars(obj){
  const arr = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!arr.length) return '<p class="empty">Noch keine Partien.</p>';
  const max = arr[0][1];
  return arr.map(([n, c]) => `<div class="bar"><span class="n">${esc(n)}</span><span class="b"><i style="width:${c / max * 100}%"></i></span><span class="c">${c}</span></div>`).join('');
}
function renderSpi(){
  const people = ['Ich', ...D.fre.map(x => x.n)];
  const checked = new Set([...document.querySelectorAll('#spi_who input:checked')].map(i => i.value));
  $('spi_who').innerHTML = people.map(p => `<label><input type="checkbox" value="${esc(p)}" ${checked.has(p) || p === 'Ich' ? 'checked' : ''}>${esc(p)}</label>`).join('') +
    (D.fre.length ? '' : '<span class="hint">Lege unter „Freunde“ deine Mitspieler an.</span>');
  const w = $('spi_w').value;
  $('spi_w').innerHTML = '<option value="">– auswählen –</option>' + people.map(p => `<option ${p === w ? 'selected' : ''}>${esc(p)}</option>`).join('');
  const games = [...new Set(D.spi.map(e => e.g))];
  $('spi_games').innerHTML = games.map(g => `<option value="${esc(g)}">`).join('');
  const wins = {}, top = {};
  D.spi.forEach(e => { if (e.w) wins[e.w] = (wins[e.w] || 0) + 1; top[e.g] = (top[e.g] || 0) + 1; });
  $('spi_wins').innerHTML = bars(wins);
  $('spi_top').innerHTML = bars(top);
  $('spi_list').innerHTML = D.spi.length ? byDate(D.spi).slice(0, 30).map(e => `<li><div class="t"><b>${esc(e.g)}</b>${e.w ? ' · Sieger: ' + esc(e.w) : ''}<small>${dt(e.d)} · ${esc((e.who || []).join(', '))}</small></div><button class="del" aria-label="Löschen" data-del="spi" data-id="${e.id}">×</button></li>`).join('') : '<li class="empty">Noch keine Spieleabende eingetragen.</li>';
}
function renderFre(){
  $('fre_list').innerHTML = D.fre.length ? [...D.fre].sort((a, b) => a.n.localeCompare(b.n)).map(x => {
    const n = D.spi.filter(e => (e.who || []).includes(x.n)).length, w = D.spi.filter(e => e.w === x.n).length;
    return `<li><div class="t"><b>${esc(x.n)}</b><small>${n} Partien gemeinsam · ${w} Siege${x.x ? ' · ' + esc(x.x) : ''}</small></div><button class="del" aria-label="Löschen" data-del="fre" data-id="${x.id}">×</button></li>`;
  }).join('') : '<li class="empty">Noch keine Freunde eingetragen.</li>';
}
function renderAll(){ renderRad(); renderSch(); renderSpi(); renderFre(); }

['rad_d', 'sch_d', 'spi_d'].forEach(id => $(id).value = today());
$('rad_add').onclick = () => {
  const km = num('rad_km'); if (km <= 0) return alert('Bitte Kilometer eintragen.');
  D.rad.push({id: uid(), d: $('rad_d').value || today(), km, min: num('rad_min'), hm: num('rad_hm'), n: val('rad_n')});
  store(); ['rad_km', 'rad_min', 'rad_hm', 'rad_n'].forEach(i => $(i).value = ''); renderRad();
};
$('sch_add').onclick = () => {
  const b = num('sch_b'); if (b <= 0) return alert('Bitte Bahnen eintragen.');
  D.sch.push({id: uid(), d: $('sch_d').value || today(), b, m: Math.round(b * num('sch_l')), min: num('sch_min'), n: val('sch_n')});
  store(); ['sch_b', 'sch_min', 'sch_n'].forEach(i => $(i).value = ''); renderSch();
};
$('spi_add').onclick = () => {
  const g = val('spi_g'); if (!g) return alert('Bitte ein Spiel eintragen.');
  const who = [...document.querySelectorAll('#spi_who input:checked')].map(i => i.value);
  D.spi.push({id: uid(), d: $('spi_d').value || today(), g, who, w: $('spi_w').value});
  store(); $('spi_g').value = ''; $('spi_w').value = ''; renderSpi(); renderFre();
};
$('fre_add').onclick = () => {
  const n = val('fre_n'); if (!n) return alert('Bitte einen Namen eintragen.');
  if (n === 'Ich' || D.fre.some(x => x.n.toLowerCase() === n.toLowerCase())) return alert('Diesen Namen gibt es schon.');
  D.fre.push({id: uid(), n, x: val('fre_x')}); store(); $('fre_n').value = ''; $('fre_x').value = ''; renderSpi(); renderFre();
};
$('bk_exp').onclick = () => {
  const blob = new Blob([JSON.stringify({app: 'meine-app', v: 1, daten: D, werte: JSON.parse(localStorage.getItem(KEY) || '{}')}, null, 2)], {type: 'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'meine-app-sicherung-' + today() + '.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$('bk_imp').onclick = () => $('bk_file').click();
$('bk_file').onchange = async ev => {
  const file = ev.target.files[0]; if (!file) return;
  try {
    const j = JSON.parse(await file.text());
    if (file.size > 5e6) throw 0;
    if (!j || j.app !== 'meine-app' || !j.daten) throw 0;
    if (!confirm('Sicherung laden? Die aktuellen Einträge werden ersetzt.')) return;
    D = clean(j.daten); store(); renderAll(); alert('Sicherung wiederhergestellt.');
  } catch (e) { alert('Diese Datei ist keine gültige Sicherung.'); }
  ev.target.value = '';
};

// ===== Küche =====
let K = null;
const KKEY = 'meine-app-kueche';
let KS = {pick: [], done: []};
try { Object.assign(KS, JSON.parse(localStorage.getItem(KKEY) || '{}')); } catch (e) {}
const kstore = () => { try { localStorage.setItem(KKEY, JSON.stringify(KS)); } catch (e) {} };
const ROM = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
function renderKue(){
  if (!K) return;
  if (KS.woche !== K.woche) { KS = {woche: K.woche, pick: [], done: []}; kstore(); }
  $('kue_head').innerHTML = `<h2><svg class="ic"><use href="#i-cloche"/></svg>Küche der Woche</h2><b>${esc(K.woche)}</b>${K.ort ? ' · ' + esc(K.ort) : ''}<p class="hint">${esc(K.hinweis || '')}</p><p class="hint">Stand: ${dt(K.stand)}</p><button class="refresh" data-refresh="1">Aktualisieren</button>`;
  $('kue_rez').innerHTML = K.rezepte.map((r, i) => `<details class="rez"><summary><span class="e">${ROM[i] || i + 1}</span><span><b>${esc(r.titel)}</b><small>${r.portionen} Portionen · ${esc(r.zeit)} · ca. ${eur(r.kosten)}</small></span></summary><div class="in">
    <ul class="list">${r.zutaten.map(z => `<li><div class="t">${esc(z.name)}${z.angebot ? `<span class="tag">${esc(z.markt)}</span>` : ''}<small>${esc(z.menge)}</small></div></li>`).join('')}</ul>
    <ol>${r.schritte.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    ${r.rest ? `<p class="hint"><b>Für die Folgetage:</b> ${esc(r.rest)}</p>` : ''}
    <button class="pick ${KS.pick.includes(i) ? 'on' : ''}" data-pick="${i}">${KS.pick.includes(i) ? 'Auf der Einkaufsliste ✓' : 'Auf die Einkaufsliste'}</button></div></details>`).join('');
  const groups = {};
  KS.pick.forEach(i => (K.rezepte[i]?.zutaten || []).forEach(z => { const m = z.markt || 'Vorrat / beliebig'; ((groups[m] ||= {})[z.name] ||= []).push(z.menge); }));
  for (const m in groups) groups[m] = Object.entries(groups[m]).map(([n, q]) => n + ' – ' + q.join(' + '));
  const ms = Object.keys(groups).sort((a, b) => (a.startsWith('Vorrat') ? 1 : 0) - (b.startsWith('Vorrat') ? 1 : 0) || a.localeCompare(b));
  $('kue_list').innerHTML = ms.length ? '<div class="shop">' + ms.map(m => `<h3>${esc(m)}</h3>` + groups[m].map(t => { const k = m + '|' + t; return `<label class="${KS.done.includes(k) ? 'done' : ''}"><input type="checkbox" ${KS.done.includes(k) ? 'checked' : ''} data-done="${encodeURIComponent(k)}"><span>${esc(t)}</span></label>`; }).join('')).join('') + '</div>' : '<p class="empty">Wähle unten Rezepte aus, dann entsteht hier deine Einkaufsliste.</p>';
  const am = {};
  K.angebote.forEach(a => (am[a.markt] ||= []).push(a));
  $('kue_ang').innerHTML = Object.keys(am).map(m => `<h3 class="mk">${esc(m)}</h3>` + am[m].map(a => `<div class="ang"><span>${esc(a.produkt)}<small>${esc(a.menge || '')}${a.info ? ' · ' + esc(a.info) : ''}</small></span><b>${a.preis != null ? eur(a.preis) : '–'}</b></div>`).join('')).join('');
}
function togglePick(i){ KS.pick = KS.pick.includes(i) ? KS.pick.filter(x => x !== i) : [...KS.pick, i]; kstore(); renderKue(); }
function toggleDone(el, k){ k = decodeURIComponent(k); KS.done = el.checked ? [...KS.done, k] : KS.done.filter(x => x !== k); kstore(); el.parentElement.classList.toggle('done', el.checked); }
function loadKue(){
  return fetch('kueche.json?t=' + Date.now(), {cache: 'no-store'}).then(r => { if (!r.ok) throw 0; return r.json(); }).then(j => { K = j; renderKue(); return true; })
    .catch(() => { if (!K) $('kue_head').innerHTML = '<h2><svg class="ic"><use href="#i-cloche"/></svg>Küche der Woche</h2><p class="empty">Angebote konnten nicht geladen werden. Bist du online?</p><button class="refresh" data-refresh="1">Nochmal versuchen</button>'; return false; });
}
loadKue();
function toast(t){ const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200); }
let busy = false;
async function refresh(){
  if (busy) return; busy = true;
  const ptr = $('ptr'); ptr.style.transform = 'translate(-50%, 16px)'; ptr.classList.add('spin');
  const old = K && K.stand + K.woche;
  const t0 = Date.now();
  const ok = await loadKue();
  try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); } catch (e) {}
  await new Promise(r => setTimeout(r, Math.max(0, 700 - (Date.now() - t0))));
  ptr.classList.remove('spin'); ptr.style.transform = ''; busy = false;
  toast(!ok ? 'Keine Verbindung' : (old && old !== K.stand + K.woche ? 'Neue Angebote geladen' : 'Alles aktuell'));
}
// Herunterziehen zum Aktualisieren
let y0 = null, pull = 0;
addEventListener('touchstart', e => { y0 = (scrollY <= 0 && !busy) ? e.touches[0].clientY : null; pull = 0; }, {passive: true});
addEventListener('touchmove', e => {
  if (y0 === null) return;
  pull = Math.max(0, e.touches[0].clientY - y0);
  const ptr = $('ptr'); ptr.style.transition = 'none';
  ptr.style.transform = `translate(-50%, ${Math.min(pull * .5, 70) - 60}px) rotate(${pull * 2}deg)`;
}, {passive: true});
addEventListener('touchend', () => {
  if (y0 === null) return; const ptr = $('ptr'); ptr.style.transition = '';
  if (pull > 90) refresh(); else ptr.style.transform = '';
  y0 = null; pull = 0;
});

// ===== Navigation =====
const SUB = {work: 'Werkstatt', free: 'Freizeit'};
const last = {work: 'rech', free: 'kue'};
let area = 'work';
function greet(){ const h = new Date().getHours(); $('greet').textContent = h < 5 ? 'Gute Nacht' : h < 11 ? 'Guten Morgen' : h < 17 ? 'Guten Tag' : h < 22 ? 'Guten Abend' : 'Gute Nacht'; }
function go(id){
  if (!$(id)) id = area === 'work' ? 'rech' : 'kue';
  document.querySelectorAll('main > section').forEach(s => s.classList.toggle('on', s.id === id));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.go === id));
  last[area] = id;
  try { localStorage.setItem(KEY + '-nav', JSON.stringify({area, last})); } catch (e) {}
  window.scrollTo(0, 0);
}
function setArea(a){
  area = a;
  document.querySelectorAll('.switch button').forEach(b => b.classList.toggle('on', b.dataset.area === a));
  $('nav-free').classList.toggle('on', a === 'free');
  document.body.classList.toggle('nonav', a === 'work');
  $('subtitle').textContent = SUB[a];
  go(last[a]);
}
document.querySelectorAll('nav button').forEach(b => b.addEventListener('click', () => go(b.dataset.go)));
document.querySelectorAll('.switch button').forEach(b => b.addEventListener('click', () => setArea(b.dataset.area)));
try { const n = JSON.parse(localStorage.getItem(KEY + '-nav') || 'null'); if (n) { if (n.last && n.last.free) last.free = n.last.free; area = n.area === 'free' ? 'free' : 'work'; } } catch (e) {}
greet(); setInterval(greet, 600000);

renderAll();
setArea(area);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

// Klicks zentral verteilen (keine eingebetteten Befehle, damit die Sicherheitsregeln streng sein können)
document.addEventListener('click', e => {
  const t = e.target.closest('[data-del],[data-refresh],[data-pick]');
  if (!t) return;
  if (t.dataset.del) del(t.dataset.del, t.dataset.id);
  else if (t.dataset.refresh) refresh();
  else if (t.dataset.pick) togglePick(+t.dataset.pick);
});
document.addEventListener('change', e => { const t = e.target; if (t.dataset && t.dataset.done) toggleDone(t, t.dataset.done); });
