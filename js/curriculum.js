/**
 * Müfredat: harf sırası, hece havuzu ve kelime listesi.
 * Hem tarayıcıda (window.Curriculum) hem Node testlerinde (require) çalışır.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Curriculum = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    const TR = 'tr-TR';

    // Selim'in ders kitabındaki sıra (ilk 12 harf veliden alındı).
    // Kalan harflerin sırası TAHMİNİDİR: kitaptan teyit edilip güncellenmeli.
    const LETTER_ORDER = [
        'a', 'n', 'e', 't', 'i', 'l', 'o', 'k', 'u', 'r', 'ı', 'm',
        'ö', 'ü', 'd', 'y', 's', 'b', 'ş', 'z', 'ç', 'c', 'g', 'ğ', 'h', 'j', 'f', 'v', 'p'
    ];
    const VOWELS = ['a', 'e', 'ı', 'i', 'o', 'ö', 'u', 'ü'];

    const isVowel = (ch) => VOWELS.includes(ch.toLocaleLowerCase(TR));
    const isConsonant = (ch) => {
        const c = ch.toLocaleLowerCase(TR);
        return LETTER_ORDER.includes(c) && !VOWELS.includes(c);
    };

    // Hecelere ayrılmış kelimeler ("-" hece sınırı). Her kelime yalnızca
    // LETTER_ORDER'ın ilk harflerini kullanır; gereken aşama otomatik hesaplanır.
    const RAW_WORDS = [
        'a-na', 'an', 'al', 'el', 'et', 'ek', 'en', 'ol', 'ot', 'at', 'ok', 'ak', 'ik', 'il', 'im', 'ar', 'er', 'or',
        'an-ne', 'a-ta', 'na-ne', 'ta-ne', 'ten', 'tan', 'ni-ne', 'i-nat', 'i-le', 'e-le', 'la-le', 'tel', 'a-let',
        'at-let', 'an-lat', 'i-lan', 'a-lan', 'e-lin', 'o-tel', 'o-to', 'ton', 'not', 'o-lan', 'kol', 'kal', 'ka-le',
        'kan', 'kat', 'ki-lo', 'kek', 'ka-nat', 'e-lek', 'ek-le', 'lo-kan-ta', 'i-nek', 'til-ki', 'ki-lit', 'ka-nal',
        'ku-tu', 'ko-ku', 'ku-lak', 'tu-na', 'u-nut', 'o-kul', 'ko-nu', 'ka-ra', 'ka-re', 'tar-la', 'ro-ta', 'tur',
        'nar', 'or-ta', 'ar-ka', 'kurt', 'tek-rar', 'tur-na', 'ku-rak', 'kor-ku', 'ek-ran', 'li-ra', 'a-rı', 'kır',
        'kırk', 'ı-lık', 'al-tı', 'ka-lın', 'ı-rak', 'tır-nak', 'a-nı', 'kıt-lık', 'a-ma', 'ma-ma', 'mum', 'man-tı',
        'kum', 'tam', 'ka-lem', 'el-ma', 'me-tin', 'ma-ki-ne', 'mor', 'mo-la', 'ke-mer', 'an-lam', 'ek-mek', 'ta-mam',
        'mut-lu', 'me-mur', 'mo-tor', 'li-mon', 'ma-rul', 'man-tar', 'or-man', 'me-lek', 'mar-ka', 'mem-le-ket',
        'e-mek', 'ko-mik', 'a-tom'
    ];

    // Kısa cümleler (yalnızca bilinen harflerle okunabilen olanlar derse girer).
    const RAW_SENTENCES = [
        'Ela anlat.', 'Ali anlat.', 'Anne mutlu.', 'Ona kalem al.', 'Anne kalem al.', 'Anne ekmek al.',
        'Anne lale al.', 'Ali kutu al.', 'Tuna kutu al.', 'Nur motor al.', 'Kemal limon al.',
        'Anne mantı al.', 'Kuru ot ak.', 'Ali okula kalem al.', 'Tuna oku.', 'Ela tane al.'
    ];

    function fold(s) { return s.toLocaleLowerCase(TR); }

    function stageOf(text) {
        let stage = 0;
        [...fold(text).replace(/[^a-zçğıöşü]/g, '')].forEach((l) => { stage = Math.max(stage, LETTER_ORDER.indexOf(l) + 1); });
        return stage;
    }

    const SENTENCES = RAW_SENTENCES.map((text) => ({
        text,
        words: text.replace(/[.!?,]/g, '').split(/\s+/),
        stage: stageOf(text)
    }));

    const LEXICON = RAW_WORDS.map((raw) => {
        const parts = raw.split('-');
        const sequence = parts.join('');
        const letters = new Set(sequence);
        let stage = 0;
        letters.forEach((l) => { stage = Math.max(stage, LETTER_ORDER.indexOf(l) + 1); });
        return { sequence, syllables: parts, stage };
    });

    /** Sıranın başından `letter`e kadar olan harfler (letter dahil). */
    function lettersThrough(letter) {
        const idx = LETTER_ORDER.indexOf(fold(letter));
        return idx < 0 ? [] : LETTER_ORDER.slice(0, idx + 1);
    }

    /** Herhangi bir harf listesinden, en ileri harfe kadar olan öneki döndürür. */
    function normalizeKnown(letters) {
        let max = -1;
        (letters || []).forEach((l) => { max = Math.max(max, LETTER_ORDER.indexOf(fold(l))); });
        return LETTER_ORDER.slice(0, max + 1);
    }

    /** Bilinen harflerden hece havuzu: V, CV, VC (kolay) ve CVC (orta). */
    function generateSyllables(knownLetters) {
        const known = normalizeKnown(knownLetters);
        const vowels = known.filter(isVowel);
        const consonants = known.filter(isConsonant);
        const out = [];
        const add = (type, seq, difficulty) => out.push({
            id: `${type}_${seq}`, sequence: seq, type, difficulty, isMastered: false, attemptCount: 0
        });
        vowels.forEach((v) => add('V', v, 'Simple'));
        consonants.forEach((c) => vowels.forEach((v) => add('CV', c + v, 'Simple')));
        vowels.forEach((v) => consonants.forEach((c) => add('VC', v + c, 'Simple')));
        consonants.forEach((c1) => vowels.forEach((v) => consonants.forEach((c2) => add('CVC', c1 + v + c2, 'Medium'))));
        return out;
    }

    /**
     * Sıradaki heceyi seç: önce öğrenilmemişler, önce kolaylar; en son öğrenilen
     * harfi içeren heceler 3 kat sık gelir (yeni harf pekişsin).
     */
    function pickSyllable(pool, { focusLetter, rng = Math.random, exclude } = {}) {
        if (!pool || pool.length === 0) return null;
        let cands = pool.filter((s) => !s.isMastered);
        if (cands.length === 0) cands = pool;
        const simple = cands.filter((s) => s.difficulty === 'Simple');
        if (simple.length > 0) cands = simple;
        if (exclude && cands.length > 1) cands = cands.filter((s) => s.id !== exclude.id);
        const weights = cands.map((s) => (focusLetter && s.sequence.includes(focusLetter) ? 3 : 1));
        let r = rng() * weights.reduce((a, b) => a + b, 0);
        for (let i = 0; i < cands.length; i++) {
            r -= weights[i];
            if (r <= 0) return cands[i];
        }
        return cands[cands.length - 1];
    }

    /** Bilinen harflerle okunabilen kelimeler. */
    function wordsFor(knownLetters, { minSyllables = 1 } = {}) {
        const known = normalizeKnown(knownLetters);
        const stage = known.length;
        return LEXICON.filter((w) => w.stage <= stage && w.syllables.length >= minSyllables);
    }

    /** Bilinen harflerle okunabilen cümleler. */
    function sentencesFor(knownLetters) {
        const stage = normalizeKnown(knownLetters).length;
        return SENTENCES.filter((x) => x.stage <= stage);
    }

    function shuffle(arr, rng) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    /**
     * Ses temelli cümle yöntemi akışı: yeni harfin sesi -> hece -> kelime -> cümle.
     * Her öğe: { kind, text, units, key } ; key ses dosyası/kayıt anahtarıdır.
     */
    function buildLesson(knownLetters, { rng = Math.random, counts = {} } = {}) {
        const known = normalizeKnown(knownLetters);
        if (known.length === 0) return [];
        const n = { ses: 1, hece: 8, kelime: 6, cumle: 3, ...counts };
        const focus = known[known.length - 1];
        const items = [];

        items.push({ kind: 'ses', text: focus, units: [focus], key: `ses/${focus}` });

        const pool = generateSyllables(known).filter((s) => s.difficulty === 'Simple' && s.type !== 'V');
        const withFocus = shuffle(pool.filter((s) => s.sequence.includes(focus)), rng);
        const review = shuffle(pool.filter((s) => !s.sequence.includes(focus)), rng);
        const syl = withFocus.slice(0, Math.ceil(n.hece * 0.65)).concat(review).slice(0, n.hece);
        shuffle(syl, rng).forEach((s) => items.push({ kind: 'hece', text: s.sequence, units: [s.sequence], key: `hece/${s.sequence}` }));

        const words = wordsFor(known);
        const wFocus = shuffle(words.filter((w) => w.sequence.includes(focus)), rng);
        const wRest = shuffle(words.filter((w) => !w.sequence.includes(focus)), rng);
        wFocus.concat(wRest).slice(0, n.kelime).forEach((w) =>
            items.push({ kind: 'kelime', text: w.sequence, units: w.syllables, key: `kelime/${w.sequence}` }));

        const sents = sentencesFor(known);
        const sFocus = shuffle(sents.filter((x) => x.text.toLocaleLowerCase(TR).includes(focus)), rng);
        const sRest = shuffle(sents.filter((x) => !x.text.toLocaleLowerCase(TR).includes(focus)), rng);
        sFocus.concat(sRest).slice(0, n.cumle).forEach((x) =>
            items.push({ kind: 'cumle', text: x.text, units: x.words, key: `cumle/${slug(x.text)}` }));
        return items;
    }

    function slug(text) {
        return fold(text).replace(/[.!?,]/g, '').trim().replace(/\s+/g, '_');
    }

    return { LETTER_ORDER, VOWELS, LEXICON, SENTENCES, sentencesFor, buildLesson, slug, stageOf, fold, isVowel, isConsonant, lettersThrough, normalizeKnown, generateSyllables, pickSyllable, wordsFor };
});
