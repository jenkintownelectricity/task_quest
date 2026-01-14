"""
LDS Speech Engine - Zero Latency Voice Output
=============================================

The mouth comes alive. Data becomes speech the instant the message is carried.

Philosophy:
- LDS is data until speech
- No middleware, no waiting
- Stream-first: first word speaks while last word loads
- "Always true" - if it's in the LDS, it speaks

Usage:
    from lds_speech_engine import speak, stream_speak

    # Instant speak from LDS
    speak(lds_entity)

    # Stream speak (starts immediately)
    async for chunk in stream_speak(lds_entity):
        pass  # Already speaking
"""

import json
import asyncio
import queue
import threading
from dataclasses import dataclass, field
from typing import Optional, Iterator, AsyncIterator, Callable, Any, Union
from pathlib import Path
from enum import Enum
import time


# =============================================================================
# CORE TYPES
# =============================================================================

class VoiceState(Enum):
    """The mouth's state"""
    SILENT = "silent"
    SPEAKING = "speaking"
    STREAMING = "streaming"


@dataclass
class Voice:
    """A voice configuration - how the mouth sounds"""
    rate: float = 1.0          # Speed: 0.5 (slow) to 2.0 (fast)
    pitch: float = 1.0         # Pitch: 0.5 (low) to 2.0 (high)
    volume: float = 1.0        # Volume: 0.0 to 1.0
    voice_id: Optional[str] = None  # Specific voice to use


@dataclass
class Utterance:
    """A single unit of speech - the carried message"""
    text: str
    voice: Voice = field(default_factory=Voice)
    priority: int = 0          # Higher = speaks first
    timestamp: float = field(default_factory=time.time)

    def __lt__(self, other):
        return self.priority > other.priority  # Higher priority first


@dataclass
class LDSMessage:
    """Extracted speakable content from an LDS entity"""
    id: str
    content: str
    voice: Voice
    meta: dict = field(default_factory=dict)


# =============================================================================
# THE SPEECH ENGINE - The Core
# =============================================================================

class LDSSpeechEngine:
    """
    The mouth. Feed it LDS, it speaks.

    Zero latency design:
    - Speaks first word before parsing last
    - Background thread for non-blocking
    - Queue for ordered speech
    """

    def __init__(self, backend: str = "auto"):
        """
        Initialize the speech engine.

        Args:
            backend: "pyttsx3", "edge", "web", or "auto"
        """
        self.backend = self._select_backend(backend)
        self.state = VoiceState.SILENT
        self._queue = queue.PriorityQueue()
        self._speaker_thread: Optional[threading.Thread] = None
        self._running = False
        self._on_speak: Optional[Callable[[str], None]] = None
        self._on_done: Optional[Callable[[], None]] = None

    def _select_backend(self, backend: str) -> str:
        """Auto-select the best available backend"""
        if backend != "auto":
            return backend

        # Try pyttsx3 first (most compatible)
        try:
            import pyttsx3
            return "pyttsx3"
        except ImportError:
            pass

        # Try edge-tts (high quality, async)
        try:
            import edge_tts
            return "edge"
        except ImportError:
            pass

        return "print"  # Fallback: just print

    # -------------------------------------------------------------------------
    # LDS PARSING - Extract voice from data
    # -------------------------------------------------------------------------

    def parse_lds(self, lds: Union[dict, str, Path]) -> LDSMessage:
        """
        Parse an LDS entity into a speakable message.

        The LDS becomes voice through these paths:
        1. core.speak / core.message / core.text - explicit speech
        2. core.name + core.description - inferred speech
        3. Any string in core - fallback
        """
        # Load if path or string
        if isinstance(lds, (str, Path)):
            if Path(lds).exists():
                with open(lds) as f:
                    lds = json.load(f)
            else:
                lds = json.loads(lds)

        # Extract metadata
        meta = lds.get("_lds", {})
        lds_id = meta.get("id", "unknown")

        # Extract voice settings
        voice = self._extract_voice(lds)

        # Extract content - priority order
        content = self._extract_content(lds)

        return LDSMessage(
            id=lds_id,
            content=content,
            voice=voice,
            meta=meta
        )

    def _extract_voice(self, lds: dict) -> Voice:
        """Extract voice configuration from LDS"""
        voice = Voice()

        # Check core.voice
        core = lds.get("core", {})
        voice_cfg = core.get("voice", {})

        if isinstance(voice_cfg, dict):
            voice.rate = voice_cfg.get("rate", voice_cfg.get("speed", 1.0))
            voice.pitch = voice_cfg.get("pitch", 1.0)
            voice.volume = voice_cfg.get("volume", 1.0)
            voice.voice_id = voice_cfg.get("voice_id", voice_cfg.get("id"))

        # Check top-level voice settings
        if "voice" in lds and isinstance(lds["voice"], dict):
            v = lds["voice"]
            voice.rate = v.get("rate", voice.rate)
            voice.pitch = v.get("pitch", voice.pitch)
            voice.volume = v.get("volume", voice.volume)
            voice.voice_id = v.get("voice_id", voice.voice_id)

        return voice

    def _extract_content(self, lds: dict) -> str:
        """Extract speakable content from LDS - the message to carry"""
        core = lds.get("core", {})

        # Priority 1: Explicit speech fields
        for field in ["speak", "say", "message", "text", "utterance", "speech"]:
            if field in core:
                val = core[field]
                if isinstance(val, str):
                    return val
                elif isinstance(val, list):
                    return " ".join(str(v) for v in val)

        # Priority 2: Name + description
        name = core.get("name", "")
        desc = core.get("description", "")
        if name and desc:
            return f"{name}. {desc}"
        if name:
            return name
        if desc:
            return desc

        # Priority 3: Any string value in core
        for key, val in core.items():
            if isinstance(val, str) and len(val) > 5:
                return val

        # Priority 4: Stringify the whole thing
        return json.dumps(core, indent=2)

    # -------------------------------------------------------------------------
    # SPEAKING - The mouth comes alive
    # -------------------------------------------------------------------------

    def speak(self, lds: Union[dict, str, Path, LDSMessage], block: bool = True) -> None:
        """
        Speak an LDS entity. The message is carried to voice.

        Args:
            lds: The LDS entity, path, or already-parsed LDSMessage
            block: Wait for speech to complete (default True)
        """
        # Parse if needed
        if isinstance(lds, LDSMessage):
            message = lds
        else:
            message = self.parse_lds(lds)

        # Create utterance
        utterance = Utterance(text=message.content, voice=message.voice)

        if block:
            self._speak_now(utterance)
        else:
            self._enqueue(utterance)

    def speak_text(self, text: str, voice: Optional[Voice] = None, block: bool = True) -> None:
        """Speak raw text directly - bypass LDS parsing"""
        utterance = Utterance(text=text, voice=voice or Voice())

        if block:
            self._speak_now(utterance)
        else:
            self._enqueue(utterance)

    def _speak_now(self, utterance: Utterance) -> None:
        """Speak immediately, blocking until done"""
        self.state = VoiceState.SPEAKING

        if self._on_speak:
            self._on_speak(utterance.text)

        if self.backend == "pyttsx3":
            self._speak_pyttsx3(utterance)
        elif self.backend == "edge":
            asyncio.run(self._speak_edge(utterance))
        else:
            # Fallback: print
            print(f"[SPEAK]: {utterance.text}")

        self.state = VoiceState.SILENT

        if self._on_done:
            self._on_done()

    def _speak_pyttsx3(self, utterance: Utterance) -> None:
        """Speak using pyttsx3 - synchronous, local"""
        import pyttsx3

        engine = pyttsx3.init()

        # Apply voice settings
        engine.setProperty('rate', int(150 * utterance.voice.rate))
        engine.setProperty('volume', utterance.voice.volume)

        # Set voice if specified
        if utterance.voice.voice_id:
            voices = engine.getProperty('voices')
            for v in voices:
                if utterance.voice.voice_id.lower() in v.id.lower():
                    engine.setProperty('voice', v.id)
                    break

        engine.say(utterance.text)
        engine.runAndWait()
        engine.stop()

    async def _speak_edge(self, utterance: Utterance) -> None:
        """Speak using edge-tts - async, high quality"""
        import edge_tts
        import tempfile
        import os

        # Create communicate object
        voice = utterance.voice.voice_id or "en-US-AriaNeural"
        rate = f"+{int((utterance.voice.rate - 1) * 100)}%" if utterance.voice.rate >= 1 else f"{int((utterance.voice.rate - 1) * 100)}%"
        pitch = f"+{int((utterance.voice.pitch - 1) * 50)}Hz" if utterance.voice.pitch >= 1 else f"{int((utterance.voice.pitch - 1) * 50)}Hz"

        communicate = edge_tts.Communicate(
            utterance.text,
            voice,
            rate=rate,
            pitch=pitch
        )

        # Stream to temp file and play
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            temp_path = f.name

        await communicate.save(temp_path)

        # Play audio
        try:
            import pygame
            pygame.mixer.init()
            pygame.mixer.music.load(temp_path)
            pygame.mixer.music.set_volume(utterance.voice.volume)
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                await asyncio.sleep(0.1)
        except ImportError:
            # Fallback: use system player
            import subprocess
            if os.name == 'nt':
                os.startfile(temp_path)
            elif os.name == 'posix':
                subprocess.run(['mpg123', '-q', temp_path], check=False)
        finally:
            try:
                os.unlink(temp_path)
            except:
                pass

    # -------------------------------------------------------------------------
    # STREAMING - Zero latency, speak as we parse
    # -------------------------------------------------------------------------

    def stream_speak(self, text_iterator: Iterator[str], voice: Optional[Voice] = None) -> None:
        """
        Stream speech - start speaking before all text arrives.

        This is the zero-latency path. Each chunk speaks as it arrives.
        """
        self.state = VoiceState.STREAMING
        voice = voice or Voice()

        buffer = ""

        for chunk in text_iterator:
            buffer += chunk

            # Speak on sentence boundaries for natural flow
            while True:
                # Find sentence end
                for delim in [". ", "! ", "? ", "\n"]:
                    idx = buffer.find(delim)
                    if idx != -1:
                        sentence = buffer[:idx + len(delim)]
                        buffer = buffer[idx + len(delim):]

                        # Speak this sentence
                        utterance = Utterance(text=sentence.strip(), voice=voice)
                        self._speak_now(utterance)
                        break
                else:
                    break

        # Speak remaining buffer
        if buffer.strip():
            utterance = Utterance(text=buffer.strip(), voice=voice)
            self._speak_now(utterance)

        self.state = VoiceState.SILENT

    async def async_stream_speak(self, async_iterator: AsyncIterator[str], voice: Optional[Voice] = None) -> None:
        """Async version of stream_speak for async text sources"""
        self.state = VoiceState.STREAMING
        voice = voice or Voice()

        buffer = ""

        async for chunk in async_iterator:
            buffer += chunk

            while True:
                for delim in [". ", "! ", "? ", "\n"]:
                    idx = buffer.find(delim)
                    if idx != -1:
                        sentence = buffer[:idx + len(delim)]
                        buffer = buffer[idx + len(delim):]

                        utterance = Utterance(text=sentence.strip(), voice=voice)
                        self._speak_now(utterance)
                        break
                else:
                    break

        if buffer.strip():
            utterance = Utterance(text=buffer.strip(), voice=voice)
            self._speak_now(utterance)

        self.state = VoiceState.SILENT

    # -------------------------------------------------------------------------
    # BACKGROUND SPEAKING - Non-blocking queue
    # -------------------------------------------------------------------------

    def _enqueue(self, utterance: Utterance) -> None:
        """Add to speech queue"""
        self._queue.put(utterance)

        if not self._running:
            self._start_speaker_thread()

    def _start_speaker_thread(self) -> None:
        """Start background speaker thread"""
        self._running = True
        self._speaker_thread = threading.Thread(target=self._speaker_loop, daemon=True)
        self._speaker_thread.start()

    def _speaker_loop(self) -> None:
        """Background thread that speaks queued utterances"""
        while self._running:
            try:
                utterance = self._queue.get(timeout=0.1)
                self._speak_now(utterance)
                self._queue.task_done()
            except queue.Empty:
                if self._queue.empty():
                    self._running = False

    def stop(self) -> None:
        """Stop all speech immediately"""
        self._running = False

        # Clear queue
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
            except queue.Empty:
                break

        self.state = VoiceState.SILENT

    # -------------------------------------------------------------------------
    # CALLBACKS - Hook into the mouth
    # -------------------------------------------------------------------------

    def on_speak(self, callback: Callable[[str], None]) -> None:
        """Register callback when speech starts"""
        self._on_speak = callback

    def on_done(self, callback: Callable[[], None]) -> None:
        """Register callback when speech ends"""
        self._on_done = callback


# =============================================================================
# CONVENIENCE API - Simple functions
# =============================================================================

_engine: Optional[LDSSpeechEngine] = None

def get_engine() -> LDSSpeechEngine:
    """Get or create the global engine"""
    global _engine
    if _engine is None:
        _engine = LDSSpeechEngine()
    return _engine


def speak(lds: Union[dict, str, Path], block: bool = True) -> None:
    """
    Speak an LDS entity. The simplest API.

    Examples:
        speak({"core": {"message": "Hello world"}})
        speak("./my-entity.lds.json")
        speak('{"core": {"speak": "Hello"}}')
    """
    get_engine().speak(lds, block=block)


def say(text: str, block: bool = True) -> None:
    """Speak raw text directly"""
    get_engine().speak_text(text, block=block)


def stream(text_iterator: Iterator[str]) -> None:
    """Stream speech - zero latency"""
    get_engine().stream_speak(text_iterator)


async def astream(async_iterator: AsyncIterator[str]) -> None:
    """Async stream speech"""
    await get_engine().async_stream_speak(async_iterator)


def stop() -> None:
    """Stop all speech"""
    get_engine().stop()


# =============================================================================
# LDS FILE WATCHER - Speak when LDS changes
# =============================================================================

class LDSVoiceWatcher:
    """
    Watch LDS files and speak when they change.

    The mouth stays alive, responding to data changes.
    """

    def __init__(self, engine: Optional[LDSSpeechEngine] = None):
        self.engine = engine or get_engine()
        self._watching = False
        self._watch_paths: list[Path] = []

    def watch(self, path: Union[str, Path]) -> None:
        """Start watching an LDS file or directory"""
        path = Path(path)
        self._watch_paths.append(path)

        if not self._watching:
            self._start_watching()

    def _start_watching(self) -> None:
        """Start the file watcher"""
        self._watching = True

        try:
            from watchdog.observers import Observer
            from watchdog.events import FileSystemEventHandler

            class LDSHandler(FileSystemEventHandler):
                def __init__(handler_self, engine):
                    handler_self.engine = engine

                def on_modified(handler_self, event):
                    if event.src_path.endswith('.lds.json'):
                        handler_self.engine.speak(event.src_path, block=False)

            observer = Observer()
            handler = LDSHandler(self.engine)

            for path in self._watch_paths:
                if path.is_dir():
                    observer.schedule(handler, str(path), recursive=True)
                else:
                    observer.schedule(handler, str(path.parent), recursive=False)

            observer.start()

        except ImportError:
            print("Install watchdog for file watching: pip install watchdog")


# =============================================================================
# DEMO / CLI
# =============================================================================

def demo():
    """Demo the speech engine"""
    print("=" * 60)
    print("LDS SPEECH ENGINE - The Mouth Comes Alive")
    print("=" * 60)

    # Test 1: Simple LDS
    print("\n1. Speaking from LDS entity...")
    lds = {
        "_lds": {"id": "lds:demo/greeting-v1", "type": "demo"},
        "core": {
            "speak": "Hello! I am the LDS Speech Engine. Data becomes voice instantly."
        }
    }
    speak(lds)

    # Test 2: Voice configuration
    print("\n2. Speaking with custom voice...")
    lds_with_voice = {
        "core": {
            "message": "This message speaks faster.",
            "voice": {"rate": 1.3}
        }
    }
    speak(lds_with_voice)

    # Test 3: Raw text
    print("\n3. Speaking raw text...")
    say("Raw text speaks too. No LDS needed.")

    # Test 4: Streaming
    print("\n4. Streaming speech...")
    def word_generator():
        sentence = "This sentence streams word by word with zero latency."
        for word in sentence.split():
            yield word + " "
            time.sleep(0.1)  # Simulate slow source

    stream(word_generator())

    print("\n" + "=" * 60)
    print("Demo complete. The mouth rests.")
    print("=" * 60)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        # Speak file or text from command line
        arg = sys.argv[1]

        if Path(arg).exists():
            speak(arg)
        else:
            say(" ".join(sys.argv[1:]))
    else:
        demo()
