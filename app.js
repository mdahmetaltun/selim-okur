/**
 * Selim Okur - 1. Sınıf Okuma Eğitimi
 * Ses temelli cümle yöntemi: ses -> hece -> kelime -> cümle.
 * Modüller: Curriculum (müfredat), Judge/Verify/DSP (karar), Mic/Recognizer (dinleme), Voice (ses bankası).
 */

const TR = 'tr-TR';
const isTurkishVowel = (ch) => !!ch && Curriculum.isVowel(ch);
const isTurkishConsonant = (ch) => !!ch && Curriculum.isConsonant(ch);

const KIND_LABEL = { ses: 'Bu harfin sesini söyle', hece: 'Heceyi oku', kelime: 'Kelimeyi oku', cumle: 'Cümleyi oku' };
const KIND_HINT = {
    ses: 'Önce dinle, sonra sen söyle',
    hece: 'Harfleri birleştirip oku',
    kelime: 'Hece hece oku, sonra birleştir',
    cumle: 'Kelimeleri sırayla oku'
};
const POINTS = { ses: 5, hece: 10, kelime: 15, cumle: 25 };

// ---------- Durum ----------
const state = {
    knownLetters: Curriculum.lettersThrough('t'),
    isLowerCase: true,
    score: 0,
    lessons: 0,
    isParentMode: false,
    isAutoMode: true,
    childName: 'Selim',
    character: '🦁',
    sfxEnabled: true,
    engine: 'auto',
    micRelease: Platform.isIOS, // her okumadan sonra mikrofonu bırak (iPad'de medya sesi kısılmasın)
    mode: 'path',          // path | mixed | focus
    focusLetters: [],      // 'Seçtiğim harfler' modunda çalışılacak harfler
    pathStep: 0,           // 'Baştan ilerle' yolunda tamamlanan adım sayısı
    stats: {},       // anahtar -> { ok, tries }
    activities: []
};
const PERSIST = ['knownLetters', 'isLowerCase', 'score', 'lessons', 'isParentMode', 'isAutoMode', 'childName', 'character', 'sfxEnabled', 'engine', 'micRelease', 'mode', 'focusLetters', 'pathStep', 'stats', 'activities'];

const $ = (id) => document.getElementById(id);
const screens = {};
let autoAdvanceTimer = null;

function init() {
    ['home', 'dashboard', 'game', 'word', 'certificate', 'settings', 'studio'].forEach((n) => { screens[n] = $(`screen-${n}`); });
    loadState();
    renderLetterGrid();
    updateCaseButtons();
    updateStartButton();
    renderModePicker();
    renderDashboard();
    setupEventListeners();
    showScreen('home');
    Promise.all([Voice.init(), Templates.load()]).then(() => { refreshSettingsInfo(); renderEnvBanners(); warmAudioOnce(); });
    renderEnvBanners();
}

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem('selim_okur_state') || 'null');
        if (saved) {
            PERSIST.forEach((k) => { if (saved[k] !== undefined) state[k] = saved[k]; });
            state.knownLetters = Curriculum.normalizeKnown(state.knownLetters);
            if (state.knownLetters.length === 0) state.knownLetters = Curriculum.lettersThrough('t');
            if (!['path', 'mixed', 'focus'].includes(state.mode)) state.mode = 'path';
            state.focusLetters = (state.focusLetters || []).filter((l) => state.knownLetters.includes(l));
            state.pathStep = Math.max(0, Number(state.pathStep) || 0);
        }
    } catch (e) { console.error('Load error:', e); }
    $('setting-child-name').value = state.childName;
    $('setting-character').value = state.character;
    $('setting-sfx').checked = state.sfxEnabled;
    $('setting-auto-mode').checked = state.isAutoMode;
    $('setting-engine').value = state.engine;
    $('setting-mic-release').checked = state.micRelease;
    $('parent-mode-toggle').checked = state.isParentMode;
    applyParentModeText();
    $('character').textContent = state.character;
}

function saveState() {
    try {
        const out = {};
        PERSIST.forEach((k) => { out[k] = state[k]; });
        localStorage.setItem('selim_okur_state', JSON.stringify(out));
    } catch (e) { console.error('Save error:', e); }
}

function addActivity(type, text) {
    state.activities.unshift({ type, text, time: new Date().toLocaleString(TR, { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) });
    if (state.activities.length > 50) state.activities.pop();
    saveState();
}

function showScreen(name) {
    Object.values(screens).forEach((s) => s && s.classList.remove('active'));
    if (screens[name]) screens[name].classList.add('active');
    if (name === 'dashboard') renderDashboard();
    if (name === 'home') $('home-user-name').textContent = state.childName;
    if (name === 'settings') refreshSettingsInfo();
    if (name !== 'game') { Voice.stop(); if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer); }
}

const caseText = (s) => (state.isLowerCase ? s : s.toLocaleUpperCase(TR));

// ---------- Harf seçici ----------
function renderLetterGrid() {
    const grid = $('letter-grid');
    grid.innerHTML = '';
    const last = state.knownLetters[state.knownLetters.length - 1];
    grid.classList.toggle('focus-mode', state.mode === 'focus');
    Curriculum.LETTER_ORDER.forEach((letter, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'letter-btn' + (isTurkishVowel(letter) ? ' vowel-btn' : ' consonant-btn');
        btn.dataset.letter = letter;
        const main = state.isLowerCase ? letter : letter.toLocaleUpperCase(TR);
        const sub = state.isLowerCase ? letter.toLocaleUpperCase(TR) : letter;
        btn.innerHTML = `<span class="letter-main">${main}</span><span class="letter-sub">${sub}</span>`;
        btn.title = `${i + 1}. harf`;
        if (state.knownLetters.includes(letter)) btn.classList.add('selected');
        if (letter === last) btn.classList.add('last-known');
        if (state.mode === 'focus' && state.focusLetters.includes(letter)) btn.classList.add('focus-sel');
        grid.appendChild(btn);
    });
    renderSelectedTags();
}

function renderSelectedTags() {
    const c = $('selected-tags');
    c.innerHTML = '';
    $('selected-vowel-count').textContent = state.knownLetters.filter(isTurkishVowel).length;
    $('selected-consonant-count').textContent = state.knownLetters.filter(isTurkishConsonant).length;
    state.knownLetters.forEach((l) => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.textContent = caseText(l);
        c.appendChild(tag);
    });
}

function setKnownThrough(letter) {
    state.knownLetters = Curriculum.lettersThrough(letter);
    state.focusLetters = state.focusLetters.filter((l) => state.knownLetters.includes(l));
    renderLetterGrid();
    updateStartButton();
    renderModePicker();
    saveState();
}

// ---------- Ders türü: baştan ilerle / karışık tekrar / seçtiğim harfler ----------
const MODE_DESC = {
    path: 'Baştan başlar: önce ilk iki harf, sonra her adımda bir harf eklenir. Önceki harfler de tekrar edilir.',
    mixed: 'Bildiği tüm harflerden karışık hece, kelime ve cümleler. Harf sırası gözetilmez.',
    focus: 'Yukarıdan bildiği harflerden çalışmak istediklerine dokun. Tek harf ya da birkaç harf seç (örn. k ve a).'
};

function setMode(mode) {
    state.mode = mode;
    renderLetterGrid();
    updateStartButton();
    renderModePicker();
    saveState();
}

function toggleFocus(letter) {
    if (!state.knownLetters.includes(letter)) {
        renderModePicker(`${caseText(letter)} harfini henüz öğrenmedi. Önce "Bildiği Harfler" için o harfe kadar seç.`);
        return;
    }
    const i = state.focusLetters.indexOf(letter);
    if (i >= 0) state.focusLetters.splice(i, 1);
    else state.focusLetters.push(letter);
    state.focusLetters = Curriculum.LETTER_ORDER.filter((l) => state.focusLetters.includes(l));
    renderLetterGrid();
    updateStartButton();
    renderModePicker();
    saveState();
}

function renderModePicker(notice) {
    document.querySelectorAll('.mode-chip').forEach((b) => {
        const on = b.dataset.mode === state.mode;
        b.classList.toggle('active', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    $('mode-desc').textContent = notice || MODE_DESC[state.mode];
    $('letter-hint').innerHTML = state.mode === 'focus'
        ? 'Çalışmak istediğin <strong>harflere</strong> dokun (soluk harfler henüz öğrenilmedi):'
        : 'Ders kitabında öğrendiği <strong>son harfe</strong> dokun. Ondan önceki harfler otomatik seçilir:';
    const box = $('path-status');
    box.innerHTML = '';
    if (state.mode === 'path') {
        const total = Curriculum.pathSteps(state.knownLetters);
        const done = Math.min(state.pathStep, total);
        const known = Curriculum.normalizeKnown(state.knownLetters);
        const dots = document.createElement('span');
        dots.className = 'path-dots';
        for (let i = 0; i < total; i++) {
            const d = document.createElement('i');
            d.className = i < done ? 'done' : i === done ? 'next' : '';
            d.title = i === 0 ? `${known[0]} ${known[1]}` : `+${known[i + 1]}`;
            dots.appendChild(d);
        }
        const label = document.createElement('span');
        label.textContent = total === 0 ? 'Önce sesli ve sessiz birer harf seç.'
            : done >= total ? 'Yol tamamlandı ✓ Baştan tekrar edilir.'
                : `Sıradaki: ${done === 0 ? `${known[0]} ${known[1]}` : `+${known[done + 1]}`} (${done}/${total})`;
        box.append(dots, label);
        if (done > 0) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = 'Baştan başla';
            b.onclick = () => { state.pathStep = 0; saveState(); renderModePicker(); };
            box.appendChild(b);
        }
    } else if (state.mode === 'focus') {
        const label = document.createElement('span');
        label.textContent = state.focusLetters.length ? `Seçili: ${state.focusLetters.map(caseText).join(' + ')}` : 'Henüz harf seçmedin.';
        box.appendChild(label);
        if (state.focusLetters.length) {
            const b = document.createElement('button');
            b.type = 'button';
            b.textContent = 'Temizle';
            b.onclick = () => { state.focusLetters = []; renderLetterGrid(); updateStartButton(); renderModePicker(); saveState(); };
            box.appendChild(b);
        }
    }
}

function updateCaseButtons() {
    $('btn-case-lower').classList.toggle('active', state.isLowerCase);
    $('btn-case-upper').classList.toggle('active', !state.isLowerCase);
}

function updateStartButton() {
    let ok = state.knownLetters.some(isTurkishVowel) && state.knownLetters.some(isTurkishConsonant);
    if (state.mode === 'focus') ok = ok && state.focusLetters.length > 0;
    $('btn-start').disabled = !ok;
    $('btn-start').classList.toggle('disabled', !ok);
}

// ---------- Ders akışı ----------
const lesson = { items: [], meta: { mode: 'path' }, idx: 0, attempts: 0, uncertain: 0, busy: false, ctl: {}, passed: 0, helped: 0, skipped: 0, lastFeat: null, lastResult: null, done: false };

function buildSession() {
    const known = state.knownLetters;
    if (state.mode === 'focus') return { items: Curriculum.buildFocus(known, state.focusLetters), meta: { mode: 'focus' } };
    if (state.mode === 'mixed') return { items: Curriculum.buildMixed(known), meta: { mode: 'mixed' } };
    const p = Curriculum.buildPath(known, { from: state.pathStep, steps: 2 });
    return { items: p.items, meta: { mode: 'path', from: p.from, to: p.to, total: p.total, letters: p.letters } };
}

function beginSession(items, meta) {
    Object.assign(lesson, { items, meta, idx: 0, attempts: 0, uncertain: 0, busy: false, ctl: {}, passed: 0, helped: 0, skipped: 0, lastFeat: null, lastResult: null, done: false, taught: 0, teachMiss: 0, lastTaught: null });
    $('rd-summary').classList.add('hidden');
    showScreen('game');
    $('character').textContent = state.character;
    renderSteps();
    showItem(0);
}

// ---------- Sesimi tanıt: Selim okur, uygulama dinleyip sesini şablon olarak öğrenir ----------
async function startTeach() {
    Voice.unlock();
    const focus = state.mode === 'focus' ? state.focusLetters : [];
    const items = Curriculum.buildCalibration(state.knownLetters, Templates.counts(), { n: 16, focus });
    if (items.length === 0) { alert('Önce bilinen harfleri seç.'); return; }
    try { await Mic.ensure(); } catch (e) { alert(micErrorText(e)); return; }
    beginSession(items, { mode: 'teach' });
    addActivity('teach', 'Ses tanıtma oturumu');
}

async function handleTeach(item, heard) {
    if (!screens.game.classList.contains('active') || lesson.done) return;
    const card = $('rd-card');
    const retry = (ms) => { autoAdvanceTimer = setTimeout(() => { if (currentItem() === item && !lesson.busy) onListenClick(); }, ms); };
    if (!heard.audio.speech) {
        lesson.teachMiss++;
        say('Sesini duyamadım. Bir daha oku!');
        if (lesson.teachMiss < 3) retry(900);
        else { lesson.teachMiss = 0; showFeedback('Ses gelmiyor. Mikrofonu kontrol et ya da Atla.', 'warning'); }
        return;
    }
    lesson.teachMiss = 0;
    const feat = DSP.features(heard.audio.samples, heard.audio.rate);
    if (feat.length <= 10 || !(await Templates.add(item.key, feat))) { say('Çok kısa oldu. Bir daha oku!'); retry(900); return; }
    lesson.lastTaught = { key: item.key, feat };
    lesson.taught++;
    card.classList.add('ok');
    playSound('correct');
    say(['Tamam, öğrendim!', 'Güzel, duydum!', 'Harika!'][lesson.taught % 3]);
    refreshSettingsInfo();
    autoAdvanceTimer = setTimeout(nextItem, 1300);
}

function startLesson() {
    Voice.unlock();
    const { items, meta } = buildSession();
    if (items.length === 0) { alert('Bu seçimle ders oluşturulamadı. Harf seçimini kontrol et.'); return; }
    beginSession(items, meta);
    const what = meta.mode === 'path' ? `baştan ilerle, ${meta.letters.map(caseText).join(' ')}` : meta.mode === 'mixed' ? 'karışık tekrar' : `seçilen harfler: ${state.focusLetters.map(caseText).join(' ')}`;
    addActivity('start', `Ders başladı (${what})`);
}

const currentItem = () => lesson.items[lesson.idx];
const poolFor = (item) => lesson.items.filter((i) => i.kind === item.kind && i.key !== item.key);

function chapters() { return [...new Set(lesson.items.map((i) => i.chapter))]; }

function renderSteps() {
    const ol = $('rd-steps');
    ol.innerHTML = '';
    chapters().forEach((c) => {
        const li = document.createElement('li');
        li.className = 'rd-step';
        li.dataset.chapter = c;
        li.textContent = caseText(c);
        ol.appendChild(li);
    });
    updateSteps();
}

function updateSteps() {
    const cur = currentItem();
    document.querySelectorAll('.rd-step').forEach((li) => {
        const c = li.dataset.chapter;
        const all = lesson.items.filter((i) => i.chapter === c);
        const doneN = all.filter((i) => lesson.items.indexOf(i) < lesson.idx).length;
        li.style.setProperty('--p', (doneN / all.length).toFixed(2));
        li.classList.toggle('done', doneN === all.length);
        li.classList.toggle('current', !!cur && cur.chapter === c);
    });
}

function renderCardText(item) {
    const el = $('rd-text');
    if (item.kind === 'ses') {
        const main = state.isLowerCase ? item.text : item.text.toLocaleUpperCase(TR);
        const pair = state.isLowerCase ? item.text.toLocaleUpperCase(TR) : item.text;
        el.innerHTML = `<span>${main}</span><span class="pair">${pair}</span>`;
    } else if (item.kind === 'kelime') {
        el.innerHTML = item.units.map((u) => `<span class="syl">${caseText(u)}</span>`).join('<span class="dot">·</span>');
    } else if (item.kind === 'cumle') {
        el.innerHTML = item.units.map((w) => `<span class="word">${caseText(w)}</span>`).join('');
    } else {
        el.textContent = caseText(item.text);
    }
}

function showItem(i) {
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    lesson.idx = i;
    lesson.attempts = 0;
    lesson.uncertain = 0;
    lesson.lastFeat = null;
    lesson.lastResult = null;
    const item = currentItem();
    const card = $('rd-card');
    card.className = 'rd-card';
    card.dataset.kind = item.kind;
    const teach = lesson.meta.mode === 'teach';
    $('rd-kind').textContent = teach ? 'Sesini tanıtalım: oku' : KIND_LABEL[item.kind];
    $('rd-hint').textContent = teach ? 'Ben dinliyorum ve sesini öğreniyorum' : KIND_HINT[item.kind];
    $('rd-heard').textContent = '';
    renderCardText(item);
    hideFeedback();
    setParentAttention(teach || state.isParentMode, teach ? 'Yanlış okuduysa ↻ Tekrar\'a bas, kaydı silerim:' : state.isParentMode ? `${state.childName} okuyunca onayla:` : '👨‍👧 Veli onayı:');
    setMicState('idle');
    $('game-score').textContent = state.score;
    updateSteps();
    if (teach) {
        // örnek sesi çal (harf sesleri için), bitince kendiliğinden dinlemeye başla
        autoAdvanceTimer = setTimeout(async () => {
            if (currentItem() !== item || lesson.done) return;
            if (item.kind === 'ses') await speakItem();
            if (currentItem() === item && !lesson.busy && !lesson.done && screens.game.classList.contains('active')) onListenClick();
        }, item.kind === 'ses' ? 300 : 800);
    } else if (item.kind === 'ses') setTimeout(() => { if (currentItem() === item && !lesson.busy) speakItem(); }, 350);
}

function speakItem() {
    const item = currentItem();
    if (!item) return Promise.resolve();
    const fallback = item.kind === 'ses' ? (Judge.letterAliases(item.text)[1] || item.text) : item.text;
    return Voice.play(item.key, { text: fallback });
}

function setParentAttention(on, msg) {
    $('parent-check-group').classList.toggle('attention', !!on);
    if (msg) $('parent-msg').textContent = msg;
}

function setMicState(s, label) {
    const btn = $('btn-listen');
    btn.classList.toggle('listening', s === 'listening');
    btn.classList.toggle('busy', s === 'busy');
    btn.style.setProperty('--lvl', 0);
    $('rd-card').classList.toggle('listening', s === 'listening');
    const text = { idle: 'Oku', listening: 'Dinliyorum…', busy: label || 'Bakıyorum…' }[s];
    btn.querySelector('.listen-text').textContent = text;
    btn.querySelector('.mic-icon').textContent = s === 'listening' ? '🎙' : s === 'busy' ? '⏳' : '🎤';
    btn.disabled = s === 'busy';
    btn.style.display = state.isParentMode ? 'none' : '';
}

function say(text) {
    const b = $('speech-bubble');
    b.textContent = text;
    b.classList.add('show');
    clearTimeout(say.t);
    say.t = setTimeout(() => b.classList.remove('show'), 3200);
}

function showFeedback(text, type = 'info') {
    const fb = $('feedback-message');
    fb.textContent = text;
    fb.className = `feedback-message feedback-${type}`;
}
function hideFeedback() { $('feedback-message').className = 'feedback-message hidden'; }

function bumpStat(item, ok) {
    const s = state.stats[item.key] || { ok: 0, tries: 0 };
    s.tries++;
    if (ok) s.ok++;
    state.stats[item.key] = s;
}

// Gömülü çerçevede (önizleme) tarayıcı mikrofonu hiç sormaz; kilit simgesi işe yaramaz.
function micErrorText(e) {
    let embedded = false;
    try { embedded = window.top !== window.self; } catch (err) { embedded = true; }
    if (embedded) return 'Bu önizleme çerçevesinde mikrofon kapalı. Uygulamayı kendi bilgisayarında tarayıcıda aç (node server.js, localhost:3000). Şimdilik veli onayını kullanabilirsin.';
    if (e.code === 'denied') return 'Mikrofon izni kapalı. Adres çubuğundaki kilit simgesinden mikrofona izin ver, sonra sayfayı yenile. Ya da veli onayını kullan.';
    if (e.code === 'insecure') return 'Mikrofon için sayfa HTTPS ile açılmalı (localhost hariç). iPad için README\'deki yayın adımlarına bak.';
    if (e.code === 'unsupported') return 'Bu tarayıcı mikrofon erişimini desteklemiyor.';
    return `Mikrofon açılamadı: ${e.message}`;
}

function logAttempt(item, r) {
    try {
        const log = JSON.parse(localStorage.getItem('selim_okur_asr_log') || '[]');
        log.push({ t: Date.now(), key: item.key, heard: r.heard, verdict: r.verdict, why: r.why, ev: r.evidence, web: r.webAvailable, err: r.srError || null, n: Templates.count(item.key) });
        localStorage.setItem('selim_okur_asr_log', JSON.stringify(log.slice(-500)));
    } catch (e) { /* günlük zorunlu değil */ }
}

function exportAsrLog() {
    const blob = new Blob([localStorage.getItem('selim_okur_asr_log') || '[]'], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'selim-okur-tanima-gunlugu.json';
    a.click();
    URL.revokeObjectURL(a.href);
}

async function onListenClick() {
    Voice.unlock();
    if (lesson.done) return;
    if (lesson.busy) { if (lesson.ctl.stop) lesson.ctl.stop(); return; }
    const item = currentItem();
    if (!item) return;
    Voice.stop();
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    lesson.busy = true;
    hideFeedback();
    $('rd-card').classList.remove('ok', 'again');
    $('rd-heard').textContent = '';
    setMicState('busy', 'Mikrofon açılıyor…');
    try {
        await Mic.ensure();
    } catch (e) {
        lesson.busy = false;
        setMicState('idle');
        showFeedback(micErrorText(e), 'error');
        setParentAttention(true, 'Mikrofon yok. Selim okuyunca sen onayla:');
        return;
    }
    setMicState('listening');
    $('btn-listen').disabled = false; // dinlerken "Bitir" olarak çalışır
    say(`Seni dinliyorum, ${state.childName}!`);
    let heard;
    try {
        heard = await Recognizer.listen({
            engine: lesson.meta.mode === 'teach' ? 'voice' : state.engine,
            ctl: lesson.ctl,
            onLevel: (v) => $('btn-listen').style.setProperty('--lvl', v.toFixed(2)),
            onInterim: (t) => { $('rd-heard').textContent = `“${t}”`; },
            maxMs: item.kind === 'cumle' ? 12000 : 6000,
            // hece hece okuyan çocuk arada durur: kelime/cümlede daha uzun sessizliği bitiş sayma
            silenceMs: item.kind === 'cumle' ? 1600 : item.kind === 'kelime' ? 1300 : 800
        });
    } catch (e) {
        lesson.busy = false;
        setMicState('idle');
        showFeedback(`Dinleme hatası: ${e.message}`, 'error');
        return;
    }
    if (state.micRelease && lesson.meta.mode !== 'teach') Mic.release();
    const problem = audioProblem(heard.audio);
    if (problem && lesson.meta.mode !== 'teach') {
        lesson.busy = false;
        setMicState('idle');
        $('rd-card').classList.add('again');
        say(problem.say);
        showFeedback(problem.text, 'warning');
        return;
    }
    if (lesson.meta.mode === 'teach') {
        lesson.busy = false;
        setMicState('idle');
        if (problem && problem.fatal) { say(problem.say); showFeedback(problem.text, 'warning'); return; }
        await handleTeach(item, heard);
        return;
    }
    setMicState('busy', 'Bakıyorum…');
    let r;
    try {
        r = await Recognizer.evaluate(item, poolFor(item), heard);
    } catch (e) {
        console.error(e);
        lesson.busy = false;
        setMicState('idle');
        showFeedback('Değerlendirme hatası. Veli onayını kullanabilirsin.', 'error');
        setParentAttention(true, 'Selim okuyunca sen onayla:');
        return;
    }
    lesson.busy = false;
    lesson.lastFeat = r.feat || lesson.lastFeat;
    lesson.lastResult = r;
    logAttempt(item, r);
    setMicState('idle');
    applyVerdict(item, r);
}

// Kayıt kalitesi: ses hiç gelmediyse ya da çok sessiz/bozuksa yargılama; çocuğu yanlış cezalandırma
function audioProblem(a) {
    if (a.reason === 'no-audio' || a.frames === 0) {
        Mic.release(); // bir sonraki dokunuşta mikrofon yeniden açılır
        return { fatal: true, say: 'Mikrofon sesi gelmiyor. Bir daha dokun!', text: 'Mikrofondan ses gelmedi. Ekrana dokunup tekrar dene; olmazsa Ayarlar → Mikrofonu test et.' };
    }
    if (a.speech && a.clipped) return { say: 'Çok yüksek oldu. Biraz yavaş söyle!', text: 'Ses çok yüksek geldi (bozuldu). Mikrofondan biraz uzaklaşıp tekrar dene.' };
    if (a.speech && a.snr < 6) return { say: 'Etraf gürültülü. Bir daha!', text: 'Ortam gürültüsü fazla. Sessiz bir yerde tekrar dene.' };
    return null;
}

function applyVerdict(item, r) {
    const card = $('rd-card');
    if (r.heard) $('rd-heard').textContent = `Duyulan: “${r.heard}”`;
    if (r.why === 'learned-alias') $('rd-heard').textContent += '  · alışık olduğum bir söyleyiş 🧠';
    else if ((r.why || '').startsWith('voice')) $('rd-heard').textContent += '  · sesini tanıdım 🧠';
    if (r.srError === 'not-allowed' || r.srError === 'service-not-allowed') {
        showFeedback('Tarayıcının konuşma tanıması kapalı; yalnızca ses eşleştirme kullanılıyor.', 'warning');
    }
    if (r.verdict === 'correct') { onSuccess(item, r, 'auto'); return; }
    card.classList.add('again');
    if (r.verdict === 'nospeech') {
        say('Sesini duyamadım. Mikrofona biraz yaklaş!');
        showFeedback('Ses duyulmadı. Mikrofona yaklaşıp tekrar dene.', 'warning');
        return;
    }
    if (r.verdict === 'uncertain') {
        lesson.uncertain++;
        say('Tam anlayamadım. Bir daha okur musun?');
        setParentAttention(true, 'Emin olamadım. Doğru muydu?');
        return;
    }
    lesson.attempts++;
    bumpStat(item, false);
    playSound('wrong');
    $('character').textContent = '😊';
    setTimeout(() => { $('character').textContent = state.character; }, 700);
    if (lesson.attempts >= 3) {
        say('Birlikte okuyalım!');
        setParentAttention(true, 'Takıldı. Birlikte okuyup onaylayabilirsin:');
        speakItem();
    } else {
        say('Bir daha deneyelim mi?');
        setParentAttention(lesson.attempts >= 2, 'Doğru okuduysa onayla:');
        if (lesson.attempts === 1) speakItem();
    }
    saveState();
}

async function onSuccess(item, result, source) {
    const card = $('rd-card');
    card.classList.remove('again');
    card.classList.add('ok');
    lesson.passed++;
    if (lesson.attempts >= 3) lesson.helped++;
    state.score += POINTS[item.kind];
    $('game-score').textContent = state.score;
    bumpStat(item, true);
    saveState();
    addActivity('success', `${item.text} ✓`);
    playSound('correct');
    $('character').textContent = '🎉';
    setTimeout(() => { $('character').textContent = state.character; }, 1200);
    say(['Aferin', 'Harika', 'Çok güzel'][Math.floor(Math.random() * 3)] + `, ${state.childName}!`);
    setParentAttention(state.isParentMode, state.isParentMode ? `${state.childName} okuyunca onayla:` : '👨‍👧 Veli onayı:');
    try { await Recognizer.confirmed(item, result, source); } catch (e) { /* öğrenme zorunlu değil */ }
    refreshSettingsInfo();
    if (state.isAutoMode) autoAdvanceTimer = setTimeout(nextItem, 1500);
    else showFeedback('Doğru! Devam etmek için ➔ ye bas.', 'success');
}

function nextItem(skipped) {
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    if (lesson.busy && lesson.ctl.stop) lesson.ctl.stop();
    if (skipped === true && lesson.meta.mode !== 'teach') { lesson.skipped++; bumpStat(currentItem(), false); saveState(); }
    if (lesson.idx + 1 >= lesson.items.length) { finishLesson(); return; }
    showItem(lesson.idx + 1);
}

function finishTeach() {
    lesson.done = true;
    playSound('levelup');
    saveState();
    const n = Templates.labels().length;
    const s = $('rd-summary');
    s.innerHTML = `
        <div style="font-size:72px">🧠</div>
        <h2>Sesini daha iyi tanıyorum, ${state.childName}!</h2>
        <div class="sum-stats">
            <div><b>${lesson.taught}</b>yeni örnek</div>
            <div><b>${n}</b>ses/hece tanıyorum</div>
            <div><b>${Templates.total()}</b>toplam örnek</div>
        </div>
        <p class="studio-intro">Her tanıtma turunda ve doğru okumada tanıma biraz daha iyileşir.</p>
        <div class="sum-actions">
            <button class="btn-primary" id="sum-again">🎙 Bir tur daha</button>
            <button class="btn-secondary" id="sum-home">Ana menü</button>
        </div>`;
    s.classList.remove('hidden');
    $('sum-again').onclick = startTeach;
    $('sum-home').onclick = () => { showScreen('home'); renderDashboard(); };
}

function finishLesson() {
    Platform.persistStorage();
    if (lesson.meta.mode === 'teach') { finishTeach(); return; }
    lesson.done = true;
    state.lessons++;
    const m = lesson.meta;
    if (m.mode === 'path') state.pathStep = m.to; // bir sonraki oturum kaldığı yerden devam eder
    const total = lesson.items.length;
    const ratio = lesson.passed / total;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
    saveState();
    renderModePicker();
    addActivity('lesson', `Ders bitti: ${lesson.passed}/${total} (${'⭐'.repeat(stars)})`);
    playSound('levelup');
    const last = state.knownLetters[state.knownLetters.length - 1];
    const next = Curriculum.LETTER_ORDER[Curriculum.LETTER_ORDER.indexOf(last) + 1];
    const pathLeft = m.mode === 'path' && m.to < m.total;
    const nextStepLetter = pathLeft ? Curriculum.normalizeKnown(state.knownLetters)[m.to + 1] : null;
    const buttons = [];
    if (pathLeft) buttons.push(`<button class="btn-primary" id="sum-continue">Devam: +${caseText(nextStepLetter)} ➔</button>`);
    else buttons.push(`<button class="btn-primary" id="sum-continue">${m.mode === 'path' ? 'Baştan tekrar' : 'Yeni ders'} ➔</button>`);
    if (next && !pathLeft) buttons.push(`<button class="btn-secondary" id="sum-next">Yeni harf: ${caseText(next)}</button>`);
    buttons.push('<button class="btn-secondary" id="sum-again">🔁 Bu dersi tekrarla</button>');
    buttons.push('<button class="btn-secondary" id="sum-cert">🎓 Belge</button>');
    buttons.push('<button class="btn-secondary" id="sum-home">Ana menü</button>');
    const s = $('rd-summary');
    s.innerHTML = `
        <div style="font-size:72px">🏆</div>
        <h2>Ders bitti, ${state.childName}!</h2>
        <div class="stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
        <div class="sum-stats">
            <div><b>${lesson.passed}/${total}</b>doğru</div>
            <div><b>${lesson.helped + lesson.skipped}</b>pekiştirilecek</div>
            <div><b>${state.score}</b>puan</div>
        </div>
        <div class="sum-actions">${buttons.join('')}</div>`;
    s.classList.remove('hidden');
    $('sum-continue').onclick = startLesson;
    $('sum-again').onclick = () => { if (m.mode === 'path') { state.pathStep = m.from; saveState(); } startLesson(); };
    $('sum-home').onclick = () => showScreen('home');
    $('sum-cert').onclick = openCertificate;
    if ($('sum-next')) $('sum-next').onclick = () => { setKnownThrough(next); startLesson(); };
}

function prevItem() {
    if (lesson.idx > 0) showItem(lesson.idx - 1);
}

async function parentVerdict(ok) {
    Voice.unlock();
    const item = currentItem();
    if (!item || lesson.done) return;
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    if (lesson.busy && lesson.ctl.stop) lesson.ctl.stop();
    if (lesson.meta.mode === 'teach') {
        if (ok) { nextItem(); return; }
        if (lesson.lastTaught && lesson.lastTaught.key === item.key) {
            await Templates.remove(item.key, lesson.lastTaught.feat);
            lesson.lastTaught = null;
            lesson.taught = Math.max(0, lesson.taught - 1);
            refreshSettingsInfo();
        }
        $('rd-card').classList.remove('ok');
        say('Tekrar oku!');
        autoAdvanceTimer = setTimeout(() => { if (currentItem() === item && !lesson.busy) onListenClick(); }, 600);
        return;
    }
    if (ok) {
        if ($('rd-card').classList.contains('ok')) { nextItem(); return; }
        addActivity('parent', `Veli onayladı: ${item.text}`);
        onSuccess(item, lesson.lastResult || { feat: lesson.lastFeat }, 'parent');
    } else {
        Recognizer.rejected(item, lesson.lastResult);
        $('rd-card').classList.remove('ok');
        $('rd-card').classList.add('again');
        say('Tekrar deneyelim!');
        await speakItem();
    }
}

// ---------- Kelime Kur oyunu ----------
const wordGame = { word: null, placed: [] };

function startWordGame() {
    Voice.unlock();
    const words = Curriculum.wordsFor(state.knownLetters, { minSyllables: 2 });
    if (words.length === 0) { alert('Bu harflerle kurulacak kelime yok. Önce birkaç harf daha öğrenin.'); return; }
    const word = words[Math.floor(Math.random() * words.length)];
    wordGame.word = word;
    wordGame.placed = [];
    $('target-word-display').textContent = caseText(word.sequence);
    $('target-word-hint').textContent = 'Heceleri doğru sıraya diz';
    const slots = $('syllable-slots');
    slots.innerHTML = '';
    word.syllables.forEach((_, i) => {
        const slot = document.createElement('div');
        slot.className = 'syllable-slot';
        slot.dataset.index = i;
        slots.appendChild(slot);
    });
    const bank = $('syllable-bank');
    bank.innerHTML = '';
    word.syllables.slice().sort(() => Math.random() - 0.5).forEach((s) => {
        const btn = document.createElement('button');
        btn.className = 'syllable-bank-btn';
        btn.textContent = caseText(s);
        btn.addEventListener('click', () => {
            if (wordGame.placed.length >= word.syllables.length) return;
            Voice.play(`hece/${s}`, { text: s });
            const slot = slots.children[wordGame.placed.length];
            slot.textContent = caseText(s);
            slot.classList.add('filled');
            wordGame.placed.push(s);
            btn.classList.add('used');
            btn.disabled = true;
            if (wordGame.placed.length === word.syllables.length) checkWord();
        });
        bank.appendChild(btn);
    });
    $('word-feedback').classList.add('hidden');
    $('btn-word-next').classList.add('hidden');
    showScreen('word');
}

function checkWord() {
    const w = wordGame.word;
    const ok = wordGame.placed.every((p, i) => p === w.syllables[i]);
    const fb = $('word-feedback');
    if (ok) {
        state.score += 20;
        bumpStat({ key: `kelime/${w.sequence}` }, true);
        fb.textContent = '🎉 Harika! Kelimeyi doğru kurdun!';
        fb.className = 'word-feedback feedback-success';
        playSound('correct');
        setTimeout(() => Voice.play(`kelime/${w.sequence}`, { text: w.sequence }), 500);
        addActivity('word_success', w.sequence);
    } else {
        fb.textContent = '🤔 Hemen hemen! Tekrar deneyelim.';
        fb.className = 'word-feedback feedback-warning';
        playSound('wrong');
    }
    saveState();
    $('btn-word-next').classList.remove('hidden');
}

function clearWord() {
    Array.from($('syllable-slots').children).forEach((s) => { s.textContent = ''; s.classList.remove('filled'); });
    Array.from($('syllable-bank').children).forEach((b) => { b.classList.remove('used'); b.disabled = false; });
    wordGame.placed = [];
    $('word-feedback').classList.add('hidden');
    $('btn-word-next').classList.add('hidden');
}

// ---------- Veli paneli ----------
function statCount(prefix) {
    return Object.keys(state.stats).filter((k) => k.startsWith(prefix) && state.stats[k].ok > 0).length;
}

function renderDashboard() {
    $('dash-total-score').textContent = state.score;
    $('dash-mastered-hece').textContent = statCount('hece/');
    $('dash-mastered-kelime').textContent = statCount('kelime/');
    $('dash-current-level').textContent = state.lessons + 1;

    const grid = $('letter-progress-grid');
    grid.innerHTML = '';
    Curriculum.LETTER_ORDER.forEach((letter) => {
        const known = state.knownLetters.includes(letter);
        const item = document.createElement('div');
        item.className = 'letter-progress-item' + (known ? ' mastered' : '');
        item.innerHTML = `<span class="letter-char">${letter} (${letter.toLocaleUpperCase(TR)})</span><span class="letter-status">${known ? 'Bildi' : 'Öğrenilecek'}</span>`;
        grid.appendChild(item);
    });

    renderRecognitionStats();

    const weak = $('weak-list');
    weak.innerHTML = '';
    const rows = Object.keys(state.stats).map((k) => ({ k, ...state.stats[k] }))
        .filter((r) => r.tries - r.ok >= 2 && r.ok / r.tries < 0.6)
        .sort((a, b) => (b.tries - b.ok) - (a.tries - a.ok)).slice(0, 8);
    if (rows.length === 0) weak.innerHTML = '<div class="activity-item empty">Şimdilik takıldığı bir şey yok.</div>';
    rows.forEach((r) => {
        const d = document.createElement('div');
        d.className = 'activity-item';
        d.innerHTML = `<span><b>${r.k.split('/')[1]}</b> (${r.k.split('/')[0]})</span><span style="font-size:12px">${r.ok}/${r.tries} doğru</span>`;
        weak.appendChild(d);
    });

    const list = $('activity-list');
    list.innerHTML = '';
    const recent = state.activities.slice(0, 10);
    if (recent.length === 0) list.innerHTML = '<div class="activity-item empty">Henüz aktivite yok.</div>';
    recent.forEach((a) => {
        const d = document.createElement('div');
        d.className = 'activity-item';
        d.innerHTML = `<span>${a.text}</span><span style="font-size:11px;color:var(--text-light);">${a.time}</span>`;
        list.appendChild(d);
    });
}

// Tanıma gelişimi: son denemelerin dökümü ve ilk yarı / son yarı karşılaştırması
function renderRecognitionStats() {
    const box = $('recog-stats');
    box.innerHTML = '';
    let log = [];
    try { log = JSON.parse(localStorage.getItem('selim_okur_asr_log') || '[]'); } catch (e) { /* boş */ }
    log = log.filter((x) => x.verdict !== 'nospeech').slice(-60);
    const row = (a, b) => { const d = document.createElement('div'); d.className = 'activity-item'; d.innerHTML = `<span>${a}</span><span style="font-size:13px;font-weight:700">${b}</span>`; box.appendChild(d); };
    row('Öğrenilen ses/hece', `${Templates.labels().length} (${Templates.total()} örnek)`);
    row('Öğrenilen tanıyıcı hatası', `${Learned.stats().aliases}`);
    if (log.length < 6) { row('Otomatik tanıma oranı', 'Biraz daha oku, sonra gösteririm'); return; }
    const rate = (xs) => Math.round((100 * xs.filter((x) => x.verdict === 'correct').length) / xs.length);
    const half = Math.floor(log.length / 2);
    const first = rate(log.slice(0, half)), last = rate(log.slice(half));
    row(`Otomatik doğru (son ${log.length} deneme)`, `%${rate(log)}`);
    row('İlk yarı → son yarı', `%${first} → %${last} ${last > first ? '📈' : last < first ? '📉' : '➖'}`);
    const viaVoice = log.filter((x) => (x.why || '').startsWith('voice')).length;
    const viaAlias = log.filter((x) => x.why === 'learned-alias').length;
    if (viaVoice + viaAlias > 0) row('Ses ve alışkanlıkla tanınan', `${viaVoice + viaAlias} deneme`);
}

function openCertificate() {
    showScreen('certificate');
    $('cert-name').textContent = state.childName;
    $('cert-score').textContent = state.score;
    $('cert-hece').textContent = statCount('hece/');
    $('cert-kelime').textContent = statCount('kelime/');
    $('cert-date').textContent = new Date().toLocaleDateString(TR);
    $('cert-achievement-text').textContent = 'Okuma yolculuğunda büyük adımlar atıyor!';
}

// ---------- Ayarlar ----------
function applyParentModeText() {
    $('toggle-text').textContent = state.isParentMode ? '👨‍👧 Veli Onayı Modu' : '🤖 Otomatik Dinleme Modu';
    $('mode-hint').textContent = state.isParentMode
        ? 'Çocuk okuduğunda sen "Doğru okudu" butonuna basacaksın.'
        : 'Uygulama mikrofonla çocuğun sesini dinler; emin olamazsa sana sorar.';
}

function refreshSettingsInfo() {
    const n = Templates.total();
    const l = Learned.stats();
    $('template-count').textContent = n === 0
        ? 'Henüz öğrenilmiş kayıt yok. "Sesimi Tanıt" ile ya da Selim doğru okudukça (sen onayladıkça) uygulama onun sesini öğrenir ve daha iyi tanır.'
        : `${Templates.labels().length} farklı hece/ses için toplam ${n} ses örneği, ${l.aliases} öğrenilmiş tanıyıcı hatası.`;
    $('engine-note').textContent = Recognizer.webSpeechAvailable()
        ? 'Bu cihazda tarayıcı konuşma tanıma var; ses eşleştirmeyle birlikte kullanılır.'
        : 'Bu cihazda tarayıcı konuşma tanıma güvenilir değil (iPad/Safari); yalnızca ses eşleştirme kullanılır. Doğruluk için doğru okumaları onayla.';
}

function saveSettings() {
    state.childName = $('setting-child-name').value || 'Selim';
    state.character = $('setting-character').value;
    state.sfxEnabled = $('setting-sfx').checked;
    state.isAutoMode = $('setting-auto-mode').checked;
    state.isParentMode = $('parent-mode-toggle').checked;
    state.engine = $('setting-engine').value;
    state.micRelease = $('setting-mic-release').checked;
    $('character').textContent = state.character;
    saveState();
    alert('Ayarlar kaydedildi!');
}

async function runMicTest() {
    const out = $('mic-test-out'), meter = $('mic-meter'), btn = $('btn-mic-test');
    btn.disabled = true;
    out.textContent = 'Mikrofon açılıyor…';
    try {
        await Mic.ensure();
        out.textContent = '🎙 Şimdi bir hece söyle (örn. "ka")…';
        const t0 = performance.now();
        const heard = await Recognizer.listen({
            engine: state.engine,
            onLevel: (v) => { meter.style.width = `${Math.round(v * 100)}%`; },
            onInterim: (t) => { out.textContent = `🎙 Duyuluyor: “${t}”`; }
        });
        const feat = heard.audio.speech ? DSP.features(heard.audio.samples, heard.audio.rate) : [];
        out.textContent = [
            `Ses algılandı: ${heard.audio.speech ? 'evet' : 'HAYIR (mikrofon seviyesini kontrol et)'}`,
            `Süre: ${(heard.audio.ms / 1000).toFixed(1)} sn, örnekleme: ${heard.audio.rate} Hz, öznitelik: ${feat.length} kare`,
            `Tarayıcı tanıma: ${heard.webAvailable ? 'açık' : 'bu cihazda kapalı/yok'}${heard.srError ? ` (hata: ${heard.srError})` : ''}`,
            heard.webAvailable ? `Duyulan: ${heard.web.alts.length ? heard.web.alts.slice(0, 4).map((a) => `“${a}”`).join(', ') : '(hiçbir şey)'}` : '',
            `Süre: ${Math.round(performance.now() - t0)} ms`
        ].filter(Boolean).join('\n');
    } catch (e) {
        out.textContent = micErrorText(e);
    }
    meter.style.width = '0';
    btn.disabled = false;
}

// Sesleri çevrimdışı için bir kez arka planda indir (servis çalışanı yoksa ya da yayın paketinde gerekmez)
function warmAudioOnce() {
    if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
    const flag = 'selim_okur_audio_warm_v12';
    try { if (localStorage.getItem(flag) === '1') return; } catch (e) { return; }
    navigator.serviceWorker.ready.then(() => new Promise((r) => setTimeout(r, 2500))).then(() => Voice.warmCache())
        .then((done) => { if (done) { try { localStorage.setItem(flag, '1'); } catch (e) { /* */ } } }).catch(() => {});
}

// ---------- Ortam uyarıları (iPad/PWA/HTTPS) ----------
const dismissed = (k) => { try { return localStorage.getItem(`selim_okur_dismiss_${k}`) === '1'; } catch (e) { return false; } };
const dismiss = (k) => { try { localStorage.setItem(`selim_okur_dismiss_${k}`, '1'); } catch (e) { /* */ } renderEnvBanners(); };

function renderEnvBanners() {
    const box = $('env-banners');
    if (!box) return;
    box.innerHTML = '';
    const add = (cls, html, actions = []) => {
        const d = document.createElement('div');
        d.className = `env-banner ${cls}`;
        d.innerHTML = `<span>${html}</span>`;
        actions.forEach(({ label, fn }) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.onclick = fn; d.appendChild(b); });
        box.appendChild(d);
    };
    if (!Platform.isSecure) add('warn', '🔒 Mikrofon için bu sayfa <b>HTTPS</b> ile açılmalı (README → iPad).');
    if (Platform.isIOS && !Platform.isStandalone && !dismissed('a2hs')) {
        add('info', '📲 En iyi sonuç için Safari\'de <b>Paylaş ⎙ ▸ Ana Ekrana Ekle</b> de. Uygulama tam ekran açılır ve öğrendikleri silinmez.', [{ label: 'Tamam', fn: () => dismiss('a2hs') }]);
    }
    if (Templates.total() === 0 && !Recognizer.webSpeechAvailable() && !dismissed('teach1')) {
        add('info', '🎙 Bu cihazda uygulama Selim\'in sesini kendisi öğrenmeli. Önce <b>Sesimi Tanıt</b> ile 3 dakikalık bir tur yap.', [{ label: 'Şimdi tanıt', fn: startTeach }, { label: 'Sonra', fn: () => dismiss('teach1') }]);
    }
}

// ---------- Yedek ve taşıma ----------
async function exportBackup() {
    const voices = [];
    for (const key of await Store.allVoiceKeys()) {
        const row = await Store.getVoice(key);
        if (row && row.blob) voices.push({ key, type: row.blob.type || 'audio/mp4', data: Backup.toBase64(new Uint8Array(await row.blob.arrayBuffer())) });
    }
    const st = {};
    PERSIST.forEach((k) => { st[k] = state[k]; });
    let log = [];
    try { log = JSON.parse(localStorage.getItem('selim_okur_asr_log') || '[]'); } catch (e) { /* */ }
    const text = JSON.stringify(Backup.build({ state: st, learned: Learned.dump(), templates: Templates.dictFor(Templates.labels()), voices, log }));
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `selim-okur-yedek-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function importBackup(file) {
    let parsed;
    try { parsed = Backup.parse(await file.text()); } catch (e) { alert(e.message); return; }
    const n = Object.keys(parsed.templates).length;
    if (!confirm(`Yedek (${(parsed.date || '').slice(0, 10)}) yüklenecek: ${n} ses/hece örneği, ${parsed.voices.length} kayıt. Bu cihazdaki mevcut ilerleme ve öğrenilenlerin yerine geçer. Devam edilsin mi?`)) return;
    try {
        localStorage.setItem('selim_okur_state', JSON.stringify(parsed.state));
        localStorage.setItem('selim_okur_asr_log', JSON.stringify(parsed.log || []));
        Learned.replace(parsed.learned);
        await Store.clearTemplates();
        for (const [label, feats] of Object.entries(parsed.templates)) await Store.putTemplates(label, feats);
        for (const key of await Store.allVoiceKeys()) await Store.delVoice(key);
        for (const v of parsed.voices) await Store.putVoice(v.key, new Blob([Backup.fromBase64(v.data)], { type: v.type }));
    } catch (e) { alert(`Yüklenemedi: ${e.message}`); return; }
    location.reload();
}

// ---------- Seslerim (kayıt stüdyosu) ----------
let studioTab = 'ses';
let studioRec = null;

function studioItems(tab) {
    const known = state.knownLetters;
    if (tab === 'ses') return known.map((l) => ({ key: `ses/${l}`, text: l, say: Judge.letterAliases(l)[1] || l }));
    if (tab === 'hece') return Curriculum.generateSyllables(known).filter((s) => s.difficulty === 'Simple').map((s) => ({ key: `hece/${s.sequence}`, text: s.sequence, say: s.sequence }));
    if (tab === 'kelime') return Curriculum.wordsFor(known).map((w) => ({ key: `kelime/${w.sequence}`, text: w.sequence, say: w.sequence }));
    return Curriculum.sentencesFor(known).map((s) => ({ key: `cumle/${Curriculum.slug(s.text)}`, text: s.text, say: s.text }));
}

function renderStudio() {
    const tabs = $('studio-tabs');
    tabs.innerHTML = '';
    [['ses', 'Harfler'], ['hece', 'Heceler'], ['kelime', 'Kelimeler'], ['cumle', 'Cümleler']].forEach(([k, label]) => {
        const b = document.createElement('button');
        b.className = 'studio-tab' + (k === studioTab ? ' active' : '');
        b.textContent = label;
        b.onclick = () => { studioTab = k; renderStudio(); };
        tabs.appendChild(b);
    });
    const list = $('studio-list');
    list.innerHTML = '';
    studioItems(studioTab).forEach((it) => {
        const row = document.createElement('div');
        row.className = 'studio-row';
        const src = Voice.source(it.key);
        row.innerHTML = `<span class="txt">${it.text}</span><span class="src ${src === 'kayıt' ? 'rec' : ''}">${src === 'kayıt' ? 'Benim sesim' : src === 'dosya' ? 'Hazır ses' : 'Tarayıcı sesi'}</span>
            <button data-a="play" title="Dinle">▶</button><button data-a="rec" title="Kaydet">⏺</button>${src === 'kayıt' ? '<button data-a="del" title="Kaydı sil">✕</button>' : ''}`;
        row.querySelector('[data-a="play"]').onclick = () => { Voice.unlock(); Voice.play(it.key, { text: it.say }); };
        row.querySelector('[data-a="rec"]').onclick = (e) => toggleStudioRecord(it, e.currentTarget);
        const del = row.querySelector('[data-a="del"]');
        if (del) del.onclick = async () => { await Voice.deleteRecording(it.key); renderStudio(); };
        list.appendChild(row);
    });
}

async function toggleStudioRecord(it, btn) {
    Voice.unlock();
    if (studioRec) { studioRec.stop(); return; }
    try { await Mic.ensure(); } catch (e) { alert(e.code === 'denied' ? 'Mikrofon izni verilmedi.' : e.message); return; }
    Voice.stop();
    btn.classList.add('rec-on');
    const rec = Mic.recordBlob({ maxMs: it.text.length > 8 ? 6000 : 3000 });
    studioRec = rec;
    const blob = await rec.done;
    studioRec = null;
    btn.classList.remove('rec-on');
    if (blob.size > 800) await Voice.saveRecording(it.key, blob);
    renderStudio();
}

// ---------- Olaylar ----------
function setupEventListeners() {
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
    // iOS: ses çalma ve ses bağlamı ancak bir dokunuş içinde açılır
    const unlockAll = () => { Voice.unlock(); Platform.unlockAudio(); };
    document.addEventListener('pointerdown', unlockAll, { passive: true });
    document.addEventListener('touchend', unlockAll, { once: true, passive: true });
    // iPad: çift dokunma/sıkıştırma ile yakınlaşma ve sürükleyerek yenileme oyunu bozmasın
    ['gesturestart', 'gesturechange', 'gestureend'].forEach((ev) => document.addEventListener(ev, (e) => e.preventDefault()));
    document.addEventListener('dblclick', (e) => e.preventDefault());

    on('letter-grid', 'click', (e) => {
        const b = e.target.closest('.letter-btn');
        if (!b) return;
        if (state.mode === 'focus') toggleFocus(b.dataset.letter);
        else setKnownThrough(b.dataset.letter);
    });
    document.querySelectorAll('.mode-chip').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
    on('btn-case-lower', 'click', () => { state.isLowerCase = true; updateCaseButtons(); renderLetterGrid(); saveState(); });
    on('btn-case-upper', 'click', () => { state.isLowerCase = false; updateCaseButtons(); renderLetterGrid(); saveState(); });
    on('parent-mode-toggle', 'change', (e) => { state.isParentMode = e.target.checked; applyParentModeText(); saveState(); });

    on('btn-start', 'click', startLesson);
    on('btn-teach', 'click', startTeach);
    on('btn-word-game', 'click', startWordGame);
    on('btn-studio', 'click', () => { renderStudio(); showScreen('studio'); });
    on('btn-studio-back', 'click', () => showScreen('home'));
    on('btn-dashboard-back', 'click', () => showScreen('home'));
    on('btn-game-back', 'click', () => { if (lesson.busy && lesson.ctl.stop) lesson.ctl.stop(); showScreen('home'); });
    on('btn-word-back', 'click', () => showScreen('home'));
    on('btn-settings-back', 'click', () => showScreen('home'));
    on('btn-settings-save', 'click', saveSettings);
    on('btn-parent-dashboard', 'click', () => showScreen('dashboard'));
    on('btn-settings', 'click', () => showScreen('settings'));
    on('btn-export-log', 'click', exportAsrLog);
    on('btn-backup', 'click', exportBackup);
    on('file-restore', 'change', (e) => { const f = e.target.files && e.target.files[0]; if (f) importBackup(f); e.target.value = ''; });
    on('btn-mic-test', 'click', runMicTest);
    on('btn-clear-templates', 'click', async () => {
        if (confirm('Selim\'in sesinden öğrenilenler silinsin mi?')) { await Templates.clear(); Learned.clear(); refreshSettingsInfo(); renderDashboard(); }
    });
    on('btn-reset-progress', 'click', () => {
        if (!confirm('Tüm ilerleme sıfırlanacak. Emin misiniz?')) return;
        state.knownLetters = Curriculum.lettersThrough('t');
        state.score = 0; state.lessons = 0; state.stats = {}; state.activities = [];
        state.pathStep = 0; state.focusLetters = []; state.mode = 'path';
        saveState(); renderLetterGrid(); updateStartButton(); renderModePicker(); renderDashboard();
    });

    on('btn-listen', 'click', onListenClick);
    on('btn-repeat', 'click', () => { Voice.unlock(); speakItem(); });
    on('btn-next', 'click', () => nextItem(!$('rd-card').classList.contains('ok')));
    on('btn-parent-yes', 'click', () => parentVerdict(true));
    on('btn-parent-no', 'click', () => parentVerdict(false));

    on('btn-word-clear', 'click', clearWord);
    on('btn-word-check', 'click', () => { if (wordGame.placed.length === wordGame.word.syllables.length) checkWord(); });
    on('btn-word-next', 'click', startWordGame);
    on('btn-cert-print', 'click', () => window.print());
    on('btn-cert-home', 'click', () => showScreen('home'));

    document.addEventListener('keydown', (e) => {
        if (!screens.game.classList.contains('active') || e.target.matches('input, select, textarea')) return;
        if (e.code === 'Space') { e.preventDefault(); onListenClick(); }
        else if (e.key === 'ArrowRight') nextItem(!$('rd-card').classList.contains('ok'));
        else if (e.key === 'ArrowLeft') prevItem();
        else if (e.key.toLowerCase() === 'd') speakItem();
    });
}

// ---------- Efekt sesleri ----------
let sfxCtx = null;
function playSound(type) {
    if (!state.sfxEnabled) return;
    try {
        sfxCtx = Platform.audioContext();
        if (sfxCtx.state !== 'running') sfxCtx.resume().catch(() => {});
        const t = sfxCtx.currentTime, osc = sfxCtx.createOscillator(), gain = sfxCtx.createGain();
        osc.connect(gain); gain.connect(sfxCtx.destination);
        const tune = {
            correct: ['sine', [[523.25, 0], [783.99, 0.15]], 0.25, 0.12],
            wrong: ['triangle', [[300, 0], [200, 0.25]], 0.3, 0.08],
            levelup: ['sine', [[440, 0], [880, 0.15], [1320, 0.3]], 0.5, 0.15]
        }[type];
        if (!tune) return;
        osc.type = tune[0];
        tune[1].forEach(([f, d], i) => (i === 0 ? osc.frequency.setValueAtTime(f, t + d) : osc.frequency.linearRampToValueAtTime(f, t + d)));
        gain.gain.setValueAtTime(tune[3], t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + tune[2]);
        osc.start(t); osc.stop(t + tune[2]);
    } catch (e) { /* ses efekti zorunlu değil */ }
}

init();
