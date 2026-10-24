/**
 * src/ui_feedback_renderer.js
 * @file Handles all visual, auditory, and behavioral feedback for the child.
 * @description Translates game state changes into a child-centric, low-friction user experience.
 */

/**
 * Renders the current target syllable and prepares for input.
 * @param {string} sequence - The syllable (e.g., "MA").
 * @param {number} level - The current difficulty level.
 * @param {Function} onInputStart - Callback to initiate audio recording.
 * @param {Function} onChallengeComplete - Callback when the child attempts the syllable.
 * @param {object} currentSyllableData - Data from the generator engine.
 */
export function presentChallenge(sequence, level, onInputStart, onChallengeComplete, currentSyllableData) {
    // NOTE: In a real implementation, this would involve rendering DOM/Canvas elements.
    console.log(`[UI] --- NEW CHALLENGE ---`);
    console.log(`[UI] Level ${level} Challenge: ${sequence}`);
    console.log(`[UI] Please pronounce this syllable!`);

    // Trigger the external voice input mechanism
    onInputStart();
}

/**
 * Renders feedback based on the Perception Engine's validation result.
 * @param {string} outcome - 'SUCCESS', 'NEAR_MISS', or 'COMPLETE_FAILURE'.
 * @param {string} targetSequence - The syllable that was attempted.
 * @param {Function} onNextStep - Callback to advance the state machine.
 */
export function renderChallengeOutcome(outcome, targetSequence, onNextStep) {
    console.log(`[UI] --- RESULT ---`);

    switch (outcome) {
        case 'SUCCESS':
            // Success visual feedback: big animation, positive sound.
            console.log(`[UI] 🎉 AMAZING! "${targetSequence}" is correct! +10 Points.`);
            // A simple, positive reward display is rendered here.
            onNextStep('ADVANCE_CHALLENGE');
            break;

        case 'NEAR_MISS':
            // Constructive feedback: Don't penalize, guide gently.
            console.log(`[UI] 🤔 Almost! You sounded close. Try again. (Hint: Focus on the vowel sound)`);
            // Do not advance the state, loop back to re-attempt.
            break;

        case 'COMPLETE_FAILURE':
            // Gentle discouragement, focus on the tool/system, not the child.
            console.log(`[UI] 🥺 Oops. Not quite right this time. Let's try a different one!`);
            onNextStep('RESET_SYLLABLE');
            break;

        case 'MASTERY_CHECK':
            // Triggers the external, parental verification workflow.
            console.log(`[UI] 🏆 MASTERED? Pause for Parent Check.`);
            onNextStep('PAUSE_FOR_PARENTS');
            break;

        default:
            console.log('[UI] Unknown outcome. Reverting to safety.');
    }
}

/**
 * Renders the initial or reset state feedback.
 */
export function renderInitialState() {
    console.log('[UI] 🚀 Let\'s Start Learning!');
    // Render a friendly character or introductory screen.
}

export {
    presentChallenge,
    renderChallengeOutcome,
    renderInitialState
};