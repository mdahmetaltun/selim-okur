const test = require('node:test');
const assert = require('node:assert');
const { fuse } = require('../js/verify.js');

const strong = (best, margin = 0.3) => ({ best, bestDist: 2, margin });
const opts = { target: 'ka', personalCount: 3, personalLabels: 5, intra: 2, speech: true };
const web = (verdict) => ({ verdict, heard: 'x' });

test('web doğru, ses şablonu çelişmiyorsa doğru', () => {
    assert.strictEqual(fuse(web('correct'), null, null, opts).verdict, 'correct');
    assert.strictEqual(fuse(web('correct'), strong('ka'), null, opts).verdict, 'correct');
});

test('web doğru ama Selim\'in sesi başka heceye çok yakınsa belirsiz', () => {
    assert.strictEqual(fuse(web('correct'), strong('ta'), null, opts).verdict, 'uncertain');
});

test('web belirsiz: ses şablonu destekliyorsa doğru, çelişiyorsa yanlış', () => {
    assert.strictEqual(fuse(web('uncertain'), strong('ka'), null, opts).verdict, 'correct');
    assert.strictEqual(fuse(web('uncertain'), strong('ta'), null, opts).verdict, 'wrong');
    assert.strictEqual(fuse(web('uncertain'), null, null, opts).verdict, 'uncertain');
});

test('web yanlış ama kişisel şablon güçlü destekliyorsa doğru', () => {
    assert.strictEqual(fuse(web('wrong'), strong('ka'), null, opts).verdict, 'correct');
    assert.strictEqual(fuse(web('wrong'), null, null, opts).verdict, 'wrong');
});

test('az şablonla kişisel kanıt sayılmaz (sahte güven yok)', () => {
    const few = { ...opts, personalCount: 1 };
    assert.strictEqual(fuse(web('wrong'), strong('ka'), null, few).verdict, 'wrong');
    const fewLabels = { ...opts, personalLabels: 1 };
    assert.strictEqual(fuse(web('uncertain'), strong('ka'), null, fewLabels).verdict, 'uncertain');
});

test('tanıyıcı yok (iPad): şablon yoksa belirsiz, güçlü şablon varsa doğru, sessizse nospeech', () => {
    assert.strictEqual(fuse(null, null, null, opts).verdict, 'uncertain');
    assert.strictEqual(fuse(null, strong('ka'), null, opts).verdict, 'correct');
    assert.strictEqual(fuse(null, null, strong('ka'), opts).verdict, 'uncertain'); // referans tek başına yetmez
    assert.strictEqual(fuse(null, null, null, { ...opts, speech: false }).verdict, 'nospeech');
});
