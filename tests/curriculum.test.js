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

test('cümleler: tüm sözcükler ünlü içerir ve harfler sıra içinde', () => {
    C.SENTENCES.forEach((s) => {
        assert.ok(s.stage > 0 && s.stage <= 29);
        s.words.forEach((w) => assert.ok([...w.toLocaleLowerCase('tr-TR')].some(C.isVowel), s.text));
    });
    const early = C.sentencesFor(C.lettersThrough('t'));
    early.forEach((s) => assert.ok(s.stage <= 4));
});

test('buildLesson: ses -> hece -> kelime -> cümle sırası ve yalnızca bilinen harfler', () => {
    const known = C.lettersThrough('m');
    const lesson = C.buildLesson(known);
    const kinds = lesson.map((i) => i.kind);
    assert.strictEqual(kinds[0], 'ses');
    assert.strictEqual(lesson[0].text, 'm');
    const order = ['ses', 'hece', 'kelime', 'cumle'];
    for (let i = 1; i < kinds.length; i++) assert.ok(order.indexOf(kinds[i]) >= order.indexOf(kinds[i - 1]));
    lesson.forEach((i) => [...C.fold(i.text).replace(/[^a-zçğıöşü]/g, '')]
        .forEach((ch) => assert.ok(known.includes(ch), `${i.text}: ${ch}`)));
    assert.ok(lesson.filter((i) => i.kind === 'hece').length > 0);
    assert.ok(lesson.some((i) => i.kind === 'cumle'));
    assert.strictEqual(C.buildLesson([]).length, 0);
});

test('erken derste (a n) yalnızca hece ve kelime vardır, hata vermez', () => {
    const lesson = C.buildLesson(C.lettersThrough('n'));
    assert.ok(lesson.length >= 2);
    assert.ok(lesson.every((i) => ['ses', 'hece', 'kelime', 'cumle'].includes(i.kind)));
});
