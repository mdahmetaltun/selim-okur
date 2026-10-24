/**
 * Selim'in ses şablonları. Her etiket (örn. "hece/ka") için en çok 8 örnek tutulur;
 * dolunca birbirine en çok benzeyen iki örnekten eskisi atılır (çeşitlilik korunur, tekrar yığılmaz).
 * Hem tarayıcıda (createTemplates) hem Node testlerinde (require) çalışır.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.createTemplates = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    return function createTemplates({ store, dsp, max = 8, minFrames = 10 }) {
        let cache = new Map(); // etiket -> { feats, intra }

        /** Her örneğin en yakın komşusuna uzaklığının medyanı: kişinin kendi değişkenlik ölçüsü. */
        function intraOf(feats) {
            if (feats.length < 2) return null;
            const nn = feats.map((a, i) => Math.min(...feats.map((b, j) => (i === j ? Infinity : dsp.dtw(a, b)))));
            nn.sort((x, y) => x - y);
            return nn[Math.floor(nn.length / 2)];
        }

        function prune(feats) {
            while (feats.length > max) {
                let bi = 0, bj = 1, best = Infinity;
                for (let i = 0; i < feats.length; i++) {
                    for (let j = i + 1; j < feats.length; j++) {
                        const d = dsp.dtw(feats[i], feats[j]);
                        if (d < best) { best = d; bi = i; bj = j; }
                    }
                }
                feats.splice(Math.min(bi, bj), 1); // benzer ikiliden eskisini at
            }
            return feats;
        }

        async function load() {
            cache = new Map();
            (await store.allTemplates()).forEach((r) => { if (r.feats && r.feats.length) cache.set(r.label, { feats: r.feats, intra: intraOf(r.feats) }); });
        }

        async function add(label, feat) {
            if (!feat || feat.length < minFrames) return false;
            const cur = cache.get(label) ? cache.get(label).feats.slice() : [];
            cur.push(feat);
            prune(cur);
            cache.set(label, { feats: cur, intra: intraOf(cur) });
            await store.putTemplates(label, cur);
            return true;
        }

        /** Belirli bir örneği (aynı nesne) sil: veli "yanlış okudu" derse. */
        async function remove(label, feat) {
            const e = cache.get(label);
            if (!e) return false;
            const feats = e.feats.filter((f) => f !== feat);
            if (feats.length === e.feats.length) return false;
            if (feats.length === 0) {
                cache.delete(label);
                await store.delTemplates(label);
            } else {
                cache.set(label, { feats, intra: intraOf(feats) });
                await store.putTemplates(label, feats);
            }
            return true;
        }

        const count = (label) => (cache.get(label) ? cache.get(label).feats.length : 0);
        const intra = (label) => (cache.get(label) ? cache.get(label).intra : null);
        const dictFor = (labels) => {
            const d = {};
            labels.forEach((l) => { if (cache.has(l)) d[l] = cache.get(l).feats; });
            return d;
        };
        /** Selim'in kendi tekrarlarının tipik iç mesafesi (etiketlerin medyanı); örnek yoksa null. */
        const typicalIntra = () => {
            const xs = [...cache.values()].map((v) => v.intra).filter((x) => x != null).sort((a, b) => a - b);
            return xs.length ? xs[Math.floor(xs.length / 2)] : null;
        };
        const total = () => [...cache.values()].reduce((n, v) => n + v.feats.length, 0);
        const labels = () => [...cache.keys()];
        /** Etiket başına örnek sayıları: { etiket: n } */
        const counts = () => Object.fromEntries([...cache].map(([k, v]) => [k, v.feats.length]));
        async function clear() { cache = new Map(); await store.clearTemplates(); }

        return { load, add, remove, count, intra, typicalIntra, dictFor, total, labels, counts, clear };
    };
});
