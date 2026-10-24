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

const letterSet = (items) => new Set(items.flatMap((i) => [...C.fold(i.text).replace(/[^a-zçğıöşü]/g, '')]));

test('baştan ilerle: ilk adım en baştaki harflerle (a, n), sonraki adım bir harf ekler', () => {
    const known = C.lettersThrough('k'); // a n e t i l o k
    const p = C.buildPath(known, { from: 0, steps: 2 });
    assert.strictEqual(p.total, 7);
    assert.deepStrictEqual([p.from, p.to], [0, 2]);
    const first = p.items.filter((i) => i.chapter === 'a n');
    assert.ok(first.some((i) => i.kind === 'ses' && i.text === 'a'), 'a sesi');
    assert.ok(first.some((i) => i.kind === 'ses' && i.text === 'n'), 'n sesi');
    assert.ok([...letterSet(first)].every((l) => 'an'.includes(l)), 'ilk adımda yalnızca a ve n');
    const second = p.items.filter((i) => i.chapter === '+e');
    assert.ok(second.some((i) => i.kind === 'ses' && i.text === 'e'));
    assert.ok([...letterSet(second)].every((l) => 'ane'.includes(l)), 'ikinci adımda yalnızca a, n, e');
    assert.ok(second.some((i) => i.kind === 'hece' && i.text.includes('e')));
});

test('baştan ilerle: tüm adımlar bilinen her harfi kapsar ve tekrar eden öğe yok', () => {
    const known = C.lettersThrough('k');
    const seen = new Set();
    let from = 0, guard = 0;
    while (guard++ < 10) {
        const p = C.buildPath(known, { from, steps: 2 });
        p.items.forEach((i) => seen.add(i.key));
        p.letters.forEach((l) => seen.add(`odak/${l}`));
        if (p.to >= p.total) break;
        from = p.to;
    }
    known.slice(1).forEach((l) => assert.ok(seen.has(`odak/${l}`), `${l} için adım yok`));
    known.forEach((l) => assert.ok(seen.has(`ses/${l}`), `${l} sesi çalışılmıyor`));
    const keys = C.buildPath(known, { from: 0, steps: 7 }).items.map((i) => i.key);
    assert.strictEqual(new Set(keys).size, keys.length);
});

test('baştan ilerle: bitince başa sarar, tek harf ya da boşta boş döner', () => {
    const known = C.lettersThrough('t');
    assert.strictEqual(C.buildPath(known, { from: 99 }).from, 0);
    assert.strictEqual(C.buildPath(['a']).items.length, 0);
    assert.strictEqual(C.buildPath([]).total, 0);
});

test('karışık tekrar: yalnızca bilinen harfler, baştaki harfler de gelir', () => {
    const known = C.lettersThrough('k');
    const all = new Set();
    for (let i = 0; i < 30; i++) {
        const m = C.buildMixed(known);
        letterSet(m).forEach((l) => { assert.ok(known.includes(l), l); all.add(l); });
    }
    assert.ok(all.has('a') && all.has('n'), 'başlangıç harfleri de çalışılmalı');
});

test('seçtiğim harfler: sesli+sessiz seçilirse heceler yalnızca o harflerden', () => {
    const known = C.lettersThrough('k');
    const f = C.buildFocus(known, ['k', 'a']);
    const syl = f.filter((i) => i.kind === 'hece');
    assert.ok(syl.length >= 2);
    syl.forEach((i) => assert.ok([...i.text].every((l) => 'ka'.includes(l)), i.text));
    assert.ok(syl.some((i) => i.text === 'ka') && syl.some((i) => i.text === 'ak'));
    assert.deepStrictEqual(f.filter((i) => i.kind === 'ses').map((i) => i.text).sort(), ['a', 'k']);
    f.filter((i) => i.kind === 'kelime').forEach((i) => assert.ok(/[ka]/.test(i.text)));
});

test('seçtiğim harfler: yalnızca sessiz seçilirse bilinen seslilerle birleşir', () => {
    const known = C.lettersThrough('k');
    const syl = C.buildFocus(known, ['l']).filter((i) => i.kind === 'hece');
    syl.forEach((i) => assert.ok(i.text.includes('l'), i.text));
    assert.ok(new Set(syl.map((i) => i.text.replace('l', ''))).size > 2, 'farklı ünlülerle');
});

test('seçtiğim harfler: bilinmeyen harf yok sayılır, hiç seçim yoksa boş', () => {
    const known = C.lettersThrough('t');
    assert.strictEqual(C.buildFocus(known, ['k']).length, 0);
    assert.strictEqual(C.buildFocus(known, []).length, 0);
    assert.deepStrictEqual(C.buildFocus(known, ['k', 'n']).filter((i) => i.kind === 'ses').map((i) => i.text), ['n']);
});
