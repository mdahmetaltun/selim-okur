/**
 * Ses bankası. Çalma önceliği:
 *   1) velinin kendi kaydı (IndexedDB)  2) önceden üretilmiş dosya (audio/)  3) tarayıcı TTS (son çare)
 * Ayrıca tanıma için "referans öznitelik" üretir (kayıt/dosya -> MFCC).
 */
const Voice = (() => {
    const el = new Audio();
    el.preload = 'auto';
    let manifest = new Set();
    let pack = null; // { index: {anahtar: [başlangıç, uzunluk]}, blob } — tek dosyada toplanmış sesler (yayın sürümü)
    let recorded = new Set();
    let unlocked = false;
    let ctx = null;
    const refCache = new Map();
    let curUrl = null;
    const fileUrls = new Map(); // dosya anahtarı -> blob adresi (bir kez indirilir; iOS ve kısıtlı çerçevelerde güvenilir)

    async function init() {
        try {
            const r = await fetch('audio/manifest.json', { cache: 'no-cache' });
            if (r.ok) {
                const m = await r.json();
                manifest = new Set(m.keys);
                if (m.pack) {
                    const pr = await fetch(m.pack);
                    if (pr.ok) pack = { index: m.index, blob: await pr.blob() };
                }
            }
        } catch (e) { /* dosyalar yoksa TTS'e düşer */ }
        recorded = new Set(await Store.allVoiceKeys());
    }

    /** iOS/Safari: ilk dokunuşta sessiz bir çalma ile ses çalmayı aç. */
    function unlock() {
        if (unlocked) return;
        unlocked = true;
        try {
            el.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAABErAAABAAgAZGF0YQAAAAA=';
            el.play().catch(() => {});
        } catch (e) { /* önemli değil */ }
    }

    const source = (key) => (recorded.has(key) ? 'kayıt' : manifest.has(key) ? 'dosya' : 'tts');
    const has = (key) => recorded.has(key) || manifest.has(key);

    function stop() {
        try { el.pause(); } catch (e) { /* */ }
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    }

    function speakTts(text, rate) {
        return new Promise((resolve) => {
            if (!('speechSynthesis' in window) || !text) return resolve(false);
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'tr-TR';
            const v = window.speechSynthesis.getVoices().find((x) => x.lang && x.lang.toLowerCase().startsWith('tr'));
            if (v) u.voice = v;
            u.rate = rate || 0.85;
            u.pitch = 1.1;
            u.onend = () => resolve(true);
            u.onerror = () => resolve(false);
            window.speechSynthesis.speak(u);
        });
    }

    async function fileUrl(key) {
        if (fileUrls.has(key)) return fileUrls.get(key);
        let u = `audio/${key}.mp3`;
        if (pack && pack.index[key]) {
            const [from, len] = pack.index[key];
            u = URL.createObjectURL(pack.blob.slice(from, from + len, 'audio/mpeg'));
            fileUrls.set(key, u);
            return u;
        }
        try {
            const r = await fetch(u);
            if (r.ok) u = URL.createObjectURL(await r.blob());
        } catch (e) { /* doğrudan adres denenir */ }
        fileUrls.set(key, u);
        return u;
    }

    async function urlFor(key) {
        if (recorded.has(key)) {
            const row = await Store.getVoice(key);
            if (row && row.blob) return URL.createObjectURL(row.blob);
            recorded.delete(key);
        }
        return manifest.has(key) ? fileUrl(key) : null;
    }

    /** Çalar, bitince çözülür. text: dosya yoksa TTS ile okunacak metin. */
    async function play(key, { text, rate = 1 } = {}) {
        stop();
        const url = await urlFor(key);
        if (!url) return speakTts(text, 0.85 * rate);
        return new Promise((resolve) => {
            if (curUrl && curUrl.startsWith('blob:') && ![...fileUrls.values()].includes(curUrl)) URL.revokeObjectURL(curUrl);
            curUrl = url;
            el.src = url;
            el.playbackRate = rate;
            const done = (ok) => { el.onended = el.onerror = null; resolve(ok); };
            el.onended = () => done(true);
            el.onerror = () => done(false);
            el.play().catch(() => done(false));
        });
    }

    async function saveRecording(key, blob) {
        await Store.putVoice(key, blob);
        recorded.add(key);
        refCache.delete(key);
    }

    async function deleteRecording(key) {
        await Store.delVoice(key);
        recorded.delete(key);
        refCache.delete(key);
    }

    /** Tanıma için referans öznitelik (velinin kaydı ya da üretilmiş dosya). */
    async function referenceFeatures(key) {
        if (refCache.has(key)) return refCache.get(key);
        let feat = null;
        try {
            const url = await urlFor(key);
            if (url) {
                const buf = await (await fetch(url)).arrayBuffer();
                ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
                const audio = await ctx.decodeAudioData(buf);
                feat = DSP.features(audio.getChannelData(0), audio.sampleRate);
            }
        } catch (e) { feat = null; }
        refCache.set(key, feat && feat.length ? feat : null);
        return refCache.get(key);
    }

    return { init, unlock, play, stop, has, source, saveRecording, deleteRecording, referenceFeatures,
        get recordedKeys() { return recorded; }, get fileKeys() { return manifest; } };
})();
