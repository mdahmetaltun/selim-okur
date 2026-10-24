const test = require('node:test');
const assert = require('node:assert');
const createTemplates = require('../js/templates.js');
const DSP = require('../js/dsp.js');

const RATE = 16000;
function tone(f0, f1, ms = 400) {
    const n = Math.floor((RATE * ms) / 1000), pad = Math.floor(RATE * 0.2);
    const x = new Float32Array(n + pad * 2);
    let ph = 0;
    for (let i = 0; i < n; i++) { ph += (2 * Math.PI * (f0 + ((f1 - f0) * i) / n)) / RATE; x[pad + i] = 0.4 * Math.sin(ph) * Math.min(1, i / 400, (n - i) / 400); }
    return x;
}
const feat = (f0, f1, ms) => DSP.features(tone(f0, f1, ms), RATE);

const memStore = () => {
    const m = new Map();
    return { allTemplates: async () => [...m].map(([label, feats]) => ({ label, feats })), putTemplates: async (l, f) => { m.set(l, f); }, delTemplates: async (l) => { m.delete(l); }, clearTemplates: async () => m.clear(), m };
};

test('en çok 8 örnek tutulur ve en çeşitli olanlar kalır', async () => {
    const T = createTemplates({ store: memStore(), dsp: DSP, max: 4 });
    const distinct = [feat(300, 900), feat(900, 300), feat(300, 300), feat(900, 900)];
    for (const f of distinct) await T.add('hece/ka', f);
    for (let i = 0; i < 6; i++) await T.add('hece/ka', feat(300, 900, 400 + i)); // neredeyse aynı tekrarlar
    assert.strictEqual(T.count('hece/ka'), 4);
    const kept = T.dictFor(['hece/ka'])['hece/ka'];
    // farklı üç şekil (azalan, sabit-düşük, sabit-yüksek) hâlâ temsil ediliyor
    const rs = ['down', 'low', 'high'].map((_, i) => [feat(900, 300), feat(300, 300), feat(900, 900)][i]);
    rs.forEach((r) => assert.ok(Math.min(...kept.map((k) => DSP.dtw(r, k))) < 0.5, 'çeşit kayboldu'));
});

test('çok kısa kayıt eklenmez, remove ve counts çalışır, kalıcıdır', async () => {
    const store = memStore();
    const T = createTemplates({ store, dsp: DSP });
    assert.strictEqual(await T.add('hece/ka', []), false);
    const f = feat(300, 900);
    assert.strictEqual(await T.add('hece/ka', f), true);
    await T.add('hece/ta', feat(900, 300));
    assert.deepStrictEqual(T.counts(), { 'hece/ka': 1, 'hece/ta': 1 });
    assert.strictEqual(await T.remove('hece/ka', f), true);
    assert.strictEqual(T.count('hece/ka'), 0);
    assert.strictEqual(await T.remove('hece/ka', f), false);
    const T2 = createTemplates({ store, dsp: DSP });
    await T2.load();
    assert.deepStrictEqual(T2.labels(), ['hece/ta']);
    await T2.clear();
    assert.strictEqual(T2.total(), 0);
});

test('intra: tek örnekte null, iki örnekte aralarındaki mesafe', async () => {
    const T = createTemplates({ store: memStore(), dsp: DSP });
    await T.add('x', feat(300, 900));
    assert.strictEqual(T.intra('x'), null);
    await T.add('x', feat(310, 880, 430));
    assert.ok(T.intra('x') > 0);
});
