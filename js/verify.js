/**
 * Karar birleştirme: Web Speech (Judge) sonucu ile ses şablonu eşleştirmesini tek karara indirir.
 * Hem tarayıcıda (window.Verify) hem Node'da (require) çalışır.
 *
 * web      : Judge.judge çıktısı ya da null (tanıyıcı yok / hata)
 * personal : DSP.classify(Selim'in kendi şablonları) ya da null
 * ref      : DSP.classify(üretilmiş/veli referansı) ya da null
 * opts     : { target, personalCount (hedefin kendi şablon sayısı), personalLabels (kaç farklı etiket),
 *              intra (hedefin kendi şablonlarının iç mesafesi), speech (mikrofonda konuşma algılandı mı) }
 */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory();
    else root.Verify = factory();
})(typeof self !== 'undefined' ? self : this, function () {
    const MARGIN_SUPPORT = 0.08;
    const MARGIN_CONTRADICT = 0.15;
    const MARGIN_REF = 0.25;

    function evidence(personal, ref, o) {
        const out = { personal: 'none', ref: 'none' };
        if (personal && o.personalCount >= 2 && o.personalLabels >= 3) {
            const close = !o.intra || personal.bestDist <= o.intra * 2.2 + 0.5;
            if (personal.best === o.target && personal.margin >= MARGIN_SUPPORT && close) out.personal = 'support';
            else if (personal.best !== o.target && personal.margin >= MARGIN_CONTRADICT) out.personal = 'contradict';
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
        if (ev.ref === 'support') return { ...base, verdict: 'uncertain', why: 'ref-weak-support' };
        if (ev.ref === 'contradict') return { ...base, verdict: 'uncertain', why: 'ref-weak-contradict' };
        return { ...base, verdict: 'uncertain', why: 'no-evidence' };
    }

    return { fuse, evidence };
});
