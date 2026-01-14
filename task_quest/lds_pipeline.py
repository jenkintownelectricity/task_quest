"""
LDS Voice Pipeline - Data Until Speech
======================================

The message is carried as data until it becomes speech.
This is the zero-latency pipeline.

    LDS Entity → Parser → Voice Queue → Output
         ↓          ↓          ↓          ↓
       Data      Extract    Buffer     Speak
                  Voice      Chunk     Instant

No middleware. No waiting. The mouth comes alive.
"""

import asyncio
import json
import time
from dataclasses import dataclass, field
from typing import AsyncIterator, Optional, Callable, Any
from pathlib import Path
from queue import Queue
from threading import Thread, Event


# =============================================================================
# PIPELINE STAGES
# =============================================================================

@dataclass
class VoiceChunk:
    """A chunk of voice data ready to speak"""
    text: str
    rate: float = 1.0
    pitch: float = 1.0
    timestamp: float = field(default_factory=time.time)
    source_id: str = ""


class LDSSource:
    """
    Stage 1: LDS Source

    Reads LDS entities and yields voice-ready data.
    Can watch files, poll APIs, or receive pushes.
    """

    def __init__(self):
        self._watchers: list[Callable] = []

    async def from_file(self, path: str) -> AsyncIterator[dict]:
        """Stream LDS from a file"""
        with open(path) as f:
            lds = json.load(f)
        yield lds

    async def from_files(self, pattern: str) -> AsyncIterator[dict]:
        """Stream LDS from multiple files"""
        for path in Path().glob(pattern):
            if path.suffix == '.json' and '.lds' in path.name:
                with open(path) as f:
                    yield json.load(f)

    async def from_stream(self, stream: AsyncIterator[str]) -> AsyncIterator[dict]:
        """Stream LDS from incoming data"""
        async for chunk in stream:
            try:
                yield json.loads(chunk)
            except json.JSONDecodeError:
                # Treat as raw text
                yield {"core": {"speak": chunk}}

    def watch(self, path: str, callback: Callable):
        """Watch for file changes (requires watchdog)"""
        try:
            from watchdog.observers import Observer
            from watchdog.events import FileSystemEventHandler

            class Handler(FileSystemEventHandler):
                def on_modified(self, event):
                    if '.lds.json' in event.src_path:
                        with open(event.src_path) as f:
                            callback(json.load(f))

            observer = Observer()
            observer.schedule(Handler(), path, recursive=True)
            observer.start()

        except ImportError:
            print("Install watchdog for file watching")


class VoiceExtractor:
    """
    Stage 2: Voice Extractor

    Extracts speakable content from LDS entities.
    The transformation from data to voice payload.
    """

    @staticmethod
    def extract(lds: dict) -> VoiceChunk:
        """Extract voice chunk from LDS entity"""
        core = lds.get("core", lds)
        meta = lds.get("_lds", {})

        # Extract text
        text = ""
        for field in ["speak", "say", "message", "text", "utterance"]:
            if field in core:
                val = core[field]
                text = " ".join(val) if isinstance(val, list) else str(val)
                break

        # Fallback to name + description
        if not text:
            name = core.get("name", "")
            desc = core.get("description", "")
            text = f"{name}. {desc}".strip(". ") if name or desc else ""

        # Extract voice settings
        voice = core.get("voice", {})
        rate = voice.get("rate", voice.get("speed", 1.0))
        pitch = voice.get("pitch", 1.0)

        return VoiceChunk(
            text=text or json.dumps(core),
            rate=rate,
            pitch=pitch,
            source_id=meta.get("id", "unknown")
        )

    async def process(self, source: AsyncIterator[dict]) -> AsyncIterator[VoiceChunk]:
        """Process stream of LDS entities into voice chunks"""
        async for lds in source:
            yield self.extract(lds)


class VoiceBuffer:
    """
    Stage 3: Voice Buffer

    Buffers voice chunks for smooth playback.
    Handles chunking for streaming speech.
    """

    def __init__(self, chunk_size: int = 100):
        self.chunk_size = chunk_size  # chars per chunk
        self._buffer: Queue = Queue()

    async def buffer(self, chunks: AsyncIterator[VoiceChunk]) -> AsyncIterator[VoiceChunk]:
        """Buffer and optionally re-chunk voice data"""
        async for chunk in chunks:
            # If text is short, pass through
            if len(chunk.text) <= self.chunk_size:
                yield chunk
                continue

            # Split long text into sentence-based chunks
            sentences = self._split_sentences(chunk.text)

            for sentence in sentences:
                yield VoiceChunk(
                    text=sentence,
                    rate=chunk.rate,
                    pitch=chunk.pitch,
                    source_id=chunk.source_id
                )

    def _split_sentences(self, text: str) -> list[str]:
        """Split text into sentences"""
        import re
        sentences = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in sentences if s.strip()]


class VoiceOutput:
    """
    Stage 4: Voice Output

    The mouth. Speaks voice chunks instantly.
    Zero latency - first word speaks before last arrives.
    """

    def __init__(self, backend: str = "auto"):
        self.backend = self._detect_backend(backend)
        self._speaking = Event()
        self._engine = None

    def _detect_backend(self, backend: str) -> str:
        if backend != "auto":
            return backend

        try:
            import pyttsx3
            return "pyttsx3"
        except ImportError:
            pass

        return "print"

    def _init_engine(self):
        if self.backend == "pyttsx3" and self._engine is None:
            import pyttsx3
            self._engine = pyttsx3.init()

    async def speak(self, chunks: AsyncIterator[VoiceChunk]):
        """Speak chunks as they arrive - zero latency"""
        self._init_engine()

        async for chunk in chunks:
            if not chunk.text.strip():
                continue

            self._speaking.set()

            if self.backend == "pyttsx3":
                await self._speak_pyttsx3(chunk)
            else:
                await self._speak_print(chunk)

            self._speaking.clear()

    async def _speak_pyttsx3(self, chunk: VoiceChunk):
        """Speak using pyttsx3"""
        self._engine.setProperty('rate', int(150 * chunk.rate))
        self._engine.say(chunk.text)
        self._engine.runAndWait()

    async def _speak_print(self, chunk: VoiceChunk):
        """Fallback: print to console"""
        print(f"[SPEAK {chunk.source_id}]: {chunk.text}")
        # Simulate speech time
        await asyncio.sleep(len(chunk.text) * 0.05)

    def stop(self):
        """Stop speaking immediately"""
        if self._engine:
            self._engine.stop()


# =============================================================================
# THE PIPELINE - Data Until Speech
# =============================================================================

class LDSVoicePipeline:
    """
    The complete pipeline: LDS → Voice

    Data flows through:
    1. Source: Load LDS entities
    2. Extractor: Extract voice content
    3. Buffer: Chunk for streaming
    4. Output: Speak instantly
    """

    def __init__(self, backend: str = "auto"):
        self.source = LDSSource()
        self.extractor = VoiceExtractor()
        self.buffer = VoiceBuffer()
        self.output = VoiceOutput(backend)

    async def speak_file(self, path: str):
        """Speak an LDS file"""
        lds_stream = self.source.from_file(path)
        voice_stream = self.extractor.process(lds_stream)
        buffered = self.buffer.buffer(voice_stream)
        await self.output.speak(buffered)

    async def speak_files(self, pattern: str):
        """Speak multiple LDS files"""
        lds_stream = self.source.from_files(pattern)
        voice_stream = self.extractor.process(lds_stream)
        buffered = self.buffer.buffer(voice_stream)
        await self.output.speak(buffered)

    async def speak_lds(self, lds: dict):
        """Speak an LDS entity directly"""
        async def single():
            yield lds

        voice_stream = self.extractor.process(single())
        buffered = self.buffer.buffer(voice_stream)
        await self.output.speak(buffered)

    async def speak_stream(self, stream: AsyncIterator[dict]):
        """Speak from a stream of LDS entities"""
        voice_stream = self.extractor.process(stream)
        buffered = self.buffer.buffer(voice_stream)
        await self.output.speak(buffered)

    def stop(self):
        """Stop the pipeline"""
        self.output.stop()


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

_pipeline: Optional[LDSVoicePipeline] = None

def get_pipeline() -> LDSVoicePipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = LDSVoicePipeline()
    return _pipeline


def speak_file(path: str):
    """Speak an LDS file"""
    asyncio.run(get_pipeline().speak_file(path))


def speak_lds(lds: dict):
    """Speak an LDS entity"""
    asyncio.run(get_pipeline().speak_lds(lds))


def speak_text(text: str):
    """Speak raw text"""
    speak_lds({"core": {"speak": text}})


# =============================================================================
# DEMO
# =============================================================================

async def demo():
    """Demo the pipeline"""
    print("=" * 60)
    print("LDS VOICE PIPELINE - Data Until Speech")
    print("=" * 60)

    pipeline = LDSVoicePipeline()

    # Demo 1: Single LDS entity
    print("\n1. Speaking single LDS entity...")
    await pipeline.speak_lds({
        "_lds": {"id": "lds:demo/hello-v1"},
        "core": {
            "speak": "Hello! This is the LDS Voice Pipeline speaking.",
            "voice": {"rate": 1.0}
        }
    })

    # Demo 2: Streaming multiple entities
    print("\n2. Streaming multiple entities...")

    async def entity_stream():
        entities = [
            {"core": {"speak": "First message arrives."}},
            {"core": {"speak": "Second message follows immediately."}},
            {"core": {"speak": "Third message completes the stream."}}
        ]
        for e in entities:
            yield e
            await asyncio.sleep(0.5)  # Simulate delay

    await pipeline.speak_stream(entity_stream())

    # Demo 3: Long text with chunking
    print("\n3. Speaking with automatic chunking...")
    await pipeline.speak_lds({
        "core": {
            "speak": "This is a longer message that will be automatically chunked. "
                     "The pipeline splits text at sentence boundaries. "
                     "Each sentence speaks as it's ready. "
                     "No waiting for the full text. Zero latency."
        }
    })

    print("\n" + "=" * 60)
    print("Pipeline demo complete.")
    print("=" * 60)


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        path = sys.argv[1]
        if Path(path).exists():
            speak_file(path)
        else:
            speak_text(" ".join(sys.argv[1:]))
    else:
        asyncio.run(demo())
