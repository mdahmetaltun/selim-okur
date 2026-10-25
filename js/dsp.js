/**
 * Sinyal işleme: MFCC öznitelikleri ve DTW ile şablon eşleştirme.
 * Model indirmeden, her cihazda (iPad dahil) çevrimdışı çalışır.
 * Hem tarayıcıda (window.DSP) hem Node'da (require) çalışır.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.DSP = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    const TARGET_RATE = 16000;
    const FRAME = 400;   // 25 ms
    const HOP = 160;     // 10 ms
    const NFFT = 512;
    const NMEL = 26;
    const NCEP = 13;

    /** Doğrusal enterpolasyonla yeniden örnekleme (tarayıcı 44.1/48 kHz verir). */
    function resample(x, fromRate, toRate = TARGET_RATE) {
        if (fromRate === toRate) return Float32Array.from(x);
        const ratio = fromRate / toRate;
        const n = Math.floor(x.length / ratio);
        const out = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const pos = i * ratio, i0 = Math.floor(pos), i1 = Math.min(i0 + 1, x.length - 1);
            out[i] = x[i0] + (x[i1] - x[i0]) * (pos - i0);
        }
        return out;
    }

    /** Sessizlik kırpma: enerji eşiğine göre konuşulan bölümü bul (kenarlara 60 ms pay). */
    function trimSilence(x, rate = TARGET_RATE) {
        const win = Math.floor(rate * 0.02);
        const energies = [];
        for (let i = 0; i + win <= x.length; i += win) {
            let e = 0;
            for (let j = 0; j < win; j++) e += x[i + j] * x[i + j];
            energies.push(e / win);
        }
        if (energies.length === 0) return x;
        const sorted = energies.slice().sort((a, b) => a - b);
        const noise = sorted[Math.floor(sorted.length * 0.1)] || 1e-10;
        const peak = sorted[sorted.length - 1];
        const thr = Math.max(noise * 6, peak * 0.02);
        let first = energies.findIndex((e) => e > thr);
        let last = energies.length - 1 - [...energies].reverse().findIndex((e) => e > thr);
        if (first < 0) return x.subarray(0, 0);
        const pad = Math.ceil(0.06 / 0.02);
        first = Math.max(0, first - pad);
        last = Math.min(energies.length - 1, last + pad);
        return x.subarray(first * win, Math.min(x.length, (last + 1) * win));
    }

    const hamming = new Float32Array(FRAME).map((_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (FRAME - 1)));

    const hz2mel = (f) => 2595 * Math.log10(1 + f / 700);
    const mel2hz = (m) => 700 * (10 ** (m / 2595) - 1);

    /** Mel filtre bankası. alpha != 1: frekans ekseni ölçeklenir (VTLN: çocuk/yetişkin formant farkı). */
    function makeBank(alpha) {
        const nyq = TARGET_RATE / 2 - 100;
        const lo = hz2mel(80), hi = hz2mel(TARGET_RATE / 2 - 200);
        const pts = Array.from({ length: NMEL + 2 }, (_, i) => Math.min(nyq, mel2hz(lo + ((hi - lo) * i) / (NMEL + 1)) * alpha));
        const bins = pts.map((f) => Math.floor(((NFFT + 1) * f) / TARGET_RATE));
        const bank = [];
        for (let m = 1; m <= NMEL; m++) {
            const f = new Float32Array(NFFT / 2 + 1);
            for (let k = bins[m - 1]; k < bins[m]; k++) f[k] = (k - bins[m - 1]) / Math.max(1, bins[m] - bins[m - 1]);
            for (let k = bins[m]; k < bins[m + 1]; k++) f[k] = (bins[m + 1] - k) / Math.max(1, bins[m + 1] - bins[m]);
            bank.push(f);
        }
        return bank;
    }
    const bankCache = new Map();
    const bankFor = (alpha) => {
        const key = alpha.toFixed(3);
        if (!bankCache.has(key)) bankCache.set(key, makeBank(alpha));
        return bankCache.get(key);
    };

    const dctMat = Array.from({ length: NCEP }, (_, i) =>
        Float32Array.from({ length: NMEL }, (_, j) => Math.cos((Math.PI * i * (j + 0.5)) / NMEL)));

    /** Basit radix-2 FFT (yerinde). */
    function fft(re, im) {
        const n = re.length;
        for (let i = 1, j = 0; i < n; i++) {
            let bit = n >> 1;
            for (; j & bit; bit >>= 1) j ^= bit;
            j ^= bit;
            if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
        }
        for (let len = 2; len <= n; len <<= 1) {
            const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
            for (let i = 0; i < n; i += len) {
                let cr = 1, ci = 0;
                for (let k = 0; k < len / 2; k++) {
                    const a = i + k, b = i + k + len / 2;
                    const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
                    re[b] = re[a] - tr; im[b] = im[a] - ti;
                    re[a] += tr; im[a] += ti;
                    const ncr = cr * wr - ci * wi;
                    ci = cr * wi + ci * wr; cr = ncr;
                }
            }
        }
    }

    /** MFCC (13) + delta yok; kepstral ortalama/varyans normalizasyonu (konuşmacı farkını azaltır). */
    function mfcc(x, alpha = 1) {
        const melBank = bankFor(alpha);
        const frames = [];
        const emph = new Float32Array(x.length);
        for (let i = 1; i < x.length; i++) emph[i] = x[i] - 0.97 * x[i - 1];
        const re = new Float32Array(NFFT), im = new Float32Array(NFFT);
        for (let s = 0; s + FRAME <= emph.length; s += HOP) {
            re.fill(0); im.fill(0);
            for (let i = 0; i < FRAME; i++) re[i] = emph[s + i] * hamming[i];
            fft(re, im);
            const logMel = new Float32Array(NMEL);
            for (let m = 0; m < NMEL; m++) {
                let sum = 0;
                const f = melBank[m];
                for (let k = 0; k <= NFFT / 2; k++) if (f[k] > 0) sum += f[k] * (re[k] * re[k] + im[k] * im[k]);
                logMel[m] = Math.log(sum + 1e-10);
            }
            const c = new Float32Array(NCEP);
            for (let i = 0; i < NCEP; i++) {
                let v = 0;
                for (let j = 0; j < NMEL; j++) v += dctMat[i][j] * logMel[j];
                c[i] = v;
            }
            frames.push(c);
        }
        if (frames.length === 0) return frames;
        // c0 (enerji) atılır; c1..c12 ortalama/varyans normalize edilir
        const out = frames.map((f) => f.slice(1));
        const d = NCEP - 1;
        for (let i = 0; i < d; i++) {
            let mean = 0;
            out.forEach((f) => { mean += f[i]; });
            mean /= out.length;
            let varr = 0;
            out.forEach((f) => { varr += (f[i] - mean) ** 2; });
            const sd = Math.sqrt(varr / out.length) || 1;
            out.forEach((f) => { f[i] = (f[i] - mean) / sd; });
        }
        return out;
    }

    /** Ham ses -> öznitelik dizisi (16 kHz'e indir, sessizliği kırp, MFCC). */
    function features(samples, rate, alpha = 1) {
        const x = resample(samples, rate);
        const t = trimSilence(x);
        if (t.length < FRAME * 3) return [];
        return mfcc(t, alpha);
    }

    /** VTLN için denenecek eksen ölçekleri (1 = değişiklik yok). */
    const WARPS = [0.86, 0.93, 1, 1.08, 1.17, 1.27];

    /**
     * Konuşmacı farkını telafi ederek sınıflandır: test sesi her ölçekle işlenir, her etiket için en iyi ölçek
     * seçilir. Aşırı serbestlik yanlış eşleşmeyi artırmasın diye 1'den uzak ölçeklere küçük bir ceza uygulanır.
     * @returns {classify çıktısı + warp}
     */
    function classifyWarped(samples, rate, templates, { warps = WARPS, penalty = 0.04 } = {}) {
        const per = {};
        let bestWarp = 1, bestD = Infinity;
        warps.forEach((a) => {
            const f = features(samples, rate, a);
            if (f.length < 10) return;
            Object.keys(templates).forEach((label) => {
                let d = Infinity;
                templates[label].forEach((t) => { d = Math.min(d, dtw(f, t)); });
                d *= 1 + penalty * Math.abs(Math.log(a) / Math.log(1.1));
                if (d < (per[label] ? per[label].d : Infinity)) per[label] = { d, a };
            });
        });
        const scores = Object.keys(per).map((label) => ({ label, d: per[label].d })).sort((x, y) => x.d - y.d);
        if (scores.length === 0) return null;
        bestD = scores[0].d;
        bestWarp = per[scores[0].label].a;
        const [b, s2] = scores;
        return { best: b.label, bestDist: bestD, second: s2 ? s2.label : null, secondDist: s2 ? s2.d : Infinity,
            margin: s2 ? (s2.d - b.d) / s2.d : 1, scores, warp: bestWarp };
    }

    const frameDist = (a, b) => {
        let s = 0;
        for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
        return Math.sqrt(s);
    };

    /** Bant sınırlı DTW; yol uzunluğuna normalize edilmiş ortalama kare mesafesi. */
    function dtw(A, B, band = 0.4) {
        const n = A.length, m = B.length;
        if (n === 0 || m === 0) return Infinity;
        const w = Math.max(Math.abs(n - m), Math.ceil(Math.max(n, m) * band));
        const INF = 1e18;
        let prev = new Float64Array(m + 1).fill(INF), cur = new Float64Array(m + 1).fill(INF);
        const prevLen = new Float64Array(m + 1), curLen = new Float64Array(m + 1);
        prev[0] = 0;
        for (let i = 1; i <= n; i++) {
            cur.fill(INF);
            const lo = Math.max(1, i - w), hi = Math.min(m, i + w);
            for (let j = lo; j <= hi; j++) {
                const c = frameDist(A[i - 1], B[j - 1]);
                let best = prev[j - 1], len = prevLen[j - 1];
                if (prev[j] < best) { best = prev[j]; len = prevLen[j]; }
                if (cur[j - 1] < best) { best = cur[j - 1]; len = curLen[j - 1]; }
                cur[j] = best + c; curLen[j] = len + 1;
            }
            [prev, cur] = [cur, prev];
            prevLen.set(curLen);
        }
        return prev[m] / Math.max(1, prevLen[m]);
    }

    /**
     * Sınıflandırma: şablonlar { label: [features...] }.
     * Döndürür: { best, bestDist, second, secondDist, margin } (margin = göreli fark).
     * Her etiket için en yakın şablonun mesafesi kullanılır.
     */
    function classify(feat, templates) {
        const scores = [];
        Object.keys(templates).forEach((label) => {
            let d = Infinity;
            templates[label].forEach((t) => { d = Math.min(d, dtw(feat, t)); });
            if (d < Infinity) scores.push({ label, d });
        });
        scores.sort((a, b) => a.d - b.d);
        if (scores.length === 0) return null;
        const [b, s] = scores;
        return {
            best: b.label, bestDist: b.d,
            second: s ? s.label : null, secondDist: s ? s.d : Infinity,
            margin: s ? (s.d - b.d) / s.d : 1,
            scores
        };
    }

    return { TARGET_RATE, WARPS, resample, trimSilence, mfcc, features, dtw, classify, classifyWarped };
});
