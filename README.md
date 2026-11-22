# Meine App

Persönliche App für Werkstatt und Freizeit: Werkstatt-Rechner (Holz, Dreieck, Neigung, Gehrung, Verteilen, Treppe, Öl & Lack, Angebot), Küche der Woche, Fahrrad, Schwimmen, Spieleabende, Freunde. Mit PIN- und Face-ID-Sperre. Alle Einträge bleiben auf dem Gerät.

- **Web-Version:** https://simonandrick-alt.github.io/meine-app/
- **Datenschutz:** https://simonandrick-alt.github.io/meine-app/datenschutz.html

---

## iPhone-App auf dem Mac bauen

### Einmalig vorbereiten
1. **Xcode** aus dem Mac App Store installieren und einmal öffnen (Zusatzkomponenten installieren lassen).
2. **Node.js** (LTS) von https://nodejs.org installieren.
3. Im **Terminal**:
   ```bash
   git clone https://github.com/simonandrick-alt/meine-app.git
   cd meine-app
   npm install
   ```

### App öffnen und auf dem eigenen iPhone starten
```bash
npm run ios
```
Das baut die Web-Dateien, überträgt sie ins iPhone-Projekt und öffnet Xcode. Dann in Xcode:
1. Links auf **App** (blaues Symbol) → **Signing & Capabilities** → bei **Team** deine Apple-ID auswählen.
   Falls die **Bundle Identifier** schon vergeben ist, einen eigenen eintragen (z. B. `de.deinname.meineapp`).
2. iPhone per Kabel anschließen, oben als Ziel auswählen und auf **▶︎** klicken.
3. Beim ersten Mal auf dem iPhone: **Einstellungen → Allgemein → VPN und Geräteverwaltung** → Entwickler vertrauen.
   Bei aktiviertem **Entwicklermodus** (Einstellungen → Datenschutz & Sicherheit) läuft die App.

> Mit kostenloser Apple-ID läuft die App 7 Tage, danach einfach erneut auf ▶︎ klicken.
> Mit dem **Apple Developer Program** (99 €/Jahr) läuft sie ein Jahr und kann über **TestFlight** oder den **App Store** verteilt werden.

### In den App Store / TestFlight hochladen
1. Mitglied im Apple Developer Program werden.
2. In **App Store Connect** (appstoreconnect.apple.com) eine neue App anlegen (Name, Bundle Identifier wie in Xcode).
3. In Xcode oben als Ziel **Any iOS Device (arm64)** wählen → Menü **Product → Archive** → **Distribute App** → **App Store Connect**.
4. In App Store Connect: Screenshots, Beschreibung, Datenschutz-URL (siehe oben) und Angaben „Keine Daten erfasst“ eintragen, dann zur Prüfung einreichen – oder nur über **TestFlight** auf eigene Geräte verteilen.

### Nach Änderungen an der App
```bash
git pull
npm run ios
```
