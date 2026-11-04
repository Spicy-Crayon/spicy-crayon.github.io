# Kennisbronnen voor de PathHopper-assistent

Hier zet je gratis brochures, wandelgidsen en eigen notities die de assistent mag gebruiken. Het werkt een beetje zoals een wiki: je voegt een bestand toe en na enkele minuten kan de assistent het gebruiken. **Er hoeft geen APK gebouwd te worden.**

## Een brochure toevoegen

1. Ga op GitHub naar deze map: `kennis/bronnen/`.
2. Kies **Add file → Upload files** en sleep de pdf of epub erin. Daarna **Commit changes**.
3. Open het tabblad **Actions**. De taak "Kennis indexeren" start vanzelf (1 à 3 minuten). Een groen vinkje betekent klaar.
4. Open `kennis/index.json`: daar staan de documenten en het aantal stukjes. De app haalt dat bestand zelf op zodra de assistent gebruikt wordt, en bewaart het voor offline gebruik.

Verwijderen kan op dezelfde manier: bestand weg uit `kennis/bronnen/`, de taak maakt de index opnieuw.

## Wat kan erin

- **pdf** (met echte tekst), **epub**, **md**, **txt** en **html**.
- Gescande brochures (enkel een foto van elke pagina) bevatten geen tekst. De taak toont daar een gele waarschuwing bij en slaat ze over. Daarvoor is OCR nodig.
- Kaartjes en foto's worden niet gelezen. De assistent kan wel zeggen "zie blz. 3" en opent de pdf op die pagina.
- Tabellen en meerdere kolommen komen soms door elkaar uit een pdf. Controleer eens met een vraag of het antwoord klopt.

## Titel, taal en link opgeven (niet verplicht)

Maak een bestand `kennis/bronnen/_info.json`:

```json
{
  "Moezel_per_fiets.pdf": {
    "titel": "Moezel per fiets",
    "taal": "de",
    "url": "https://voorbeeld.de/brochure.pdf",
    "licentie": "gratis toeristische brochure, bron: Tourist-Info Cochem"
  }
}
```

Zonder dit bestand wordt de titel de bestandsnaam en de taal geraden. Met `url` opent de bronlink in de app die website in plaats van je eigen kopie.

## Rechten

Gratis toeristische brochures zijn meestal oké voor eigen gebruik. De app toont geen lange stukken tekst, enkel een antwoord met bronnaam en pagina. Zet er niets in dat je niet mag delen: deze map staat openbaar op GitHub Pages.

## Grootte

`index.json` wordt bij elke start van de assistent gedownload. Hou hem onder ongeveer 8 MB (de taak waarschuwt). Dat is ruim genoeg voor tientallen brochures.
