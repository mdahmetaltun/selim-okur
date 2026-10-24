/**
 * src/syllable_generator.ts
 * @file Core logic for syllable generation and categorization.
 * @description Manages the "Letter Set Knowledge Base" and implements rules for creating valid syllables.
 */

// Define the structures for clarity
export interface Syllable {
    id: string;
    sequence: string; // e.g., "MA"
    difficulty: 'Simple' | 'Medium' | 'Hard';
    validations: {
        // Metadata for the game state
        isMastered: boolean;
        attemptCount: number;
    };
}

export type LetterSet = string[]; // List of known characters (e.g., ['A', 'M', 'O'])

/**
 * Generates a pool of possible syllables from a given set of letters.
 * This is a simplified state machine/rule-based implementation.
 * @param {LetterSet} knownLetters - The available consonants and vowels.
 * @returns {Syllable[]} An array of possible syllables.
 */
function generateSyllablePool(knownLetters: LetterSet): Syllable[] {
    const syllables: Syllable[] = [];

    // Simplified vowel/consonant splitting for basic generation
    const vowels = knownLetters.filter(l => 'AEIOU'.includes(l.toUpperCase()));
    const consonants = knownLetters.filter(l => !'AEIOU'.includes(l.toUpperCase()));

    // Rule 1: Simple CV (Consonant-Vowel) Syllables (Difficulty: Simple)
    consonants.forEach(c => {
        vowels.forEach(v => {
            const sequence = c + v.toUpperCase();
            syllables.push({
                id: `CV_${sequence}`,
                sequence: sequence,
                difficulty: 'Simple',
                validations: { isMastered: false, attemptCount: 0 }
            });
        });
    });

    // Rule 2: Simple VC (Vowel-Consonant) - Less common, but useful for completeness (Difficulty: Simple/Medium)
    vowels.forEach(v => {
        consonants.forEach(c => {
            const sequence = v + c.toUpperCase();
            syllables.push({
                id: `VC_${sequence}`,
                sequence: sequence,
                difficulty: 'Simple',
                validations: { isMastered: false, attemptCount: 0 }
            });
        });
    });

    // Rule 3: Double Vowel (Diphthongs) - Requires more complex logic, simplified for now (Difficulty: Hard)
    // This would involve checking for pairs of vowels that form specific sounds.
    if (vowels.length >= 2) {
        // Example: A + I -> AI
        const diphthongTest = vowels.filter((v, i) => i < vowels.length - 1);
        diphthongTest.forEach(v1 => {
             const v2 = vowels[vowels.indexOf(v1) + 1];
             const sequence = v1 + v2.toUpperCase();
             syllables.push({
                id: `VV_${sequence}`,
                sequence: sequence,
                difficulty: 'Hard',
                validations: { isMastered: false, attemptCount: 0 }
            });
        });
    }


    return syllables;
}

/**
 * Selects the next target syllable based on current difficulty and a randomization bias.
 * In a real game, this would track progression more rigorously.
 * @param {Syllable[]} availableSyllables - The current pool.
 * @returns {Syllable | null} The chosen target syllable.
 */
function getNextChallenge(availableSyllables: Syllable[]): Syllable | null {
    // Logic here would use game_state_manager to decide the difficulty level
    // and filter the availableSyllables accordingly.

    // For now, pick a random one
    if (availableSyllables.length === 0) {
        return null;
    }
    const randomIndex = Math.floor(Math.random() * availableSyllables.length);
    return availableSyllables[randomIndex];
}

export {
    generateSyllablePool,
    getNextChallenge,
    Syllable,
    LetterSet
};