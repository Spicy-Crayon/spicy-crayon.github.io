#!/usr/bin/env node
// De "cracker" voor PathHopper: leest alle brochures in kennis/bronnen/ (pdf, epub, md, txt, html), haalt de tekst eruit,
// knipt die in stukjes van ongeveer 200 woorden (met bronnaam en pagina) en schrijft kennis/index.json.
// De app haalt dat bestand online op (geen APK-build nodig) en zoekt erin als je de assistent iets vraagt.
// Alleen ingebouwde Node-modules; voor pdf en epub wordt `pdftotext` (poppler-utils) en `unzip` gebruikt (staan op GitHub-runners of worden door de workflow geinstalleerd).
// Gebruik:  node tools/build-kennis.mjs [bronmap] [uitvoerbestand]
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, extname, basename } from 'node:path';

const SRC = process.argv[2] || 'kennis/bronnen';
const OUT = process.argv[3] || 'kennis/index.json';
const CHUNK_WORDS = 200, MAX_WORDS = 260, OVERLAP = 30, MIN_WORDS = 12;
const warnings = [];
const warn = (m) => { warnings.push(m); console.log('::warning::' + m); };

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const decodeEntities = (s) => s
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return ' '; } })
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ' '; } });
const stripHtml = (h) => decodeEntities(String(h)
  .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>|<br\s*\/?>/gi, '\n\n')
  .replace(/<[^>]+>/g, ' '));

// Schoonmaken: afbrekingen aan regeleinden herstellen, losse regeleinden binnen een alinea samenvoegen, alinea's behouden.
function clean(t){
  return String(t).replace(/\r/g, '').replace(/­/g, '').replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2')
    .split(/\n\s*\n/).map(p => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
// Alinea's -> stukjes van ~CHUNK_WORDS woorden; een heel lange alinea wordt in vensters met overlap geknipt.
function chunkParagraphs(paras){
  const out = []; let cur = [], n = 0;
  const flush = () => { if (n >= MIN_WORDS) out.push(cur.join(' ')); cur = []; n = 0; };
  for (const p of paras){
    const w = p.split(' ');
    if (w.length > MAX_WORDS){
      flush();
      for (let i = 0; i < w.length; i += CHUNK_WORDS - OVERLAP){
        const part = w.slice(i, i + CHUNK_WORDS);
        if (part.length >= MIN_WORDS) out.push(part.join(' '));
        if (i + CHUNK_WORDS >= w.length) break;
      }
      continue;
    }
    if (n + w.length > MAX_WORDS) flush();
    cur.push(p); n += w.length;
    if (n >= CHUNK_WORDS) flush();
  }
  flush();
  return out;
}

// Per bestandstype: lijst van { page, text }. Pagina = paginanummer (pdf) of hoofdstuknummer (epub); 0 = geen pagina's (md, txt, html).
function extractPdf(file){
  const txt = run('pdftotext', ['-enc', 'UTF-8', file, '-']);
  const pages = txt.split('\f'); if (pages.length && !pages[pages.length - 1].trim()) pages.pop();
  return pages.map((t, i) => ({ page: i + 1, text: t }));
}
function extractEpub(file){
  const read = (name) => run('unzip', ['-p', file, name]);
  const container = read('META-INF/container.xml');
  const opfPath = (container.match(/full-path="([^"]+)"/) || [])[1];
  if (!opfPath) throw new Error('geen OPF-bestand gevonden');
  const opf = read(opfPath), dir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
  const manifest = {};
  for (const m of opf.matchAll(/<item\b[^>]*>/g)){
    const id = (m[0].match(/\bid="([^"]+)"/) || [])[1], href = (m[0].match(/\bhref="([^"]+)"/) || [])[1];
    if (id && href) manifest[id] = decodeURIComponent(href);
  }
  const spine = [...opf.matchAll(/<itemref\b[^>]*\bidref="([^"]+)"/g)].map(m => manifest[m[1]]).filter(Boolean);
  return spine.map((href, i) => { let t = ''; try { t = stripHtml(read(dir + href)); } catch { warn(`${basename(file)}: hoofdstuk ${href} niet te lezen`); } return { page: i + 1, text: t }; });
}
function extract(file){
  const ext = extname(file).toLowerCase();
  if (ext === '.pdf') return extractPdf(file);
  if (ext === '.epub') return extractEpub(file);
  if (ext === '.md' || ext === '.txt') return [{ page: 0, text: readFileSync(file, 'utf8') }];
  if (ext === '.html' || ext === '.htm') return [{ page: 0, text: stripHtml(readFileSync(file, 'utf8')) }];
  return null;
}
// Taal raden (nl/de/en/fr) op de meest voorkomende woorden; alleen een hulpmiddel, te overschrijven in _info.json.
function guessLang(text){
  const sets = { nl: ' de het een en van naar niet ook voor met ', de: ' der die das und nicht mit von ist ein eine auch ', en: ' the and of to is with for you are this ', fr: ' le la les des et est pour avec dans une ' };
  const t = ' ' + text.slice(0, 20000).toLowerCase().replace(/[^\p{L}]+/gu, ' ') + ' ';
  let best = '', bs = 0;
  for (const [l, w] of Object.entries(sets)){ let s = 0; for (const x of w.trim().split(' ')) s += t.split(' ' + x + ' ').length - 1; if (s > bs){ bs = s; best = l; } }
  return best;
}

const info = (() => { try { return JSON.parse(readFileSync(join(SRC, '_info.json'), 'utf8')); } catch { return {}; } })();
const files = existsSync(SRC) ? readdirSync(SRC).filter(f => !f.startsWith('.') && !f.startsWith('_') && statSync(join(SRC, f)).isFile()).sort((a, b) => a.localeCompare(b, 'en')) : [];
const docs = [], chunks = [];
for (const f of files){
  let pages;
  try { pages = extract(join(SRC, f)); } catch (e){ warn(`${f}: lezen mislukt (${String(e.message || e).split('\n')[0]})`); continue; }
  if (!pages){ console.log(`${f}: type overgeslagen`); continue; }
  const d = docs.length, before = chunks.length;
  let chars = 0, all = '';
  for (const pg of pages){
    const paras = clean(pg.text); chars += paras.join('').length; if (all.length < 20000) all += ' ' + paras.join(' ');
    chunkParagraphs(paras).forEach(t => chunks.push({ d, p: pg.page, t }));
  }
  if (pages.length && chars < 40 * pages.length) warn(`${f}: bijna geen tekst gevonden (${chars} tekens op ${pages.length} pagina's). Is dit een gescande brochure? Die kan deze cracker niet lezen (OCR nodig).`);
  if (chunks.length === before){ docs.push(null); continue; }
  const i = info[f] || {};
  docs.push({ title: i.titel || i.title || f.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' '), file: f, lang: i.taal || i.lang || guessLang(all), url: i.url || '', license: i.licentie || i.license || '', pages: pages.length });
}
// Documenten zonder tekst eruit; stukjes krijgen een nieuw documentnummer.
const keep = docs.map((d, i) => d ? i : -1), remap = new Map(); let n = 0;
keep.forEach(i => { if (i >= 0) remap.set(i, n++); });
const outDocs = docs.filter(Boolean), outChunks = chunks.map(c => ({ d: remap.get(c.d), p: c.p, t: c.t }));
const result = { version: 1, built: new Date().toISOString(), docs: outDocs, chunks: outChunks, warnings };
let prev = null; try { prev = JSON.parse(readFileSync(OUT, 'utf8')); } catch {}
const same = (a, b) => a && JSON.stringify({ ...a, built: 0 }) === JSON.stringify({ ...b, built: 0 });
if (same(prev, result)) console.log('Geen wijzigingen in de index.');
else writeFileSync(OUT, JSON.stringify(result));   // niet netjes ingesprongen: kleiner om te downloaden
const kb = Math.round(Buffer.byteLength(JSON.stringify(result)) / 1024);
console.log(`${outDocs.length} documenten, ${outChunks.length} stukjes, ${kb} kB, ${warnings.length} waarschuwing(en).`);
if (kb > 8000) warn(`index.json is ${kb} kB: groot voor een telefoon. Splits de brochures of laat minder belangrijke weg.`);
