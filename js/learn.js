/**
 * Tanıyıcının hatalarını öğrenme. Tarayıcı konuşma tanıma bazı okumaları hep aynı yanlış
 * metne çevirir (örn. "ka" -> "kah"). Veli o okumayı doğru onayladığında (ya da Selim'in sesi hedefi
 * güçlü biçimde işaret ettiğinde) duyulan metin o hedefin "takma adı" olarak saklanır; bir dahaki sefere
 * aynı metin gelince doğru kabul edilir. Veli "tekrar" dediyse ters yönde, "bu metin bu hedef değil" diye öğrenilir.
 * Hem tarayıcıda (createLearned) hem Node testlerinde (require) çalışır.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.createLearned = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    return function createLearned({ storage, normalize, storageKey = 'selim_okur_learned' }) {
        let data = { alias: {}, reject: {} };
        try { data = { alias: {}, reject: {}, ...JSON.parse(storage.getItem(storageKey) || '{}') }; } catch (e) { /* boş başla */ }

        const save = () => { try { storage.setItem(storageKey, JSON.stringify(data)); } catch (e) { /* zorunlu değil */ } };
        const bump = (map, key, text) => {
            map[key] = map[key] || {};
            map[key][text] = (map[key][text] || 0) + 1;
        };

        /** Duyulan alternatiflerden karşılaştırılacak metinler: tüm cümle ve tek tek sözcükler. */
        function forms(alts) {
            const out = new Set();
            (alts || []).map(normalize).filter(Boolean).forEach((a) => {
                out.add(a);
                a.split(' ').forEach((t) => t && out.add(t));
            });
            return [...out];
        }

        /** Doğru okuma onaylandı; tanıyıcının ilk tahmini hedeften farklıysa takma ad olarak öğren. */
        function confirm(key, targetText, alts) {
            const first = normalize((alts || [])[0] || '');
            if (!first || first === normalize(targetText)) return false;
            bump(data.alias, key, first);
            save();
            return true;
        }

        /** Veli "doğru değildi" dedi: tanıyıcının ilk tahmini bu hedefi göstermemeli (hedefin kendisi hariç). */
        function reject(key, targetText, alts) {
            const first = normalize((alts || [])[0] || '');
            if (!first || first === normalize(targetText)) return false;
            bump(data.reject, key, first);
            save();
            return true;
        }

        /**
         * @returns {'accept'|'reject'|null}
         * accept: duyulanlardan biri bu hedefin öğrenilmiş takma adı ve başka bir hedefe daha çok ait değil.
         * reject: duyulanlardan biri daha önce bu hedef için reddedilmiş (ve takma ad değil).
         */
        function check(key, alts, poolKeys = []) {
            const fs = forms(alts);
            const mine = data.alias[key] || {};
            const rej = data.reject[key] || {};
            for (const f of fs) {
                if (mine[f]) {
                    const rival = Math.max(0, ...poolKeys.filter((k) => k !== key).map((k) => (data.alias[k] || {})[f] || 0));
                    if (mine[f] > rival) return 'accept';
                }
            }
            for (const f of fs) if (rej[f] && !mine[f]) return 'reject';
            return null;
        }

        const stats = () => ({
            aliases: Object.values(data.alias).reduce((n, m) => n + Object.keys(m).length, 0),
            rejects: Object.values(data.reject).reduce((n, m) => n + Object.keys(m).length, 0)
        });
        const clear = () => { data = { alias: {}, reject: {} }; save(); };
        const replace = (d) => { data = { alias: (d && d.alias) || {}, reject: (d && d.reject) || {} }; save(); };
        const dump = () => JSON.parse(JSON.stringify(data));

        return { confirm, reject, check, stats, clear, replace, dump, forms };
    };
});
