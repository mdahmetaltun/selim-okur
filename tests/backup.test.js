const test = require('node:test');
const assert = require('node:assert');
const Backup = require('../js/backup.js');

const feat = (n, d, seed = 1) => Array.from({ length: n }, (_, i) => Float32Array.from({ length: d }, (_, j) => Math.sin(i * 0.3 + j + seed) * 3));

test('özellik paketleme: gidiş-dönüş hatası çok küçük', () => {
    const f = feat(60, 12);
    const back = Backup.unpackFeats(Backup.packFeats(f));
    assert.strictEqual(back.length, 60);
    assert.strictEqual(back[0].length, 12);
    let maxErr = 0;
    f.forEach((row, i) => row.forEach((v, j) => { maxErr = Math.max(maxErr, Math.abs(v - back[i][j])); }));
    assert.ok(maxErr < 0.0005, `hata ${maxErr}`);
});

test('boş özellik listesi paketlenir', () => {
    assert.deepStrictEqual(Backup.unpackFeats(Backup.packFeats([])), []);
});

test('build -> parse: durum, öğrenilenler, şablonlar ve veli kayıtları korunur', () => {
    const parts = {
        state: { knownLetters: ['a', 'n', 'e'], score: 40 },
        learned: { alias: { 'hece/ka': { kah: 2 } }, reject: {} },
        templates: { 'hece/ka': [feat(40, 12, 1), feat(45, 12, 2)], 'ses/a': [feat(30, 12, 3)] },
        voices: [{ key: 'ses/a', type: 'audio/mp4', data: 'AAAA' }]
    };
    const text = JSON.stringify(Backup.build(parts));
    const got = Backup.parse(text);
    assert.deepStrictEqual(got.state, parts.state);
    assert.deepStrictEqual(got.learned, parts.learned);
    assert.strictEqual(got.templates['hece/ka'].length, 2);
    assert.strictEqual(got.templates['hece/ka'][1].length, 45);
    assert.deepStrictEqual(got.voices, parts.voices);
    assert.ok(text.length < 40000, 'yedek makul boyutta');
});

test('geçersiz dosyalar anlaşılır hata verir', () => {
    assert.throws(() => Backup.parse('bu json değil'), /okunamadı/);
    assert.throws(() => Backup.parse('{"a":1}'), /yedeği değil/);
    assert.throws(() => Backup.parse(JSON.stringify({ app: 'selim-okur', v: 99 })), /daha yeni/);
});
