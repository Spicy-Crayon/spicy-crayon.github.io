# plekken/ – eigen, gecontroleerde plekken en tips

Hier zet je plekken die je zelf kent en gecontroleerd hebt. De app toont ze als **📍 Eigen tips** bovenaan de pop-up "Leuke wandelingen/fietsroutes",
binnen 40 km van je positie, met je foto en één zin. De app verzint hier niets: staat er niets in, dan verschijnt er niets.

## index.json

```json
{
  "regions": [
    {
      "id": "voorbeeld-streek",
      "name": "Naam van de streek",
      "places": [
        {
          "name": "Naam van de plek",
          "text": "Eén zin: wat is er te zien of te doen, en waarom is het de moeite?",
          "lat": 50.0000,
          "lon": 5.0000,
          "mode": "beide",
          "foto": "plekken/foto/naam-van-de-plek.jpg",
          "fotoBron": "eigen foto",
          "gecontroleerd": "2026-10"
        }
      ]
    }
  ],
  "tips": [
    { "m": [11, 12], "nl": "Tip voor november en december.", "en": "Tip for November and December." }
  ]
}
```

- `mode`: `"wandel"`, `"fiets"` of `"beide"` (standaard).
- `maps` (mag ontbreken): de zoektekst waarmee de plek in Google Maps opent, bijvoorbeeld `"Terhills Maasmechelen"`. Zonder dit veld opent Maps op de coördinaten `lat` en `lon`. Met `maps` hoeven de coördinaten maar bij benadering te kloppen: ze dienen enkel om te bepalen welke plekken binnen 40 km liggen.
- `foto`: een bestand in `plekken/foto/` (komt mee in de app) of een `https://`-adres. Zonder foto staat er een 📍.
- `gecontroleerd`: wanneer je het voor het laatst zelf zag (bijvoorbeeld `"2026-10"`); dat staat bij de plek. Staat er geen datum, dan toont de app "Tip, nog niet zelf gecontroleerd" en weet de assistent dat ook. Zo staan de tien Limburgse startplekken erin: vul de datum in zodra je een plek zelf gezien hebt.
- Extra velden zoals `opmerking` worden genegeerd; je kunt er een eigen notitie in kwijt.
- `tips`: eigen seizoenstips voor het keuzescherm. `m` zijn de maanden (1 = januari). Zonder eigen tip voor de maand gebruikt de app haar vaste tips.
- Foto's: houd ze klein (breedte ongeveer 600 px, enkele tientallen kB), want ze zitten in de app.
