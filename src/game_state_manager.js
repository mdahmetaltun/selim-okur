/**
 * src/game_state_manager.js
 * @file Manages the state of the educational game session.
 * @description Tracks score, level progression, and the critical mastery status of each syllable.
 */

const initialGameState = {
    level: 1, // Maps to complexity: 1=Simple, 2=Medium, 3=Hard
    score: 0,
    maxScore: 100,
    consecutiveSuccesses: 0,
    consecutiveFailures: 0,
    currentSyllableId: null,
    gameState: 'AWAITING_START' // AWAITING_START, CHALLENGE, CHALLENGE_FAIL, MASTERY_CHECK
};

/**
 * Updates the game state after a successful challenge completion.
 * @param {object} gameState - The current game state.
 * @param {number} pointsAwarded - Points from the scored syllable.
 * @param {object} syllableData - The data of the syllable that was mastered.
 * @returns {object} The new game state.
 */
function handleSuccess(gameState, pointsAwarded, syllableData) {
    const newState = { ...gameState };

    // 1. Update Score and Streak
    newState.score += pointsAwarded;
    newState.consecutiveSuccesses += 1;
    newState.consecutiveFailures = 0;

    // 2. Check for Level Progression (Difficulty Threshold)
    const requiredStreakForLevelUp = 3;
    if (newState.consecutiveSuccesses >= requiredStreakForLevelUp) {
        newState.level = Math.min(3, newState.level + 1); // Cap at 3 (Hard)
        console.log(`[GameState] Level Up! New Level: ${newState.level}`);
        // Reset streak/score to apply new level's difficulty curve
        newState.score = Math.floor(newState.score * 0.5);
        newState.consecutiveSuccesses = 0;
    }

    // 3. Trigger Mastery Check
    // If the current syllable is considered 'High Importance' (a future feature)
    // or if a certain score threshold is met, transition to the external validation step.
    if (Math.random() < 0.3) { // 30% chance to trigger the Mastery Gate check
        newState.gameState = 'MASTERY_CHECK';
    } else {
        newState.gameState = 'CHALLENGE';
    }

    return newState;
}

/**
 * Handles the outcome of a perception check (voice recognition).
 * @param {object} gameState - The current game state.
 * @param {boolean} isSuccess - Whether the pronunciation was deemed accurate.
 * @returns {object} The new game state.
 */
function handleChallengeResult(gameState, isSuccess) {
    const newState = { ...gameState };

    if (isSuccess) {
        return handleSuccess(gameState, 10, { id: newState.currentSyllableId, sequence: newState.currentSyllableId });
    } else {
        // Failure handling
        newState.consecutiveFailures += 1;
        newState.consecutiveSuccesses = 0;

        // Gentle negative feedback (no large penalty, just encouragement)
        if (newState.consecutiveFailures >= 3) {
            // If failure count is high, reset the syllable or lower the difficulty bias
            newState.consecutiveFailures = 0;
            console.log("[GameState] Syllable deemed too hard. Resetting challenge.");
        }

        newState.gameState = 'CHALLENGE_FAIL';
    }
    return newState;
}

export {
    initialGameState,
    handleSuccess,
    handleChallengeResult
};