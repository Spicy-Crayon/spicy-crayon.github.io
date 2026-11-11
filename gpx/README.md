# Wandel-/fietsroutes (GPX) — hoe voeg ik routes toe?

Deze map wordt door de app zelf getoond via de knop **"Wandelroutes (GPX)"** /
**"Fietsroutes (GPX)"** in het opzetscherm (zichtbaar in zowel wandel- als
fiets-modus, elk met zijn eigen lijst). De app kan géén routes downloaden of
scrapen van externe route-sites (dat blokkeren die sites zelf via CORS) — dus
moet jij de `.gpx`-bestanden zelf aanleveren, waarna ze bij de eerstvolgende
versie van de app worden meegebouwd.

## Mapstructuur

Er is een top-level opsplitsing tussen **Wandelen** en **Fietsen** (elk met een
eigen, onafhankelijke provincie-lijst), en daaronder — net als voorheen — een
submap per provincie (en eventueel nog een submap per gemeente eronder, puur
ter overzicht — de app zelf leest enkel `index.json`, de bestandsnamen/mappen
mogen dus vrij gekozen worden):

```
gpx/
  index.json              <- verplicht, zie hieronder
  Wandelen/
    Limburg/
      Hasselt/
        groene-boulevard.gpx
      Bokrijk/
        bokrijk-rondje.gpx
    Antwerpen/
      stadswandeling-centrum.gpx
  Fietsen/
    Limburg/
      maasfietsroute.gpx
    ...
```

(De submap-namen "Wandelen"/"Fietsen" zijn puur ter overzicht — enkel de
`file`-paden in `index.json` bepalen wat de app effectief ophaalt, dus je mag
zelf een andere mapindeling kiezen zolang de paden kloppen.)

## index.json

Dit bestand bepaalt wat de app toont — het scant de mappen zelf niet automatisch
(een statische app kan geen mapinhoud opvragen aan de server). Er staan nu 2
onafhankelijke top-level secties, elk met dezelfde `provinces`-structuur als
voorheen:

```json
{
  "wandelen": {
    "provinces": [
      {
        "name": "Limburg",
        "walks": [
          {
            "name": "Groene Boulevard",
            "gemeente": "Hasselt",
            "km": 8.5,
            "file": "Wandelen/Limburg/Hasselt/groene-boulevard.gpx"
          },
          {
            "name": "Bokrijk-rondje",
            "gemeente": "Genk",
            "km": 5.2,
            "file": "Wandelen/Limburg/Bokrijk/bokrijk-rondje.gpx"
          },
          {
            "name": "Diverse wandelingen",
            "url": "https://www.wandeleninlimburg.be/nl/wandellussen"
          },
          {
            "name": "Wandeling in het Silsombos",
            "gemeente": "Sint-Truiden",
            "source": "Natuurpunt",
            "categorie": "Natuur",
            "url": "https://www.natuurpunt.be/natuurgebieden/silsombos",
            "lat": 50.822,
            "lon": 5.178
          }
        ]
      },
      {
        "name": "Antwerpen",
        "walks": [
          {
            "name": "Stadswandeling Centrum",
            "gemeente": "Antwerpen",
            "km": 4.1,
            "categorie": "Stad",
            "file": "Wandelen/Antwerpen/stadswandeling-centrum.gpx"
          }
        ]
      }
    ]
  },
  "fietsen": {
    "provinces": [
      {
        "name": "Limburg",
        "walks": [
          {
            "name": "Maasfietsroute",
            "gemeente": "Maasmechelen",
            "km": 42,
            "file": "Fietsen/Limburg/maasfietsroute.gpx"
          }
        ]
      }
    ]
  }
}
```

- Het veld heet in beide secties nog steeds `walks` (ook onder `fietsen`) —
  puur om de code eenvoudig te houden, het is gewoon "de lijst met routes".
- `file` is altijd relatief t.o.v. deze `gpx/`-map (dus inclusief het
  `Wandelen/`- of `Fietsen/`-voorvoegsel als je die submap-indeling volgt).
- **`url` in plaats van `file`:** een routerij mag ook een externe link zijn
  i.p.v. een meegeleverd `.gpx`-bestand — bv. een overzichtspagina op een
  wandel-/fietssite waar je zelf nog een route uit kiest, in plaats van één
  specifiek bestand. Zet dan gewoon `"url": "https://…"` i.p.v. `"file"`. Zo'n
  rij krijgt een 🔗-icoon en een "Open website"-knop die de link in een nieuw
  tabblad/de systeembrowser opent, i.p.v. "Open op kaart" die een bestand op
  de kaart laadt. `file` en `url` door elkaar gebruiken binnen dezelfde lijst
  kan gewoon, per routerij apart. Heeft een routerij GEEN van beide, dan komt
  er simpelweg geen knop bij die rij. Enkel `http(s)://`-links worden
  geopend.
- `km` en `gemeente` zijn optioneel (worden gewoon niet getoond als je ze weglaat).
- **`source`** (optioneel): vrije tekst, bv. `"Natuurpunt"`, `"Natuurmonumenten"` of `"Natagora"` — verschijnt als
  een klein label bij de naam ("Bron: Natagora"). Bedoeld voor routes die je van een externe organisatie overneemt
  (als bestand, of als `url`-link naar hun eigen pagina) en waarbij je wil laten zien wie de bron is. De 64
  Natagora-wandelingen (Ronde 43) zijn hier een voorbeeld van: het echte GPX-bestand zit bij hen achter een
  lidaccount, maar naam/afstand/vertrekplaats stonden gewoon publiek op hun overzichtspagina's — die zijn
  overgenomen als `url`-rijen (`https://www.natagora.be/natagora_walks/userselect/<id>`), met bij benadering het
  centrum van de vertrekgemeente als `lat`/`lon` (Natagora geeft zelf geen exacte coördinaat van het beginpunt).
- **`lat`/`lon`** (optioneel, beide samen): coördinaten van het beginpunt, enkel gebruikt voor de "In de
  buurt"-weergave (zie hieronder) — een routerij zonder `lat`/`lon` blijft gewoon zichtbaar per provincie,
  maar verschijnt niet in de "In de buurt"-lijst. Wordt NIET automatisch uit een `file` gehaald (geen
  GPX-parsing enkel om te sorteren) — voor een `file`-routerij moet je dus zelf het beginpunt opzoeken en
  meegeven, voor een `url`-routerij is dit de enige manier om 'm toch op afstand te kunnen tonen. Heeft een
  gebied meerdere wandelingen met een verschillende lengte (bv. een korte en een lange lus vanaf hetzelfde
  startpunt), zet dan gewoon 2 aparte routerijen met elk hun eigen `km` en hetzelfde `lat`/`lon`.
- **`foto`**, **`fotoBron`**, **`fotoUrl`** (optioneel, Ronde 155): een eigen foto van deze wandeling voor het detailscherm van
  "Leuke routes bij jou". `foto` is het adres van de afbeelding en moet met `https://` beginnen (andere adressen worden genegeerd),
  `fotoBron` is de tekst die onder de foto komt (maker en licentie, bv. `"Jan Peeters, CC BY 4.0"`) en `fotoUrl` het adres dat opent
  als je de foto aantikt (bv. de bronpagina). Een eigen foto staat voorop; ontbreekt hij, dan zoekt de app zelf foto's van Wikimedia
  Commons die binnen 150 m van het spoor zijn genomen, en bij gebrek daaraan de hoofdfoto van het dichtstbijzijnde Wikipedia-artikel
  (als omgevingsfoto, met maker en licentie). Foto's van Natuurpunt of Natagora mag je enkel gebruiken met hun toestemming.
- **`kaart`**, **`kaartBron`**, **`kaartUrl`** (optioneel, Ronde 161, enkel voor een routerij met een `url` en zonder `file`): een eigen
  kaartje van een route die enkel een link is, voor het detailscherm van "Leuke routes bij jou". Een routerij met een `file` krijgt
  altijd het echte routekaartje uit het GPX-bestand; bij die rijen wordt `kaart` genegeerd. `kaart` is het adres van de afbeelding
  (png, jpg of webp) en moet met `https://` beginnen (andere adressen worden genegeerd), `kaartBron` is de tekst onder het kaartje
  (bv. `"Natagora"`; de app zet er "Kaartje:" / "Map:" voor) en `kaartUrl` het adres dat opent als je het kaartje aantikt (zonder
  `kaartUrl` opent de afbeelding zelf, zodat je kunt inzoomen). De afbeelding wordt in een vak van 2:1 volledig getoond (niets wordt
  afgesneden). Ontbreekt `kaart`, of laadt de afbeelding niet (geen verbinding, fout adres), dan toont de app een van de vijf eigen
  tekeningen, afwisselend per route, met de uitleg dat het een link naar een website is. Voorbeeld:
  `{ "name": "Wandeling Keignaert", "url": "https://www.natuurpunt.be/natuurgebieden/keignaert", "lat": 51.1, "lon": 3.9,
  "kaart": "https://voorbeeld.be/kaarten/keignaert.png", "kaartBron": "Natuurpunt", "kaartUrl": "https://voorbeeld.be/kaart" }`.
  Gebruik enkel kaartjes waarvoor je toestemming hebt. De namen van de velden zijn Nederlands en in beide talen hetzelfde; de teksten
  rond het kaartje volgen de taal van de app.
- **Dieren en planten (Ronde 157, planten erbij in Ronde 158)**: geen veld nodig. Bij een route met een `url` naar een Natuurpunt-natuurgebied
  (`https://www.natuurpunt.be/natuurgebieden/<naam>`) leest de app (enkel de Android-app) de soortenlijst van die pagina
  en koppelt de soorten aan iNaturalist voor een foto; bij alle andere routes toont ze de meest waargenomen soorten
  binnen 1 km van het beginpunt (`lat`/`lon`) volgens iNaturalist. Dieren en planten staan in twee aparte rijen; heeft de
  Natuurpunt-pagina voor een rij geen soorten, dan wordt die rij apart aangevuld met iNaturalist.
- **`parkingLat`/`parkingLon`** (optioneel, beide samen): enkel invullen als de parking een ANDERE locatie is
  dan het beginpunt zelf (bv. een parking net buiten het gebied, met nog een stukje te stappen tot de start).
  Is de parking gewoon hetzelfde punt als de start, dan volstaat `lat`/`lon` alleen.
- **`Gmaps`** (optioneel, ook `gmaps`/`maps`/`googlemaps` worden herkend): een kant-en-klare Google Maps-link
  naar het beginpunt (bv. `"https://www.google.com/maps/place/50.822,5.178"`). Geeft de rij een eigen turquoise
  🗺️-knopje, los van het gewone 🔗/"Open website"-knopje. **Dit veld hoeft bijna nooit manueel ingevuld te
  worden**: heeft een routerij al `lat`/`lon`, dan bouwt de app die Google Maps-link er zelf uit op (exact
  hetzelfde `https://www.google.com/maps/place/<lat>,<lon>`-patroon) — `Gmaps` is dus enkel nog nodig als je
  een ANDERE/preciezere link wil dan wat `lat`/`lon` zelf al oplevert. Heeft een routerij ENKEL een
  meegeleverd `file` (geen `lat`/`lon`, geen `Gmaps`), dan verschijnt het 🗺️-knopje ook — de app haalt de
  coördinaat dan pas op het moment van tikken zelf uit dat GPX-bestand (het eerste punt van de track). Heeft
  een routerij geen van de 3 (`Gmaps`/`lat`+`lon`/`file`) — bv. een kale `url`-verwijzing naar een
  overzichtspagina — dan komt er simpelweg geen 🗺️-knopje.
- **`categorie`** (optioneel, ook `category`/`categorieën`/`type` worden herkend — hoofdletters maken niet
  uit): vrije tekst, bv. `"Natuur"`, `"Stad"` of `"Rivier"` — zelf te kiezen, geen vaste lijst. Zodra minstens
  1 routerij (in eender welke provincie) dit veld heeft, verschijnt er automatisch een rij filter-"chips"
  boven de routelijst in de app (1 per gevonden categorie, plus een vaste "Alles"-chip) — tik een chip aan om
  enkel die categorie te tonen, zowel bij "Per provincie" als bij "In de buurt". Gebruikt geen enkele
  routerij dit veld, dan blijft die rij gewoon volledig weg (geen categorieën gezet = geen wijziging in de
  app t.o.v. voorheen).
- Provincies zonder routes mag je gewoon weglaten uit de lijst.
- Zolang een sectie leeg is (`"provinces": []`, de huidige staat van beide),
  toont de app een duidelijke lege-staat-uitleg in de popup i.p.v. een lege lijst.
- **Oudere, platte `index.json`-bestanden** (enkel een top-level `"provinces"`,
  zonder `"wandelen"`/`"fietsen"`) worden nog steeds gelezen als terugval —
  maar dan enkel getoond in de Wandel-lijst, nooit in de Fiets-lijst. Nieuwe
  routes toevoegen gebeurt best meteen in de nieuwe, opgesplitste vorm.

## Belangrijk: dit vereist een nieuwe build

Net zoals bij de Zombie Run mp3's kan een gebruiker deze map NIET achteraf vullen via
een bestandsbeheerder op het toestel — de inhoud van `gpx/` wordt bij het bouwen van
de app (PWA + Android) mee ingepakt. Bezorg de `.gpx`-bestanden (en de bijgewerkte
`index.json`) zodat ze in de volgende versie meegenomen kunnen worden.
