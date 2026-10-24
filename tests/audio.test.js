const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../js/curriculum.js');

const root = path.join(__dirname, '..', 'audio');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const keys = new Set(manifest.keys);

test('manifest ile dosyalar eşleşir', () => {
    manifest.keys.forEach((k) => assert.ok(fs.existsSync(path.join(root, `${k}.mp3`)), `${k} dosyası yok`));
});

test('müfredattaki her harf sesi, kelime ve cümle için ses dosyası var', () => {
    C.LETTER_ORDER.forEach((l) => assert.ok(keys.has(`ses/${l}`), `ses/${l}`));
    C.LEXICON.forEach((w) => assert.ok(keys.has(`kelime/${w.sequence}`), `kelime/${w.sequence}`));
    C.SENTENCES.forEach((s) => assert.ok(keys.has(`cumle/${C.slug(s.text)}`), `cumle/${C.slug(s.text)}`));
});

test('ders öğelerinin (ilk 12 harf) hepsinin sesi var', () => {
    for (let n = 2; n <= 12; n++) {
        const lesson = C.buildLesson(C.LETTER_ORDER.slice(0, n), { counts: { hece: 99, kelime: 99, cumle: 99 } });
        lesson.forEach((i) => assert.ok(keys.has(i.key), `${n} harf: ${i.key} yok`));
    }
});
