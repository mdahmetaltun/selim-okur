/**
 * Dinleme ve değerlendirme: mikrofon kaydı + (varsa) tarayıcı konuşma tanıma birlikte çalışır,
 * sonuçlar Judge ve Verify ile tek karara indirilir. Onaylanan okumalar Selim'in ses şablonu olur,
 * tanıyıcının sürekli yaptığı hatalar (Learned) öğrenilir.
 */
const Templates = createTemplates({ store: Store, dsp: DSP });
const Learned = createLearned({ storage: localStorage, normalize: Judge.normalize });

const Recognizer = (() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const isApple = Platform.isIOS;

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
    async function listen({ engine = 'auto', onLevel, onInterim, maxMs = 6000, silenceMs = 800, ctl = {} } = {}) {
        await Mic.ensure();
        const useWeb = engine !== 'voice' && webSpeechAvailable();
        const sr = useWeb ? startWebSpeech() : null;
        const timer = sr ? setInterval(() => onInterim && sr.out.interim && onInterim(sr.out.interim), 150) : null;
        const cap = Mic.capture({ maxMs, silenceMs, onLevel });
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
        const poolKeys = pool.map((p) => p.key);
        let web = null;
        if (heardResult.webAvailable) {
            if (item.kind === 'cumle') web = Judge.judgeWords(item.units, alts);
            else if (item.kind === 'ses') {
                web = Judge.judge(item.text, alts, pool.map((p) => p.text), { aliases: Judge.letterAliases(item.text) });
            } else {
                web = Judge.judge(item.text, alts, item.kind === 'hece' ? pool.map((p) => p.text) : []);
            }
            // Daha önce öğrenilen tanıyıcı hataları: "kah" hep "ka" demekse kabul et; veli reddettiyse sorgula
            const learned = Learned.check(item.key, alts, poolKeys);
            if (learned === 'accept' && web.verdict !== 'correct') web = { ...web, verdict: 'correct', learned: 'accept' };
            else if (learned === 'reject' && web.verdict === 'correct') web = { ...web, verdict: 'uncertain', learned: 'reject' };
        }

        let personal = null, ref = null, feat = null;
        const templated = item.kind === 'ses' || item.kind === 'hece' || item.kind === 'kelime';
        if (templated && heardResult.audio.speech) {
            feat = featOf(heardResult.audio);
            if (feat.length > 10) {
                const labels = [...new Set([item.key, ...poolKeys])];
                personal = DSP.classify(feat, Templates.dictFor(labels));
                if (item.kind !== 'kelime') {
                    const refDict = {};
                    await Promise.all(labels.slice(0, 90).map(async (l) => {
                        const f = await Voice.referenceFeatures(l);
                        if (f) refDict[l] = [f];
                    }));
                    // Hazır referans sesi başka bir konuşmacı: frekans ekseni ölçekleme (VTLN) ile çocuk/yetişkin farkını telafi et
                    ref = DSP.classifyWarped(heardResult.audio.samples, heardResult.audio.rate, refDict);
                }
            }
        }

        const result = Verify.fuse(web, personal, ref, {
            target: item.key,
            personalCount: Templates.count(item.key),
            personalLabels: Templates.labels().length,
            rivals: poolKeys.filter((k) => Templates.count(k) > 0).length,
            intra: Templates.intra(item.key),
            typical: Templates.typicalIntra(),
            speech: heardResult.audio.speech,
            refAuto: !heardResult.webAvailable && poolKeys.length >= 2
        });
        const heard = (web && web.heard) || (alts[0] || '');
        const why = (web && web.learned === 'accept' && result.verdict === 'correct' && result.why === 'web') ? 'learned-alias' : result.why;
        return { ...result, why, heard, alts, feat, webAvailable: heardResult.webAvailable, srError: heardResult.srError };
    }

    /**
     * Doğru okuma onaylandı. Selim'in sesi şablon olur; veli onayladıysa ya da ses şablonu hedefi
     * güçlü biçimde işaret ettiyse tanıyıcının o okumaya verdiği metin "takma ad" olarak öğrenilir.
     */
    async function confirmed(item, result, source) {
        const feat = result && result.feat;
        // Yalnızca hazır sesle eşleşip otomatik kabul edilenler şablon olmaz (%1 yanlış kabul örnekleri kirletmesin)
        const unverified = source === 'auto' && result && result.why === 'ref';
        if (feat && !unverified && (item.kind === 'ses' || item.kind === 'hece' || item.kind === 'kelime')) await Templates.add(item.key, feat);
        if (result && result.alts && result.alts.length && (source === 'parent' || (result.why || '').startsWith('voice'))) {
            Learned.confirm(item.key, item.text, result.alts);
        }
    }

    /** Veli "doğru değildi" dedi ve uygulama doğru/belirsiz demişti: o metni bu hedef için reddet. */
    function rejected(item, result) {
        if (result && result.verdict !== 'wrong' && result.alts && result.alts.length) Learned.reject(item.key, item.text, result.alts);
    }

    /**
     * Ses tanıtma: kayıtta konuşma varsa Selim'in sesini şablon olarak sakla (tanıma yapmadan).
     * @returns {Promise<boolean>} saklandı mı
     */
    async function teach(item, audio) {
        if (!audio.speech) return false;
        return Templates.add(item.key, featOf(audio));
    }

    return { webSpeechAvailable, listen, evaluate, confirmed, rejected, teach, isApple };
})();
