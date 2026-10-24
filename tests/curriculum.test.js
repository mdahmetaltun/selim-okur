const test = require('node:test');
const assert = require('node:assert');
const C = require('../js/curriculum.js');

test('kelime listesi: her hece tam bir ünlü içerir, harfler sıra içinde', () => {
    C.LEXICON.forEach((w) => {
        w.syllables.forEach((s) => {
            const vowels = [...s].filter(C.isVowel).length;
            assert.strictEqual(vowels, 1, `${w.sequence}: "${s}" hecesinde ${vowels} ünlü var`);
        });
        [...w.sequence].forEach((ch) => assert.ok(C.LETTER_ORDER.includes(ch), `${w.sequence}: bilinmeyen harf ${ch}`));
    });
});

test('harf sırası: 29 benzersiz harf', () => {
    assert.strictEqual(new Set(C.LETTER_ORDER).size, 29);
    assert.strictEqual(C.LETTER_ORDER.slice(0, 12).join(''), 'anetilokurım');
});

test('lettersThrough ve normalizeKnown öneki verir', () => {
    assert.deepStrictEqual(C.lettersThrough('e'), ['a', 'n', 'e']);
    assert.deepStrictEqual(C.normalizeKnown(['a', 'e', 'l', 'm']), C.LETTER_ORDER.slice(0, 12));
    assert.deepStrictEqual(C.normalizeKnown([]), []);
});

test('hece havuzu yalnızca bilinen harfleri kullanır', () => {
    const known = C.lettersThrough('t'); // a n e t
    const pool = C.generateSyllables(known);
    assert.ok(pool.length > 0);
    pool.forEach((s) => [...s.sequence].forEach((ch) => assert.ok(known.includes(ch))));
    assert.ok(pool.some((s) => s.sequence === 'na'));
    assert.ok(pool.some((s) => s.sequence === 'et'));
    assert.ok(pool.some((s) => s.sequence === 'ten' && s.difficulty === 'Medium'));
    assert.ok(!pool.some((s) => s.sequence === 'ka'));
});

test('wordsFor yalnızca bilinen harflerle kurulabilen kelimeleri verir', () => {
    const known = C.lettersThrough('t');
    const words = C.wordsFor(known);
    assert.ok(words.some((w) => w.sequence === 'ana'));
    assert.ok(words.some((w) => w.sequence === 'tane'));
    words.forEach((w) => [...w.sequence].forEach((ch) => assert.ok(known.includes(ch))));
    assert.ok(!words.some((w) => w.sequence === 'kalem'));
    C.wordsFor(known, { minSyllables: 2 }).forEach((w) => assert.ok(w.syllables.length >= 2));
});

test('pickSyllable: kolaylar önce, yeni harf ağırlıklı, istisna hariç', () => {
    const pool = C.generateSyllables(C.lettersThrough('t'));
    const picked = new Set();
    for (let i = 0; i < 200; i++) picked.add(C.pickSyllable(pool, { focusLetter: 't' }).difficulty);
    assert.deepStrictEqual([...picked], ['Simple']);
    const first = pool[0];
    for (let i = 0; i < 50; i++) assert.notStrictEqual(C.pickSyllable(pool, { exclude: first }).id, first.id);
    assert.strictEqual(C.pickSyllable([], {}), null);
});
