/**
 * Mikrofon yakalama. Konuşma başlangıç/bitişi enerjiyle algılanır, anlık seviye arayüze bildirilir.
 * Mikrofon bir ders boyunca açık kalır (izin tekrar sorulmasın); boşta kalınca, sayfa gizlenince ya da
 * istenince bırakılır (iOS'ta turuncu nokta ve kısık ses sorunu için). Ses bağlamı Platform'dan gelir.
 */
const Mic = (() => {
    const IDLE_RELEASE_MS = 120000;
    let stream = null, source = null, proc = null, idleTimer = null, capturing = 0;
    const taps = new Set();

    function armIdle() {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => { if (!capturing) release(); }, IDLE_RELEASE_MS);
    }

    /** Mikrofonu bırak: akışı kapatır (bağlam açık kalır, tekrar kullanılabilir). */
    function release() {
        clearTimeout(idleTimer);
        try { if (source) source.disconnect(); if (proc) { proc.disconnect(); proc.onaudioprocess = null; } } catch (e) { /* */ }
        if (stream) stream.getTracks().forEach((t) => { try { t.stop(); } catch (e) { /* */ } });
        stream = source = proc = null;
    }

    async function ensure() {
        const ctx = Platform.audioContext();
        if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) { /* dokunuş gerekebilir */ } }
        if (stream && stream.active && proc) { armIdle(); return; }
        release();
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw Object.assign(new Error('Bu tarayıcı mikrofon erişimini desteklemiyor.'), { code: Platform.isSecure ? 'unsupported' : 'insecure' });
        }
        if (!Platform.isSecure) throw Object.assign(new Error('Mikrofon için sayfa HTTPS ile açılmalı.'), { code: 'insecure' });
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: Platform.micConstraints() });
        } catch (e) {
            throw Object.assign(new Error(e.message), { code: e.name === 'NotAllowedError' ? 'denied' : 'device' });
        }
        stream.getTracks().forEach((t) => { t.onended = () => { if (stream && !stream.active) release(); }; });
        if (ctx.state !== 'running') { try { await ctx.resume(); } catch (e) { /* */ } }
        source = ctx.createMediaStreamSource(stream);
        proc = ctx.createScriptProcessor(2048, 1, 1);
        proc.onaudioprocess = (e) => {
            const d = e.inputBuffer.getChannelData(0);
            taps.forEach((fn) => fn(d));
        };
        source.connect(proc);
        proc.connect(ctx.destination); // çıkışa yazmadığımız için sessiz
        armIdle();
    }

    const rms = (d) => { let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i]; return Math.sqrt(s / d.length); };

    /**
     * Bir okuma kaydı al. Konuşma bitince (sessizlik) ya da süre dolunca döner.
     * @param {{maxMs, startTimeoutMs, silenceMs, onLevel}} o
     * @returns {{promise: Promise<{samples, rate, speech, ms, reason, peak, noise, snr, clipped, frames}>, stop}}
     */
    function capture({ maxMs = 6000, startTimeoutMs = 5000, silenceMs = 800, onLevel } = {}) {
        const ctx = Platform.audioContext();
        const chunks = [];
        let total = 0, speechSeen = false, speechMs = 0, lastLoud = 0, noise = null, finished = false, peak = 0, loudPeak = 0, frames = 0, hot = 0, run = 0, clipRuns = 0;
        const calib = [];
        let resolveFn;
        const promise = new Promise((res) => { resolveFn = res; });
        const t0 = performance.now();
        capturing++;
        clearTimeout(idleTimer);

        const finish = (reason) => {
            if (finished) return;
            finished = true;
            clearTimeout(watchdog);
            taps.delete(tap);
            capturing = Math.max(0, capturing - 1);
            armIdle();
            const samples = new Float32Array(total);
            let o = 0;
            chunks.forEach((c) => { samples.set(c, o); o += c.length; });
            const n = noise || 0.002;
            resolveFn({
                samples, rate: ctx.sampleRate, speech: speechSeen && speechMs >= 100, ms: performance.now() - t0, reason,
                peak, noise: n, snr: 20 * Math.log10(Math.max(loudPeak, 1e-6) / Math.max(n, 1e-6)), clipped: clipRuns >= 3, frames
            });
        };

        const tap = (d) => {
            frames++;
            chunks.push(Float32Array.from(d));
            total += d.length;
            const now = performance.now() - t0;
            const level = rms(d);
            // Gerçek kırpılma: tavana yapışmış ardışık örnekler (yeniden örneklemenin tek örneklik taşması sayılmaz)
            for (let i = 0; i < d.length; i++) {
                const a = Math.abs(d[i]);
                if (a > peak) peak = a;
                if (a >= 0.99) { run++; hot++; if (run === 4) clipRuns++; } else run = 0;
            }
            if (onLevel) onLevel(Math.min(1, level * 9));
            if (noise === null) {
                calib.push(level);
                if (now > 300) { calib.sort((a, b) => a - b); noise = calib[Math.floor(calib.length / 2)] || 0.002; }
                return;
            }
            const thr = Math.max(0.012, noise * 3.5);
            if (level > thr) {
                speechSeen = true;
                loudPeak = Math.max(loudPeak, level);
                speechMs += (d.length / ctx.sampleRate) * 1000;
                lastLoud = now;
            }
            if (speechSeen && now - lastLoud > silenceMs) finish('silence');
            else if (!speechSeen && now > startTimeoutMs) finish('no-speech');
            else if (now > maxMs) finish('max');
        };
        // iOS: bağlam askıya alındıysa (arama, arka plan) ses akışı hiç gelmez; sonsuza kadar beklemeyelim
        const watchdog = setTimeout(() => { if (frames === 0) finish('no-audio'); }, 1800);
        taps.add(tap);
        return { promise, stop: () => finish('stopped') };
    }

    /** Kayıt (veli sesi): MediaRecorder ile blob döndürür. */
    function recordBlob({ maxMs = 4000 } = {}) {
        capturing++;
        clearTimeout(idleTimer);
        const rec = new MediaRecorder(stream);
        const parts = [];
        rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
        const done = new Promise((res) => {
            rec.onstop = () => { capturing = Math.max(0, capturing - 1); armIdle(); res(new Blob(parts, { type: rec.mimeType || 'audio/mp4' })); };
        });
        rec.start();
        const timer = setTimeout(() => rec.state !== 'inactive' && rec.stop(), maxMs);
        return { done, stop: () => { clearTimeout(timer); if (rec.state !== 'inactive') rec.stop(); } };
    }

    // Sayfa gizlenince (ana ekrana dönüş, uygulama değiştirme) mikrofonu bırak; iOS bunu zaten ister
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && !capturing) release();
        else if (!document.hidden) { const c = Platform.audioContext(); if (c.state !== 'running') c.resume().catch(() => {}); }
    });

    return { ensure, release, capture, recordBlob, get ready() { return !!(stream && stream.active); } };
})();
