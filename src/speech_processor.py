# src/speech_processor.py
"""
@file Encapsulates the logic for handling audio input, communicating with an
STT Service, and executing the Fuzzy Matching/Acoustic Similarity algorithms.
"""

import os
import time
# Import the basic distance functions from the local JS utility (assuming a shared wrapper)
from . import phonetic_utils

# Mock STT Service API (In a real implementation, this would use a real cloud API client)
class MockSTTClient:
    """
    Mocks a cloud-based Speech-to-Text service.
    In reality, this would handle audio stream encoding and network requests.
    """
    def transcribe(self, audio_path: str) -> str:
        print(f"[STT MOCK] Transcribing audio from {audio_path}...")
        # Simulate network latency
        time.sleep(0.1)

        # === MOCK LOGIC FOR TESTING ===
        # We need a way to inject mock transcription results based on the test case
        # For simplicity, we rely on the test runner to provide a mock transcript.
        # If a real audio file were present, we'd process it here.

        # Return a default, neutral mock transcript.
        return "the ma"

# Initialize the service client
stt_client = MockSTTClient()

def get_transcription(audio_file_path: str) -> str:
    """
    Sends the audio file to the STT service and retrieves the text.
    """
    try:
        transcript = stt_client.transcribe(audio_file_path)
        return transcript
    except Exception as e:
        print(f"ERROR: STT transcription failed: {e}")
        return ""

def validate_pronunciation(target_syllable: str, transcript: str) -> tuple[bool, str]:
    """
    Implements the Level 2 (Acoustic Check) for Fuzzy Matching.
    Returns (is_similar, feedback_message).
    """
    # 1. Basic Check (Semantic - Exact Match)
    if target_syllable.lower() in transcript.lower():
        # If we were using a proper phonetic library, we'd check phoneme alignment here.
        # For this placeholder, we check if the length is reasonable.
        if len(target_syllable) > 1 and len(transcript) > 1:
             return (True, "Perfect match.")

    # 2. Fuzzy Check (Acoustic Similarity)
    # We use a predefined threshold for the Levenshtein distance.
    # A threshold of 1 or 2 is typical for "near miss."
    THRESHOLD = 2
    if phonetic_utils.isPhoneticallySimilar(target_syllable, transcript, THRESHOLD):
        # This means the sound was close enough, but perhaps not perfect.
        return (True, "Near miss. Focus on articulation.")

    # 3. Complete Failure
    return (False, "Could not understand. Please try again.")

def process_and_validate(target_syllable: str, audio_path: str) -> tuple[bool, str]:
    """
    Main function for the Perception Engine.
    Handles the full flow: Audio -> Transcription -> Validation.
    """
    print(f"[Perception] Starting validation for '{target_syllable}'...")

    # Step 1: Get transcription
    transcript = get_transcription(audio_path)
    if not transcript:
        return False, "STT failed to produce text."

    # Step 2: Validate the sound against the target
    is_similar, feedback = validate_pronunciation(target_syllable, transcript)

    if is_similar:
        return True, feedback
    else:
        return False, feedback

# NOTE: This module relies on external services (STT) and local utilities (phonetic_utils).
# The integration point is the 'process_and_validate' function.

if __name__ == '__main__':
    # Example of how this module would be used
    TEST_SYLLABLE = "ma"
    MOCK_AUDIO_PATH = "test_ma.wav"

    # Simulate success path (assuming mock STT handles it)
    success, feedback = process_and_validate(TEST_SYLLABLE, MOCK_AUDIO_PATH)
    print(f"Test Result (Success): {success} - {feedback}")

    # Simulate failure path (e.g., transcript is "mame")
    # To truly test the failure path, we would need to modify the mock STTClient.
    # For now, we rely on the function structure being correct.

# IMPORTANT: This script needs phonetic_utils.js (JS) to be wrapped or mirrored for Python execution
# in a production environment, or rely on a shared language service.
