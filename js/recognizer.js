/**
 * Dinleme ve değerlendirme: mikrofon kaydı + (varsa) tarayıcı konuşma tanıma birlikte çalışır,
 * sonuçlar Judge ve Verify ile tek karara indirilir. Onaylanan okumalar Selim'in ses şablonu olur.
 */
const Templates = (() => {
    const MAX_PER_LABEL = 6;
    let cache = new Map(); // label -> { feats, intra }

    async function load() {
        cache = new Map();
        (await Store.allTemplates()).forEach((r) => cache.set(r.label, { feats: r.feats, intra: intraOf(r.feats) }));
    }

    function intraOf(feats) {
        if (feats.length < 2) return null;
        let m = Infinity;
        for (let i = 0; i < feats.length; i++) for (let j = i + 1; j < feats.length; j++) m = Math.min(m, DSP.dtw(feats[i], feats[j]));
        return m;
    }

    async function add(label, feat) {
        if (!feat || feat.length < 10) return;
        const cur = cache.get(label) ? cache.get(label).feats.slice() : [];
        cur.push(feat);
        while (cur.length > MAX_PER_LABEL) cur.shift();
        cache.set(label, { feats: cur, intra: intraOf(cur) });
        await Store.putTemplates(label, cur);
    }

    const count = (label) => (cache.get(label) ? cache.get(label).feats.length : 0);
    const intra = (label) => (cache.get(label) ? cache.get(label).intra : null);
    const dictFor = (labels) => {
        const d = {};
        labels.forEach((l) => { if (cache.has(l)) d[l] = cache.get(l).feats; });
        return d;
    };
    const total = () => [...cache.values()].reduce((n, v) => n + v.feats.length, 0);
    const labels = () => [...cache.keys()];
    async function clear() { cache = new Map(); await Store.clearTemplates(); }

    return { load, add, count, intra, dictFor, total, labels, clear };
})();

const Recognizer = (() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    /** Tarayıcı konuşma tanıma bu cihazda güvenilir mi? (iPad/iPhone'da değil) */
    const webSpeechAvailable = () => !!SR && !isApple;

    function startWebSpeech() {
        if (!webSpeechAvailable()) return null;
        const rec = new SR();
        rec.lang = 'tr-TR';
        rec.continuous = false;
        rec.interimResults = true;
        rec.maxAlternatives = 8;
        const out = { alts: [], interim: '', error: null, ended: false };
        out.done = new Promise((resolve) => {
            rec.onresult = (e) => {
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    const r = e.results[i];
                    if (r.isFinal) { for (let a = 0; a < r.length; a++) out.alts.push(r[a].transcript); }
                    else out.interim = r[0].transcript;
                }
            };
            rec.onerror = (e) => { out.error = e.error; };
            rec.onend = () => { out.ended = true; resolve(out); };
        });
        try { rec.start(); } catch (e) { out.error = e.message; out.ended = true; return { out, stop() {} , done: Promise.resolve(out) }; }
        return { out, stop: () => { try { rec.stop(); } catch (e) { /* */ } }, done: out.done };
    }

    /**
     * Bir okuma dinle.
     * @param {{engine:'auto'|'voice'|'web', onLevel:Function, onInterim:Function}} o
     */
    async function listen({ engine = 'auto', onLevel, onInterim, maxMs = 6000, ctl = {} } = {}) {
        await Mic.ensure();
        const useWeb = engine !== 'voice' && webSpeechAvailable();
        const sr = useWeb ? startWebSpeech() : null;
        const timer = sr ? setInterval(() => onInterim && sr.out.interim && onInterim(sr.out.interim), 150) : null;
        const cap = Mic.capture({ maxMs, onLevel });
        ctl.stop = cap.stop; // dışarıdan erken bitirmek için
        const audio = await cap.promise;
        let web = null, srError = null;
        if (sr) {
            sr.stop();
            await Promise.race([sr.done, new Promise((r) => setTimeout(r, 1500))]);
            clearInterval(timer);
            srError = sr.out.error;
            const alts = sr.out.alts.length ? sr.out.alts : (sr.out.interim ? [sr.out.interim] : []);
            web = { alts };
        }
        return { audio, web, srError, webAvailable: !!sr };
    }

    /** İki ses karşılaştırması için öznitelik. */
    const featOf = (audio) => DSP.features(audio.samples, audio.rate);

    /**
     * @param {{kind,text,units,key}} item
     * @param {Array<{kind,text,key}>} pool  aynı türden rakip öğeler (ses/hece için)
     */
    async function evaluate(item, pool, heardResult) {
        const alts = heardResult.web ? heardResult.web.alts : [];
        let web = null;
        if (heardResult.webAvailable) {
            if (item.kind === 'cumle') web = Judge.judgeWords(item.units, alts);
            else if (item.kind === 'ses') {
                web = Judge.judge(item.text, alts, pool.map((p) => p.text), { aliases: Judge.letterAliases(item.text) });
            } else {
                web = Judge.judge(item.text, alts, item.kind === 'hece' ? pool.map((p) => p.text) : []);
            }
        }

        let personal = null, ref = null, feat = null;
        const templated = item.kind === 'ses' || item.kind === 'hece';
        if (templated && heardResult.audio.speech) {
            feat = featOf(heardResult.audio);
            if (feat.length > 10) {
                const labels = [...new Set([item.key, ...pool.map((p) => p.key)])];
                personal = DSP.classify(feat, Templates.dictFor(labels));
                const refDict = {};
                await Promise.all(labels.slice(0, 90).map(async (l) => {
                    const f = await Voice.referenceFeatures(l);
                    if (f) refDict[l] = [f];
                }));
                ref = DSP.classify(feat, refDict);
            }
        }

        const personalLabels = Templates.labels().length;
        const result = Verify.fuse(web, personal, ref, {
            target: item.key,
            personalCount: Templates.count(item.key),
            personalLabels,
            intra: Templates.intra(item.key),
            speech: heardResult.audio.speech
        });
        const heard = (web && web.heard) || (alts[0] || '');
        return { ...result, heard, feat, webAvailable: heardResult.webAvailable, srError: heardResult.srError };
    }

    /** Doğru okuma onaylandı (otomatik ya da veli): Selim'in sesini şablon olarak sakla. */
    async function enroll(item, feat) {
        if (feat && (item.kind === 'ses' || item.kind === 'hece')) await Templates.add(item.key, feat);
    }

    return { webSpeechAvailable, listen, evaluate, enroll, isApple };
})();
