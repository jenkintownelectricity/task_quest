#!/usr/bin/env python3
"""
mouth.py - The simplest LDS-to-voice interface
===============================================

    python mouth.py "Hello world"              # Speak text
    python mouth.py ./entities/greeting.lds.json  # Speak LDS file
    python mouth.py                            # Interactive mode

The mouth comes alive.
"""

import sys
import json
from pathlib import Path


def speak(content: str):
    """Speak content - auto-detects LDS vs plain text"""

    # Import the engine
    try:
        from lds_speech_engine import LDSSpeechEngine, Voice
        engine = LDSSpeechEngine()
    except ImportError as e:
        print(f"Engine import error: {e}")
        print("Fallback to print mode")
        engine = None

    # Check if it's a file
    if Path(content).exists():
        with open(content) as f:
            if content.endswith('.json'):
                lds = json.load(f)
                content = extract_speech(lds)
            else:
                content = f.read()

    # Check if it's JSON
    elif content.strip().startswith('{'):
        try:
            lds = json.loads(content)
            content = extract_speech(lds)
        except json.JSONDecodeError:
            pass

    # Speak it
    if engine:
        engine.speak_text(content)
    else:
        print(f"[MOUTH]: {content}")


def extract_speech(lds: dict) -> str:
    """Extract speech content from LDS"""
    core = lds.get("core", lds)

    # Check speech fields
    for field in ["speak", "say", "message", "text", "utterance"]:
        if field in core:
            val = core[field]
            return " ".join(val) if isinstance(val, list) else str(val)

    # Name + description
    name = core.get("name", "")
    desc = core.get("description", "")
    if name or desc:
        return f"{name}. {desc}".strip(". ")

    return json.dumps(core)


def interactive():
    """Interactive mode - type to speak"""
    print("=" * 50)
    print("LDS MOUTH - Interactive Mode")
    print("=" * 50)
    print("Type text or paste LDS JSON to speak.")
    print("Commands: /quit, /file <path>")
    print("-" * 50)

    while True:
        try:
            text = input("\n> ").strip()

            if not text:
                continue

            if text == "/quit":
                break

            if text.startswith("/file "):
                path = text[6:].strip()
                speak(path)
                continue

            speak(text)

        except KeyboardInterrupt:
            break
        except EOFError:
            break

    print("\nMouth closed.")


def main():
    if len(sys.argv) > 1:
        # Speak argument
        speak(" ".join(sys.argv[1:]))
    else:
        # Interactive mode
        interactive()


if __name__ == "__main__":
    main()
