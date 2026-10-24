/**
 * utils/phonetic_utils.js
 * @file Core phonetic analysis tools for the Perception Engine.
 * @description Contains functions to calculate phonetic distances between transcribed words.
 */

/**
 * Calculates the Levenshtein distance between two strings.
 * This metric is used as a basic approximation of "sound similarity"
 * before full acoustic modeling is implemented.
 * @param {string} str1 - The target string (the expected syllable).
 * @param {string} str2 - The input string (the child's transcription).
 * @returns {number} The Levenshtein distance.
 */
function levenshteinDistance(str1, str2) {
    const matrix = [];

    // Initialize the matrix
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
        matrix[0] = [j];
    }

    // Fill the matrix
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            const cost = str1[j - 1] === str2[i - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,        // Deletion
                matrix[i][j - 1] + 1,        // Insertion
                matrix[i - 1][j - 1] + cost  // Substitution
            );
        }
    }

    return matrix[str2.length][str1.length];
}

/**
 * Checks if two strings are "close enough" based on a defined distance threshold.
 * @param {string} str1
 * @param {string} str2
 * @param {number} threshold - Max acceptable Levenshtein distance.
 * @returns {boolean} True if they are considered close matches.
 */
function isPhoneticallySimilar(str1, str2, threshold) {
    if (typeof str1 !== 'string' || typeof str2 !== 'string') {
        return false;
    }
    const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    return distance <= threshold;
}

export {
    levenshteinDistance,
    isPhoneticallySimilar
};