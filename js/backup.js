/**
 * Yedekleme: durum, öğrenilenler, ses örnekleri ve veli kayıtları tek bir JSON dosyasında.
 * Cihazlar arası taşıma (bilgisayar -> iPad) ve Safari'nin veri silme riskine karşı güvence için.
 * Ses özellikleri 16 bit tam sayıya sıkıştırılır (hata < 0.0003, tanımayı etkilemez).
 * Hem tarayıcıda (Backup) hem Node testlerinde (require) çalışır.
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Backup = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    const SCALE = 4000;       // ortalama/varyans normalize değerler ~[-8, 8]
    const VERSION = 1;

    function toBase64(bytes) {
        let s = '';
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(s);
    }
    function fromBase64(b64) {
        const s = atob(b64);
        const out = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
        return out;
    }

    /** [kare][boyut] -> { frames, dim, data } */
    function packFeats(feats) {
        const frames = feats.length, dim = frames ? feats[0].length : 0;
        const q = new Int16Array(frames * dim);
        for (let i = 0; i < frames; i++) for (let j = 0; j < dim; j++) q[i * dim + j] = Math.max(-32768, Math.min(32767, Math.round(feats[i][j] * SCALE)));
        return { frames, dim, data: toBase64(new Uint8Array(q.buffer)) };
    }

    function unpackFeats(p) {
        const bytes = fromBase64(p.data);
        const q = new Int16Array(bytes.buffer, bytes.byteOffset, p.frames * p.dim);
        return Array.from({ length: p.frames }, (_, i) => Float32Array.from({ length: p.dim }, (_, j) => q[i * p.dim + j] / SCALE));
    }

    /**
     * @param {{state, learned, templates:{label:feats[]}, voices:[{key,type,data}], log}} parts
     */
    function build({ state, learned, templates, voices = [], log = [] }) {
        return {
            app: 'selim-okur', v: VERSION, date: new Date().toISOString(),
            state, learned,
            templates: Object.fromEntries(Object.entries(templates).map(([label, list]) => [label, list.map(packFeats)])),
            voices, log
        };
    }

    /** Geçerli bir yedek mi? Aksi halde açıklayıcı hata verir. */
    function parse(text) {
        let obj;
        try { obj = JSON.parse(text); } catch (e) { throw new Error('Bu dosya bir yedek değil (okunamadı).'); }
        if (!obj || obj.app !== 'selim-okur') throw new Error('Bu dosya Selim Okur yedeği değil.');
        if (obj.v > VERSION) throw new Error('Bu yedek daha yeni bir sürümden. Uygulamayı güncelle.');
        return {
            state: obj.state || {}, learned: obj.learned || { alias: {}, reject: {} },
            templates: Object.fromEntries(Object.entries(obj.templates || {}).map(([label, list]) => [label, list.map(unpackFeats)])),
            voices: obj.voices || [], log: obj.log || [], date: obj.date
        };
    }

    return { packFeats, unpackFeats, build, parse, toBase64, fromBase64 };
});
