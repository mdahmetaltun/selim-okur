/**
 * src/syllable_generator.js
 * @file Turkish-aware syllable generation for early reading education.
 * @description Generates CV, CVC, and VCV syllables using Turkish vowels and consonants.
 * Turkish vowels: A, E, I, İ, O, Ö, U, Ü
 * Turkish consonants: B, C, Ç, D, F, G, Ğ, H, J, K, L, M, N, P, R, S, Ş, T, V, Y, Z
 */

const TURKISH_VOWELS = ['A', 'E', 'I', 'İ', 'O', 'Ö', 'U', 'Ü'];
const TURKISH_CONSONANTS = ['B', 'C', 'Ç', 'D', 'F', 'G', 'Ğ', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'Ş', 'T', 'V', 'Y', 'Z'];

function isTurkishVowel(char) {
    return TURKISH_VOWELS.includes(char.toUpperCase());
}

function isTurkishConsonant(char) {
    return TURKISH_CONSONANTS.includes(char.toUpperCase());
}

function Syllable(id, sequence, difficulty, validations) {
    this.id = id;
    this.sequence = sequence;
    this.difficulty = difficulty;
    this.validations = validations || { isMastered: false, attemptCount: 0 };
}

/**
 * Generates a pool of Turkish syllables from a given set of known letters.
 * @param {Array<string>} knownLetters - Letters the child already knows (e.g., ['M', 'A', 'P']).
 * @returns {Array<Syllable>} An array of possible syllables.
 */
function generateSyllablePool(knownLetters) {
    if (!knownLetters || knownLetters.length === 0) {
        return [];
    }

    const normalized = knownLetters.map(l => l.toUpperCase().trim()).filter(Boolean);
    const vowels = normalized.filter(isTurkishVowel);
    const consonants = normalized.filter(isTurkishConsonant);

    const syllables = [];

    // Rule 1: CV (Consonant-Vowel) - e.g., MA, PA, TA  (Difficulty: Simple)
    consonants.forEach(c => {
        vowels.forEach(v => {
            const sequence = c + v;
            syllables.push(new Syllable(
                `CV_${sequence}`,
                sequence,
                'Simple',
                { isMastered: false, attemptCount: 0 }
            ));
        });
    });

    // Rule 2: VC (Vowel-Consonant) - e.g., AM, AP, AT  (Difficulty: Simple)
    vowels.forEach(v => {
        consonants.forEach(c => {
            const sequence = v + c;
            syllables.push(new Syllable(
                `VC_${sequence}`,
                sequence,
                'Simple',
                { isMastered: false, attemptCount: 0 }
            ));
        });
    });

    // Rule 3: CVC (Consonant-Vowel-Consonant) - e.g., MAS, PAT, TAK  (Difficulty: Medium)
    consonants.forEach(c1 => {
        vowels.forEach(v => {
            consonants.forEach(c2 => {
                const sequence = c1 + v + c2;
                syllables.push(new Syllable(
                    `CVC_${sequence}`,
                    sequence,
                    'Medium',
                    { isMastered: false, attemptCount: 0 }
                ));
            });
        });
    });

    // Rule 4: VCV (Vowel-Consonant-Vowel) - e.g., AMA, APA, ATA  (Difficulty: Medium)
    vowels.forEach(v1 => {
        consonants.forEach(c => {
            vowels.forEach(v2 => {
                const sequence = v1 + c + v2;
                syllables.push(new Syllable(
                    `VCV_${sequence}`,
                    sequence,
                    'Medium',
                    { isMastered: false, attemptCount: 0 }
                ));
            });
        });
    });

    return syllables;
}

/**
 * Selects the next target syllable, preferring unmastered Simple ones first.
 * @param {Array<Syllable>} availableSyllables - The current pool.
 * @param {object} options - { preferDifficulty: 'Simple'|'Medium'|'Hard' }
 * @returns {Syllable | null} The chosen target syllable.
 */
function getNextChallenge(availableSyllables, options = {}) {
    if (!availableSyllables || availableSyllables.length === 0) {
        return null;
    }

    const { preferDifficulty } = options;

    // Filter unmastered syllables first
    const unmastered = availableSyllables.filter(s => !s.validations.isMastered);

    let candidates = unmastered.length > 0 ? unmastered : availableSyllables;

    if (preferDifficulty) {
        const filtered = candidates.filter(s => s.difficulty === preferDifficulty);
        if (filtered.length > 0) {
            candidates = filtered;
        }
    }

    const randomIndex = Math.floor(Math.random() * candidates.length);
    return candidates[randomIndex];
}

/**
 * Returns Turkish vowel list for UI selection.
 */
function getTurkishVowels() {
    return [...TURKISH_VOWELS];
}

/**
 * Returns Turkish consonant list for UI selection.
 */
function getTurkishConsonants() {
    return [...TURKISH_CONSONANTS];
}

module.exports = {
    generateSyllablePool,
    getNextChallenge,
    getTurkishVowels,
    getTurkishConsonants,
    TURKISH_VOWELS,
    TURKISH_CONSONANTS
};