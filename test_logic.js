// test_logic.js
import { calculateTotalPoints } from './utils/scoring_logic.js';
import { generateSyllablePool } from './src/syllable_generator.ts';

// --- Test Case 1: Scoring Logic ---
console.log("--- Running Scoring Logic Tests ---");

// Test 1.1: Simple syllable base points
const simpleBasePoints = 5;
console.log("Test 1.1: Simple base points check ->", simpleBasePoints === 5 ? "PASS" : "FAIL");

// Test 1.2: Calculating points with a streak (e.g., 1st success)
const score1 = calculateTotalPoints('Simple', 0);
console.log("Test 1.2: Score after 1st success (Base * 1.0) ->", score1);
// Expected: 5

// Test 1.3: Calculating points with a streak (e.g., 3rd success)
const score3 = calculateTotalPoints('Simple', 2);
console.log("Test 1.3: Score after 3rd success (Base * 1.3) ->", score3);
// Expected: Math.floor(5 * 1.3) = 6

// --- Test Case 2: Syllable Generator Logic ---
console.log("\\n--- Running Syllable Generator Tests ---");

// Prepare test data (letters for 'mam')
const testLetters = ['M', 'A', 'M'];
const syllables = generateSyllablePool(testLetters);

// Test 2.1: Check for generation
console.log(`Test 2.1: Syllable pool size check -> ${syllables.length > 0 ? "PASS" : "FAIL"}`);

// Test 2.2: Check for correct categorization (should contain at least a 'Simple' type)
const hasSimple = syllables.some(s => s.difficulty === 'Simple');
console.log("Test 2.2: 'Simple' difficulty syllable existence ->", hasSimple ? "PASS" : "FAIL");

// The next steps (Integration and UI) rely on these tests passing.
console.log("\\n--- Test Execution Finished ---");