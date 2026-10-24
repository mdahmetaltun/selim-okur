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
        return syllablesFrom(normalizeKnown(knownLetters));
    }

    /** Verilen harf kümesinden (önek olmak zorunda değil) hece havuzu. */
    function syllablesFrom(letters) {
        const vowels = letters.filter(isVowel);
        const consonants = letters.filter(isConsonant);
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

    const item = (kind, text, units, chapter) => ({ kind, text, units, key: `${kind === 'cumle' ? 'cumle' : kind}/${kind === 'cumle' ? slug(text) : text}`, chapter });
    const sylItem = (s, chapter) => item('hece', s.sequence, [s.sequence], chapter);
    const wordItem = (w, chapter) => item('kelime', w.sequence, w.syllables, chapter);
    const sentItem = (x, chapter) => item('cumle', x.text, x.words, chapter);
    const KIND_ORDER = ['ses', 'hece', 'kelime', 'cumle'];
    const KIND_CHAPTER = { ses: 'Ses', hece: 'Hece', kelime: 'Kelime', cumle: 'Cümle' };
    const has = (text, letter) => fold(text).includes(letter);

    /**
     * Bir "adım": prefix harfleriyle, odak harfi vurgulayan küçük ders.
     * ses (odak) -> hece (çoğu odaklı, biraz tekrar) -> kelime -> cümle.
     */
    function stepItems(prefix, focus, { rng = Math.random, counts = {}, used = new Set(), extraSes = [], chapter } = {}) {
        const n = { hece: 6, kelime: 3, cumle: 1, ...counts };
        const out = [];
        const push = (it) => { if (!used.has(it.key)) { used.add(it.key); out.push(it); } };
        [...extraSes, focus].forEach((l) => push(item('ses', l, [l], chapter)));

        const pool = syllablesFrom(prefix).filter((x) => x.difficulty === 'Simple' && x.type !== 'V');
        const withFocus = shuffle(pool.filter((x) => has(x.sequence, focus)), rng);
        const review = shuffle(pool.filter((x) => !has(x.sequence, focus)), rng);
        const nFocus = Math.min(withFocus.length, Math.ceil(n.hece * 0.7));
        shuffle(withFocus.slice(0, nFocus).concat(review.slice(0, n.hece - nFocus)), rng).forEach((x) => push(sylItem(x, chapter)));

        const words = wordsFor(prefix);
        const wFocus = shuffle(words.filter((w) => has(w.sequence, focus)), rng);
        const wRest = shuffle(words.filter((w) => !has(w.sequence, focus)), rng);
        wFocus.concat(wRest).slice(0, n.kelime).forEach((w) => push(wordItem(w, chapter)));

        const sFocus = shuffle(sentencesFor(prefix).filter((x) => has(x.text, focus)), rng);
        sFocus.slice(0, n.cumle).forEach((x) => push(sentItem(x, chapter)));
        return out;
    }

    /** Geriye dönük uyumluluk: son harfe odaklı tek adımlık ders. */
    function buildLesson(knownLetters, { rng = Math.random, counts = {} } = {}) {
        const known = normalizeKnown(knownLetters);
        if (known.length === 0) return [];
        const n = { hece: 8, kelime: 6, cumle: 3, ...counts };
        return stepItems(known, known[known.length - 1], { rng, counts: n });
    }

    /** "Baştan ilerle" yolundaki adım sayısı: ilk iki harften sonra her harf bir adım. */
    const pathSteps = (knownLetters) => Math.max(0, normalizeKnown(knownLetters).length - 1);

    /**
     * Baştan ilerle: ilk adım ilk iki harfi birlikte (örn. a + n) öğretir, sonraki her adım
     * bilinen sıradaki bir sonraki harfi ekler. Her adımda önceki harfler tekrar edilir.
     * @param {number} from  kaçıncı adımdan başlanacağı (0'dan)
     * @param {number} steps bu oturumda kaç adım
     * @returns {{items, from, to, total, letters}} to: oturumdan sonraki adım numarası
     */
    function buildPath(knownLetters, { from = 0, steps = 2, rng = Math.random, counts } = {}) {
        const known = normalizeKnown(knownLetters);
        const total = pathSteps(known);
        if (total === 0) return { items: [], from: 0, to: 0, total: 0, letters: [] };
        const start = from >= total ? 0 : Math.max(0, from);
        const end = Math.min(total, start + steps);
        const used = new Set();
        const items = [];
        const letters = [];
        for (let st = start; st < end; st++) {
            const focus = known[st + 1];
            const label = st === 0 ? `${known[0]} ${known[1]}` : `+${focus}`;
            letters.push(focus);
            items.push(...stepItems(known.slice(0, st + 2), focus, { rng, counts, used, extraSes: st === 0 ? [known[0]] : [], chapter: label }));
        }
        return { items, from: start, to: end, total, letters };
    }

    /** Karışık tekrar: tüm bilinen harflerden, harf odağı olmadan rastgele. */
    function buildMixed(knownLetters, { rng = Math.random, counts = {} } = {}) {
        const known = normalizeKnown(knownLetters);
        if (known.length === 0) return [];
        const n = { ses: 2, hece: 10, kelime: 8, cumle: 3, ...counts };
        const items = [];
        shuffle(known, rng).slice(0, n.ses).forEach((l) => items.push(item('ses', l, [l], KIND_CHAPTER.ses)));
        const pool = syllablesFrom(known).filter((x) => x.type !== 'V');
        const simple = shuffle(pool.filter((x) => x.difficulty === 'Simple'), rng);
        const medium = shuffle(pool.filter((x) => x.difficulty === 'Medium'), rng);
        const nMed = Math.min(medium.length, Math.floor(n.hece * 0.2));
        shuffle(simple.slice(0, n.hece - nMed).concat(medium.slice(0, nMed)), rng).forEach((x) => items.push(sylItem(x, KIND_CHAPTER.hece)));
        shuffle(wordsFor(known), rng).slice(0, n.kelime).forEach((w) => items.push(wordItem(w, KIND_CHAPTER.kelime)));
        shuffle(sentencesFor(known), rng).slice(0, n.cumle).forEach((x) => items.push(sentItem(x, KIND_CHAPTER.cumle)));
        return items;
    }

    /**
     * Seçtiğim harfler: yalnızca seçilen harf ya da harf kombinasyonlarıyla çalış.
     * - Hem sesli hem sessiz seçildiyse heceler yalnızca o harflerden kurulur (örn. k + a: ka, ak, kak).
     * - Yalnızca sessiz seçildiyse bilinen tüm seslilerle, yalnızca sesli seçildiyse bilinen tüm sessizlerle birleşir.
     * - Kelime ve cümleler, bilinen harflerle yazılmış ve seçilenlerden en az birini içerenlerdir (çok içeren önce).
     */
    function buildFocus(knownLetters, focusLetters, { rng = Math.random, counts = {} } = {}) {
        const known = normalizeKnown(knownLetters);
        const F = known.filter((l) => (focusLetters || []).map(fold).includes(l));
        if (F.length === 0) return [];
        const n = { ses: 4, hece: 12, cedit: 4, kelime: 8, cumle: 3, ...counts };
        const fv = F.filter(isVowel), fc = F.filter(isConsonant);
        const letters = fv.length && fc.length ? F : [...(fv.length ? fv : known.filter(isVowel)), ...(fc.length ? fc : known.filter(isConsonant))];
        const items = [];
        F.slice(0, n.ses).forEach((l) => items.push(item('ses', l, [l], KIND_CHAPTER.ses)));
        const pool = syllablesFrom(letters).filter((x) => x.type !== 'V');
        const simple = shuffle(pool.filter((x) => x.difficulty === 'Simple'), rng);
        const medium = shuffle(pool.filter((x) => x.difficulty === 'Medium'), rng);
        const nMed = Math.min(medium.length, n.cedit);
        shuffle(simple.slice(0, n.hece - nMed).concat(medium.slice(0, nMed)), rng).forEach((x) => items.push(sylItem(x, KIND_CHAPTER.hece)));
        const score = (text) => F.filter((l) => has(text, l)).length;
        const byScore = (list, textOf) => shuffle(list.filter((x) => score(textOf(x)) > 0), rng).sort((a, b) => score(textOf(b)) - score(textOf(a)));
        byScore(wordsFor(known), (w) => w.sequence).slice(0, n.kelime).forEach((w) => items.push(wordItem(w, KIND_CHAPTER.kelime)));
        byScore(sentencesFor(known), (x) => x.text).slice(0, n.cumle).forEach((x) => items.push(sentItem(x, KIND_CHAPTER.cumle)));
        return items;
    }

    /**
     * Sesini tanıt: bilinen harf sesleri ve kolay hecelerden, henüz en az örneği olanlardan başlayarak liste.
     * @param {Object} counts  { "hece/ka": örnek sayısı }
     * @param {string[]} focus seçili harfler varsa yalnızca onları içerenler
     */
    function buildCalibration(knownLetters, counts = {}, { n = 16, focus = [], rng = Math.random } = {}) {
        const known = normalizeKnown(knownLetters);
        if (known.length === 0) return [];
        const F = known.filter((l) => focus.map(fold).includes(l));
        const cands = [
            ...known.map((l) => item('ses', l, [l], 'Tanıt')),
            ...syllablesFrom(known).filter((x) => x.difficulty === 'Simple' && x.type !== 'V').map((x) => sylItem(x, 'Tanıt'))
        ].filter((it) => F.length === 0 || F.some((l) => has(it.text, l)));
        const c = (it) => counts[it.key] || 0;
        return shuffle(cands, rng).sort((a, b) => c(a) - c(b)).slice(0, n);
    }

    function slug(text) {
        return fold(text).replace(/[.!?,]/g, '').trim().replace(/\s+/g, '_');
    }

    return { LETTER_ORDER, VOWELS, LEXICON, SENTENCES, sentencesFor, buildLesson, buildPath, buildMixed, buildFocus, buildCalibration, pathSteps, syllablesFrom, slug, stageOf, fold, isVowel, isConsonant, lettersThrough, normalizeKnown, generateSyllables, pickSyllable, wordsFor };
});
