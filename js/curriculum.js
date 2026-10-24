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

    function fold(s) { return s.toLocaleLowerCase(TR); }

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

    return { LETTER_ORDER, VOWELS, LEXICON, isVowel, isConsonant, lettersThrough, normalizeKnown, generateSyllables, pickSyllable, wordsFor };
});
