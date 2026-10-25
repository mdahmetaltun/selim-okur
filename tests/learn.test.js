const test = require('node:test');
const assert = require('node:assert');
const createLearned = require('../js/learn.js');
const { normalize } = require('../js/judge.js');

const memStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
const make = (storage = memStorage()) => ({ L: createLearned({ storage, normalize }), storage });

test('veli doğru dediğinde tanıyıcının hatası takma ad olur ve sonra kabul edilir', () => {
    const { L } = make();
    assert.strictEqual(L.check('hece/ka', ['kah'], ['hece/ta']), null);
    assert.ok(L.confirm('hece/ka', 'ka', ['kah', 'kak']));
    assert.strictEqual(L.check('hece/ka', ['Kah!'], ['hece/ta']), 'accept');
    assert.strictEqual(L.check('hece/ka', ['kah bir şey'], ['hece/ta']), 'accept'); // sözcük bazlı
    assert.strictEqual(L.check('hece/ka', ['ta'], ['hece/ta']), null);
});

test('hedefin kendisi takma ad olarak öğrenilmez', () => {
    const { L } = make();
    assert.strictEqual(L.confirm('hece/ka', 'ka', ['ka']), false);
    assert.strictEqual(L.stats().aliases, 0);
});

test('aynı metin başka bir heceye daha çok aitse kabul edilmez (çatışma)', () => {
    const { L } = make();
    L.confirm('hece/ka', 'ka', ['ha']);
    L.confirm('hece/ta', 'ta', ['ha']);
    L.confirm('hece/ta', 'ta', ['ha']);
    assert.strictEqual(L.check('hece/ka', ['ha'], ['hece/ta']), null);
    assert.strictEqual(L.check('hece/ta', ['ha'], ['hece/ka']), 'accept');
});

test('veli reddettiği metni sonradan sorgulatır, ama takma adı etkilemez', () => {
    const { L } = make();
    L.reject('hece/ka', 'ka', ['ga']);
    assert.strictEqual(L.check('hece/ka', ['ga'], []), 'reject');
    L.confirm('hece/ka', 'ka', ['ga']);
    assert.strictEqual(L.check('hece/ka', ['ga'], []), 'accept');
    assert.strictEqual(L.reject('hece/ka', 'ka', ['ka']), false);
});

test('kalıcıdır: yeni örnek aynı depodan okur; clear siler', () => {
    const { L, storage } = make();
    L.confirm('hece/ka', 'ka', ['kah']);
    const L2 = createLearned({ storage, normalize });
    assert.strictEqual(L2.check('hece/ka', ['kah'], []), 'accept');
    L2.clear();
    assert.strictEqual(createLearned({ storage, normalize }).check('hece/ka', ['kah'], []), null);
    assert.doesNotThrow(() => createLearned({ storage: { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } }, normalize }));
});

test('replace: yedekten yüklenen öğrenilenler geçerli olur', () => {
    const { L } = make();
    L.replace({ alias: { 'hece/ka': { kah: 3 } }, reject: {} });
    assert.strictEqual(L.check('hece/ka', ['kah'], []), 'accept');
    L.replace(null);
    assert.strictEqual(L.check('hece/ka', ['kah'], []), null);
});
