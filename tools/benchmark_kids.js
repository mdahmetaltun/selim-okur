#!/usr/bin/env node
/**
 * Çocuk sesi benzetimi: yetişkin sesiyle üretilmiş şablonlara karşı, formantları yukarı kaydırılmış
 * (çocuk benzeri) kayıtlarla tanıma. VTLN (frekans ekseni ölçekleme) kazancını ölçer.
 *   node tools/benchmark_kids.js [harf-sonu: m]
 * Not: ffmpeg ile hız/perde kaydırma gerçek çocuk sesinin yalnızca kabaca bir benzetimidir.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const DSP = require('../js/dsp.js'), C = require('../js/curriculum.js'), { readWav } = require('./wav.js');

const known = C.lettersThrough(process.argv[2] || 'm');
const labels = C.generateSyllables(known).filter((s) => s.type === 'CV' || s.type === 'VC').map((s) => s.sequence);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-'));

function wav(label, voice, pitch, speed, shift = 1) {
    const raw = path.join(tmp, 'r.wav'), out = path.join(tmp, 's.wav');
    spawnSync('espeak-ng', ['-v', voice, '-p', String(pitch), '-s', String(speed), '-w', raw, label]);
    if (shift === 1) return readWav(raw);
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', `asetrate=22050*${shift},aresample=22050,atempo=${(1 / shift).toFixed(3)}`, out]);
    return readWav(out);
}
// Şablonlar: uygulamanın hazır referans sesi (tr+f3, perde 62, hız 105) — soğuk başlangıçta eldeki tek şey budur
const adult = [['tr+f3', 62, 105]];
const templates = Object.fromEntries(labels.map((l) => [l, adult.map(([v, p, s]) => { const w = wav(l, v, p, s); return DSP.features(w.samples, w.rate); })]));

// Çocuk benzeri: kadın sesine göre formant ×1.05–1.2 (7 yaş çocuğu ~1.1–1.15)
const kids = [['tr+m1', 55, 100, 1.2], ['tr+f1', 75, 105, 1.1], ['tr+f4', 80, 95, 1.15], ['tr+m3', 60, 110, 1.25], ['tr+f2', 72, 100, 1.05]];
function run(name, classifier, poolSize) {
    const rows = [];
    kids.forEach(([v, p, sp, shift]) => labels.forEach((l) => {
        const w = wav(l, v, p, sp, shift);
        const dict = poolSize ? Object.fromEntries([l, ...labels.filter((x) => x !== l).sort(() => Math.random() - 0.5).slice(0, poolSize - 1)].map((k) => [k, templates[k]])) : templates;
        const r = classifier(w, dict);
        rows.push({ ok: !!r && r.best === l, margin: r ? r.margin : 0 });
    }));
    const n = rows.length, ok = rows.filter((x) => x.ok).length;
    console.log(`${name.padEnd(30)} havuz ${String(poolSize || labels.length).padStart(3)}: ${(100 * ok / n).toFixed(1)}%  (n=${n})`);
    if (process.env.MARGINS) {
        [0.05, 0.1, 0.15, 0.2, 0.3, 0.4].forEach((t) => {
            const acc = rows.filter((x) => x.margin >= t);
            const good = acc.filter((x) => x.ok).length;
            console.log(`    güven eşiği ${t.toFixed(2)}: karar verilen %${(100 * acc.length / n).toFixed(0)}, bunların doğruluğu %${acc.length ? (100 * good / acc.length).toFixed(1) : '-'}`);
        });
    }
}
console.log(`${labels.length} hece; şablonlar: 1 hazır referans sesi (tr+f3); testler: ${kids.length} çocuk benzeri ses (formant ×1.05–1.25)\n`);
const plain = (w, dict) => DSP.classify(DSP.features(w.samples, w.rate), dict);
const warped = (w, dict) => DSP.classifyWarped(w.samples, w.rate, dict);
for (const pool of (process.env.POOLS ? process.env.POOLS.split(',').map(Number) : [10, 0])) { run('VTLN yok', plain, pool); run('VTLN (6 ölçek)', warped, pool); console.log(''); }
fs.rmSync(tmp, { recursive: true, force: true });
