#!/usr/bin/env node
/**
 * Öğrenme eğrisi: aynı konuşmacının tekrarları (hız/perde farklı) ile, hece başına kaç örnek
 * saklandığında tanıma ne kadar iyi? Uygulamadaki gerçek karar kuralları (Verify) kullanılır.
 *   node tools/benchmark_learning.js [harf-sonu: m] [tekrar: 3]
 * Not: espeak tekrarları gerçek çocuk sesinden çok daha az değişkendir; sayılar kaba bir üst sınırdır.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const DSP = require('../js/dsp.js'), C = require('../js/curriculum.js'), V = require('../js/verify.js'), { readWav } = require('./wav.js');

const known = C.lettersThrough(process.argv[2] || 'm');
const REPEAT = Number(process.argv[3] || 3);
const labels = C.generateSyllables(known).filter((s) => s.type === 'CV' || s.type === 'VC').map((s) => s.sequence);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bl-'));
let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const jitter = () => ({ s: 90 + Math.round(rnd() * 32), p: 40 + Math.round(rnd() * 10) });

function token(label) {
    const f = path.join(tmp, 'x.wav'), j = jitter();
    spawnSync('espeak-ng', ['-v', 'tr+m1', '-p', String(j.p), '-s', String(j.s), '-w', f, label]);
    const { samples, rate } = readWav(f);
    return DSP.features(samples, rate);
}
const PER = 10;
const toks = Object.fromEntries(labels.map((l) => [l, Array.from({ length: PER }, () => token(l))]));

function evaluate(nTrain, poolSize, coverage = 1) {
    let n = 0, correct = 0, wrong = 0, unsure = 0, wrongWhenCorrect = 0, falseAccept = 0;
    for (let r = 0; r < REPEAT; r++) {
        for (const target of labels) {
            // lesson-boyutlu havuz: hedef + rastgele rakipler
            const pool = [target, ...labels.filter((l) => l !== target).sort(() => rnd() - 0.5).slice(0, poolSize - 1)];
            // kapsama: rakip hecelerin yalnızca bir kısmının örneği var (uygulamada sıkça böyle)
            const dict = Object.fromEntries(pool.filter((l, i) => i === 0 || rnd() < coverage).map((l) => [l, toks[l].slice(0, nTrain)]));
            const rivals = Object.keys(dict).length - 1;
            const intras = Object.values(dict).filter((f) => f.length >= 2).map((f) => { const nn = f.map((a, i) => Math.min(...f.map((b2, j) => (i === j ? Infinity : DSP.dtw(a, b2))))).sort((x, y) => x - y); return nn[Math.floor(nn.length / 2)]; }).sort((x, y) => x - y);
            const typical = intras.length ? intras[Math.floor(intras.length / 2)] : null;
            const test = toks[target][PER - 1 - r]; // eğitimde kullanılmayan örnek
            const personal = nTrain > 0 ? DSP.classify(test, dict) : null;
            const intra = nTrain >= 2 ? (() => { const f = dict[target]; const nn = f.map((a, i) => Math.min(...f.map((b, j) => (i === j ? Infinity : DSP.dtw(a, b))))).sort((x, y) => x - y); return nn[Math.floor(nn.length / 2)]; })() : null;
            const res = V.fuse(null, personal, null, { target, personalCount: nTrain, personalLabels: Object.keys(dict).length, rivals, typical, intra, speech: true });
            // güvenlik: başka bir heceyi okuyan çocuk hedef için "doğru" sayılmamalı
            const other = pool[1 + Math.floor(rnd() * (pool.length - 1))];
            const spoken = toks[other][PER - 1 - r];
            const personalW = nTrain > 0 ? DSP.classify(spoken, dict) : null;
            const resW = V.fuse(null, personalW, null, { target, personalCount: nTrain, personalLabels: Object.keys(dict).length, rivals, typical, intra, speech: true });
            if (resW.verdict === 'correct') { falseAccept++; if (process.env.DEBUG_FA) console.log('FA', target, '<-', other, 'n', nTrain, 'rivals', rivals, 'best', personalW.best, personalW.bestDist.toFixed(2), 'margin', personalW.margin.toFixed(2), 'intra', intra && intra.toFixed(2)); }
            n++;
            if (res.verdict === 'correct') correct++;
            else if (res.verdict === 'wrong') { wrong++; wrongWhenCorrect++; }
            else unsure++;
        }
    }
    return { auto: 100 * correct / n, unsure: 100 * unsure / n, falseWrong: 100 * wrongWhenCorrect / n, falseAccept: 100 * falseAccept / n };
}

console.log(`${labels.length} hece, her biri için ${PER} tekrar. Tanıyıcı (web) YOK: yalnızca Selim'in ses örnekleriyle karar.\n`);
console.log('hece başına örnek | havuz | otomatik doğru | veliye soruluyor | doğruyu "yanlış" sayma | yanlışı "doğru" sayma');
const cov = Number(process.argv[4] || 1);
console.log(`Rakip hecelerin örneği olma olasılığı (kapsama): %${Math.round(cov * 100)}`);
for (const poolSize of [10, labels.length]) {
    for (const nTrain of [0, 1, 2, 3, 5, 7]) {
        const r = evaluate(nTrain, poolSize, cov);
        console.log(`${String(nTrain).padStart(10)}        | ${String(poolSize).padStart(5)} | ${r.auto.toFixed(1).padStart(10)}%    | ${r.unsure.toFixed(1).padStart(10)}%       | ${r.falseWrong.toFixed(1).padStart(8)}%        | ${r.falseAccept.toFixed(1).padStart(8)}%`);
    }
    console.log('');
}
fs.rmSync(tmp, { recursive: true, force: true });
