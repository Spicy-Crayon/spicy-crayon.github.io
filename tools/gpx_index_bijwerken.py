#!/usr/bin/env python3
"""Werkt gpx/index.json bij op basis van de .gpx-bestanden in de map gpx/.

Gebruik (draait ook automatisch via GitHub Actions, zie .github/workflows/gpx-index.yml):
    python tools/gpx_index_bijwerken.py [gpx-map]          # standaard: gpx
    python tools/gpx_index_bijwerken.py gpx --controle     # enkel rapport, niets schrijven

Wat het doet
- Nieuw .gpx-bestand in gpx/Wandelen/<Provincie>/  -> nieuwe rij in die provincie (naam uit de bestandsnaam, lengte en beginpunt uit het bestand,
  categorie "Natuur"). Is de provincie nog niet in de lijst, dan wordt ze aangemaakt.
  Nieuw bestand in gpx/Fietsen/<Provincie>/          -> idem, in de sectie "fietsen".
- Een rij met een "file" waarvan het bestand niet (meer) bestaat, wordt verwijderd. Rijen met alleen een "url" blijven altijd staan.
- Een rij met "file" maar zonder lat/lon krijgt het beginpunt van het bestand (eerste trkpt, anders rtept, anders wpt).
- Een pad dat enkel in hoofdletters afwijkt van het echte pad wordt rechtgezet (GitHub Pages en Android zijn hoofdlettergevoelig).
- Bestaande rijen worden verder NIET aangepast (naam, km, categorie, foto's, enz. blijven zoals jij ze zette).
- Alles gebeurt zonder iets te hernoemen of te verplaatsen. Is er niets te doen, dan wordt het bestand niet herschreven.
"""
import json, math, os, re, sys

def first_point(path):
    data = open(path, 'rb').read().decode('utf-8', 'replace')
    for tag in ('trkpt', 'rtept', 'wpt'):
        for m in re.finditer(r'<%s\b([^>]*)>' % tag, data):
            a = m.group(1)
            la = re.search(r'\blat\s*=\s*["\']([-+0-9.eE]+)["\']', a); lo = re.search(r'\blon\s*=\s*["\']([-+0-9.eE]+)["\']', a)
            if la and lo:
                lat, lon = float(la.group(1)), float(lo.group(1))
                if -90 <= lat <= 90 and -180 <= lon <= 180 and not (lat == 0 and lon == 0):
                    return round(lat, 6), round(lon, 6)
    return None

def track_km(path):
    data = open(path, 'rb').read().decode('utf-8', 'replace')
    pts = []
    for tag in ('trkpt', 'rtept'):
        for m in re.finditer(r'<%s\b([^>]*)>' % tag, data):
            a = m.group(1)
            la = re.search(r'\blat\s*=\s*["\']([-+0-9.eE]+)["\']', a); lo = re.search(r'\blon\s*=\s*["\']([-+0-9.eE]+)["\']', a)
            if la and lo: pts.append((float(la.group(1)), float(lo.group(1))))
        if pts: break
    tot = 0.0
    for i in range(len(pts) - 1):
        la1, lo1, la2, lo2 = map(math.radians, (pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]))
        x = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
        tot += 2 * 6371.0 * math.asin(math.sqrt(min(1.0, x)))
    return round(tot, 1)

def pretty_name(stem):
    s = re.sub(r'[_]+', ' ', stem); s = re.sub(r'\s*-\s*', ' - ', s) if ' - ' in s else s.replace('-', ' ')
    s = re.sub(r'\s+', ' ', s).strip()
    return s[:1].upper() + s[1:]

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    check = '--controle' in sys.argv
    gpx_dir = os.path.abspath(args[0] if args else 'gpx')
    idx_path = os.path.join(gpx_dir, 'index.json')
    text = open(idx_path, encoding='utf-8').read(); j = json.loads(text)
    disk = []
    for root, _, files in os.walk(gpx_dir):
        for f in files:
            if f.lower().endswith('.gpx'): disk.append(os.path.relpath(os.path.join(root, f), gpx_dir).replace(os.sep, '/'))
    exact = set(disk); lower = {}
    for p in disk: lower.setdefault(p.lower(), []).append(p)
    log = {'nieuw': [], 'weg': [], 'coord': [], 'pad': [], 'geenpunt': []}
    used = set()
    # --- bestaande rijen: lijsten per provincie (platte vorm: provinces[].wandelen) en per sectie (wandelen/fietsen -> provinces[].walks)
    def lists():
        out = []
        for prov in j.get('provinces', []) if isinstance(j.get('provinces'), list) else []:
            for k, v in prov.items():
                if isinstance(v, list): out.append((None, prov, k))
        for sec in ('wandelen', 'fietsen'):
            s = j.get(sec)
            if isinstance(s, dict):
                for prov in s.get('provinces', []):
                    for k, v in prov.items():
                        if isinstance(v, list): out.append((sec, prov, k))
        return out
    for sec, prov, key in lists():
        keep = []
        for r in prov[key]:
            if not isinstance(r, dict) or not r.get('file'): keep.append(r); continue
            f = r['file']; real = f if f in exact else (lower[f.lower()][0] if len(lower.get(f.lower(), [])) == 1 else None)
            if not real: log['weg'].append(f); continue
            if real != f: log['pad'].append((f, real)); r['file'] = real
            used.add(real)
            if r.get('lat') is None or r.get('lon') is None:
                pt = first_point(os.path.join(gpx_dir, real))
                if pt: r['lat'], r['lon'] = pt; log['coord'].append(real)
                else: log['geenpunt'].append(real)
            keep.append(r)
        prov[key] = keep
    # --- nieuwe bestanden
    def section_for(rel):
        top = rel.split('/')[0].lower()
        return 'fietsen' if top == 'fietsen' else 'wandelen'
    for rel in sorted(set(disk) - used):
        parts = rel.split('/')
        if len(parts) < 3: log.setdefault('overgeslagen', []).append(rel); continue          # enkel gpx/<Wandelen|Fietsen>/<Provincie>/bestand.gpx
        top, provname = parts[0], parts[1]
        if top.lower() not in ('wandelen', 'fietsen'): log.setdefault('overgeslagen', []).append(rel); continue
        pt = first_point(os.path.join(gpx_dir, rel))
        if not pt: log['geenpunt'].append(rel); continue
        row = {'name': pretty_name(os.path.splitext(parts[-1])[0]), 'km': track_km(os.path.join(gpx_dir, rel)), 'categorie': 'Natuur', 'file': rel, 'lat': pt[0], 'lon': pt[1]}
        sec = section_for(rel)
        flat = isinstance(j.get('provinces'), list) and sec == 'wandelen' and not isinstance(j.get('wandelen'), dict)
        if flat:
            prov = next((p for p in j['provinces'] if p.get('name', '').lower() == provname.lower()), None)
            if not prov: prov = {'name': provname}; j['provinces'].append(prov)
            prov.setdefault('wandelen', []).append(row)
        else:
            s = j.setdefault(sec, {}); s.setdefault('provinces', [])
            prov = next((p for p in s['provinces'] if p.get('name', '').lower() == provname.lower()), None)
            if not prov: prov = {'name': provname, 'walks': []}; s['provinces'].append(prov)
            prov.setdefault('walks', []).append(row)
        log['nieuw'].append((rel, row['name'], row['km']))
    changed = any(log[k] for k in ('nieuw', 'weg', 'coord', 'pad'))
    print('Nieuwe routes toegevoegd :', len(log['nieuw']))
    for r in log['nieuw']: print('   +', r[1], '(%s km)' % r[2], '<-', r[0])
    print('Rijen verwijderd (bestand weg):', len(log['weg']))
    for r in log['weg']: print('   -', r)
    print('Beginpunt aangevuld      :', len(log['coord']))
    print('Pad rechtgezet (hoofdletters):', len(log['pad']))
    if log['geenpunt']: print('Zonder bruikbaar punt (niet toegevoegd):', log['geenpunt'])
    if log.get('overgeslagen'): print('Overgeslagen (niet in gpx/Wandelen|Fietsen/<Provincie>/):', log['overgeslagen'])
    if not changed: print('Niets te doen: index.json klopt al.'); return
    if check: print('(controle; niets geschreven)'); return
    open(idx_path, 'w', encoding='utf-8', newline='\n').write(json.dumps(j, indent=2, ensure_ascii=False) + '\n')
    print('index.json bijgewerkt.')

if __name__ == '__main__': main()
