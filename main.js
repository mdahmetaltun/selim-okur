/**
 * main.js
 * @file Simulates the core application loop to perform integration testing of the logic modules.
 * @description Tries to connect Generation, State, and Perception engines.
 */

import { generateSyllablePool, getNextChallenge } from './src/syllable_generator.ts';
import { initialGameState, handleChallengeResult, handleSuccess } from './src/game_state_manager.js';
import { presentChallenge, renderChallengeOutcome, renderInitialState } from './src/ui_feedback_renderer.js';
// We import the processor, but we will mock its output for simplicity in this test harness
import { process_and_validate } from './src/speech_processor.py';

// A mock callback for the challenge completion, which will be handled by this main loop
const handleChallengeCompletion = (gameState) => {
    console.log("--- Integrating Logic Check ---");
    console.log("Current State:", JSON.stringify(gameState, null, 2));
};

// A mock callback for when the UI asks for the next step
const handleUiStep = (action) => {
    if (action === 'ADVANCE_CHALLENGE') {
        console.log("[MAIN LOOP] Advancing challenge...");
        // In a real app, we'd fetch the next syllable here.
    } else if (action === 'RESET_SYLLABLE') {
        console.log("[MAIN LOOP] Resetting challenge for retry.");
    } else if (action === 'PAUSE_FOR_PARENTS') {
        console.log("[MAIN LOOP] Pausing flow for parental Mastery Check.");
    }
};

/**
 * The main simulation loop.
 */
async function runSimulation() {
    let gameState = initialGameState;
    console.log("========================================");
    console.log("🚀 Starting Application Integration Simulation");
    console.log("========================================");

    renderInitialState();

    // --- Cycle 1: Generate and Present ---
    const knownLetters = ['A', 'M', 'O'];
    const availableSyllables = generateSyllablePool(knownLetters);

    if (availableSyllables.length === 0) {
        console.error("FATAL ERROR: No syllables were generated. Check letter input rules.");
        return;
    }

    const targetSyllable = getNextChallenge(availableSyllables);
    if (!targetSyllable) return;

    gameState.currentSyllableId = targetSyllable.id;

    console.log("----------------------------------------");
    // Simulate the UI presentation
    const mockInputStart = () => {
        console.log("[SIMULATION] Sending input signal to Perception Engine...");

        // Simulate a 'SUCCESS' (Near Miss) scenario
        // In the real world, we'd pass the actual recorded file path here.
        // For the simulation, we are pretending the STT was near-perfect.
        const isSuccess, feedback = process_and_validate(targetSyllable.sequence, 'mock_audio_file.wav');

        if (isSuccess) {
            // Successful validation, handle the success
            gameState = handleSuccess(gameState, 10, targetSyllable);
            renderChallengeOutcome('SUCCESS', targetSyllable.sequence, handleUiStep);
        } else {
            // Failed validation, handle the failure
            gameState = handleChallengeResult(gameState, False);
            renderChallengeOutcome('COMPLETE_FAILURE', targetSyllable.sequence, handleUiStep);
        }
    };

    console.log("\n--- Simulation Step 1: Initial Challenge ---");
    presentChallenge(targetSyllable.sequence, gameState.level, mockInputStart, handleChallengeCompletion);

    console.log("\n--- Simulation Step 2: Post-Result State Check ---");
    // Manually call the result handler as the simulation is single-turn.
    // This shows the state change after one attempt.
    handleChallengeCompletion(gameState);
    console.log("FINAL SIMULATED STATE:", JSON.stringify(gameState, null, 2));

}

runSimulation();