// ===== Meine App – kleiner PDF-Baukasten (A4, Helvetica, JPEG-Bilder), läuft komplett auf dem Gerät =====
(function () {
  'use strict';
  const W = 595.28, H = 841.89; // A4 in Punkt
  // Text in WinAnsi (Windows-1252) umwandeln; Zeichen ohne Entsprechung werden ersetzt
  const MAP = {'€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '™': 0x99};
  const SUBST = {'↘': '\\', '↙': '/', 'α': 'alpha', 'β': 'beta', 'γ': 'gamma', '→': '->', '≈': '~', '−': '-', '⅓': '1/3', '✓': 'OK', '✗': 'X'};
  function enc(s) {
    const out = [];
    for (const ch of String(s)) {
      if (SUBST[ch]) { for (const c of SUBST[ch]) out.push(c.charCodeAt(0)); continue; }
      const c = ch.codePointAt(0);
      if (MAP[ch]) out.push(MAP[ch]); else if (c >= 32 && c <= 255 && !(c >= 127 && c < 160)) out.push(c); else out.push(63);
    }
    let r = '';
    for (const b of out) r += b === 40 ? '\\(' : b === 41 ? '\\)' : b === 92 ? '\\\\' : String.fromCharCode(b);
    return r;
  }
  // Breite grob schätzen (Helvetica), für Umbruch und Rechtsbündig
  const CW = {i: .22, l: .22, j: .22, t: .28, f: .28, r: .33, ' ': .28, '.': .28, ',': .28, ':': .28, '1': .56, m: .83, w: .72, M: .83, W: .94};
  const width = (s, size, bold) => [...String(s)].reduce((a, c) => a + (CW[c] || (c === c.toUpperCase() && /[A-ZÄÖÜ]/.test(c) ? .67 : .55)), 0) * size * (bold ? 1.06 : 1);
  function wrap(s, size, maxW, bold) {
    const lines = []; String(s).split('\n').forEach(par => {
      let cur = ''; par.split(/\s+/).forEach(w => { const t = cur ? cur + ' ' + w : w; if (width(t, size, bold) > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
      lines.push(cur);
    }); return lines;
  }
  const rgb = hex => { const n = parseInt(hex.replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(v => v.toFixed(3)).join(' '); };

  class Doc {
    constructor() { this.pages = []; this.images = []; this.add(); }
    add() { this.cur = []; this.pages.push(this.cur); return this; }
    // y wird von oben gemessen (bequemer), intern umgerechnet
    text(x, y, s, {size = 10, bold = false, color = '#000000', align = 'left'} = {}) {
      let xx = x; if (align === 'right') xx = x - width(s, size, bold); if (align === 'center') xx = x - width(s, size, bold) / 2;
      this.cur.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg ${xx.toFixed(2)} ${(H - y).toFixed(2)} Td (${enc(s)}) Tj ET`); return this;
    }
    para(x, y, s, maxW, o = {}) { const size = o.size || 10, lh = o.lh || size * 1.35; wrap(s, size, maxW, o.bold).forEach((l, i) => this.text(x, y + i * lh, l, o)); return y + wrap(s, size, maxW, o.bold).length * lh; }
    rect(x, y, w, h, fill) { this.cur.push(`${rgb(fill)} rg ${x.toFixed(2)} ${(H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`); return this; }
    line(x1, y1, x2, y2, color = '#cccccc', w = .5) { this.cur.push(`${rgb(color)} RG ${w} w ${x1.toFixed(2)} ${(H - y1).toFixed(2)} m ${x2.toFixed(2)} ${(H - y2).toFixed(2)} l S`); return this; }
    circle(cx, cy, r, fill) { const k = .5523 * r, y = H - cy; this.cur.push(`${rgb(fill)} rg ${cx + r} ${y} m ${cx + r} ${y + k} ${cx + k} ${y + r} ${cx} ${y + r} c ${cx - k} ${y + r} ${cx - r} ${y + k} ${cx - r} ${y} c ${cx - r} ${y - k} ${cx - k} ${y - r} ${cx} ${y - r} c ${cx + k} ${y - r} ${cx + r} ${y - k} ${cx + r} ${y} c f`); return this; }
    // jpeg: Uint8Array, iw/ih: Pixelmaße
    image(jpeg, iw, ih, x, y, w, h) { const n = this.images.push({jpeg, iw, ih}); this.cur.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(H - y - h).toFixed(2)} cm /Im${n} Do Q`); return this; }
    blob() {
      const te = new TextEncoder(), parts = [], offs = []; let len = 0;
      const push = d => { const b = typeof d === 'string' ? Uint8Array.from(d, c => c.charCodeAt(0) & 255) : d; parts.push(b); len += b.length; };
      const objs = []; // [id, builder]
      let id = 0; const nid = () => ++id;
      const cat = nid(), pagesId = nid(), f1 = nid(), f2 = nid();
      const imgIds = this.images.map(() => nid());
      const pageIds = this.pages.map(() => [nid(), nid()]);
      push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
      const obj = (n, body) => { offs[n] = len; push(`${n} 0 obj\n`); if (typeof body === 'string') push(body); else body(); push('\nendobj\n'); };
      obj(cat, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
      obj(pagesId, `<< /Type /Pages /Kids [${pageIds.map(p => p[0] + ' 0 R').join(' ')}] /Count ${pageIds.length} >>`);
      obj(f1, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
      obj(f2, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      this.images.forEach((im, i) => obj(imgIds[i], () => { push(`<< /Type /XObject /Subtype /Image /Width ${im.iw} /Height ${im.ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.jpeg.length} >>\nstream\n`); push(im.jpeg); push('\nendstream'); }));
      const xo = this.images.map((_, i) => `/Im${i + 1} ${imgIds[i]} 0 R`).join(' ');
      this.pages.forEach((ops, i) => {
        const content = ops.join('\n'), [pid, cid] = pageIds[i];
        obj(pid, `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> /XObject << ${xo} >> >> /Contents ${cid} 0 R >>`);
        obj(cid, () => { push(`<< /Length ${content.length} >>\nstream\n`); push(content); push('\nendstream'); });
      });
      const xref = len;
      push(`xref\n0 ${id + 1}\n0000000000 65535 f \n` + Array.from({length: id}, (_, i) => String(offs[i + 1]).padStart(10, '0') + ' 00000 n \n').join(''));
      push(`trailer\n<< /Size ${id + 1} /Root ${cat} 0 R >>\nstartxref\n${xref}\n%%EOF`);
      void te;
      return new Blob(parts, {type: 'application/pdf'});
    }
  }
  window.MiniPDF = {Doc, W, H, wrap, width};
})();
