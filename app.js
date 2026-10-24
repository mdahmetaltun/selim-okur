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
const STEP_NAME = { ses: 'Ses', hece: 'Hece', kelime: 'Kelime', cumle: 'Cümle' };
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
    stats: {},       // anahtar -> { ok, tries }
    activities: []
};
const PERSIST = ['knownLetters', 'isLowerCase', 'score', 'lessons', 'isParentMode', 'isAutoMode', 'childName', 'character', 'sfxEnabled', 'engine', 'stats', 'activities'];

const $ = (id) => document.getElementById(id);
const screens = {};
let autoAdvanceTimer = null;

function init() {
    ['home', 'dashboard', 'game', 'word', 'certificate', 'settings', 'studio'].forEach((n) => { screens[n] = $(`screen-${n}`); });
    loadState();
    renderLetterGrid();
    updateCaseButtons();
    updateStartButton();
    renderDashboard();
    setupEventListeners();
    showScreen('home');
    Promise.all([Voice.init(), Templates.load()]).then(refreshSettingsInfo);
}

function loadState() {
    try {
        const saved = JSON.parse(localStorage.getItem('selim_okur_state') || 'null');
        if (saved) {
            PERSIST.forEach((k) => { if (saved[k] !== undefined) state[k] = saved[k]; });
            state.knownLetters = Curriculum.normalizeKnown(state.knownLetters);
            if (state.knownLetters.length === 0) state.knownLetters = Curriculum.lettersThrough('t');
        }
    } catch (e) { console.error('Load error:', e); }
    $('setting-child-name').value = state.childName;
    $('setting-character').value = state.character;
    $('setting-sfx').checked = state.sfxEnabled;
    $('setting-auto-mode').checked = state.isAutoMode;
    $('setting-engine').value = state.engine;
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
    renderLetterGrid();
    updateStartButton();
    saveState();
}

function updateCaseButtons() {
    $('btn-case-lower').classList.toggle('active', state.isLowerCase);
    $('btn-case-upper').classList.toggle('active', !state.isLowerCase);
}

function updateStartButton() {
    const ok = state.knownLetters.some(isTurkishVowel) && state.knownLetters.some(isTurkishConsonant);
    $('btn-start').disabled = !ok;
    $('btn-start').classList.toggle('disabled', !ok);
}

// ---------- Ders akışı ----------
const lesson = { items: [], idx: 0, attempts: 0, uncertain: 0, busy: false, ctl: {}, passed: 0, helped: 0, skipped: 0, lastFeat: null, done: false };

function startLesson() {
    Voice.unlock();
    const items = Curriculum.buildLesson(state.knownLetters);
    if (items.length === 0) { alert('Önce kitapta öğrenilen son harfe dokun.'); return; }
    Object.assign(lesson, { items, idx: 0, attempts: 0, uncertain: 0, busy: false, ctl: {}, passed: 0, helped: 0, skipped: 0, lastFeat: null, done: false });
    $('rd-summary').classList.add('hidden');
    showScreen('game');
    $('character').textContent = state.character;
    renderSteps();
    showItem(0);
    addActivity('start', `Ders başladı (${caseText(state.knownLetters[state.knownLetters.length - 1])} harfine kadar)`);
}

const currentItem = () => lesson.items[lesson.idx];
const poolFor = (item) => lesson.items.filter((i) => i.kind === item.kind && i.key !== item.key);

function renderSteps() {
    const kinds = [...new Set(lesson.items.map((i) => i.kind))];
    const ol = $('rd-steps');
    ol.innerHTML = '';
    kinds.forEach((k) => {
        const li = document.createElement('li');
        li.className = 'rd-step';
        li.dataset.kind = k;
        li.textContent = STEP_NAME[k];
        ol.appendChild(li);
    });
    updateSteps();
}

function updateSteps() {
    const cur = currentItem();
    document.querySelectorAll('.rd-step').forEach((li) => {
        const k = li.dataset.kind;
        const all = lesson.items.filter((i) => i.kind === k);
        const doneN = all.filter((i) => lesson.items.indexOf(i) < lesson.idx).length;
        li.style.setProperty('--p', (doneN / all.length).toFixed(2));
        li.classList.toggle('done', doneN === all.length);
        li.classList.toggle('current', !!cur && cur.kind === k);
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
    const item = currentItem();
    const card = $('rd-card');
    card.className = 'rd-card';
    card.dataset.kind = item.kind;
    $('rd-kind').textContent = KIND_LABEL[item.kind];
    $('rd-hint').textContent = KIND_HINT[item.kind];
    $('rd-heard').textContent = '';
    renderCardText(item);
    hideFeedback();
    setParentAttention(state.isParentMode, state.isParentMode ? `${state.childName} okuyunca onayla:` : '👨‍👧 Veli onayı:');
    setMicState('idle');
    $('game-score').textContent = state.score;
    updateSteps();
    if (item.kind === 'ses') setTimeout(() => { if (currentItem() === item && !lesson.busy) speakItem(); }, 350);
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

function logAttempt(item, r) {
    try {
        const log = JSON.parse(localStorage.getItem('selim_okur_asr_log') || '[]');
        log.push({ t: Date.now(), key: item.key, heard: r.heard, verdict: r.verdict, why: r.why, ev: r.evidence, web: r.webAvailable, err: r.srError || null });
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
        showFeedback(e.code === 'denied'
            ? 'Mikrofon izni kapalı. Adres çubuğundaki kilit simgesinden mikrofona izin ver ya da veli onayını kullan.'
            : `Mikrofon açılamadı: ${e.message}`, 'error');
        setParentAttention(true, 'Mikrofon yok. Selim okuyunca sen onayla:');
        return;
    }
    setMicState('listening');
    $('btn-listen').disabled = false; // dinlerken "Bitir" olarak çalışır
    say(`Seni dinliyorum, ${state.childName}!`);
    let heard;
    try {
        heard = await Recognizer.listen({
            engine: state.engine,
            ctl: lesson.ctl,
            onLevel: (v) => $('btn-listen').style.setProperty('--lvl', v.toFixed(2)),
            onInterim: (t) => { $('rd-heard').textContent = `“${t}”`; },
            maxMs: item.kind === 'cumle' ? 12000 : 6000
        });
    } catch (e) {
        lesson.busy = false;
        setMicState('idle');
        showFeedback(`Dinleme hatası: ${e.message}`, 'error');
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
    logAttempt(item, r);
    setMicState('idle');
    applyVerdict(item, r);
}

function applyVerdict(item, r) {
    const card = $('rd-card');
    if (r.heard) $('rd-heard').textContent = `Duyulan: “${r.heard}”`;
    if (r.srError === 'not-allowed' || r.srError === 'service-not-allowed') {
        showFeedback('Tarayıcının konuşma tanıması kapalı; yalnızca ses eşleştirme kullanılıyor.', 'warning');
    }
    if (r.verdict === 'correct') { onSuccess(item, lesson.lastFeat); return; }
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

async function onSuccess(item, feat) {
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
    try { await Recognizer.enroll(item, feat); } catch (e) { /* şablon zorunlu değil */ }
    refreshSettingsInfo();
    if (state.isAutoMode) autoAdvanceTimer = setTimeout(nextItem, 1500);
    else showFeedback('Doğru! Devam etmek için ➔ ye bas.', 'success');
}

function nextItem(skipped) {
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    if (lesson.busy && lesson.ctl.stop) lesson.ctl.stop();
    if (skipped === true) { lesson.skipped++; bumpStat(currentItem(), false); saveState(); }
    if (lesson.idx + 1 >= lesson.items.length) { finishLesson(); return; }
    showItem(lesson.idx + 1);
}

function finishLesson() {
    lesson.done = true;
    state.lessons++;
    const total = lesson.items.length;
    const ratio = lesson.passed / total;
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1;
    saveState();
    addActivity('lesson', `Ders bitti: ${lesson.passed}/${total} (${'⭐'.repeat(stars)})`);
    playSound('levelup');
    const idx = Curriculum.LETTER_ORDER.indexOf(state.knownLetters[state.knownLetters.length - 1]);
    const next = Curriculum.LETTER_ORDER[idx + 1];
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
        <div class="sum-actions">
            ${next ? `<button class="btn-primary" id="sum-next">Yeni harf: ${caseText(next)} ➔</button>` : ''}
            <button class="btn-secondary" id="sum-again">🔁 Dersi tekrarla</button>
            <button class="btn-secondary" id="sum-cert">🎓 Belge</button>
            <button class="btn-secondary" id="sum-home">Ana menü</button>
        </div>`;
    s.classList.remove('hidden');
    $('sum-again').onclick = startLesson;
    $('sum-home').onclick = () => showScreen('home');
    $('sum-cert').onclick = openCertificate;
    if (next) $('sum-next').onclick = () => { setKnownThrough(next); startLesson(); };
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
    if (ok) {
        if ($('rd-card').classList.contains('ok')) { nextItem(); return; }
        addActivity('parent', `Veli onayladı: ${item.text}`);
        onSuccess(item, lesson.lastFeat);
    } else {
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
    $('template-count').textContent = n === 0
        ? 'Henüz öğrenilmiş kayıt yok. Selim doğru okudukça (ya da sen onayladıkça) uygulama onun sesini öğrenir ve daha iyi tanır.'
        : `${Templates.labels().length} farklı hece/ses için toplam ${n} kayıt öğrenildi.`;
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
        out.textContent = e.code === 'denied' ? 'Mikrofon izni verilmedi. Adres çubuğundaki kilit simgesinden izin ver.' : `Hata: ${e.message}`;
    }
    meter.style.width = '0';
    btn.disabled = false;
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
    document.addEventListener('pointerdown', () => Voice.unlock(), { once: true });

    on('letter-grid', 'click', (e) => { const b = e.target.closest('.letter-btn'); if (b) setKnownThrough(b.dataset.letter); });
    on('btn-case-lower', 'click', () => { state.isLowerCase = true; updateCaseButtons(); renderLetterGrid(); saveState(); });
    on('btn-case-upper', 'click', () => { state.isLowerCase = false; updateCaseButtons(); renderLetterGrid(); saveState(); });
    on('parent-mode-toggle', 'change', (e) => { state.isParentMode = e.target.checked; applyParentModeText(); saveState(); });

    on('btn-start', 'click', startLesson);
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
    on('btn-mic-test', 'click', runMicTest);
    on('btn-clear-templates', 'click', async () => {
        if (confirm('Selim\'in sesinden öğrenilenler silinsin mi?')) { await Templates.clear(); refreshSettingsInfo(); }
    });
    on('btn-reset-progress', 'click', () => {
        if (!confirm('Tüm ilerleme sıfırlanacak. Emin misiniz?')) return;
        state.knownLetters = Curriculum.lettersThrough('t');
        state.score = 0; state.lessons = 0; state.stats = {}; state.activities = [];
        saveState(); renderLetterGrid(); updateStartButton(); renderDashboard();
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
        sfxCtx = sfxCtx || new (window.AudioContext || window.webkitAudioContext)();
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
