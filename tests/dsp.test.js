const test = require('node:test');
const assert = require('node:assert');
const DSP = require('../js/dsp.js');

const RATE = 16000;
// Sentetik "heceler": iki farklı formant geçişi + sessizlik payı
function tone(f0, f1, ms = 400, rate = RATE) {
    const n = Math.floor((rate * ms) / 1000), pad = Math.floor(rate * 0.2);
    const x = new Float32Array(n + pad * 2);
    let ph = 0;
    for (let i = 0; i < n; i++) {
        const f = f0 + ((f1 - f0) * i) / n;
        ph += (2 * Math.PI * f) / rate;
        x[pad + i] = 0.4 * Math.sin(ph) * Math.min(1, i / 400, (n - i) / 400);
    }
    return x;
}

test('resample ve trimSilence', () => {
    const x = tone(300, 300);
    assert.strictEqual(DSP.resample(x, RATE).length, x.length);
    assert.ok(DSP.resample(x, 48000).length < x.length);
    const t = DSP.trimSilence(x);
    assert.ok(t.length < x.length && t.length > RATE * 0.35);
    assert.strictEqual(DSP.trimSilence(new Float32Array(8000)).length, 0);
});

test('features: sessiz kayıt boş, ton dolu', () => {
    assert.strictEqual(DSP.features(new Float32Array(16000), RATE).length, 0);
    const f = DSP.features(tone(300, 900), RATE);
    assert.ok(f.length > 20);
    assert.strictEqual(f[0].length, 12);
});

test('dtw: aynı kayıt 0, farklı ses daha uzak, hız farkına dayanıklı', () => {
    const a = DSP.features(tone(300, 900), RATE);
    const aSlow = DSP.features(tone(300, 900, 520), RATE);
    const b = DSP.features(tone(900, 300), RATE);
    assert.ok(DSP.dtw(a, a) < 1e-6);
    assert.ok(DSP.dtw(a, aSlow) < DSP.dtw(a, b));
});

test('classify: doğru etiketi bulur ve margin verir', () => {
    const t = { up: [DSP.features(tone(300, 900), RATE)], down: [DSP.features(tone(900, 300), RATE)] };
    const r = DSP.classify(DSP.features(tone(320, 880, 450), RATE), t);
    assert.strictEqual(r.best, 'up');
    assert.ok(r.margin > 0.1);
    assert.strictEqual(DSP.classify(DSP.features(tone(300, 900), RATE), {}), null);
});
