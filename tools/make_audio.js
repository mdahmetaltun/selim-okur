#!/usr/bin/env node
/**
 * Ön üretimli ses dosyaları: harf sesleri, heceler, kelimeler, cümleler.
 * Gereksinim: espeak-ng ve ffmpeg (apt install espeak-ng ffmpeg).
 * Kullanım:  node tools/make_audio.js [--cvc-through=m] [--voice=tr+f3] [--force]
 * Çıktı:     audio/<tür>/<ad>.mp3 ve audio/manifest.json
 *
 * Not: espeak-ng robotik bir sestir ama harf seslerini (fonem) doğru verir. Daha doğal bir
 * ses için aynı dosya adlarıyla başka bir TTS çıktısı koyabilir ya da uygulamadaki
 * "Kendi sesimle kaydet" aracını kullanabilirsin (kayıt her zaman önceliklidir).
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../js/curriculum.js');

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
}));
const VOICE = args.voice || 'tr+f3';
const CVC_THROUGH = args['cvc-through'] || 'm';
const OUT = path.join(__dirname, '..', 'audio');
const TMP = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'selim-audio-'));

// Harf sesleri (espeak fonem kodları). Patlamalı ünsüzlere çok kısa bir "ı" eklenir,
// sürekli ünsüzler (m, n, l, s...) uzatılır: ses olarak duyulsun, "me"/"em" demesin.
const LETTER_PHONEME = {
    a: "'a:", e: "'E:", 'ı': "'@:", i: "'i:", o: "'O:", 'ö': "'W:", u: "'u:", 'ü': "'y:",
    b: 'b@', c: 'dZ@', 'ç': 'tS@', d: 'd@', f: 'f:f:', g: 'J@', 'ğ': 'j@', h: 'h:h:', j: 'Z:Z:', k: 'k@',
    l: 'l:l:l:', m: 'm:m:m:', n: 'n:n:n:', p: 'p@', r: 'R:R:', s: 's:s:', 'ş': 'S:S:', t: 't@', v: 'v:v:', y: 'j:j:', z: 'z:z:'
};

function synth(text, file, { speed = 120, pitch = 62 } = {}) {
    const wav = path.join(TMP, 'x.wav');
    let r = spawnSync('espeak-ng', ['-v', VOICE, '-s', String(speed), '-p', String(pitch), '-w', wav, text]);
    if (r.status !== 0) throw new Error(`espeak-ng: ${r.stderr}`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav,
        '-af', 'silenceremove=start_periods=1:start_threshold=-58dB:stop_periods=1:stop_threshold=-58dB:stop_duration=0.08,apad=pad_dur=0.04,loudnorm=I=-18:TP=-2',
        '-ac', '1', '-ar', '22050', '-b:a', '40k', file]);
    if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr}`);
}

const jobs = [];
const add = (key, text, opts) => jobs.push({ key, text, opts });

C.LETTER_ORDER.forEach((l) => add(`ses/${l}`, `[[${LETTER_PHONEME[l]}]]`, { speed: 90 }));

const allSyl = C.generateSyllables(C.LETTER_ORDER);
const cvcLimit = new Set(C.lettersThrough(CVC_THROUGH));
allSyl.forEach((s) => {
    if (s.type === 'CVC' && ![...s.sequence].every((ch) => cvcLimit.has(ch))) return;
    add(`hece/${s.sequence}`, s.sequence, { speed: 105 });
});
C.LEXICON.forEach((w) => add(`kelime/${w.sequence}`, w.sequence, { speed: 130 }));
C.SENTENCES.forEach((s) => add(`cumle/${C.slug(s.text)}`, s.text, { speed: 135 }));
[['ui/aferin', 'Aferin!'], ['ui/harika', 'Harika!'], ['ui/tekrar', 'Bir daha deneyelim'], ['ui/oku', 'Şimdi sen oku']]
    .forEach(([k, t]) => add(k, t, { speed: 140 }));

const manifest = [];
let made = 0;
jobs.forEach(({ key, text, opts }) => {
    const file = path.join(OUT, `${key}.mp3`);
    if (args.force || !fs.existsSync(file)) { synth(text, file, opts); made++; }
    manifest.push(key);
});
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({ voice: VOICE, keys: manifest }, null, 0));
fs.rmSync(TMP, { recursive: true, force: true });
const bytes = manifest.reduce((n, k) => n + fs.statSync(path.join(OUT, `${k}.mp3`)).size, 0);
console.log(`${manifest.length} dosya (${made} yeni), toplam ${(bytes / 1048576).toFixed(1)} MB -> audio/`);
