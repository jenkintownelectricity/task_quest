# Voice Kernel - Ocean Data Flow Architecture

5-Layer voice-enabled kernel for Task Quest, based on HIVE215/Premier Voice Assistant.

## Architecture: Ocean Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  L5 SURFACE (Mouth) - Speech Output                             │
│  ├── TTS Engine (Browser/ElevenLabs/OpenAI)                     │
│  ├── Response Formatter (Child-friendly/Parent modes)           │
│  └── Celebration Sounds                                         │
├─────────────────────────────────────────────────────────────────┤
│  L4 CURRENT (Intent) - Action Processing                        │
│  ├── Intent Classifier                                          │
│  ├── Action Executor                                            │
│  └── Tool Router                                                │
├─────────────────────────────────────────────────────────────────┤
│  L3 THERMOCLINE (Context) - Working Memory                      │
│  ├── Session Context                                            │
│  ├── Conversation History                                       │
│  ├── State Machine                                              │
│  └── Thermal Mixing (bridges warm/cold layers)                  │
├─────────────────────────────────────────────────────────────────┤
│  L2 DEEP (Knowledge) - Entity Store                             │
│  ├── Entity Resolver                                            │
│  ├── LDS Loader (*.lds.json)                                    │
│  ├── Knowledge Graph                                            │
│  └── Vector Search (optional)                                   │
├─────────────────────────────────────────────────────────────────┤
│  L1 ABYSS (Persistence) - Database                              │
│  ├── Supabase Client (tq_* tables)                              │
│  ├── Local Storage (offline support)                            │
│  ├── Sync Manager                                               │
│  └── Audit Logger (HIPAA compliant)                             │
└─────────────────────────────────────────────────────────────────┘
```

## Fast Brain - LLM Router

Intelligent routing between fast (Groq) and powerful (Claude) models:

| Complexity | Model | Latency Target |
|------------|-------|----------------|
| Trivial | Groq Llama 8B Instant | 200ms |
| Simple | Groq Llama 70B | 500ms |
| Moderate | DeepSeek R1 | 2s |
| Complex | Claude Sonnet | 5s |
| Critical | Claude Opus | 15s |

## Files

```
voice_kernel/
├── L0_kernel.lds.json       # Root orchestrator
├── L1_abyss.lds.json        # Persistence layer
├── L2_deep.lds.json         # Knowledge layer
├── L3_thermocline.lds.json  # Context layer
├── L4_current.lds.json      # Intent layer
├── L5_surface.lds.json      # Output layer
├── fast_brain/
│   ├── router.lds.json      # LLM routing config
│   └── prompts.lds.json     # System prompts
└── README.md
```

## Data Flow

**Upward (Query):** Persistence → Knowledge → Context → Intent → Output

**Downward (Command):** Input → Intent → Context → Knowledge → Persistence

## Integration

The Voice Kernel connects to Task Quest via:
- **Entities:** `../entities/*.lds.json` (tasks, achievements, rewards, etc.)
- **Database:** Supabase `tq_*` tables
- **UI:** `task-quest-supabase.html` single-page app
