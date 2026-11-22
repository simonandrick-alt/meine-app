// Kopiert die Web-App nach www/ (für die iPhone-App). Die Dateien im Hauptordner bleiben für GitHub Pages.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
const FILES = ['index.html', 'app.js', 'lock.js', 'rechner.js', 'manifest.json', 'icon.svg', 'icon-192.png', 'icon-512.png', 'kueche.json'];
fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out);
for (const f of FILES) fs.copyFileSync(path.join(root, f), path.join(out, f));
fs.cpSync(path.join(root, 'fonts'), path.join(out, 'fonts'), {recursive: true});
console.log('www/ erstellt mit', FILES.length, 'Dateien');
