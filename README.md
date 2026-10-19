# Erf Mapper

Phone app for measuring a property: tap **New measurement**, take a photo, type each wall's length, save. Export everything as a ZIP (photos + `data.json` + `summary.md`) to hand to Claude for analysis.

- Installs from a link on Android and iPhone (Progressive Web App)
- Works offline once opened
- Data stays on the phone in the browser's storage, so export regularly as a backup

## Install
Open the GitHub Pages link on your phone:
- **Android (Chrome):** tap **Install** in the app, or menu ⋮ → *Install app*
- **iPhone (Safari):** Share → *Add to Home Screen*

## Files
`index.html`, `app.js` (all logic), `sw.js` (offline cache), `manifest.webmanifest`, `icons/`, `jszip.min.js` (JSZip 3.10.1, MIT).
