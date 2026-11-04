# PathHopper kennis-cracker: installeren (eenmalig)

Dit hoort in de repository van je website (`spicy-crayon.github.io`), niet in de APK-repo. Reden: de app haalt zijn online bestanden al van die site.

Upload deze vier dingen naar de hoofdmap van die repo (GitHub: Add file → Upload files, de mappen mogen mee):

- `.github/workflows/index-kennis.yml`
- `tools/build-kennis.mjs`
- `kennis/` (met `README.md`, `index.json` en de lege map `bronnen/`)

Let op: de map `.github` is verborgen op sommige computers. Sleep de hele uitgepakte map, of voeg het bestand met "Create new file" toe en typ als naam `.github/workflows/index-kennis.yml`.

Controleer daarna eenmalig:

1. Repo → Settings → Actions → General → Workflow permissions: kies "Read and write permissions".
2. Zet een testbestand (een pdf met tekst) in `kennis/bronnen/` en kijk of de taak groen wordt in het tabblad Actions.
3. Open in de app de assistent en vraag iets uit dat bestand.

Moet je de nieuwe `index.html` (v2.498) ook op de website zetten? Ja, voor de browserversie. De APK-versie haalt de index van de website op, ook zonder dat je de APK opnieuw installeert, zolang de app zelf (v2.498) erop staat.
