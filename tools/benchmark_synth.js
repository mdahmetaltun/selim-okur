#!/usr/bin/env node
/**
 * Eşleştirme yönteminin sentetik ölçümü: farklı espeak seslerini "farklı konuşmacı" sayar.
 * Gerçek çocuk sesi için değil, yöntemin kaba tutarlılığını görmek içindir.
 *   node tools/benchmark_synth.js [hece-uzunluğu: 12 harf için 'm']
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const DSP = require('../js/dsp.js'), C = require('../js/curriculum.js'), { readWav } = require('./wav.js');

const known = C.lettersThrough(process.argv[2] || 'm');
const labels = C.generateSyllables(known).filter((s) => s.type === 'CV' || s.type === 'VC').map((s) => s.sequence);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-'));
const speakers = [
    { v: 'tr+f3', p: 62, s: 105 }, { v: 'tr+m1', p: 45, s: 110 }, { v: 'tr+f1', p: 70, s: 100 },
    { v: 'tr+m3', p: 38, s: 125 }, { v: 'tr+f4', p: 80, s: 95 }
];
function feat(label, sp) {
    const f = path.join(tmp, 'x.wav');
    spawnSync('espeak-ng', ['-v', sp.v, '-p', String(sp.p), '-s', String(sp.s), '-w', f, label]);
    const { samples, rate } = readWav(f);
    return DSP.features(samples, rate);
}
const F = speakers.map((sp) => Object.fromEntries(labels.map((l) => [l, feat(l, sp)])));

function run(name, templateSpk, testSpk) {
    const templates = Object.fromEntries(labels.map((l) => [l, templateSpk.map((i) => F[i][l])]));
    let ok = 0, n = 0, conf = 0;
    testSpk.forEach((i) => labels.forEach((l) => {
        const r = DSP.classify(F[i][l], templates);
        n++; if (r.best === l) { ok++; if (r.margin > 0.08) conf++; }
    }));
    console.log(`${name.padEnd(46)} doğruluk ${(100 * ok / n).toFixed(1)}%  (güvenli ${(100 * conf / n).toFixed(1)}%)  n=${n}`);
}
console.log(`${labels.length} hece, ${speakers.length} sentetik konuşmacı`);
run('1 şablon: farklı konuşmacı (en zor durum)', [0], [1, 2, 3, 4]);
run('2 şablon: farklı konuşmacılar', [0, 1], [2, 3, 4]);
run('3 şablon: farklı konuşmacılar', [0, 1, 2], [3, 4]);
run('aynı konuşmacı, aynı hız (üst sınır)', [0], [0]);
fs.rmSync(tmp, { recursive: true, force: true });
