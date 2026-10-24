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

test('tek örnekle daha temkinli: büyük fark ister, küçük farkta kanıt yok', () => {
    const one = { ...opts, personalCount: 1, intra: null };
    assert.strictEqual(fuse(web('wrong'), strong('ka', 0.3), null, one).verdict, 'correct');
    assert.strictEqual(fuse(web('wrong'), strong('ka', 0.12), null, one).verdict, 'wrong');
    const fewLabels = { ...opts, personalLabels: 1 };
    assert.strictEqual(fuse(web('uncertain'), strong('ka'), null, fewLabels).verdict, 'uncertain');
    assert.strictEqual(fuse(web('wrong'), strong('ka'), null, { ...opts, personalCount: 0 }).verdict, 'wrong');
});

test('güvenlik: rakip hecelerin örneği yoksa Selim\'in sesi "doğru" diyemez', () => {
    assert.strictEqual(fuse(web('wrong'), strong('ka'), null, { ...opts, rivals: 1 }).verdict, 'wrong');
    assert.strictEqual(fuse(web('wrong'), strong('ka'), null, { ...opts, rivals: 2 }).verdict, 'correct');
});

test('güvenlik: hedefe "en yakın" olsa da çok uzaksa (kişinin tipik değişkenliğine göre) kanıt sayılmaz', () => {
    const far = { best: 'ka', bestDist: 3.4, margin: 0.4 };
    assert.strictEqual(fuse(web('uncertain'), far, null, { ...opts, intra: null, typical: 0.9 }).verdict, 'uncertain');
    const near = { best: 'ka', bestDist: 1.4, margin: 0.4 };
    assert.strictEqual(fuse(web('uncertain'), near, null, { ...opts, intra: null, typical: 0.9 }).verdict, 'correct');
    // kişinin tekrarları daha değişkense kapı genişler
    assert.strictEqual(fuse(web('uncertain'), far, null, { ...opts, intra: null, typical: 1.6 }).verdict, 'correct');
});

test('tanıyıcı yok (iPad): şablon yoksa belirsiz, güçlü şablon varsa doğru, sessizse nospeech', () => {
    assert.strictEqual(fuse(null, null, null, opts).verdict, 'uncertain');
    assert.strictEqual(fuse(null, strong('ka'), null, opts).verdict, 'correct');
    assert.strictEqual(fuse(null, null, strong('ka'), opts).verdict, 'uncertain'); // referans tek başına yetmez
    assert.strictEqual(fuse(null, null, null, { ...opts, speech: false }).verdict, 'nospeech');
});
