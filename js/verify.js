/**
 * Karar birleştirme: Web Speech (Judge) sonucu ile ses şablonu eşleştirmesini tek karara indirir.
 * Hem tarayıcıda (window.Verify) hem Node'da (require) çalışır.
 *
 * web      : Judge.judge çıktısı ya da null (tanıyıcı yok / hata)
 * personal : DSP.classify(Selim'in kendi şablonları) ya da null
 * ref      : DSP.classify(üretilmiş/veli referansı) ya da null
 * opts     : { target, personalCount (hedefin kendi şablon sayısı), personalLabels (kaç farklı etiket),
 *              rivals (havuzdaki diğer öğelerden kaçının şablonu var),
 *              refAuto (tanıyıcı yok: güçlü hazır-ses eşleşmesi tek başına "doğru" sayılabilir),
 *              intra (hedefin kendi şablonlarının iç mesafesi), typical (tüm şablonlarda tipik iç mesafe), speech (mikrofonda konuşma algılandı mı) }
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Verify = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    const MARGIN_SUPPORT = 0.08;
    const MARGIN_CONTRADICT = 0.15;
    const MARGIN_SUPPORT_SINGLE = 0.2;
    const MARGIN_CONTRADICT_SINGLE = 0.3;
    const MARGIN_REF = 0.25;
    const DEFAULT_INTRA = 0.9;   // sentetik ölçümden: aynı kişinin tekrarları arasındaki tipik DTW mesafesi
    const GATE_MULT = 2.0, GATE_ADD = 0.4;

    function evidence(personal, ref, o) {
        const out = { personal: 'none', ref: 'none' };
        if (personal && o.personalCount >= 1 && o.personalLabels >= 3) {
            // Tek örnekle daha temkinli: daha büyük fark ister. İki ve üstü örnekte normal eşik.
            const single = o.personalCount < 2;
            const supportMin = single ? MARGIN_SUPPORT_SINGLE : MARGIN_SUPPORT;
            const contradictMin = single ? MARGIN_CONTRADICT_SINGLE : MARGIN_CONTRADICT;
            // Yakınlık kapısı: Selim'in kendi tekrarlarının tipik değişkenliğinden öğrenilir (yoksa varsayılan).
            let limit = GATE_MULT * (o.typical != null ? o.typical : DEFAULT_INTRA) + GATE_ADD;
            if (o.intra) limit = Math.min(limit, 2.2 * o.intra + 0.5);
            const close = personal.bestDist <= limit;
            // Güvenlik: rakiplerin örneği yoksa hedefin şablonu "tek yakın" görünür; en az 2 rakip örneği iste.
            const rivalsOk = o.rivals === undefined || o.rivals >= 2;
            if (personal.best === o.target && personal.margin >= supportMin && close && rivalsOk) out.personal = 'support';
            else if (personal.best !== o.target && personal.margin >= contradictMin) out.personal = 'contradict';
        }
        if (ref) {
            if (ref.best === o.target && ref.margin >= MARGIN_REF) out.ref = 'support';
            else if (ref.best !== o.target && ref.margin >= MARGIN_REF) out.ref = 'contradict';
        }
        return out;
    }

    function fuse(web, personal, ref, opts) {
        const ev = evidence(personal, ref, opts);
        const heard = web ? web.heard : '';
        const base = { heard, evidence: ev };
        if (opts.speech === false && !(web && web.verdict !== 'nospeech')) return { ...base, verdict: 'nospeech', why: 'no-speech' };

        const w = web ? web.verdict : null;
        if (w === 'correct') {
            return ev.personal === 'contradict'
                ? { ...base, verdict: 'uncertain', why: 'web-ok-but-voice-differs' }
                : { ...base, verdict: 'correct', why: 'web' };
        }
        if (w === 'uncertain') {
            if (ev.personal === 'support') return { ...base, verdict: 'correct', why: 'voice-resolves' };
            if (ev.personal === 'contradict') return { ...base, verdict: 'wrong', why: 'voice-contradicts' };
            return { ...base, verdict: 'uncertain', why: 'web-unsure' };
        }
        if (w === 'wrong') {
            if (ev.personal === 'support') return { ...base, verdict: 'correct', why: 'voice-overrides-web' };
            return { ...base, verdict: 'wrong', why: 'web' };
        }
        // tanıyıcı yok ya da sessiz: yalnızca ses şablonu
        if (ev.personal === 'support') return { ...base, verdict: 'correct', why: 'voice' };
        if (ev.personal === 'contradict') return { ...base, verdict: 'wrong', why: 'voice' };
        // Tanıyıcı yoksa (iPad) ve henüz Selim'e ait kanıt yoksa, VTLN'li hazır-ses eşleşmesi yeterince güçlüyse kabul et
        if (ev.ref === 'support' && opts.refAuto) return { ...base, verdict: 'correct', why: 'ref' };
        if (ev.ref === 'support') return { ...base, verdict: 'uncertain', why: 'ref-weak-support' };
        if (ev.ref === 'contradict') return { ...base, verdict: 'uncertain', why: 'ref-weak-contradict' };
        return { ...base, verdict: 'uncertain', why: 'no-evidence' };
    }

    return { fuse, evidence };
});
