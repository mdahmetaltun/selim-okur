/**
 * Selim Okur - 1. Sınıf Okuma Eğitimi Uygulaması
 * Gerçek Web Speech API Ses Tanıma ve 1. Sınıf Küçük Harf Desteği
 */

// Müfredat (js/curriculum.js) ve hakem (js/judge.js) önceden yüklenir
const TURKISH_VOWELS = Curriculum.VOWELS;
const isTurkishVowel = (ch) => !!ch && Curriculum.isVowel(ch);
const isTurkishConsonant = (ch) => !!ch && Curriculum.isConsonant(ch);

function formatLetterCase(str) {
    if (!str) return '';
    return state.isLowerCase ? str.toLocaleLowerCase('tr-TR') : str.toLocaleUpperCase('tr-TR');
}

// Game state
const state = {
    knownLetters: Curriculum.lettersThrough('t'), // ders kitabı sırası: a n e t ...
    isLowerCase: true, // 1. sınıf için varsayılan küçük harf
    syllables: [],
    currentSyllable: null,
    currentWord: null,
    wordParts: [],
    placedSyllables: [],
    level: 1,
    score: 0,
    streak: 0,
    masteredHeceCount: 0,
    masteredKelimeCount: 0,
    totalHeceCount: 0,
    totalKelimeCount: 0,
    isParentMode: false,
    isAutoMode: true,
    gamePhase: 'HOME',
    childName: 'Selim',
    character: '🦁',
    speechRate: 1.0,
    sfxEnabled: true,
    bgmEnabled: false,
    activities: []
};

// DOM elements proxy to safely access any ID in kebab-case or camelCase
const screens = {};
const elements = new Proxy({}, {
    get: (target, prop) => {
        if (typeof prop !== 'string') return target[prop];
        if (target[prop]) return target[prop];
        let el = document.getElementById(prop);
        if (!el) {
            const kebab = prop.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
            el = document.getElementById(kebab);
        }
        if (el) target[prop] = el;
        return el;
    }
});

function init() {
    cacheScreens();
    loadState();
    renderLetterGrid();
    updateCaseButtons();
    updateStartButton();
    renderDashboard();
    setupEventListeners();
    showScreen('home');
}

function cacheScreens() {
    ['home', 'dashboard', 'game', 'word', 'certificate', 'settings'].forEach(name => {
        screens[name] = document.getElementById(`screen-${name}`);
    });
}

function loadState() {
    try {
        const saved = localStorage.getItem('selim_okur_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed.knownLetters) && parsed.knownLetters.length > 0) {
                state.knownLetters = Curriculum.normalizeKnown(parsed.knownLetters);
            }
            state.level = parsed.level || 1;
            state.score = parsed.score || 0;
            state.streak = parsed.streak || 0;
            state.masteredHeceCount = parsed.masteredHeceCount || 0;
            state.masteredKelimeCount = parsed.masteredKelimeCount || 0;
            state.childName = parsed.childName || 'Selim';
            state.character = parsed.character || '🦁';
            state.speechRate = parsed.speechRate || 1.0;
            state.sfxEnabled = parsed.sfxEnabled !== undefined ? parsed.sfxEnabled : true;
            state.isAutoMode = parsed.isAutoMode !== undefined ? parsed.isAutoMode : true;
            state.isParentMode = parsed.isParentMode !== undefined ? parsed.isParentMode : false;
            state.isLowerCase = parsed.isLowerCase !== undefined ? parsed.isLowerCase : true;
            state.activities = parsed.activities || [];

            const nameInput = document.getElementById('setting-child-name');
            if (nameInput) nameInput.value = state.childName;
            const charInput = document.getElementById('setting-character');
            if (charInput) charInput.value = state.character;
            const rateInput = document.getElementById('setting-speech-rate');
            if (rateInput) rateInput.value = state.speechRate;
            const sfxInput = document.getElementById('setting-sfx');
            if (sfxInput) sfxInput.checked = state.sfxEnabled;
            const autoInput = document.getElementById('setting-auto-mode');
            if (autoInput) autoInput.checked = state.isAutoMode;
            const parentToggle = document.getElementById('parent-mode-toggle');
            if (parentToggle) parentToggle.checked = state.isParentMode;
        }
    } catch (e) {
        console.error('Load error:', e);
    }
}

function saveState() {
    try {
        localStorage.setItem('selim_okur_state', JSON.stringify(state));
    } catch (e) {
        console.error('Save error:', e);
    }
}

function addActivity(type, text) {
    state.activities.unshift({ type, text, time: new Date().toLocaleTimeString('tr-TR') });
    if (state.activities.length > 50) state.activities.pop();
    saveState();
    renderDashboard();
}

function showScreen(name) {
    Object.values(screens).forEach(s => {
        if (s) s.classList.remove('active');
    });
    if (screens[name]) screens[name].classList.add('active');
    if (name === 'dashboard') renderDashboard();
    if (name === 'home') {
        const homeUserName = document.getElementById('home-user-name');
        if (homeUserName) homeUserName.textContent = state.childName;
    }
}

// Letter picker: kitaptaki sırayla dizilir; bir harfe dokunmak "buraya kadar öğrendi" demektir
function renderLetterGrid() {
    const grid = elements['letter-grid'];
    if (!grid) return;
    grid.innerHTML = '';
    Curriculum.LETTER_ORDER.forEach((letter, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'letter-btn' + (isTurkishVowel(letter) ? ' vowel-btn' : ' consonant-btn');
        btn.dataset.letter = letter;
        const mainChar = state.isLowerCase ? letter : letter.toLocaleUpperCase('tr-TR');
        const subChar = state.isLowerCase ? letter.toLocaleUpperCase('tr-TR') : letter;
        btn.innerHTML = `<span class="letter-main">${mainChar}</span><span class="letter-sub">${subChar}</span>`;
        btn.title = `${i + 1}. harf`;
        if (state.knownLetters.includes(letter)) btn.classList.add('selected');
        if (letter === state.knownLetters[state.knownLetters.length - 1]) btn.classList.add('last-known');
        grid.appendChild(btn);
    });
    renderSelectedTags();
}

function updateCaseButtons() {
    const btnLower = elements['btn-case-lower'];
    const btnUpper = elements['btn-case-upper'];
    if (btnLower) btnLower.classList.toggle('active', state.isLowerCase);
    if (btnUpper) btnUpper.classList.toggle('active', !state.isLowerCase);
}

function renderSelectedTags() {
    const container = elements['selected-tags'];
    if (!container) return;
    container.innerHTML = '';
    const vowelCount = state.knownLetters.filter(isTurkishVowel).length;
    const consonantCount = state.knownLetters.filter(isTurkishConsonant).length;
    if (elements['selected-vowel-count']) elements['selected-vowel-count'].textContent = vowelCount;
    if (elements['selected-consonant-count']) elements['selected-consonant-count'].textContent = consonantCount;

    state.knownLetters.forEach(letter => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.textContent = state.isLowerCase ? letter : letter.toLocaleUpperCase('tr-TR');
        container.appendChild(tag);
    });
}

// Bir harfe dokunmak, sıradaki o harfe kadar olan tüm harfleri bilinen yapar
function setKnownThrough(letter) {
    state.knownLetters = Curriculum.lettersThrough(letter);
    renderLetterGrid();
    updateStartButton();
    saveState();
}

function updateStartButton() {
    const hasVowel = state.knownLetters.some(isTurkishVowel);
    const hasConsonant = state.knownLetters.some(isTurkishConsonant);
    const canStart = hasVowel && hasConsonant;
    if (elements['btn-start']) {
        elements['btn-start'].disabled = !canStart;
        elements['btn-start'].classList.toggle('disabled', !canStart);
    }
}

// Game Loop
function startGame() {
    state.syllables = Curriculum.generateSyllables(state.knownLetters);
    if (state.syllables.length === 0) {
        showFeedback('Önce kitapta öğrenilen son harfe dokun (en az bir sesli ve bir sessiz harf).', 'error');
        return;
    }
    state.level = 1;
    state.score = 0;
    state.streak = 0;
    state.masteredHeceCount = 0;
    state.totalHeceCount = state.syllables.length;
    updateDisplays();
    showScreen('game');
    nextSyllable();
    addActivity('start', 'Okuma oyunu başlatıldı');
}

let autoAdvanceTimer = null;
let syllableHistory = [];

function prevSyllable() {
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    if (syllableHistory.length > 0) {
        state.currentSyllable = syllableHistory.pop();
        renderCurrentSyllable();
    } else {
        showFeedback('Zaten ilk hecedesiniz!', 'info');
    }
}

function nextSyllable() {
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);
    if (isListening && recognitionInstance) {
        try { recognitionInstance.stop(); } catch (e) {}
        isListening = false;
    }

    if (state.currentSyllable) {
        syllableHistory.push(state.currentSyllable);
        if (syllableHistory.length > 30) syllableHistory.shift();
    }

    if (state.masteredHeceCount >= state.totalHeceCount) {
        completeGame();
        return;
    }
    const focusLetter = state.knownLetters[state.knownLetters.length - 1];
    const target = Curriculum.pickSyllable(state.syllables, { focusLetter, exclude: state.currentSyllable });
    state.currentSyllable = target;
    renderCurrentSyllable();
}

function renderCurrentSyllable() {
    const target = state.currentSyllable;
    if (!target) return;

    elements['game-level'].textContent = state.level;
    elements['syllable-display'].textContent = formatLetterCase(target.sequence);
    elements['syllable-type'].textContent = target.difficulty === 'Simple' ? 'Basit Hece' : 'Orta Hece';
    elements['syllable-hint'].textContent = target.difficulty === 'Simple' ? 'Bu heceyi oku' : 'Dikkatli oku!';
    elements['session-current'].textContent = state.masteredHeceCount + 1;
    elements['session-total'].textContent = state.totalHeceCount;

    const ring = elements['progress-ring-fill'];
    if (ring) {
        const pct = state.totalHeceCount > 0 ? (state.masteredHeceCount / state.totalHeceCount) : 0;
        ring.style.strokeDashoffset = 314 * (1 - pct);
    }

    hideFeedback();
    if (elements['btn-next']) elements['btn-next'].classList.remove('hidden');
    if (elements['btn-parent-next']) elements['btn-parent-next'].classList.add('hidden');
    elements['btn-listen'].classList.remove('listening');
    elements['btn-listen'].querySelector('.listen-text').textContent = '🎤 Oku ve Dinlet';

    const listenResult = elements['listen-result'] || document.getElementById('listen-result');
    if (listenResult) {
        listenResult.textContent = '';
        listenResult.className = 'listen-result hidden';
    }

    if (state.isParentMode) {
        elements['parent-check-group'].classList.remove('hidden');
        elements['auto-check-group'].classList.add('hidden');
        showSpeechBubble('Selim okuduğunda onayla!');
    } else {
        elements['parent-check-group'].classList.add('hidden');
        elements['auto-check-group'].classList.remove('hidden');
        showSpeechBubble('Hadi oku bakalım, ' + state.childName + '!');
    }
}

// Text-to-Speech (Sadece Tekrar Dinle butonuna basınca çalar, cevabı önceden söylemez!)
function speakSyllable(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'tr-TR';
        utterance.rate = state.speechRate || 0.9;
        utterance.pitch = 1.1;
        window.speechSynthesis.speak(utterance);
    }
}

function showSpeechBubble(text) {
    const bubble = elements['speech-bubble'];
    if (!bubble) return;
    bubble.textContent = text;
    bubble.classList.add('show');
    setTimeout(() => bubble.classList.remove('show'), 3000);
}

// Gerçek Web Speech API Ses Tanıma Motoru
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognitionInstance = null;
let isListening = false;

function startListening() {
    const btn = elements['btn-listen'];
    const listenResult = elements['listen-result'] || document.getElementById('listen-result');

    if (!SpeechRecognition) {
        showFeedback("Tarayıcınız ses tanımayı desteklemiyor (Chrome/Safari önerilir). Veli onay modu açıldı.", "warning");
        elements['parent-check-group'].classList.remove('hidden');
        return;
    }

    if (isListening && recognitionInstance) {
        try { recognitionInstance.stop(); } catch (e) {}
        isListening = false;
        btn.classList.remove('listening');
        btn.querySelector('.listen-text').textContent = '🎤 Oku ve Dinlet';
        return;
    }

    try {
        recognitionInstance = new SpeechRecognition();
        recognitionInstance.lang = 'tr-TR';
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = true;
        recognitionInstance.maxAlternatives = 5;

        recognitionInstance.onstart = () => {
            isListening = true;
            btn.classList.add('listening');
            btn.querySelector('.listen-text').textContent = 'Dinliyorum... Şimdi oku!';
            if (listenResult) {
                listenResult.textContent = '🎤 Mikrofona doğru oku...';
                listenResult.className = 'listen-result';
                listenResult.classList.remove('hidden');
            }
            showSpeechBubble('Seni dinliyorum, ' + state.childName + '!');
        };

        recognitionInstance.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            const allAlternatives = [];

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                const res = event.results[i];
                if (res.isFinal) {
                    finalTranscript += res[0].transcript;
                    for (let a = 0; a < res.length; a++) {
                        allAlternatives.push(res[a].transcript);
                    }
                } else {
                    interimTranscript += res[0].transcript;
                }
            }

            const currentSpoken = (finalTranscript || interimTranscript).trim();
            if (listenResult && currentSpoken) {
                listenResult.textContent = `Duyulan: "${currentSpoken}"`;
            }

            if (finalTranscript) {
                evaluateSpeechInput(finalTranscript, allAlternatives);
            }
        };

        recognitionInstance.onerror = (event) => {
            console.warn('SpeechRecognition error:', event.error);
            isListening = false;
            btn.classList.remove('listening');
            btn.querySelector('.listen-text').textContent = '🎤 Tekrar Oku';

            if (event.error === 'no-speech') {
                showFeedback('Ses duyulamadı. Mikrofona biraz daha yaklaş!', 'warning');
                showSpeechBubble('Sesin gelmedi, mikrofona biraz yaklaşır mısın?');
            } else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                showFeedback('Mikrofon izni kapalı. Adres çubuğundaki kilit simgesinden mikrofona izin verin veya Veli Onayı ile onaylayın.', 'error');
                showSpeechBubble('Mikrofona izin vermeyi unutma!');
                elements['parent-check-group'].classList.remove('hidden');
            } else {
                showFeedback('Ses tanıma uyarısı: ' + event.error, 'warning');
            }
            // Herhangi bir aksamada veli hemen onaylayabilsin
            elements['parent-check-group'].classList.remove('hidden');
        };

        recognitionInstance.onend = () => {
            isListening = false;
            btn.classList.remove('listening');
            btn.querySelector('.listen-text').textContent = '🎤 Oku ve Dinlet';
        };

        recognitionInstance.start();
    } catch (err) {
        console.error('Speech recognition start error:', err);
        showFeedback('Mikrofon başlatılamadı: ' + err.message, 'error');
        elements['parent-check-group'].classList.remove('hidden');
    }
}

// Tanıma günlüğü: gerçekte ne duyulduğunu saklar, hakemi Selim'in sesine göre ayarlamak için
function logAttempt(target, heard, result) {
    try {
        const log = JSON.parse(localStorage.getItem('selim_okur_asr_log') || '[]');
        log.push({ t: Date.now(), target, heard, verdict: result.verdict, cost: result.best });
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

function evaluateSpeechInput(spokenText, alternatives) {
    if (!state.currentSyllable) return;
    const target = state.currentSyllable.sequence;
    const listenResult = elements['listen-result'] || document.getElementById('listen-result');
    const heard = (alternatives && alternatives.length > 0) ? alternatives : [spokenText];
    const pool = state.syllables.map(s => s.sequence);
    const result = Judge.judge(target, heard, pool);
    logAttempt(target, heard, result);

    const setResult = (text, cls) => {
        if (!listenResult) return;
        listenResult.textContent = text;
        listenResult.className = 'listen-result ' + cls;
        listenResult.classList.remove('hidden');
    };

    if (result.verdict === 'correct') {
        setResult(`Duyulan: "${result.heard}" ✓ Aferin!`, 'feedback-success');
        showSpeechBubble(`Aferin ${state.childName}! Doğru okudun!`);
        handleResult(true);
    } else if (result.verdict === 'uncertain') {
        // Emin değiliz: çocuğu yanlış cezalandırma, veli karar versin
        setResult(`Duyulan: "${result.heard}" — emin olamadım`, 'feedback-warning');
        showSpeechBubble('Tam anlayamadım. Bir daha okur musun?');
        showFeedback(`Duyulan: "${result.heard}". Doğru muydu? Veli onaylayabilir.`, 'warning');
        elements['parent-check-group'].classList.remove('hidden');
    } else {
        setResult(`Duyulan: "${result.heard || '...'}" (Hedef: "${formatLetterCase(target)}")`, 'feedback-warning');
        showSpeechBubble('Bir daha deneyelim mi?');
        showFeedback(`Duyulan: "${result.heard || '...'}" — Beklenen: "${formatLetterCase(target)}". Veli onayıyla da geçebilirsiniz.`, 'warning');
        elements['parent-check-group'].classList.remove('hidden');
        handleResult(false);
    }
}

function handleParentVerdict(isCorrect) {
    if (autoAdvanceTimer) clearTimeout(autoAdvanceTimer);

    if (isCorrect) {
        handleResult(true);
        if (elements['btn-parent-next']) {
            elements['btn-parent-next'].classList.remove('hidden');
        }
        if (elements['btn-next']) {
            elements['btn-next'].classList.remove('hidden');
        }
        // Bildi onayından 1.2 saniye sonra otomatik bir sonraki heceye geçer
        autoAdvanceTimer = setTimeout(() => {
            nextSyllable();
        }, 1200);
    } else {
        handleResult(false);
        if (elements['parent-check-group']) {
            elements['parent-check-group'].classList.remove('hidden');
        }
    }
}

function handleResult(isSuccess) {
    hideFeedback();
    if (isSuccess) {
        if (state.currentSyllable) {
            state.currentSyllable.isMastered = true;
            state.currentSyllable.attemptCount++;
        }
        state.score += 10;
        state.streak++;
        state.masteredHeceCount++;
        updateDisplays();
        showFeedback('🎉 Harika! Doğru okudun, ' + state.childName + '!', 'success');
        showSpeechBubble('Aferin ' + state.childName + '!');
        playSound('correct');
        elements['character'].textContent = '🎉';
        setTimeout(() => elements['character'].textContent = state.character, 1200);
        if (state.currentSyllable) addActivity('success', state.currentSyllable.sequence);
        elements['btn-next'].classList.remove('hidden');
    } else {
        if (state.currentSyllable) {
            state.currentSyllable.attemptCount++;
        }
        state.streak = 0;
        updateDisplays();
        playSound('wrong');
        elements['character'].textContent = '😊';
        setTimeout(() => elements['character'].textContent = state.character, 600);
        if (state.currentSyllable) addActivity('attempt', state.currentSyllable.sequence);
        elements['btn-next'].classList.remove('hidden');
    }
    saveState();
    if (state.masteredHeceCount % 5 === 0 && state.masteredHeceCount > 0 && isSuccess) {
        state.level = Math.min(5, state.level + 1);
        showFeedback('🏆 Seviye ' + state.level + ' Oldun!', 'success');
        playSound('levelup');
    }
}

function showFeedback(text, type) {
    const fb = elements['feedback-message'];
    if (!fb) return;
    fb.textContent = text;
    fb.className = 'feedback-message';
    if (type === 'success') fb.classList.add('feedback-success');
    if (type === 'warning') fb.classList.add('feedback-warning');
    if (type === 'error') fb.classList.add('feedback-error');
    fb.classList.remove('hidden');
}

function hideFeedback() {
    if (elements['feedback-message']) {
        elements['feedback-message'].classList.add('hidden');
    }
}

function updateDisplays() {
    if (elements['game-score']) elements['game-score'].textContent = state.score;
    if (elements['game-streak']) elements['game-streak'].textContent = state.streak;
    if (elements['dash-total-score']) elements['dash-total-score'].textContent = state.score;
    if (elements['dash-mastered-hece']) elements['dash-mastered-hece'].textContent = state.masteredHeceCount;
    if (elements['dash-mastered-kelime']) elements['dash-mastered-kelime'].textContent = state.masteredKelimeCount;
    if (elements['dash-current-level']) elements['dash-current-level'].textContent = state.level;
}

// Completion & Certificate
function completeGame() {
    showScreen('certificate');
    elements['cert-name'].textContent = state.childName;
    elements['cert-score'].textContent = state.score;
    elements['cert-hece'].textContent = state.masteredHeceCount;
    elements['cert-kelime'].textContent = state.masteredKelimeCount;
    elements['cert-date'].textContent = new Date().toLocaleDateString('tr-TR');
    const msgs = [
        'Harika bir okuma başarısı!',
        'Okuma yolculuğunda büyük adım!',
        'Yıldız gibi parlayan okuyucu!'
    ];
    elements['cert-achievement-text'].textContent = msgs[Math.floor(Math.random() * msgs.length)];
    playSound('levelup');
    addActivity('certificate', 'Başarı belgesi kazanıldı!');
}

// Word Game Mode
function startWordGame() {
    const words = Curriculum.wordsFor(state.knownLetters, { minSyllables: 2 });
    if (words.length === 0) {
        showFeedback('Yeterli hece yok! Önce harf seçip hece çalışın.', 'error');
        return;
    }
    const word = words[Math.floor(Math.random() * words.length)];
    state.currentWord = word;
    state.placedSyllables = [];
    elements['target-word-display'].textContent = formatLetterCase(word.sequence);
    word.parts = word.syllables.map(sequence => ({ sequence }));
    elements['target-word-hint'].textContent = 'Heceleri doğru sıraya diz';
    elements['syllable-slots'].innerHTML = '';
    for (let i = 0; i < word.parts.length; i++) {
        const slot = document.createElement('div');
        slot.className = 'syllable-slot';
        slot.dataset.index = i;
        elements['syllable-slots'].appendChild(slot);
    }
    renderSyllableBank(word);
    elements['word-feedback'].classList.add('hidden');
    elements['btn-word-next'].classList.add('hidden');
    showScreen('word');
}

function renderSyllableBank(word) {
    const bank = elements['syllable-bank'];
    bank.innerHTML = '';
    const parts = [...word.parts].sort(() => Math.random() - 0.5);
    parts.forEach((part, idx) => {
        const btn = document.createElement('button');
        btn.className = 'syllable-bank-btn';
        btn.textContent = formatLetterCase(part.sequence);
        btn.dataset.partIdx = idx;
        btn.addEventListener('click', () => addSyllableToSlot(part, btn));
        bank.appendChild(btn);
    });
}

function addSyllableToSlot(part, btn) {
    if (state.placedSyllables.length >= state.currentWord.parts.length) return;
    const idx = state.placedSyllables.length;
    const slot = elements['syllable-slots'].children[idx];
    slot.textContent = formatLetterCase(part.sequence);
    slot.classList.add('filled');
    state.placedSyllables.push(part);
    btn.classList.add('used');
    btn.disabled = true;
    if (state.placedSyllables.length === state.currentWord.parts.length) {
        checkWord();
    }
}

function checkWord() {
    const correct = state.placedSyllables.every((p, i) => p.sequence === state.currentWord.parts[i].sequence);
    const fb = elements['word-feedback'];
    if (correct) {
        state.score += 20;
        state.masteredKelimeCount++;
        updateDisplays();
        fb.textContent = '🎉 Harika! Kelimeyi doğru oluşturdun!';
        fb.className = 'word-feedback feedback-success';
        fb.classList.remove('hidden');
        playSound('correct');
        addActivity('word_success', state.currentWord.sequence);
    } else {
        fb.textContent = '🤔 Hemen hemen! Tekrar deneyelim.';
        fb.className = 'word-feedback feedback-warning';
        fb.classList.remove('hidden');
        playSound('wrong');
        addActivity('word_attempt', state.currentWord.sequence);
    }
    saveState();
    elements['btn-word-next'].classList.remove('hidden');
}

function clearWord() {
    if (elements['syllable-slots']) {
        Array.from(elements['syllable-slots'].children).forEach(s => {
            s.textContent = '';
            s.classList.remove('filled');
        });
    }
    if (elements['syllable-bank']) {
        Array.from(elements['syllable-bank'].children).forEach(b => {
            b.classList.remove('used');
            b.disabled = false;
        });
    }
    state.placedSyllables = [];
    if (elements['word-feedback']) elements['word-feedback'].classList.add('hidden');
    if (elements['btn-word-next']) elements['btn-word-next'].classList.add('hidden');
}

// Dashboard
function renderDashboard() {
    const grid = elements['letter-progress-grid'];
    if (grid) {
        grid.innerHTML = '';
        Curriculum.LETTER_ORDER.forEach(letter => {
            const item = document.createElement('div');
            const isKnown = state.knownLetters.includes(letter);
            item.className = 'letter-progress-item' + (isKnown ? ' mastered' : '');
            const charText = `${letter} (${letter.toLocaleUpperCase('tr-TR')})`;
            item.innerHTML = `<span class="letter-char">${charText}</span><span class="letter-status">${isKnown ? 'Bildi' : 'Öğrenilecek'}</span>`;
            grid.appendChild(item);
        });
    }

    const activityList = elements['activity-list'];
    if (activityList) {
        activityList.innerHTML = '';
        const recent = state.activities.slice(0, 10);
        if (recent.length === 0) {
            activityList.innerHTML = '<div class="activity-item empty">Henüz aktivite yok.</div>';
        } else {
            recent.forEach(a => {
                const div = document.createElement('div');
                div.className = 'activity-item';
                div.innerHTML = `<span>${a.text}</span><span style="font-size:11px;color:var(--text-light);">${a.time}</span>`;
                activityList.appendChild(div);
            });
        }
    }
}

// Settings
function saveSettings() {
    state.childName = document.getElementById('setting-child-name').value || 'Selim';
    state.character = document.getElementById('setting-character').value;
    state.speechRate = parseFloat(document.getElementById('setting-speech-rate').value);
    state.sfxEnabled = document.getElementById('setting-sfx').checked;
    state.isAutoMode = document.getElementById('setting-auto-mode').checked;
    state.isParentMode = document.getElementById('parent-mode-toggle').checked;
    saveState();
    showFeedback('Ayarlar kaydedildi!', 'success');
}

function resetProgress() {
    if (!confirm('Tüm ilerleme sıfırlanacak. Emin misiniz?')) return;
    state.knownLetters = Curriculum.lettersThrough('t');
    state.level = 1;
    state.score = 0;
    state.streak = 0;
    state.masteredHeceCount = 0;
    state.masteredKelimeCount = 0;
    state.activities = [];
    state.syllables = [];
    saveState();
    renderLetterGrid();
    updateStartButton();
    renderDashboard();
    showFeedback('İlerleme sıfırlandı.', 'info');
}

// Event Listeners
function setupEventListeners() {
    const on = (id, event, handler) => {
        const el = elements[id];
        if (el) el.addEventListener(event, handler);
    };

    on('letter-grid', 'click', (e) => {
        const btn = e.target.closest('.letter-btn');
        if (btn && btn.dataset.letter) setKnownThrough(btn.dataset.letter);
    });

    on('btn-case-lower', 'click', () => {
        state.isLowerCase = true;
        updateCaseButtons();
        renderLetterGrid();
        if (state.currentSyllable && elements['syllable-display']) {
            elements['syllable-display'].textContent = formatLetterCase(state.currentSyllable.sequence);
        }
        saveState();
    });

    on('btn-case-upper', 'click', () => {
        state.isLowerCase = false;
        updateCaseButtons();
        renderLetterGrid();
        if (state.currentSyllable && elements['syllable-display']) {
            elements['syllable-display'].textContent = formatLetterCase(state.currentSyllable.sequence);
        }
        saveState();
    });

    on('parent-mode-toggle', 'change', (e) => {
        state.isParentMode = e.target.checked;
        if (elements['toggle-text']) {
            elements['toggle-text'].textContent = state.isParentMode ? '👨‍👧 Veli Onayı Modu' : '🤖 Otomatik Dinleme Modu';
        }
        if (elements['mode-hint']) {
            elements['mode-hint'].textContent = state.isParentMode
                ? 'Çocuk okuduğunda sen "Evet, Bildi" butonuna basacaksın.'
                : 'Uygulama mikrofonla çocuğun sesini tanır.';
        }
        saveState();
    });

    on('btn-start', 'click', startGame);
    on('btn-dashboard-back', 'click', () => showScreen('home'));
    on('btn-game-back', 'click', () => showScreen('home'));
    on('btn-word-back', 'click', () => showScreen('home'));
    on('btn-settings-back', 'click', () => showScreen('home'));
    on('btn-settings-save', 'click', saveSettings);
    on('btn-reset-progress', 'click', resetProgress);
    on('btn-export-log', 'click', exportAsrLog);

    on('btn-repeat', 'click', () => {
        if (state.currentSyllable) speakSyllable(state.currentSyllable.sequence);
    });

    on('btn-next', 'click', () => nextSyllable());
    on('btn-prev-syllable', 'click', () => prevSyllable());
    on('btn-next-syllable', 'click', () => nextSyllable());
    on('btn-parent-next', 'click', () => nextSyllable());
    on('btn-listen', 'click', startListening);
    on('btn-parent-yes', 'click', () => handleParentVerdict(true));
    on('btn-parent-no', 'click', () => handleParentVerdict(false));

    on('btn-word-clear', 'click', clearWord);
    on('btn-word-check', 'click', checkWord);
    on('btn-word-next', 'click', startWordGame);

    on('btn-cert-print', 'click', () => window.print());
    on('btn-cert-home', 'click', () => showScreen('home'));
    on('btn-parent-dashboard', 'click', () => showScreen('dashboard'));
    on('btn-settings', 'click', () => showScreen('settings'));
}

// Sound effects using AudioContext
function playSound(type) {
    if (!state.sfxEnabled) return;
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'correct') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            osc.frequency.exponentialRampToValueAtTime(783.99, audioCtx.currentTime + 0.15); // G5
            gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.25);
        } else if (type === 'wrong') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(220, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(140, audioCtx.currentTime + 0.25);
            gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'levelup') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            osc.frequency.linearRampToValueAtTime(880, audioCtx.currentTime + 0.15);
            osc.frequency.linearRampToValueAtTime(1320, audioCtx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
        }
    } catch (e) {
        console.log('AudioContext error:', e);
    }
}

// Start
init();
