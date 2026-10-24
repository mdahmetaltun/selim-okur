/**
 * utils/scoring_logic.js
 * @file Modular functions to calculate point rewards based on game state.
 * @description Determines how many points are awarded for completing a challenge.
 */

/**
 * Calculates the base score for a given syllable difficulty.
 * @param {'Simple' | 'Medium' | 'Hard'} difficulty - The difficulty level of the syllable.
 * @returns {number} The base points associated with that difficulty.
 */
function getBaseDifficultyPoints(difficulty) {
    switch (difficulty) {
        case 'Simple':
            return 5;
        case 'Medium':
            return 10;
        case 'Hard':
            return 20;
        default:
            return 1; // Failsafe
    }
}

/**
 * Calculates the total points awarded for a successful challenge.
 * The reward is scaled by the current streak to encourage focus.
 * @param {string} difficulty - The difficulty level of the syllable.
 * @param {number} currentStreak - The number of consecutive successes before this attempt.
 * @returns {number} The final points awarded.
 */
function calculateTotalPoints(difficulty, currentStreak) {
    const basePoints = getBaseDifficultyPoints(difficulty);
    // Simple multiplier: Each success is worth slightly more than the last.
    const streakMultiplier = 1 + (currentStreak * 0.1);
    return Math.floor(basePoints * streakMultiplier);
}

export {
    calculateTotalPoints,
    getBaseDifficultyPoints
};