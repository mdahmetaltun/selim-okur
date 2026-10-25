/**
 * Platform: iPad/iPhone (iOS) ve PWA durumu, paylaşılan ses bağlamı, kalıcı depolama izni.
 * iOS notları: ses bağlamı yalnızca dokunuş içinde açılır; aynı anda az sayıda bağlam açılabilir (bu yüzden tek bağlam);
 * mikrofon açıkken medya sesi kısılabilir (bu yüzden ses işleme kapatılır ve mikrofon gerektiğinde bırakılır).
 */
const Platform = (() => {
    const ua = navigator.userAgent || '';
    // iPadOS 13+ kendini Mac olarak tanıtır; dokunmatik ekranı olan "MacIntel" iPad'dir.
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isStandalone = !!navigator.standalone || (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
    const isSecure = window.isSecureContext || isLocal;
    const isTouch = (navigator.maxTouchPoints || 0) > 0;

    let ctx = null;
    /** Uygulamanın tek ses bağlamı: efekt sesleri, mikrofon ve çözümleme hepsi bunu kullanır. */
    function audioContext() {
        if (!ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            ctx = new AC();
        }
        return ctx;
    }

    /** İlk dokunuşta çağrılır: bağlamı açar ve sessiz bir tampon çalarak iOS'ta ses çıkışını serbest bırakır. */
    async function unlockAudio() {
        try {
            const c = audioContext();
            if (c.state !== 'running') await c.resume();
            const src = c.createBufferSource();
            src.buffer = c.createBuffer(1, 1, 22050);
            src.connect(c.destination);
            src.start(0);
        } catch (e) { /* kilit açılamadı; sonraki dokunuşta tekrar denenir */ }
    }

    /** Safari sekmesi 7 gün kullanılmazsa IndexedDB verilerini silebilir; kalıcılık iste. */
    async function persistStorage() {
        try { return !!(navigator.storage && navigator.storage.persist && await navigator.storage.persist()); } catch (e) { return false; }
    }

    /** Mikrofon kısıtları: iOS'ta ses işleme kapalı (medya sesi kısılmasın, kısa heceler kırpılmasın). */
    function micConstraints() {
        return isIOS
            ? { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 }
            : { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 };
    }

    return { isIOS, isStandalone, isSecure, isLocal, isTouch, audioContext, unlockAudio, persistStorage, micConstraints };
})();
