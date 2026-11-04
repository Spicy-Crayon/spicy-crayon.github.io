// Tests voor tools/build-kennis.mjs (de cracker): pdf, epub, md/txt/html, paginanummers, waarschuwing bij een pdf zonder tekst, _info.json,
// afbrekingen, stukjesgrootte, geen wijziging bij een tweede run, kapotte bestanden, lege map. Gebruik: node tests/test-cracker.mjs
import assert from 'node:assert';
import { mkdtempSync, writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'build-kennis.mjs');
let passed = 0, failed = 0;
async function test(name, fn){ try { await fn(); passed++; console.log('OK   - ' + name); } catch (e) { failed++; console.log('FAIL - ' + name); console.log('       ' + String(e.message).split('\n').slice(0, 8).join(' | ')); } }
const run = (src, out) => { const r = spawnSync('node', [SCRIPT, src, out], { encoding: 'utf8' }); return { code: r.status, out: r.stdout + r.stderr }; };
const fresh = () => { const d = mkdtempSync(join(tmpdir(), 'kn-')); mkdirSync(join(d, 'bronnen')); return d; };
const load = (d) => JSON.parse(readFileSync(join(d, 'index.json'), 'utf8'));
const words = (t) => t.split(/\s+/).length;
const py = (code) => execFileSync('python3', ['-c', code], { encoding: 'utf8' });
let hasPdf = true; try { py('import reportlab'); } catch { hasPdf = false; }
function makePdf(file, pages){
  py(`from reportlab.pdfgen import canvas\nfrom reportlab.lib.pagesizes import A4\nimport json\nc=canvas.Canvas(${JSON.stringify(file)},pagesize=A4)\nfor t in json.loads(${JSON.stringify(JSON.stringify(pages))}):\n  y=800\n  for line in t.split('\\n'):\n    c.drawString(60,y,line); y-=16\n  c.showPage()\nc.save()`);
}
function makeEpub(file, chapters){
  py(`import zipfile,json\nch=json.loads(${JSON.stringify(JSON.stringify(chapters))})\nz=zipfile.ZipFile(${JSON.stringify(file)},'w')\nz.writestr('mimetype','application/epub+zip')\nz.writestr('META-INF/container.xml','<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>')\nitems=''.join('<item id="c%d" href="%s"/>'%(i,c[0].replace(' ','%20')) for i,c in enumerate(ch))\nspine=''.join('<itemref idref="c%d"/>'%i for i in range(len(ch)))\nz.writestr('OEBPS/content.opf','<package><manifest>'+items+'</manifest><spine>'+spine+'</spine></package>')\nfor c in ch: z.writestr('OEBPS/'+c[0],'<html><body>'+c[1]+'</body></html>')\nz.close()`);
}
const lorem = (n, w = 'woord') => Array.from({ length: n }, (_, i) => w + (i % 50)).join(' ');

await test('1. md, txt en html: tekst eruit, html-tags en entiteiten weg, pagina 0, stukjes tussen 12 en 260 woorden, korte stukjes (<12 woorden) overgeslagen', () => {
  const d = fresh();
  writeFileSync(join(d, 'bronnen', 'a.md'), '# Titel\n\n' + lorem(500) + '\n\nkort');
  writeFileSync(join(d, 'bronnen', 'b.txt'), 'Eerste alinea over wandelen in de Hoge Kempen met veel woorden erin zodat het lang genoeg is voor een stukje.\n\nTweede alinea.');
  writeFileSync(join(d, 'bronnen', 'c.html'), '<html><head><style>p{}</style><script>alert(1)</script></head><body><h1>Caf&eacute; &amp; Co</h1><p>Wandelen &gt; fietsen, zegt de tekst. ' + lorem(30) + '</p></body></html>');
  const r = run(join(d, 'bronnen'), join(d, 'index.json')); assert.strictEqual(r.code, 0, r.out);
  const j = load(d); assert.deepStrictEqual(j.docs.map(x => x.file), ['a.md', 'b.txt', 'c.html']);
  j.chunks.forEach(c => { assert.ok(words(c.t) >= 12 && words(c.t) <= 260, 'stukjesgrootte ' + words(c.t)); assert.strictEqual(c.p, 0); });
  assert.ok(!j.chunks.some(c => /alert|<\/?p>|style/.test(c.t)), 'script en tags weg');
  assert.ok(j.chunks.some(c => /Wandelen > fietsen/.test(c.t)), 'entiteiten omgezet');
  assert.ok(!j.chunks.some(c => c.t === 'kort' || /Tweede alinea\.$/.test(c.t) && words(c.t) < 12));
});

await test('2. lange alinea: vensters van ongeveer 200 woorden met overlap, niets gaat verloren (elk woord staat in minstens een stukje, in volgorde)', () => {
  const d = fresh(); const t = Array.from({ length: 900 }, (_, i) => 'w' + i).join(' ');
  writeFileSync(join(d, 'bronnen', 'lang.txt'), t); run(join(d, 'bronnen'), join(d, 'index.json'));
  const j = load(d); assert.ok(j.chunks.length >= 5, 'aantal stukjes ' + j.chunks.length);
  const seen = new Set(j.chunks.flatMap(c => c.t.split(' '))); for (let i = 0; i < 900; i++) assert.ok(seen.has('w' + i), 'woord w' + i + ' ontbreekt');
  assert.ok(j.chunks[1].t.startsWith('w170 '), 'overlap van 30 woorden: ' + j.chunks[1].t.slice(0, 20));
});

await test('3. afbrekingen aan regeleinden worden hersteld ("ver-\\nvolgens" = "vervolgens") en regeleinden binnen een alinea samengevoegd, alinea\'s blijven gescheiden', () => {
  const d = fresh(); writeFileSync(join(d, 'bronnen', 'x.txt'), 'De route is ver-\nvolgens goed bewegwijzerd en loopt langs\nde rivier door het dorp heen naar de kerk en terug.\n\nNieuwe alinea met genoeg woorden om een eigen stukje te vormen, echt waar ja.');
  run(join(d, 'bronnen'), join(d, 'index.json')); const t = load(d).chunks.map(c => c.t).join(' | ');
  assert.ok(/vervolgens goed bewegwijzerd en loopt langs de rivier/.test(t), t);
});

await test('4. pdf: tekst per pagina met het juiste paginanummer; epub: hoofdstukken in leesvolgorde (ook met een spatie in de bestandsnaam); titel en taal uit _info.json', () => {
  if (!hasPdf){ console.log('       (reportlab ontbreekt, pdf-deel overgeslagen)'); }
  const d = fresh();
  if (hasPdf) makePdf(join(d, 'bronnen', 'Moezel.pdf'), ['Fietsen langs de Moezel\n' + lorem(40), 'Wandelen in de wijngaarden\n' + lorem(40), 'Praktisch\n' + lorem(40)]);
  makeEpub(join(d, 'bronnen', 'Gids.epub'), [['ch1.xhtml', '<h1>Een</h1><p>' + lorem(40) + '</p>'], ['ch 2.xhtml', '<h1>Twee</h1><p>' + lorem(40, 'andere') + '</p>']]);
  writeFileSync(join(d, 'bronnen', '_info.json'), JSON.stringify({ 'Gids.epub': { titel: 'Mijn gids', taal: 'de', url: 'https://x.be/g', licentie: 'vrij' } }));
  const r = run(join(d, 'bronnen'), join(d, 'index.json')); assert.strictEqual(r.code, 0, r.out);
  const j = load(d), gids = j.docs.findIndex(x => x.file === 'Gids.epub');
  assert.deepStrictEqual({ t: j.docs[gids].title, l: j.docs[gids].lang, u: j.docs[gids].url, lic: j.docs[gids].license, p: j.docs[gids].pages }, { t: 'Mijn gids', l: 'de', u: 'https://x.be/g', lic: 'vrij', p: 2 });
  const ep = j.chunks.filter(c => c.d === gids); assert.deepStrictEqual(ep.map(c => c.p), [1, 2]); assert.ok(/^Een /.test(ep[0].t) && /^Twee /.test(ep[1].t) && /andere0/.test(ep[1].t));
  if (hasPdf){ const m = j.docs.findIndex(x => x.file === 'Moezel.pdf'); assert.deepStrictEqual(j.chunks.filter(c => c.d === m).map(c => c.p), [1, 2, 3]); assert.ok(/Wandelen in de wijngaarden/.test(j.chunks.find(c => c.d === m && c.p === 2).t)); assert.strictEqual(j.docs[m].title, 'Moezel'); }
});

await test('5. pdf zonder tekst (gescand): gele waarschuwing, document niet in de index, de rest blijft kloppen (documentnummers verschuiven goed)', () => {
  const d = fresh();
  writeFileSync(join(d, 'bronnen', 'a_leeg.pdf'), '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
  writeFileSync(join(d, 'bronnen', 'b.txt'), lorem(60));
  const r = run(join(d, 'bronnen'), join(d, 'index.json')); assert.strictEqual(r.code, 0);
  assert.ok(/::warning::a_leeg\.pdf: bijna geen tekst/.test(r.out), r.out);
  const j = load(d); assert.deepStrictEqual(j.docs.map(x => x.file), ['b.txt']); assert.ok(j.chunks.every(c => c.d === 0)); assert.strictEqual(j.warnings.length, 1);
});

await test('6. kapotte epub of pdf: waarschuwing, geen crash, de andere bestanden worden wel verwerkt; onbekende types, verborgen bestanden en _bestanden worden overgeslagen', () => {
  const d = fresh();
  writeFileSync(join(d, 'bronnen', 'stuk.epub'), 'dit is geen zip'); writeFileSync(join(d, 'bronnen', 'stuk.pdf'), 'geen pdf');
  writeFileSync(join(d, 'bronnen', 'foto.jpg'), 'x'); writeFileSync(join(d, 'bronnen', '.verborgen.txt'), lorem(40)); writeFileSync(join(d, 'bronnen', '_notitie.txt'), lorem(40)); writeFileSync(join(d, 'bronnen', 'ok.txt'), lorem(40));
  const r = run(join(d, 'bronnen'), join(d, 'index.json')); assert.strictEqual(r.code, 0, r.out);
  assert.ok(/stuk\.epub: lezen mislukt/.test(r.out) && /stuk\.pdf/.test(r.out)); const j = load(d); assert.deepStrictEqual(j.docs.map(x => x.file), ['ok.txt']);
});

await test('7. een tweede run zonder wijzigingen laat het bestand ongemoeid (geen nieuwe tijdstempel, dus geen nutteloze commit); een wijziging werkt de index wel bij', () => {
  const d = fresh(); writeFileSync(join(d, 'bronnen', 'a.txt'), lorem(60)); run(join(d, 'bronnen'), join(d, 'index.json'));
  const a = readFileSync(join(d, 'index.json'), 'utf8'); const r = run(join(d, 'bronnen'), join(d, 'index.json'));
  assert.ok(/Geen wijzigingen/.test(r.out)); assert.strictEqual(readFileSync(join(d, 'index.json'), 'utf8'), a);
  writeFileSync(join(d, 'bronnen', 'b.txt'), lorem(60, 'nieuw')); run(join(d, 'bronnen'), join(d, 'index.json')); assert.strictEqual(load(d).docs.length, 2);
});

await test('8. lege of ontbrekende map: een geldige lege index, geen fout; het formaat past bij wat de app verwacht (docs, chunks, d verwijst naar een document, t is tekst)', () => {
  const d = mkdtempSync(join(tmpdir(), 'kn-')); const r = run(join(d, 'bestaat-niet'), join(d, 'index.json')); assert.strictEqual(r.code, 0, r.out);
  const j = load(d); assert.deepStrictEqual({ v: j.version, docs: j.docs.length, ch: j.chunks.length }, { v: 1, docs: 0, ch: 0 });
  const e = fresh(); writeFileSync(join(e, 'bronnen', 'a.txt'), lorem(300)); run(join(e, 'bronnen'), join(e, 'index.json')); const k = load(e);
  k.chunks.forEach(c => { assert.ok(k.docs[c.d], 'd verwijst naar een document'); assert.strictEqual(typeof c.t, 'string'); assert.ok(Number.isInteger(c.p)); });
  assert.ok(k.docs.every(x => x.title && x.file && typeof x.lang === 'string'));
});

await test('9. taal raden: Nederlandse, Duitse en Engelse tekst krijgen de juiste code', () => {
  const d = fresh();
  writeFileSync(join(d, 'bronnen', 'nl.txt'), 'De route is het mooist voor wie een rustige dag wil in de natuur en het niet erg vindt om ook een stuk met de fiets te doen naar het dorp. '.repeat(5));
  writeFileSync(join(d, 'bronnen', 'de.txt'), 'Der Weg ist nicht weit und die Wanderung ist ein Erlebnis mit einer Aussicht auf den Fluss und das Dorf, ein Genuss auch für die Kinder. '.repeat(5));
  writeFileSync(join(d, 'bronnen', 'en.txt'), 'The trail is for everyone and you are going to love the views of the river and the village with your family and this is the best walk. '.repeat(5));
  run(join(d, 'bronnen'), join(d, 'index.json')); const j = load(d); assert.deepStrictEqual(Object.fromEntries(j.docs.map(x => [x.file, x.lang])), { 'de.txt': 'de', 'en.txt': 'en', 'nl.txt': 'nl' });
});

console.log(`\n${passed} geslaagd, ${failed} mislukt`); process.exit(failed ? 1 : 0);
