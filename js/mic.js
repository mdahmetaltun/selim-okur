/**
 * Mikrofon yakalama: tek bir akış açık tutulur (izin tekrar sorulmasın),
 * konuşma başlangıç/bitişi enerjiyle algılanır, anlık seviye arayüze bildirilir.
 */
const Mic = (() => {
    let stream = null, ctx = null, source = null, proc = null;
    const taps = new Set();

    async function ensure() {
        if (stream && stream.active && ctx) {
            if (ctx.state === 'suspended') await ctx.resume();
            return;
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw Object.assign(new Error('Bu tarayıcı mikrofon erişimini desteklemiyor (HTTPS gerekir).'), { code: 'unsupported' });
        }
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
            });
        } catch (e) {
            throw Object.assign(new Error(e.message), { code: e.name === 'NotAllowedError' ? 'denied' : 'device' });
        }
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC();
        if (ctx.state === 'suspended') await ctx.resume();
        source = ctx.createMediaStreamSource(stream);
        proc = ctx.createScriptProcessor(2048, 1, 1);
        proc.onaudioprocess = (e) => {
            const d = e.inputBuffer.getChannelData(0);
            taps.forEach((fn) => fn(d));
        };
        source.connect(proc);
        proc.connect(ctx.destination); // çıkışa yazmadığımız için sessiz
    }

    const rms = (d) => { let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i]; return Math.sqrt(s / d.length); };

    /**
     * Bir okuma kaydı al. Konuşma bitince (sessizlik) ya da süre dolunca döner.
     * @returns {{promise: Promise<{samples:Float32Array, rate:number, speech:boolean, ms:number}>, stop: Function}}
     */
    function capture({ maxMs = 6000, startTimeoutMs = 5000, silenceMs = 800, onLevel } = {}) {
        const chunks = [];
        let total = 0, speechSeen = false, speechMs = 0, lastLoud = 0, noise = null, finished = false;
        const calib = [];
        let resolveFn;
        const promise = new Promise((res) => { resolveFn = res; });
        const t0 = performance.now();

        const finish = (reason) => {
            if (finished) return;
            finished = true;
            taps.delete(tap);
            const samples = new Float32Array(total);
            let o = 0;
            chunks.forEach((c) => { samples.set(c, o); o += c.length; });
            resolveFn({ samples, rate: ctx.sampleRate, speech: speechSeen && speechMs >= 100, ms: performance.now() - t0, reason });
        };

        const tap = (d) => {
            chunks.push(Float32Array.from(d));
            total += d.length;
            const now = performance.now() - t0;
            const level = rms(d);
            if (onLevel) onLevel(Math.min(1, level * 9));
            if (noise === null) {
                calib.push(level);
                if (now > 300) { calib.sort((a, b) => a - b); noise = calib[Math.floor(calib.length / 2)] || 0.002; }
                return;
            }
            const thr = Math.max(0.012, noise * 3.5);
            if (level > thr) {
                speechSeen = true;
                speechMs += (d.length / ctx.sampleRate) * 1000;
                lastLoud = now;
            }
            if (speechSeen && now - lastLoud > silenceMs) finish('silence');
            else if (!speechSeen && now > startTimeoutMs) finish('no-speech');
            else if (now > maxMs) finish('max');
        };
        taps.add(tap);
        return { promise, stop: () => finish('stopped') };
    }

    /** Kayıt (veli sesi): MediaRecorder ile blob döndürür. */
    function recordBlob({ maxMs = 4000 } = {}) {
        const rec = new MediaRecorder(stream);
        const parts = [];
        rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
        const done = new Promise((res) => { rec.onstop = () => res(new Blob(parts, { type: rec.mimeType || 'audio/mp4' })); });
        rec.start();
        const timer = setTimeout(() => rec.state !== 'inactive' && rec.stop(), maxMs);
        return { done, stop: () => { clearTimeout(timer); if (rec.state !== 'inactive') rec.stop(); } };
    }

    return { ensure, capture, recordBlob, get ready() { return !!(stream && stream.active); } };
})();
