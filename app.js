/**
 * Selim Okur - 1. Sınıf Okuma Eğitimi Uygulaması
 * Gerçek Web Speech API Ses Tanıma ve 1. Sınıf Küçük Harf Desteği
 */

// Turkish alphabet (1. Sınıf uyumlu küçük harfler)
const TURKISH_VOWELS = ['a', 'e', 'ı', 'i', 'o', 'ö', 'u', 'ü'];
const TURKISH_CONSONANTS = ['b', 'c', 'ç', 'd', 'f', 'g', 'ğ', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 'ş', 't', 'v', 'y', 'z'];

function isTurkishVowel(char) {
    if (!char) return false;
    return TURKISH_VOWELS.includes(char.toLocaleLowerCase('tr-TR'));
}

function isTurkishConsonant(char) {
    if (!char) return false;
    return TURKISH_CONSONANTS.includes(char.toLocaleLowerCase('tr-TR'));
}

function formatLetterCase(str) {
    if (!str) return '';
    return state.isLowerCase ? str.toLocaleLowerCase('tr-TR') : str.toLocaleUpperCase('tr-TR');
}

// Generate syllables from known letters
function generateSyllablePool(knownLetters) {
    if (!knownLetters || knownLetters.length === 0) return [];
    const normalized = knownLetters.map(l => l.toLocaleLowerCase('tr-TR').trim()).filter(Boolean);
    const vowels = normalized.filter(isTurkishVowel);
    const consonants = normalized.filter(isTurkishConsonant);
    const syllables = [];

    // Simple: Consonant + Vowel (e.g. ma, le, ba)
    consonants.forEach(c => {
        vowels.forEach(v => {
            const seq = (c + v).toLocaleLowerCase('tr-TR');
            syllables.push({ id: `CV_${seq}`, sequence: seq, difficulty: 'Simple', isMastered: false, attemptCount: 0 });
        });
    });

    // Simple: Vowel + Consonant (e.g. el, al, ak)
    vowels.forEach(v => {
        consonants.forEach(c => {
            const seq = (v + c).toLocaleLowerCase('tr-TR');
            syllables.push({ id: `VC_${seq}`, sequence: seq, difficulty: 'Simple', isMastered: false, attemptCount: 0 });
        });
    });

    // Medium: CVC (e.g. kek, bal, tam)
    consonants.forEach(c1 => {
        vowels.forEach(v => {
            consonants.forEach(c2 => {
                const seq = (c1 + v + c2).toLocaleLowerCase('tr-TR');
                syllables.push({ id: `CVC_${seq}`, sequence: seq, difficulty: 'Medium', isMastered: false, attemptCount: 0 });
            });
        });
    });

    // Medium: VCV (e.g. ala, ela)
    vowels.forEach(v1 => {
        consonants.forEach(c => {
            vowels.forEach(v2 => {
                const seq = (v1 + c + v2).toLocaleLowerCase('tr-TR');
                syllables.push({ id: `VCV_${seq}`, sequence: seq, difficulty: 'Medium', isMastered: false, attemptCount: 0 });
            });
        });
    });

    return syllables;
}

function getNextChallenge(availableSyllables, options = {}) {
    if (!availableSyllables || availableSyllables.length === 0) return null;
    const { preferDifficulty } = options;
    const unmastered = availableSyllables.filter(s => !s.isMastered);
    let candidates = unmastered.length > 0 ? unmastered : availableSyllables;
    if (preferDifficulty) {
        const filtered = candidates.filter(s => s.difficulty === preferDifficulty);
        if (filtered.length > 0) candidates = filtered;
    }
    return candidates[Math.floor(Math.random() * candidates.length)];
}

// Generate words from known syllables
function generateWordsFromSyllables(syllables) {
    const words = [];
    const simple = syllables.filter(s => s.difficulty === 'Simple');
    if (simple.length < 2) return words;
    for (let i = 0; i < Math.min(8, simple.length); i++) {
        for (let j = 0; j < Math.min(8, simple.length); j++) {
            if (i !== j) {
                const seq = (simple[i].sequence + simple[j].sequence).toLocaleLowerCase('tr-TR');
                words.push({
                    sequence: seq,
                    parts: [simple[i], simple[j]],
                    difficulty: 'Simple'
                });
            }
        }
    }
    return words;
}

// Game state
const state = {
    knownLetters: ['a', 'e', 'l', 'm'], // 1. Sınıf başlangıç harfleri varsayılan seçili
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
                state.knownLetters = parsed.knownLetters.map(l => l.toLocaleLowerCase('tr-TR'));
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

// Letter picker
function renderLetterGrid() {
    const allLetters = [...TURKISH_VOWELS, ...TURKISH_CONSONANTS];
    const grid = elements['letter-grid'];
    if (!grid) return;

    const existingBtns = grid.querySelectorAll('.letter-btn');
    if (existingBtns.length === allLetters.length) {
        existingBtns.forEach(btn => {
            const letter = btn.dataset.letter.toLocaleLowerCase('tr-TR');
            const mainSpan = btn.querySelector('.letter-main');
            const subSpan = btn.querySelector('.letter-sub');
            if (mainSpan) {
                mainSpan.textContent = state.isLowerCase ? letter : letter.toLocaleUpperCase('tr-TR');
            }
            if (subSpan) {
                subSpan.textContent = state.isLowerCase ? letter.toLocaleUpperCase('tr-TR') : letter;
            }
            btn.classList.toggle('selected', state.knownLetters.includes(letter));
        });
    } else {
        grid.innerHTML = '';
        allLetters.forEach(letter => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'letter-btn' + (isTurkishVowel(letter) ? ' vowel-btn' : ' consonant-btn');
            btn.dataset.letter = letter;
            const mainChar = state.isLowerCase ? letter : letter.toLocaleUpperCase('tr-TR');
            const subChar = state.isLowerCase ? letter.toLocaleUpperCase('tr-TR') : letter;
            btn.innerHTML = `<span class="letter-main">${mainChar}</span><span class="letter-sub">${subChar}</span>`;
            if (state.knownLetters.includes(letter)) btn.classList.add('selected');
            grid.appendChild(btn);
        });
    }
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
        const displayLetter = state.isLowerCase ? letter : letter.toLocaleUpperCase('tr-TR');
        tag.innerHTML = `${displayLetter} <span class="tag-remove" data-letter="${letter}">✕</span>`;
        tag.querySelector('.tag-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleLetter(letter);
        });
        container.appendChild(tag);
    });
}

function toggleLetter(letter) {
    const norm = letter.toLocaleLowerCase('tr-TR');
    const idx = state.knownLetters.indexOf(norm);
    if (idx >= 0) {
        state.knownLetters.splice(idx, 1);
    } else {
        state.knownLetters.push(norm);
    }
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
    state.syllables = generateSyllablePool(state.knownLetters);
    if (state.syllables.length === 0) {
        showFeedback('Lütfen en az 1 sesli ve 1 sessiz harf seçin!', 'error');
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
    let target = getNextChallenge(state.syllables, { preferDifficulty: 'Simple' });
    if (!target) target = getNextChallenge(state.syllables, { preferDifficulty: 'Medium' });
    if (!target) target = getNextChallenge(state.syllables);
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

function evaluateSpeechInput(spokenText, alternatives) {
    if (!state.currentSyllable) return;
    const target = state.currentSyllable.sequence.trim().toLocaleLowerCase('tr-TR');
    const listenResult = elements['listen-result'] || document.getElementById('listen-result');

    const clean = (s) => (s || '').trim().toLocaleLowerCase('tr-TR').replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'0-9]/g, '');
    const deDup = (s) => clean(s).replace(/(.)\1+/g, '$1');

    const candidateList = (alternatives && alternatives.length > 0) ? alternatives : [spokenText];
    const cleanedCandidates = candidateList.map(clean).filter(Boolean);

    let isMatch = false;
    let matchedText = '';

    for (const cand of cleanedCandidates) {
        // Tam eşleşme
        if (cand === target) {
            isMatch = true;
            matchedText = cand;
            break;
        }
        // Kelime öbeği içinde geçiyorsa (örneğin "bu el" veya "el dedin")
        const words = cand.split(/\s+/);
        if (words.includes(target)) {
            isMatch = true;
            matchedText = target;
            break;
        }
        // Harf uzatma toleransı ("eeel", "elll" -> "el")
        if (deDup(cand) === deDup(target)) {
            isMatch = true;
            matchedText = target;
            break;
        }
        // Başlangıç veya bitiş eşleşmesi
        if (cand.startsWith(target) || cand.endsWith(target)) {
            isMatch = true;
            matchedText = target;
            break;
        }
    }

    const firstHeard = cleanedCandidates[0] || spokenText;

    if (isMatch) {
        if (listenResult) {
            listenResult.textContent = `Duyulan: "${matchedText}" ✓ Aferin!`;
            listenResult.className = 'listen-result feedback-success';
            listenResult.classList.remove('hidden');
        }
        showSpeechBubble(`Aferin ${state.childName}! Doğru okudun!`);
        handleResult(true);
    } else {
        if (listenResult) {
            listenResult.textContent = `Duyulan: "${firstHeard}" (Hedef: "${formatLetterCase(target)}")`;
            listenResult.className = 'listen-result feedback-warning';
            listenResult.classList.remove('hidden');
        }
        showSpeechBubble(`Ben "${firstHeard}" duydum. Tekrar deneyelim mi?`);
        showFeedback(`Duyulan: "${firstHeard}" — Beklenen: "${formatLetterCase(target)}". Veli onayıyla da geçebilirsiniz.`, 'warning');
        // Veli butonlarını görünür yap ki yapay zeka yanıldığında veli onaylayabilsin
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
    const words = generateWordsFromSyllables(state.syllables);
    if (words.length === 0) {
        showFeedback('Yeterli hece yok! Önce harf seçip hece çalışın.', 'error');
        return;
    }
    const word = words[Math.floor(Math.random() * words.length)];
    state.currentWord = word;
    state.placedSyllables = [];
    elements['target-word-display'].textContent = formatLetterCase(word.sequence);
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
        state.currentWord.isMastered = true;
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
        const allLetters = [...TURKISH_VOWELS, ...TURKISH_CONSONANTS];
        allLetters.forEach(letter => {
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
    state.knownLetters = ['a', 'e', 'l', 'm'];
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
        if (btn && btn.dataset.letter) toggleLetter(btn.dataset.letter);
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
