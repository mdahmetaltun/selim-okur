/**
 * Fonetik hakem: ses tanıyıcının döndürdüğü metni hedef heceyle karşılaştırır.
 * Soru "ne dedi?" değil, "hedefi mi dedi yoksa havuzdaki başka bir heceyi mi?".
 * Hem tarayıcıda (window.Judge) hem Node testlerinde (require) çalışır.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Judge = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    const TR = 'tr-TR';

    // Tanıyıcıların sık karıştırdığı çiftler için ikame maliyetleri (0..1).
    const NEAR_PAIRS = {
        'ı|i': 0.3, 'o|ö': 0.3, 'u|ü': 0.3,          // ünlü yazım karışıklığı
        's|ş': 0.5, 'c|ç': 0.5,                       // aksan düşmesi
        'k|g': 0.5, 't|d': 0.5, 'p|b': 0.5, 'ç|c': 0.5, // ötümlü/ötümsüz
        'g|ğ': 0.5, 'k|ğ': 0.5, 's|z': 0.6, 'f|v': 0.6
    };
    const SOFT_TRAIL = new Set(['h']); // "ka" yerine "kah" gibi soluk artığı

    function normalize(s) {
        return (s || '')
            .toLocaleLowerCase(TR)
            .replace(/[âä]/g, 'a').replace(/[îï]/g, 'i').replace(/û/g, 'u')
            .replace(/[^a-zçğıöşü\s]/g, ' ')
            .replace(/(.)\1+/g, '$1') // "eeel" -> "el"
            .replace(/\s+/g, ' ')
            .trim();
    }

    function subCost(a, b) {
        if (a === b) return 0;
        return NEAR_PAIRS[`${a}|${b}`] ?? NEAR_PAIRS[`${b}|${a}`] ?? 1;
    }

    /** Ağırlıklı Levenshtein: a = hedef, b = duyulan. */
    function distance(a, b) {
        const n = a.length, m = b.length;
        const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
        for (let i = 1; i <= n; i++) d[i][0] = i;
        for (let j = 1; j <= m; j++) {
            const extra = SOFT_TRAIL.has(b[j - 1]) && j === m ? 0.2 : 1;
            d[0][j] = d[0][j - 1] + extra;
        }
        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= m; j++) {
                const insCost = SOFT_TRAIL.has(b[j - 1]) && j === m ? 0.2 : 1;
                d[i][j] = Math.min(
                    d[i - 1][j] + 1,
                    d[i][j - 1] + insCost,
                    d[i - 1][j - 1] + subCost(a[i - 1], b[j - 1])
                );
            }
        }
        return d[n][m];
    }

    /** Aday cümlenin tüm sözcükleri ve birleşik hali içinde hedefe en yakın maliyet. */
    function bestCost(target, heardNorm) {
        const tokens = heardNorm.split(' ').filter(Boolean);
        const tries = new Set(tokens);
        if (tokens.length > 1) tries.add(tokens.join(''));
        let best = Infinity;
        tries.forEach((t) => { best = Math.min(best, distance(target, t)); });
        return best;
    }

    const acceptLimit = (len) => (len <= 2 ? 0.6 : len === 3 ? 0.9 : 1.2);

    /**
     * @param {string} target   okunması beklenen hece/kelime
     * @param {string[]} heard  tanıyıcının alternatifleri
     * @param {string[]} pool   çocuğun şu an karşılaşabileceği diğer heceler
     * @returns {{verdict:'correct'|'uncertain'|'wrong'|'nospeech', heard:string, best:number, rival:string|null}}
     */
    function judge(target, heard, pool = [], { aliases = [] } = {}) {
        const t = normalize(target);
        const cands = (heard || []).map(normalize).filter(Boolean);
        if (cands.length === 0) return { verdict: 'nospeech', heard: '', best: Infinity, rival: null };

        const costOf = (word) => Math.min(...cands.map((c) => bestCost(word, c)));
        // aliases: aynı sesin kabul edilen yazımları (örn. harf sesi "m" için "me", "em")
        const best = Math.min(costOf(t), ...aliases.map(normalize).filter(Boolean).map(costOf));
        let rival = null, rivalCost = Infinity;
        pool.map(normalize).filter((p) => p && p !== t).forEach((p) => {
            const c = costOf(p);
            if (c < rivalCost) { rivalCost = c; rival = p; }
        });

        const limit = acceptLimit(t.length);
        let verdict;
        if (best <= limit) {
            if (best === 0) verdict = 'correct';
            else if (rivalCost < best - 0.1) verdict = 'uncertain'; // başka bir heceye daha yakın
            else if (rivalCost <= best + 0.1) verdict = 'uncertain'; // ayırt edilemiyor
            else verdict = 'correct';
        } else if (best <= limit + 0.6) {
            verdict = rivalCost < best ? 'wrong' : 'uncertain';
        } else {
            verdict = 'wrong';
        }
        return { verdict, heard: cands[0], best, rival: rivalCost < Infinity ? rival : null };
    }

    /** Harf sesi için kabul edilen tanıyıcı yazımları: tek başına söylenen "m" sık "me"/"em" duyulur. */
    function letterAliases(letter) {
        const l = normalize(letter);
        if ('aeıioöuü'.includes(l)) return [l];
        return [l, l + 'e', 'e' + l, l + 'ı', 'ı' + l, l + 'a', l + 'i'];
    }

    /**
     * Cümle/kelime dizisi: hedef sözcüklerin kaçı duyulanlar içinde bulundu?
     * @returns {{verdict, heard, found, total}}
     */
    function judgeWords(targetWords, heard) {
        const cands = (heard || []).map(normalize).filter(Boolean);
        if (cands.length === 0) return { verdict: 'nospeech', heard: '', found: 0, total: targetWords.length };
        const tw = targetWords.map(normalize);
        let bestFound = 0;
        cands.forEach((c) => {
            const toks = c.split(' ').filter(Boolean);
            let found = 0;
            const used = new Set();
            tw.forEach((w) => {
                let bi = -1, bc = Infinity;
                toks.forEach((tok, i) => { if (!used.has(i)) { const d = distance(w, tok); if (d < bc) { bc = d; bi = i; } } });
                if (bi >= 0 && bc <= acceptLimit(w.length)) { used.add(bi); found++; }
            });
            bestFound = Math.max(bestFound, found);
        });
        const ratio = bestFound / tw.length;
        const verdict = ratio >= 0.99 ? 'correct' : ratio >= 0.6 ? 'uncertain' : 'wrong';
        return { verdict, heard: cands[0], found: bestFound, total: tw.length };
    }

    return { normalize, distance, judge, judgeWords, letterAliases };
});
