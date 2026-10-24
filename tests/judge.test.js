const test = require('node:test');
const assert = require('node:assert');
const { judge, normalize } = require('../js/judge.js');
const C = require('../js/curriculum.js');

const pool = C.generateSyllables(C.lettersThrough('k')).map((s) => s.sequence); // a n e t i l o k

const verdict = (target, heard) => judge(target, heard, pool).verdict;

test('normalize: büyük harf, noktalama, uzatma', () => {
    assert.strictEqual(normalize('Kaaa!'), 'ka');
    assert.strictEqual(normalize('  İL. '), 'il');
});

test('tam ve uzatılmış okuma doğru', () => {
    assert.strictEqual(verdict('ka', ['ka']), 'correct');
    assert.strictEqual(verdict('el', ['eeel']), 'correct');
    assert.strictEqual(verdict('ka', ['Ka ka ka']), 'correct');
});

test('alternatiflerden biri hedefse doğru', () => {
    assert.strictEqual(verdict('ka', ['kale', 'ka']), 'correct');
});

test('komşu heceyle karışan ve soluk artıklı okuma', () => {
    assert.strictEqual(verdict('ka', ['kah']), 'correct');
    assert.strictEqual(verdict('ka', ['ke']), 'wrong');
    assert.strictEqual(verdict('ta', ['na']), 'wrong');
});

test('havuzdaki başka heceye daha yakınsa belirsiz (veliye sor)', () => {
    // hedef "ti", duyulan "ki": t/k ikamesi, havuzda "ki" tam eşleşir
    assert.notStrictEqual(verdict('ti', ['ki']), 'correct');
});

test('ses yoksa nospeech', () => {
    assert.strictEqual(verdict('ka', []), 'nospeech');
    assert.strictEqual(verdict('ka', ['', '  ']), 'nospeech');
});

test('alakasız kelime yanlış', () => {
    assert.strictEqual(verdict('ka', ['merhaba']), 'wrong');
});
