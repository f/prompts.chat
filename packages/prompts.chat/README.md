# prompts.chat Prompt Builder

A comprehensive developer toolkit for building, validating, and parsing AI prompts. Create structured prompts for chat models, image generators, video AI, and music generation with fluent, type-safe APIs.

[![Playground](https://img.shields.io/badge/Playground-prompts.chat%2Ftyped--prompts--editor-blue)](https://prompts.chat/typed-prompts-editor)

## Reason

Building effective AI prompts is challenging. Developers often struggle with:

- **Inconsistent prompt structure** — Different team members write prompts differently, leading to unpredictable AI responses
- **No type safety** — Typos and missing fields go unnoticed until runtime
- **Repetitive boilerplate** — Writing the same patterns over and over for common use cases
- **Hard to maintain** — Prompts scattered across codebases without standardization
- **Multi-modal complexity** — Each AI platform (chat, image, video, audio) has different requirements

`prompts.chat` solves these problems by providing a fluent, type-safe API that guides you through prompt construction with autocomplete, validation, and pre-built templates for common patterns.

## Installation

```bash
npm install prompts.chat
```

## CLI

Requires Node.js 18 or newer. No install or account needed:

```bash
npx prompts.chat --help
```

The CLI only reads public content and never sends credentials. Private prompts stay private (`show`
reports them as private), and unlisted or deleted items are not listed.

### Interactive Prompt Browser

Browse and search prompts from your terminal:

```bash
npx prompts.chat
```

**Navigation:**
- `↑/↓` or `j/k` — Navigate list
- `Enter` — Select prompt
- `/` — Search prompts
- `c` — Pick a category (list) / copy prompt with variable filling (detail)
- `n/p` — Next/Previous page
- `r` — Run prompt (open in ChatGPT, Claude, etc.)
- `C` — Copy raw prompt
- `o` — Open in browser
- `b` — Go back
- `q` — Quit

The browser needs a real terminal. In scripts, pipes and CI use the commands below.

### Search and Browse

```bash
npx prompts.chat search "code review"            # prompts, skills, tastes and more
npx prompts.chat search sql --type skill          # text, image, video, audio, structured,
                                                  # skill, taste, classifier or bot
npx prompts.chat prompts --sort upvotes --trending
npx prompts.chat skills postgres
npx prompts.chat tastes
npx prompts.chat classifiers fraud
npx prompts.chat bots --platform hermes           # grok, openclaw, hermes, autogpt, dots, duet, muse
npx prompts.chat teams --tag software
```

Listings take `--page`, `--limit` (up to 100), `--sort newest|oldest|upvotes` and `--tag`
(`bots` and `teams` also take `--category <slug>`). Every result prints the id to pass to `show`.

### Show and Install

```bash
npx prompts.chat show <id>                        # prompt, skill, taste or classifier
npx prompts.chat show <id> --raw | pbcopy         # only the prompt body
npx prompts.chat show https://prompts.chat/classifiers/account-takeover-signal

npx prompts.chat bot <id>                         # instructions, routines, skills, install options
npx prompts.chat bot <id> --skill > SKILL.md      # the bot as an agent skill
npx prompts.chat bot <id> --install hermes        # install prompt (and command) for a platform

npx prompts.chat team lean-software-factory
npx prompts.chat team lean-software-factory --install grok
```

`show`, `bot` and `team` accept ids, `id_slug` handles and prompts.chat page URLs. Add `--json` to
any command for the raw API response.

Exit codes: `0` success, `1` request failed or not found, `2` usage error.

### Self-Hosted Instances

Point the CLI (and the interactive browser) at your own instance:

```bash
npx prompts.chat search onboarding --base-url https://prompts.example.com
PROMPTS_CHAT_URL=http://localhost:3000 npx prompts.chat
```

### Create a New Instance

Scaffold a new prompts.chat deployment with a single command:

```bash
npx prompts.chat new my-prompt-library
```

This will:
1. Clone a clean copy of the repository (removes `.github`, `.claude`, `packages/`, dev scripts)
2. Install dependencies
3. Launch the interactive setup wizard to configure branding, theme, auth, and features

### MCP Server

```bash
npx prompts.chat mcp
```

Starts the stdio MCP server from [`@fkadev/prompts.chat-mcp`](https://www.npmjs.com/package/@fkadev/prompts.chat-mcp).

### Development

```bash
npm test            # build, then unit, command and built-binary tests against a local mock API
npm run test:live   # read-only contract tests against https://prompts.chat
npm run test:pack   # npm pack, install the tarball in a clean temp project, run bins, npx and the TUI
SMOKE_NODE_BINARIES=/path/to/node18:/path/to/node24 npm run test:pack -- --live
```

See [CHANGELOG.md](./CHANGELOG.md) for release notes.

---

## Quick Start

```typescript
import { builder, chat, image, audio, variables, quality } from 'prompts.chat';

// Build structured text prompts
const prompt = builder()
  .role("Senior TypeScript Developer")
  .task("Review the following code for bugs and improvements")
  .constraints(["Be concise", "Focus on critical issues"])
  .variable("code", { required: true })
  .build();

// Build chat prompts with full control
const chatPrompt = chat()
  .role("expert code reviewer")
  .tone("professional")
  .expertise("TypeScript", "React", "Node.js")
  .task("Review code and provide actionable feedback")
  .stepByStep()
  .json()
  .build();

// Build image generation prompts
const imagePrompt = image()
  .subject("a cyberpunk samurai")
  .environment("neon-lit Tokyo streets")
  .shot("medium")
  .lens("35mm")
  .lightingType("rim")
  .medium("cinematic")
  .build();

// Build music generation prompts  
const musicPrompt = audio()
  .genre("electronic")
  .mood("energetic")
  .bpm(128)
  .instruments(["synthesizer", "drums", "bass"])
  .build();

// Normalize variable formats
const normalized = variables.normalize("Hello {{name}}, you are [ROLE]");
// → "Hello ${name}, you are ${role}"

// Check quality locally (no API needed)
const result = quality.check("Act as a developer...");
console.log(result.score); // 0.85
```

---

## Modules

- [Variables](#-variables) — Variable detection and normalization
- [Similarity](#-similarity) — Content deduplication
- [Builder](#️-builder) — Structured text prompts
- [Chat Builder](#-chat-builder) — Chat/conversational prompts
- [Image Builder](#-image-builder) — Image generation prompts
- [Video Builder](#-video-builder) — Video generation prompts
- [Audio Builder](#-audio-builder) — Music/audio generation prompts
- [Quality](#-quality) — Prompt validation
- [Parser](#-parser) — Multi-format parsing

---

## 🔧 Variables

Universal variable detection and normalization across different formats.

```typescript
import { variables } from 'prompts.chat';

// Detect variables in any format
const detected = variables.detect("Hello {{name}}, welcome to [COMPANY]");
// → [{ name: "name", pattern: "double_curly" }, { name: "COMPANY", pattern: "single_bracket" }]

// Normalize all formats to ${var}
const normalized = variables.normalize("Hello {{name}}, you are [ROLE]");
// → "Hello ${name}, you are ${role}"

// Extract variables from ${var} format
const vars = variables.extractVariables("Hello ${name:World}");
// → [{ name: "name", defaultValue: "World" }]

// Compile template with values
const result = variables.compile("Hello ${name:World}", { name: "Developer" });
// → "Hello Developer"

// Get pattern descriptions
variables.getPatternDescription("double_bracket"); // → "[[...]]"
```

### Supported Formats

| Format | Example | Pattern Name |
|--------|---------|--------------|
| `${var}` | `${name}` | `dollar_curly` |
| `${var:default}` | `${name:World}` | `dollar_curly` |
| `{{var}}` | `{{name}}` | `double_curly` |
| `[[var]]` | `[[name]]` | `double_bracket` |
| `[VAR]` | `[NAME]` | `single_bracket` |
| `{VAR}` | `{NAME}` | `single_curly` |
| `<VAR>` | `<NAME>` | `angle_bracket` |
| `%VAR%` | `%NAME%` | `percent` |

### API Reference

| Function | Description |
|----------|-------------|
| `detect(text)` | Detect variables in any format |
| `normalize(text)` | Convert all formats to `${var}` |
| `extractVariables(text)` | Extract from `${var}` format |
| `compile(text, values, options?)` | Replace variables with values |
| `convertToSupportedFormat(variable)` | Convert a single variable |
| `getPatternDescription(pattern)` | Get human-readable pattern |

---

## 📊 Similarity

Content similarity detection for deduplication using Jaccard and n-gram algorithms.

```typescript
import { similarity } from 'prompts.chat';

// Calculate similarity score (0-1)
const score = similarity.calculate(prompt1, prompt2);
// → 0.87

// Check if prompts are duplicates (default threshold: 0.85)
const isDupe = similarity.isDuplicate(prompt1, prompt2, 0.85);
// → true

// Find groups of duplicate prompts
const groups = similarity.findDuplicates(prompts, 0.85);
// → [[prompt1, prompt3], [prompt2, prompt5]]

// Deduplicate an array (keeps first occurrence)
const unique = similarity.deduplicate(prompts, 0.85);

// Get content fingerprint for indexing
const fingerprint = similarity.getContentFingerprint(prompt);

// Normalize content for comparison
const normalized = similarity.normalizeContent(text);
```

### API Reference

| Function | Description |
|----------|-------------|
| `calculate(content1, content2)` | Calculate similarity score (0-1) |
| `isDuplicate(content1, content2, threshold?)` | Check if similar (default 0.85) |
| `findDuplicates(prompts, threshold?)` | Find groups of duplicates |
| `deduplicate(prompts, threshold?)` | Remove duplicates |
| `normalizeContent(content)` | Normalize for comparison |
| `getContentFingerprint(content)` | Get fingerprint for indexing |

---

## 🏗️ Builder

Fluent DSL for creating structured text prompts.

```typescript
import { builder, fromPrompt, templates } from 'prompts.chat';

// Build a custom prompt
const prompt = builder()
  .role("Senior Developer")
  .context("You are helping review a React application")
  .task("Analyze the code for performance issues")
  .constraints([
    "Be concise",
    "Focus on critical issues",
    "Suggest fixes with code examples"
  ])
  .output("JSON with { issues: [], suggestions: [] }")
  .variable("code", { required: true, description: "Code to review" })
  .example("const x = 1;", '{ "issues": [], "suggestions": [] }')
  .section("Additional Notes", "Consider React 18 best practices")
  .build();

console.log(prompt.content);
console.log(prompt.variables);
console.log(prompt.metadata);

// Create from existing prompt
const existing = fromPrompt("You are a helpful assistant...").build();
```

### Builder Methods

| Method | Description |
|--------|-------------|
| `.role(role)` | Set AI persona (alias: `.persona()`) |
| `.context(context)` | Set background info (alias: `.background()`) |
| `.task(task)` | Set main instruction (alias: `.instruction()`) |
| `.constraints(list)` | Add multiple constraints (alias: `.rules()`) |
| `.constraint(text)` | Add single constraint |
| `.output(format)` | Set output format (alias: `.format()`) |
| `.example(input, output)` | Add input/output example |
| `.examples(list)` | Add multiple examples |
| `.variable(name, options?)` | Define a variable |
| `.section(title, content)` | Add custom section |
| `.raw(content)` | Set raw content |
| `.build()` | Build the prompt |
| `.toString()` | Get content string |

### Pre-built Templates

```typescript
import { templates } from 'prompts.chat';

// Code review template
const review = templates.codeReview({ 
  language: "TypeScript",
  focus: ["performance", "security"]
});

// Translation template
const translate = templates.translation("English", "Spanish");

// Summarization template
const summary = templates.summarize({ 
  maxLength: 100, 
  style: "bullet" 
});

// Q&A template
const qa = templates.qa("You are answering questions about React.");
```

---

## 💬 Chat Builder

Comprehensive model-agnostic builder for conversational AI prompts. Works with GPT-4, Claude, Gemini, Llama, and any chat model.

### Quick Start

```typescript
import { chat } from 'prompts.chat';

const prompt = chat()
  .role("helpful coding assistant")
  .context("Building a React application")
  .task("Explain async/await in JavaScript")
  .stepByStep()
  .detailed()
  .build();

console.log(prompt.systemPrompt);
console.log(prompt.messages);
```

### Full Example

```typescript
import { chat } from 'prompts.chat';

const prompt = chat()
  // ━━━ Persona ━━━
  .persona({
    name: "Alex",
    role: "senior software architect",
    tone: ["professional", "analytical"],
    expertise: ["system-design", "microservices", "cloud-architecture"],
    personality: ["patient", "thorough", "pragmatic"],
    background: "15 years of experience at FAANG companies",
    language: "English",
    verbosity: "detailed"
  })
  .role("expert code reviewer")                    // Override role
  .tone(["technical", "concise"])                  // Override tone(s)
  .expertise(["coding", "engineering"])            // Override expertise
  .personality(["direct", "helpful"])              // Override personality
  .background("Specialized in distributed systems")
  .speakAs("CodeReviewer")                         // Set a name
  .responseLanguage("English")                     // Response language
  
  // ━━━ Context ━━━
  .context({
    background: "Reviewing a pull request for an e-commerce platform",
    domain: "software engineering",
    audience: "mid-level developers",
    purpose: "improve code quality and maintainability",
    constraints: ["Follow team coding standards", "Consider performance"],
    assumptions: ["Team uses TypeScript", "Project uses React"],
    knowledge: ["Existing codebase uses Redux", "Team prefers functional components"]
  })
  .domain("web development")                       // Set knowledge domain
  .audience("junior developers")                   // Target audience
  .purpose("educational code review")              // Purpose of interaction
  .constraints(["Be constructive", "Explain why"]) // Add constraints
  .constraint("Focus on security issues")          // Single constraint
  .assumptions(["Code compiles successfully"])     // Set assumptions
  .knowledge(["Using React 18", "Node.js backend"]) // Known facts
  
  // ━━━ Task ━━━
  .task({
    instruction: "Review the submitted code and provide actionable feedback",
    steps: [
      "Analyze code structure and organization",
      "Check for potential bugs and edge cases",
      "Evaluate performance implications",
      "Suggest improvements with examples"
    ],
    deliverables: ["Summary of issues", "Prioritized recommendations", "Code examples"],
    criteria: ["Feedback is specific", "Examples are provided", "Tone is constructive"],
    antiPatterns: ["Vague criticism", "No examples", "Harsh language"],
    priority: "accuracy"
  })
  .instruction("Review this React component")      // Main instruction
  .steps([                                         // Override steps
    "Check hooks usage",
    "Verify prop types",
    "Review state management"
  ])
  .deliverables(["Issue list", "Fixed code"])      // Expected deliverables
  .criteria(["Clear explanations"])                // Success criteria
  .avoid(["Being overly critical", "Ignoring context"])  // Anti-patterns
  .priority("thoroughness")                        // accuracy | speed | creativity | thoroughness
  
  // ━━━ Examples (Few-Shot) ━━━
  .example(
    "const [data, setData] = useState()",
    "Consider adding a type parameter: useState<DataType>()",
    "TypeScript generics improve type safety"
  )
  .examples([
    { input: "useEffect(() => { fetch() })", output: "Add cleanup function for async operations" },
    { input: "if(data == null)", output: "Use strict equality (===) for null checks" }
  ])
  .fewShot([                                       // Alternative few-shot syntax
    { input: "var x = 1", output: "Use const or let instead of var" },
    { input: "any[]", output: "Define specific array types" }
  ])
  
  // ━━━ Output Format ━━━
  .output({
    format: { type: "markdown" },
    length: "detailed",
    style: "mixed",
    includeExamples: true,
    includeExplanation: true
  })
  .outputFormat("markdown")                        // text | json | markdown | code | table
  .json()                                          // Shortcut for JSON output
  .jsonSchema("CodeReview", {                      // JSON with schema
    type: "object",
    properties: {
      issues: { type: "array" },
      suggestions: { type: "array" }
    }
  })
  .markdown()                                      // Markdown output
  .code("typescript")                              // Code output with language
  .table()                                         // Table output
  
  // ━━━ Output Length ━━━
  .length("detailed")                              // brief | moderate | detailed | comprehensive | exhaustive
  .brief()                                         // Shortcut for brief
  .moderate()                                      // Shortcut for moderate
  .detailed()                                      // Shortcut for detailed
  .comprehensive()                                 // Shortcut for comprehensive
  .exhaustive()                                    // Shortcut for exhaustive
  
  // ━━━ Output Style ━━━
  .style("mixed")                                  // prose | bullet-points | numbered-list | table | code | mixed | qa | dialogue
  
  // ━━━ Output Includes ━━━
  .withExamples()                                  // Include examples in response
  .withExplanation()                               // Include explanations
  .withSources()                                   // Cite sources
  .withConfidence()                                // Include confidence level
  
  // ━━━ Reasoning ━━━
  .reasoning({
    style: "chain-of-thought",
    showWork: true,
    verifyAnswer: true,
    considerAlternatives: true,
    explainAssumptions: true
  })
  .reasoningStyle("step-by-step")                  // step-by-step | chain-of-thought | tree-of-thought | direct | analytical | ...
  .stepByStep()                                    // Shortcut: step-by-step + showWork
  .chainOfThought()                                // Shortcut: chain-of-thought + showWork
  .treeOfThought()                                 // Shortcut: tree-of-thought + showWork
  .firstPrinciples()                               // Shortcut: first-principles + showWork
  .devilsAdvocate()                                // Shortcut: devil-advocate + considerAlternatives
  .showWork()                                      // Show reasoning process
  .verifyAnswer()                                  // Verify before presenting
  .considerAlternatives()                          // Consider alternatives
  .explainAssumptions()                            // Explain assumptions
  
  // ━━━ Memory ━━━
  .memory({
    summary: "Previously discussed authentication patterns",
    facts: ["User prefers JWT", "API uses REST"],
    preferences: ["Concise answers", "Include code examples"],
    history: [
      { role: "user", content: "How do I handle auth?" },
      { role: "assistant", content: "I recommend JWT with refresh tokens..." }
    ]
  })
  .remember(["User is building a SaaS app"])       // Add facts to memory
  .preferences(["Show code examples"])             // User preferences
  .history([                                       // Previous messages
    { role: "user", content: "Previous question..." },
    { role: "assistant", content: "Previous answer..." }
  ])
  .summarizeHistory("Discussed React patterns")    // Summary of history
  
  // ━━━ Messages ━━━
  .system("You are a helpful assistant.")          // System message
  .user("Please review this code:", "developer")   // User message (with optional name)
  .assistant("I'll analyze the code now.")         // Assistant message
  .message("user", "Here's the code...")           // Generic message
  .messages([                                      // Multiple messages
    { role: "user", content: "First question" },
    { role: "assistant", content: "First answer" }
  ])
  .conversation([                                  // Conversation turns
    { user: "What is X?", assistant: "X is..." },
    { user: "How does it work?" }
  ])
  
  // ━━━ Custom ━━━
  .addSystemPart("Additional system instructions") // Add to system prompt
  .raw("Complete custom system prompt")            // Replace with raw content
  
  .build();

// Access outputs
console.log(prompt.messages);       // Array of ChatMessage objects
console.log(prompt.systemPrompt);   // Built system prompt string
console.log(prompt.userPrompt);     // Latest user message content
console.log(prompt.metadata);       // Structured metadata

// Export formats
const yaml = prompt.toYAML();
const json = prompt.toJSON();
const md = prompt.toMarkdown();
const system = prompt.toSystemPrompt();  // Just the system prompt
const msgs = prompt.toMessages();        // Just the messages array
```

### Types Reference

#### Message Types
```typescript
type MessageRole = 'system' | 'user' | 'assistant';

interface ChatMessage {
  role: MessageRole;
  content: string;
  name?: string;
}
```

#### Persona Types
```typescript
type PersonaTone = 
  | 'professional' | 'casual' | 'formal' | 'friendly' | 'academic'
  | 'technical' | 'creative' | 'empathetic' | 'authoritative' | 'playful'
  | 'concise' | 'detailed' | 'socratic' | 'coaching' | 'analytical'
  | 'encouraging' | 'neutral' | 'humorous' | 'serious';

type PersonaExpertise = 
  | 'general' | 'coding' | 'writing' | 'analysis' | 'research'
  | 'teaching' | 'counseling' | 'creative' | 'legal' | 'medical'
  | 'financial' | 'scientific' | 'engineering' | 'design' | 'marketing'
  | 'business' | 'philosophy' | 'history' | 'languages' | 'mathematics';
```

#### Reasoning Types
```typescript
type ReasoningStyle = 
  | 'step-by-step' | 'chain-of-thought' | 'tree-of-thought' 
  | 'direct' | 'analytical' | 'comparative' | 'deductive' | 'inductive'
  | 'first-principles' | 'analogical' | 'devil-advocate';
```

#### Output Types
```typescript
type ResponseFormatType = 'text' | 'json' | 'markdown' | 'code' | 'table';

type OutputLength = 'brief' | 'moderate' | 'detailed' | 'comprehensive' | 'exhaustive';

type OutputStyle = 'prose' | 'bullet-points' | 'numbered-list' | 'table' | 'code' | 'mixed' | 'qa' | 'dialogue';

interface JsonSchema {
  name: string;
  description?: string;
  schema: Record<string, unknown>;
}
```

### Methods Reference

#### Message Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.system()` | `system(content: string)` | Set system message |
| `.user()` | `user(content: string, name?: string)` | Add user message |
| `.assistant()` | `assistant(content: string)` | Add assistant message |
| `.message()` | `message(role, content, name?)` | Add generic message |
| `.messages()` | `messages(messages: ChatMessage[])` | Add multiple messages |
| `.conversation()` | `conversation(turns[])` | Add conversation turns |

#### Persona Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.persona()` | `persona(settings: ChatPersona \| string)` | Set full persona |
| `.role()` | `role(role: string)` | Set AI role |
| `.tone()` | `tone(tone: PersonaTone \| PersonaTone[])` | Set tone(s) |
| `.expertise()` | `expertise(areas: PersonaExpertise \| PersonaExpertise[])` | Set expertise |
| `.personality()` | `personality(traits: string[])` | Set personality traits |
| `.background()` | `background(background: string)` | Set background info |
| `.speakAs()` | `speakAs(name: string)` | Set persona name |
| `.responseLanguage()` | `responseLanguage(language: string)` | Set response language |

#### Context Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.context()` | `context(settings: ChatContext \| string)` | Set full context |
| `.domain()` | `domain(domain: string)` | Set knowledge domain |
| `.audience()` | `audience(audience: string)` | Set target audience |
| `.purpose()` | `purpose(purpose: string)` | Set purpose |
| `.constraints()` | `constraints(constraints: string[])` | Add constraints |
| `.constraint()` | `constraint(constraint: string)` | Add single constraint |
| `.assumptions()` | `assumptions(assumptions: string[])` | Set assumptions |
| `.knowledge()` | `knowledge(facts: string[])` | Set known facts |

#### Task Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.task()` | `task(instruction: string \| ChatTask)` | Set task |
| `.instruction()` | `instruction(instruction: string)` | Set main instruction |
| `.steps()` | `steps(steps: string[])` | Set task steps |
| `.deliverables()` | `deliverables(deliverables: string[])` | Set deliverables |
| `.criteria()` | `criteria(criteria: string[])` | Set success criteria |
| `.avoid()` | `avoid(antiPatterns: string[])` | Set anti-patterns |
| `.priority()` | `priority(priority)` | Set priority |

#### Example Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.example()` | `example(input, output, explanation?)` | Add single example |
| `.examples()` | `examples(examples: ChatExample[])` | Add multiple examples |
| `.fewShot()` | `fewShot(examples[])` | Add few-shot examples |

#### Output Format Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.output()` | `output(settings: ChatOutput)` | Set full output settings |
| `.outputFormat()` | `outputFormat(format: ResponseFormatType)` | Set format type |
| `.json()` | `json(schema?: JsonSchema)` | JSON output |
| `.jsonSchema()` | `jsonSchema(name, schema, description?)` | JSON with schema |
| `.markdown()` | `markdown()` | Markdown output |
| `.code()` | `code(language?: string)` | Code output |
| `.table()` | `table()` | Table output |

#### Output Length Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.length()` | `length(length: OutputLength)` | Set length |
| `.brief()` | `brief()` | Brief output |
| `.moderate()` | `moderate()` | Moderate output |
| `.detailed()` | `detailed()` | Detailed output |
| `.comprehensive()` | `comprehensive()` | Comprehensive output |
| `.exhaustive()` | `exhaustive()` | Exhaustive output |

#### Output Style Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.style()` | `style(style: OutputStyle)` | Set output style |
| `.withExamples()` | `withExamples()` | Include examples |
| `.withExplanation()` | `withExplanation()` | Include explanations |
| `.withSources()` | `withSources()` | Cite sources |
| `.withConfidence()` | `withConfidence()` | Include confidence |

#### Reasoning Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.reasoning()` | `reasoning(settings: ChatReasoning)` | Set full reasoning |
| `.reasoningStyle()` | `reasoningStyle(style: ReasoningStyle)` | Set style |
| `.stepByStep()` | `stepByStep()` | Step-by-step reasoning |
| `.chainOfThought()` | `chainOfThought()` | Chain-of-thought |
| `.treeOfThought()` | `treeOfThought()` | Tree-of-thought |
| `.firstPrinciples()` | `firstPrinciples()` | First principles |
| `.devilsAdvocate()` | `devilsAdvocate()` | Devil's advocate |
| `.showWork()` | `showWork(show?)` | Show reasoning |
| `.verifyAnswer()` | `verifyAnswer(verify?)` | Verify answer |
| `.considerAlternatives()` | `considerAlternatives(consider?)` | Consider alternatives |
| `.explainAssumptions()` | `explainAssumptions(explain?)` | Explain assumptions |

#### Memory Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.memory()` | `memory(memory: ChatMemory)` | Set full memory |
| `.remember()` | `remember(facts: string[])` | Add facts |
| `.preferences()` | `preferences(prefs: string[])` | Set preferences |
| `.history()` | `history(messages: ChatMessage[])` | Set history |
| `.summarizeHistory()` | `summarizeHistory(summary: string)` | Set summary |

#### Custom & Output Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.addSystemPart()` | `addSystemPart(part: string)` | Add system part |
| `.raw()` | `raw(content: string)` | Set raw content |
| `.build()` | `build(): BuiltChatPrompt` | Build the prompt |
| `.toString()` | `toString(): string` | Get system prompt |
| `.toSystemPrompt()` | `toSystemPrompt(): string` | Get system prompt |
| `.toMessages()` | `toMessages(): ChatMessage[]` | Get messages |
| `.toJSON()` | `toJSON(): string` | Export as JSON |
| `.toYAML()` | `toYAML(): string` | Export as YAML |
| `.toMarkdown()` | `toMarkdown(): string` | Export as Markdown |

### Output Structure

```typescript
interface BuiltChatPrompt {
  messages: ChatMessage[];    // Full message array including system
  systemPrompt: string;       // Built system prompt
  userPrompt?: string;        // Latest user message content
  metadata: {
    persona?: ChatPersona;
    context?: ChatContext;
    task?: ChatTask;
    output?: ChatOutput;
    reasoning?: ChatReasoning;
    examples?: ChatExample[];
  };
}
```

### Presets

Pre-configured builders for common use cases:

```typescript
import { chatPresets } from 'prompts.chat';

// Expert coder
const coder = chatPresets.coder("TypeScript")
  .task("Review this function")
  .user("function add(a, b) { return a + b }");

// Creative/Professional/Academic writer
const writer = chatPresets.writer("creative")
  .task("Write a short story");

// Patient tutor with subject expertise
const tutor = chatPresets.tutor("mathematics")
  .user("Explain derivatives");

// Data analyst with chain-of-thought
const analyst = chatPresets.analyst()
  .user("Analyze these sales figures");

// Socratic philosopher (asks questions)
const socratic = chatPresets.socratic()
  .user("What is justice?");

// Constructive critic
const critic = chatPresets.critic()
  .user("Review my business plan");

// Creative brainstormer
const brainstormer = chatPresets.brainstormer()
  .user("Ideas for a mobile app");

// JSON-only responder with schema
const jsonBot = chatPresets.jsonResponder("Response", {
  type: "object",
  properties: {
    answer: { type: "string" },
    confidence: { type: "number" }
  }
});

// Summarizer with length control
const summarizer = chatPresets.summarizer("brief")
  .user("Summarize this article...");

// Translator to target language
const translator = chatPresets.translator("Japanese")
  .user("Hello, how are you?");
```

### Usage Examples

#### Code Review Assistant
```typescript
const codeReview = chat()
  .role("senior code reviewer")
  .expertise("coding")
  .tone(["professional", "constructive"])
  .context("TypeScript React project")
  .task("Review code for bugs, performance, and best practices")
  .steps([
    "Identify potential bugs",
    "Check for performance issues",
    "Suggest improvements"
  ])
  .criteria(["Be specific", "Provide examples"])
  .avoid(["Harsh criticism", "Vague feedback"])
  .markdown()
  .detailed()
  .withExamples()
  .user("Please review this component...")
  .build();
```

#### Research Assistant
```typescript
const research = chat()
  .role("research assistant")
  .expertise(["research", "analysis"])
  .tone("academic")
  .context({
    domain: "machine learning",
    audience: "PhD students",
    purpose: "literature review"
  })
  .task("Analyze and summarize research papers")
  .chainOfThought()
  .withSources()
  .detailed()
  .markdown()
  .build();
```

#### JSON API Response
```typescript
const apiHelper = chat()
  .role("API response generator")
  .tone("concise")
  .jsonSchema("UserData", {
    type: "object",
    properties: {
      users: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "number" },
            name: { type: "string" },
            email: { type: "string" }
          }
        }
      },
      total: { type: "number" }
    }
  })
  .avoid(["Include markdown", "Add explanations", "Use code fences"])
  .user("Generate 3 sample users")
  .build();
```

#### Multi-Turn Conversation
```typescript
const conversation = chat()
  .role("helpful assistant")
  .tone("friendly")
  .memory({
    summary: "User is learning Python",
    facts: ["User is a beginner", "Prefers practical examples"],
    preferences: ["Step-by-step explanations"]
  })
  .conversation([
    { user: "What is a variable?", assistant: "A variable is a container for storing data..." },
    { user: "How do I create one?" }
  ])
  .stepByStep()
  .withExamples()
  .build();
```

---

## 🎨 Image Builder

Comprehensive builder for image generation prompts. Works with Midjourney, DALL-E, Stable Diffusion, Flux, and other image AI platforms.

### Quick Start

```typescript
import { image } from 'prompts.chat';

const prompt = image()
  .subject("a lone samurai")
  .environment("bamboo forest at dawn")
  .camera({ angle: "low-angle", shot: "wide", lens: "35mm" })
  .lighting({ type: "rim", time: "golden-hour" })
  .medium("cinematic")
  .build();

console.log(prompt.prompt);
```

### Full Example

```typescript
import { image } from 'prompts.chat';

const prompt = image()
  // ━━━ Subject ━━━
  .subject({
    main: "a cyberpunk samurai warrior",
    expression: "determined and fierce",
    pose: "dynamic battle stance",
    action: "deflecting bullets with katana",
    clothing: "neon-lit armor with glowing circuits",
    accessories: ["holographic visor", "cyber-enhanced arm"],
    age: "30s",
    gender: "female"
  })
  .subjectDetails(["intricate tattoos", "flowing hair"])   // Additional details
  .expression("intense focus")                             // Override expression
  .pose("mid-swing attack")                                // Override pose
  .action("slicing through rain droplets")                 // Override action
  .clothing("black nano-fiber suit")                       // Override clothing
  .accessories(["glowing katana", "shoulder armor"])       // Override accessories
  .subjectCount("single")                                  // single | couple | group | crowd | number
  
  // ━━━ Environment ━━━
  .environment({
    setting: "rain-soaked Tokyo alley",
    location: "Shibuya district",
    atmosphere: "electric and mysterious",
    props: ["neon signs", "steam vents", "holographic ads"],
    season: "winter"
  })
  .location("Neo-Tokyo, 2087")                             // Specific location
  .props(["flying cars overhead", "robot vendors"])        // Scene props
  .atmosphere("dense fog with neon glow")                  // Atmospheric description
  .season("autumn")                                        // spring | summer | autumn | winter
  
  // ━━━ Camera: Framing ━━━
  .shot("medium")                                          // extreme-close-up | close-up | medium | wide | ...
  .angle("low-angle")                                      // eye-level | low-angle | high-angle | dutch-angle | ...
  .lens("35mm")                                            // wide-angle | 35mm | 50mm | 85mm | telephoto | ...
  .focalLength("35mm")                                     // Specific focal length
  
  // ━━━ Camera: Focus & Depth ━━━
  .focus("shallow")                                        // shallow | deep | soft-focus | tilt-shift | bokeh-heavy | ...
  .aperture("f/1.4")                                       // Aperture setting
  .bokeh("smooth")                                         // smooth | creamy | swirly | soap-bubble | oval-anamorphic | ...
  
  // ━━━ Camera: Equipment ━━━
  .cameraBrand("sony")                                     // sony | canon | nikon | leica | hasselblad | arri | ...
  .cameraModel("sony-a7riv")                               // Specific camera model
  .sensor("full-frame")                                    // full-frame | aps-c | medium-format | ...
  .lensBrand("zeiss")                                      // zeiss | leica | sigma | canon | ...
  .lensModel("zeiss-otus-55")                              // Specific lens model
  
  // ━━━ Camera: Film & Filters ━━━
  .filmStock("kodak-portra-400")                           // Kodak, Fujifilm, CineStill, Ilford stocks
  .filmFormat("35mm")                                      // 35mm | 120-medium-format | instant-film | ...
  .filter("black-pro-mist")                                // nd | polarizer | black-pro-mist | diffusion | ...
  
  // ━━━ Camera: Exposure ━━━
  .iso(800)                                                // ISO sensitivity
  .shutterSpeed("1/250")                                   // Shutter speed
  .whiteBalance("tungsten")                                // daylight | cloudy | tungsten | fluorescent | ...
  .colorProfile("S-Log3")                                  // Color profile
  
  // ━━━ Lighting ━━━
  .lighting({
    type: ["rim", "practical"],
    time: "night",
    direction: "back",
    intensity: "dramatic",
    color: "neon pink and blue",
    sources: ["neon signs", "car headlights"]
  })
  .lightingType(["rim", "backlit"])                        // natural | studio | rim | rembrandt | butterfly | ...
  .timeOfDay("night")                                      // dawn | golden-hour | midday | blue-hour | night | ...
  .weather("rainy")                                        // sunny | cloudy | foggy | rainy | stormy | snowy | ...
  .lightDirection("back")                                  // front | side | back | top | three-quarter
  .lightIntensity("dramatic")                              // soft | medium | hard | dramatic
  
  // ━━━ Composition ━━━
  .composition({
    ruleOfThirds: true,
    symmetry: "none",
    foreground: "rain droplets",
    midground: "samurai figure",
    background: "towering neon buildings"
  })
  .ruleOfThirds()                                          // Enable rule of thirds
  .goldenRatio()                                           // Enable golden ratio
  .symmetry("vertical")                                    // none | horizontal | vertical | radial
  .foreground("splashing water droplets")                  // Foreground element
  .midground("central figure in action")                   // Midground element
  .background("city skyline with flying vehicles")         // Background element
  
  // ━━━ Style ━━━
  .style({
    medium: ["cinematic", "cyberpunk"],
    artist: ["Syd Mead", "Simon Stålenhag"],
    era: "futuristic",
    influence: ["Blade Runner", "Ghost in the Shell"],
    quality: ["highly detailed", "award-winning"]
  })
  .medium("cinematic")                                     // photorealistic | cinematic | anime | oil-painting | ...
  .artist(["Syd Mead", "Masamune Shirow"])                 // Reference artist(s)
  .influence(["Akira", "The Matrix"])                      // Style influences
  
  // ━━━ Color ━━━
  .color({
    palette: "neon",
    primary: ["cyan", "magenta"],
    accent: ["yellow", "white"],
    grade: "teal and orange",
    temperature: "cool",
    saturation: "vibrant",
    contrast: "high"
  })
  .palette("neon")                                         // warm | cool | vibrant | neon | monochrome | ...
  .primaryColors(["electric blue", "hot pink"])            // Primary color scheme
  .accentColors(["neon yellow", "white"])                  // Accent colors
  .colorGrade("cyberpunk teal and orange")                 // Color grading style
  
  // ━━━ Technical ━━━
  .technical({
    aspectRatio: "16:9",
    resolution: "8K",
    quality: "masterpiece",
    detail: "extreme",
    noise: "filmic",
    sharpness: "crisp"
  })
  .aspectRatio("16:9")                                     // 1:1 | 4:3 | 3:2 | 16:9 | 21:9 | 9:16 | ...
  .resolution("8K")                                        // Resolution string
  .quality("masterpiece")                                  // draft | standard | high | ultra | masterpiece
  
  // ━━━ Mood & Misc ━━━
  .mood(["dramatic", "mysterious", "epic"])                // serene | dramatic | tense | epic | intimate | ...
  .negative(["blurry", "low quality", "watermark"])        // Negative prompt items
  .custom("volumetric lighting through rain")              // Custom prompt text
  .custom("lens flare from neon signs")
  
  .build();

// Access outputs
console.log(prompt.prompt);       // Full formatted prompt with --no and --ar flags
console.log(prompt.structure);    // Full structured data object

// Export formats
const yaml = prompt.toYAML();
const json = prompt.toJSON();
const md = prompt.toMarkdown();
```

### Types Reference

#### Camera Types
```typescript
type ShotType = 'extreme-close-up' | 'close-up' | 'medium-close-up' | 'medium' 
  | 'medium-wide' | 'wide' | 'extreme-wide' | 'establishing' | 'full-body' | 'portrait' | 'headshot';

type CameraAngle = 'eye-level' | 'low-angle' | 'high-angle' | 'dutch-angle' | 'birds-eye' 
  | 'worms-eye' | 'over-the-shoulder' | 'point-of-view' | 'aerial' | 'drone'
  | 'canted' | 'oblique' | 'hip-level' | 'knee-level' | 'ground-level';

type LensType = 'wide-angle' | 'ultra-wide' | 'standard' | 'telephoto' | 'macro' | 'fisheye'
  | '14mm' | '24mm' | '35mm' | '50mm' | '85mm' | '100mm' | '135mm' | '200mm' | '400mm'
  | 'tilt-shift' | 'anamorphic' | 'spherical' | 'prime' | 'zoom';

type FocusType = 'shallow' | 'deep' | 'soft-focus' | 'tilt-shift' | 'rack-focus' | 'split-diopter'
  | 'zone-focus' | 'hyperfocal' | 'selective' | 'bokeh-heavy' | 'tack-sharp';

type BokehStyle = 'smooth' | 'creamy' | 'swirly' | 'busy' | 'soap-bubble' | 'cat-eye' | 'oval-anamorphic';
```

#### Equipment Types
```typescript
type CameraBrand = 'sony' | 'canon' | 'nikon' | 'fujifilm' | 'leica' | 'hasselblad' | 'phase-one'
  | 'panasonic' | 'olympus' | 'pentax' | 'red' | 'arri' | 'blackmagic' | 'panavision';

type CameraModel = 'sony-a7iv' | 'sony-a7riv' | 'sony-a1' | 'canon-r5' | 'canon-r6' 
  | 'nikon-z9' | 'nikon-z8' | 'leica-m11' | 'leica-q3' | 'hasselblad-x2d'
  | 'fujifilm-x-t5' | 'fujifilm-gfx100s' | 'arri-alexa-35' | 'red-v-raptor' | ...;

type SensorFormat = 'full-frame' | 'aps-c' | 'micro-four-thirds' | 'medium-format' | 'large-format'
  | 'super-35' | 'vista-vision' | 'imax' | '65mm' | '35mm-film' | '16mm-film' | '8mm-film';

type LensBrand = 'zeiss' | 'leica' | 'canon' | 'nikon' | 'sony' | 'sigma' | 'tamron' | 'voigtlander'
  | 'fujifilm' | 'samyang' | 'rokinon' | 'tokina' | 'cooke' | 'arri' | 'panavision';

type LensModel = 'zeiss-otus-55' | 'zeiss-batis-85' | 'leica-summilux-50' | 'leica-noctilux-50'
  | 'canon-rf-50-1.2' | 'sony-gm-85-1.4' | 'sigma-art-35' | 'helios-44-2' | ...;
```

#### Film & Filter Types
```typescript
type FilmStock = 
  // Kodak Color
  | 'kodak-portra-160' | 'kodak-portra-400' | 'kodak-portra-800' | 'kodak-ektar-100' | 'kodak-gold-200'
  // Kodak B&W
  | 'kodak-tri-x-400' | 'kodak-tmax-100' | 'kodak-tmax-400'
  // Kodak Cinema
  | 'kodak-vision3-50d' | 'kodak-vision3-200t' | 'kodak-vision3-500t'
  // Fujifilm
  | 'fujifilm-pro-400h' | 'fujifilm-velvia-50' | 'fujifilm-velvia-100' | 'fujifilm-provia-100f'
  // Ilford
  | 'ilford-hp5-plus' | 'ilford-delta-400' | 'ilford-fp4-plus'
  // CineStill
  | 'cinestill-50d' | 'cinestill-800t'
  // Instant
  | 'polaroid-sx-70' | 'polaroid-600' | 'instax-mini' | ...;

type FilmFormat = '35mm' | '120-medium-format' | '4x5-large-format' | '8x10-large-format'
  | '110-film' | 'instant-film' | 'super-8' | '16mm' | '65mm-imax';

type FilterType = 'uv' | 'polarizer' | 'nd' | 'nd-graduated' | 'black-pro-mist' | 'white-pro-mist'
  | 'glimmer-glass' | 'classic-soft' | 'streak' | 'starburst' | 'diffusion'
  | 'infrared' | 'color-gel' | 'warming' | 'cooling' | 'vintage-look';
```

#### Lighting Types
```typescript
type LightingType = 'natural' | 'studio' | 'dramatic' | 'soft' | 'hard' | 'diffused'
  | 'key' | 'fill' | 'rim' | 'backlit' | 'silhouette' | 'rembrandt'
  | 'split' | 'butterfly' | 'loop' | 'broad' | 'short' | 'chiaroscuro'
  | 'high-key' | 'low-key' | 'three-point' | 'practical' | 'motivated';

type TimeOfDay = 'dawn' | 'sunrise' | 'golden-hour' | 'morning' | 'midday' | 'afternoon'
  | 'blue-hour' | 'sunset' | 'dusk' | 'twilight' | 'night' | 'midnight';

type WeatherLighting = 'sunny' | 'cloudy' | 'overcast' | 'foggy' | 'misty' 
  | 'rainy' | 'stormy' | 'snowy' | 'hazy';
```

#### Style & Color Types
```typescript
type ArtStyle = 'photorealistic' | 'hyperrealistic' | 'cinematic' | 'documentary'
  | 'editorial' | 'fashion' | 'portrait' | 'landscape' | 'street' | 'fine-art'
  | 'conceptual' | 'surreal' | 'abstract' | 'minimalist' | 'maximalist'
  | 'vintage' | 'retro' | 'noir' | 'gothic' | 'romantic'
  | 'impressionist' | 'expressionist' | 'pop-art' | 'art-nouveau' | 'art-deco'
  | 'cyberpunk' | 'steampunk' | 'fantasy' | 'sci-fi' | 'anime' | 'manga'
  | 'comic-book' | 'illustration' | 'digital-art' | 'oil-painting' | 'watercolor'
  | 'sketch' | 'pencil-drawing' | 'charcoal' | 'pastel' | '3d-render';

type ColorPalette = 'warm' | 'cool' | 'neutral' | 'vibrant' | 'muted' | 'pastel' | 'neon'
  | 'monochrome' | 'sepia' | 'desaturated' | 'high-contrast' | 'low-contrast'
  | 'earthy' | 'oceanic' | 'forest' | 'sunset' | 'midnight' | 'golden';

type Mood = 'serene' | 'peaceful' | 'melancholic' | 'dramatic' | 'tense' | 'mysterious'
  | 'romantic' | 'nostalgic' | 'hopeful' | 'joyful' | 'energetic' | 'chaotic'
  | 'ethereal' | 'dark' | 'light' | 'whimsical' | 'eerie' | 'epic' | 'intimate';

type AspectRatio = '1:1' | '4:3' | '3:2' | '16:9' | '21:9' | '9:16' | '2:3' | '4:5' | '5:4';
```

### Methods Reference

#### Subject Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.subject()` | `subject(main: string \| ImageSubject)` | Set main subject |
| `.subjectDetails()` | `subjectDetails(details: string[])` | Add subject details |
| `.expression()` | `expression(expression: string)` | Set facial expression |
| `.pose()` | `pose(pose: string)` | Set body pose |
| `.action()` | `action(action: string)` | Set action/activity |
| `.clothing()` | `clothing(clothing: string)` | Set clothing |
| `.accessories()` | `accessories(accessories: string[])` | Set accessories |
| `.subjectCount()` | `subjectCount(count)` | Set subject count |

#### Environment Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.environment()` | `environment(setting: string \| ImageEnvironment)` | Set environment |
| `.location()` | `location(location: string)` | Set specific location |
| `.props()` | `props(props: string[])` | Set scene props |
| `.atmosphere()` | `atmosphere(atmosphere: string)` | Set atmosphere |
| `.season()` | `season(season)` | Set season |

#### Camera Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.camera()` | `camera(settings: ImageCamera)` | Set all camera settings |
| `.shot()` | `shot(shot: ShotType)` | Set shot type |
| `.angle()` | `angle(angle: CameraAngle)` | Set camera angle |
| `.lens()` | `lens(lens: LensType)` | Set lens type |
| `.focus()` | `focus(focus: FocusType)` | Set focus type |
| `.aperture()` | `aperture(aperture: string)` | Set aperture |
| `.bokeh()` | `bokeh(style: BokehStyle)` | Set bokeh style |
| `.cameraBrand()` | `cameraBrand(brand: CameraBrand)` | Set camera brand |
| `.cameraModel()` | `cameraModel(model: CameraModel)` | Set camera model |
| `.sensor()` | `sensor(sensor: SensorFormat)` | Set sensor format |
| `.lensBrand()` | `lensBrand(brand: LensBrand)` | Set lens brand |
| `.lensModel()` | `lensModel(model: LensModel)` | Set lens model |
| `.focalLength()` | `focalLength(length: string)` | Set focal length |
| `.filmStock()` | `filmStock(stock: FilmStock)` | Set film stock |
| `.filmFormat()` | `filmFormat(format: FilmFormat)` | Set film format |
| `.filter()` | `filter(filter: FilterType)` | Set lens filter |
| `.iso()` | `iso(iso: number)` | Set ISO |
| `.shutterSpeed()` | `shutterSpeed(speed: string)` | Set shutter speed |
| `.whiteBalance()` | `whiteBalance(wb)` | Set white balance |
| `.colorProfile()` | `colorProfile(profile: string)` | Set color profile |

#### Lighting Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.lighting()` | `lighting(settings: ImageLighting)` | Set all lighting |
| `.lightingType()` | `lightingType(type)` | Set lighting type(s) |
| `.timeOfDay()` | `timeOfDay(time: TimeOfDay)` | Set time of day |
| `.weather()` | `weather(weather: WeatherLighting)` | Set weather |
| `.lightDirection()` | `lightDirection(direction)` | Set light direction |
| `.lightIntensity()` | `lightIntensity(intensity)` | Set light intensity |

#### Composition Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.composition()` | `composition(settings: ImageComposition)` | Set all composition |
| `.ruleOfThirds()` | `ruleOfThirds()` | Enable rule of thirds |
| `.goldenRatio()` | `goldenRatio()` | Enable golden ratio |
| `.symmetry()` | `symmetry(type)` | Set symmetry type |
| `.foreground()` | `foreground(fg: string)` | Set foreground |
| `.midground()` | `midground(mg: string)` | Set midground |
| `.background()` | `background(bg: string)` | Set background |

#### Style Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.style()` | `style(settings: ImageStyle)` | Set all style settings |
| `.medium()` | `medium(medium: ArtStyle)` | Set art style/medium |
| `.artist()` | `artist(artist: string \| string[])` | Set reference artist(s) |
| `.influence()` | `influence(influences: string[])` | Set style influences |

#### Color Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.color()` | `color(settings: ImageColor)` | Set all color settings |
| `.palette()` | `palette(palette: ColorPalette)` | Set color palette |
| `.primaryColors()` | `primaryColors(colors: string[])` | Set primary colors |
| `.accentColors()` | `accentColors(colors: string[])` | Set accent colors |
| `.colorGrade()` | `colorGrade(grade: string)` | Set color grade |

#### Technical & Output Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.technical()` | `technical(settings: ImageTechnical)` | Set all technical |
| `.aspectRatio()` | `aspectRatio(ratio: AspectRatio)` | Set aspect ratio |
| `.resolution()` | `resolution(resolution: string)` | Set resolution |
| `.quality()` | `quality(quality)` | Set quality level |
| `.mood()` | `mood(mood: Mood \| Mood[])` | Set mood(s) |
| `.negative()` | `negative(items: string[])` | Add negative prompts |
| `.custom()` | `custom(text: string)` | Add custom text |
| `.build()` | `build(): BuiltImagePrompt` | Build the prompt |
| `.toString()` | `toString(): string` | Get prompt string |
| `.toJSON()` | `toJSON(): string` | Export as JSON |
| `.toYAML()` | `toYAML(): string` | Export as YAML |
| `.toMarkdown()` | `toMarkdown(): string` | Export as Markdown |

### Output Structure

```typescript
interface BuiltImagePrompt {
  prompt: string;           // Full formatted prompt with --no and --ar flags
  structure: {
    subject?: ImageSubject;
    camera?: ImageCamera;
    lighting?: ImageLighting;
    composition?: ImageComposition;
    style?: ImageStyle;
    color?: ImageColor;
    environment?: ImageEnvironment;
    technical?: ImageTechnical;
    mood?: Mood | Mood[];
    negative?: string[];
  };
}
```

### Usage Examples

#### Portrait Photography
```typescript
const portrait = image()
  .subject({
    main: "elderly fisherman",
    expression: "weathered but kind smile",
    age: "70s",
    clothing: "worn yellow raincoat"
  })
  .environment("misty harbor at dawn")
  .shot("close-up")
  .angle("eye-level")
  .lens("85mm")
  .focus("shallow")
  .aperture("f/1.8")
  .lightingType("natural")
  .timeOfDay("golden-hour")
  .medium("portrait")
  .filmStock("kodak-portra-400")
  .mood("nostalgic")
  .quality("masterpiece")
  .build();
```

#### Fantasy Illustration
```typescript
const fantasy = image()
  .subject({
    main: "elven queen",
    expression: "regal and mysterious",
    pose: "seated on crystal throne",
    clothing: "flowing silver gown with starlight patterns",
    accessories: ["crown of moonstone", "ancient scepter"]
  })
  .environment({
    setting: "ethereal forest palace",
    atmosphere: "magical mist and floating lights",
    props: ["glowing flowers", "ancient trees"]
  })
  .medium(["fantasy", "illustration"])
  .artist(["Alan Lee", "Brian Froud"])
  .palette("cool")
  .primaryColors(["silver", "deep blue", "violet"])
  .lightingType("soft")
  .mood(["ethereal", "mysterious"])
  .aspectRatio("2:3")
  .quality("ultra")
  .negative(["modern elements", "technology"])
  .build();
```

#### Product Photography
```typescript
const product = image()
  .subject("luxury mechanical watch")
  .subjectDetails(["intricate movement visible", "sapphire crystal"])
  .environment("minimalist studio setup")
  .props(["black velvet", "subtle reflections"])
  .shot("extreme-close-up")
  .lens("macro")
  .focus("tack-sharp")
  .aperture("f/8")
  .lightingType(["studio", "rim"])
  .lightDirection("side")
  .lightIntensity("soft")
  .medium("commercial")
  .palette("monochrome")
  .colorGrade("high contrast, deep blacks")
  .aspectRatio("1:1")
  .resolution("8K")
  .quality("masterpiece")
  .build();
```

#### Cinematic Landscape
```typescript
const landscape = image()
  .environment({
    setting: "volcanic Iceland highlands",
    location: "Landmannalaugar",
    terrain: "colorful rhyolite mountains",
    atmosphere: "dramatic storm clouds breaking"
  })
  .season("summer")
  .shot("extreme-wide")
  .angle("aerial")
  .lens("wide-angle")
  .cameraBrand("hasselblad")
  .cameraModel("hasselblad-x2d")
  .sensor("medium-format")
  .timeOfDay("golden-hour")
  .weather("stormy")
  .lightingType("dramatic")
  .medium("landscape")
  .palette(["earthy", "vibrant"])
  .primaryColors(["rust red", "moss green", "volcanic black"])
  .mood(["epic", "dramatic"])
  .aspectRatio("21:9")
  .quality("ultra")
  .build();
```

---

## 🎬 Video Builder

Comprehensive builder for video generation prompts. Works with Sora, Runway, Pika, Kling, and other video AI platforms.

### Quick Start

```typescript
import { video } from 'prompts.chat';

const prompt = video()
  .scene("A samurai walks through a bamboo forest")
  .camera({ movement: "tracking", angle: "low-angle" })
  .lighting({ time: "golden-hour", type: "natural" })
  .duration(5)
  .build();

console.log(prompt.prompt);
```

### Full Example

```typescript
import { video } from 'prompts.chat';

const prompt = video()
  // ━━━ Scene ━━━
  .scene({
    description: "A lone astronaut walks across the Martian surface",
    setting: "Olympus Mons base camp",
    atmosphere: "dusty red landscape, thin atmosphere"
  })
  .setting("Mars, near the base camp")     // Additional location context
  .timeOfDay("golden-hour")                // dawn | sunrise | golden-hour | midday | blue-hour | night | ...
  .weather("foggy")                        // sunny | cloudy | overcast | foggy | rainy | stormy | snowy | ...
  
  // ━━━ Subject ━━━
  .subject({
    main: "astronaut",
    appearance: "NASA spacesuit with reflective gold visor",
    clothing: "white EVA suit with mission patches",
    age: "30s",
    gender: "female"
  })
  .appearance("determined expression")     // Additional appearance details
  .clothing("dusty, worn spacesuit")       // Override/add clothing
  
  // ━━━ Camera: Framing ━━━
  .shot("wide")                            // extreme-close-up | close-up | medium | wide | establishing | ...
  .angle("low-angle")                      // eye-level | low-angle | high-angle | dutch-angle | birds-eye | ...
  .lens("anamorphic")                      // wide-angle | 35mm | 50mm | 85mm | telephoto | anamorphic | ...
  .focalLength("40mm")                     // Specific focal length
  .anamorphic("2x")                        // Enable anamorphic with ratio
  .aperture("f/2.8")                       // Aperture setting
  
  // ━━━ Camera: Movement ━━━
  .movement("tracking")                    // static | pan | tilt | dolly | tracking | crane | steadicam | ...
  .cameraSpeed("slow")                     // slow | medium | fast
  .movementDirection("forward")            // left | right | forward | backward | up | down | arc-left | arc-right
  .platform("steadicam")                   // handheld | steadicam | tripod | drone | crane | gimbal | dolly | ...
  .rig("slider")                           // tripod | gimbal | steadicam | crane | dolly | slider | ...
  .gimbal("dji-ronin-4d")                  // Specific gimbal model
  
  // ━━━ Camera: Equipment ━━━
  .cameraBrand("arri")                     // arri | red | sony | canon | blackmagic | panavision | ...
  .cameraModel("arri-alexa-65")            // Specific camera model
  .sensor("65mm")                          // full-frame | super-35 | 65mm | imax | ...
  .lensBrand("cooke")                      // zeiss | cooke | arri | panavision | ...
  .lensModel("cooke-anamorphic")           // Specific lens model
  
  // ━━━ Camera: Technical ━━━
  .frameRate(24)                           // 24 | 25 | 30 | 48 | 60 | 120 | 240
  .slowMotion()                            // Enable slow motion
  .shutterAngle(180)                       // Shutter angle in degrees
  .filter("black-pro-mist")                // nd | polarizer | black-pro-mist | diffusion | ...
  .filmStock("kodak-vision3-500t")         // Kodak, Fujifilm, CineStill film stocks
  .filmGrain("subtle")                     // none | subtle | moderate | heavy
  .halation()                              // Enable film halation effect
  
  // ━━━ Lighting ━━━
  .lighting({
    type: "natural",
    time: "golden-hour",
    direction: "back",
    intensity: "soft"
  })
  .lightingType(["natural", "rim"])        // natural | studio | dramatic | rim | rembrandt | ...
  
  // ━━━ Actions ━━━
  .action("walks slowly toward camera")                    // Add action beat
  .action("stops and looks at horizon", { timing: "middle" })
  .action("raises hand to shield eyes", { timing: "end" })
  .actions(["turns around", "begins walking back"])        // Add multiple actions
  
  // ━━━ Motion ━━━
  .motion({
    subject: "astronaut",
    type: "walk",
    direction: "forward",
    speed: "slow"
  })
  .motionBeats(["step", "pause", "step", "turn"])          // Detailed motion beats
  
  // ━━━ Style ━━━
  .style({
    format: "cinematic",
    era: "2020s",
    look: "cinematic"
  })
  .look("cinematic")                       // photorealistic | cinematic | documentary | sci-fi | noir | ...
  .era("futuristic")                       // 1970s | 1980s | modern | futuristic | ...
  .format("widescreen epic")               // Format description
  .styleFilmStock("Kodak Vision3 500T")    // Style reference film stock
  .reference(["Interstellar", "The Martian", "Gravity"])   // Reference films/directors
  
  // ━━━ Color ━━━
  .color({
    palette: "warm",
    temperature: "warm",
    grade: "orange and teal"
  })
  .palette("warm")                         // warm | cool | neutral | vibrant | neon | monochrome | ...
  .colorAnchors(["mars red", "suit white", "visor gold"])  // Key colors
  .colorGrade("orange and teal")           // Color grading style
  
  // ━━━ Audio ━━━
  .audio({
    ambient: "wind howling",
    music: "epic orchestral, building tension",
    dialogue: "breathing sounds in helmet"
  })
  .dialogue("Houston, I've arrived at the site")           // Character dialogue
  .ambient("martian wind, distant rumbling")               // Ambient sounds
  .diegetic(["footsteps on gravel", "suit servos"])        // In-world sounds
  .soundEffects(["radio static", "helmet HUD beeps"])      // Sound effects
  .music("Hans Zimmer style, building brass")              // Music description
  
  // ━━━ Technical ━━━
  .technical({
    duration: 10,
    resolution: "4K",
    fps: 24,
    aspectRatio: "21:9"
  })
  .duration(10)                            // Duration in seconds
  .resolution("4K")                        // 480p | 720p | 1080p | 4K
  .fps(24)                                 // 24 | 30 | 60
  .aspectRatio("21:9")                     // 16:9 | 9:16 | 1:1 | 4:3 | 21:9
  
  // ━━━ Mood & Pacing ━━━
  .mood(["epic", "mysterious"])            // serene | dramatic | tense | epic | intimate | ...
  .pacing("slow")                          // slow | medium | fast | variable | building | contemplative
  .transition("fade")                      // cut | fade | dissolve | wipe | morph | match-cut | ...
  .transitions(["fade", "dissolve"])       // Multiple transitions
  
  // ━━━ Shot List ━━━
  .addShot({
    name: "Opening wide",
    camera: { shot: "extreme-wide", movement: "static" },
    action: "Establish the Martian landscape",
    purpose: "Set the scene"
  })
  .shotList([
    { camera: { shot: "medium", movement: "tracking" }, action: "Follow astronaut" },
    { camera: { shot: "close-up", angle: "low-angle" }, action: "Hero shot" }
  ])
  
  // ━━━ Custom ━━━
  .custom("Lens flare as sun peeks over horizon")
  .custom("Dust particles visible in backlight")
  
  .build();

// Access outputs
console.log(prompt.prompt);       // Full formatted prompt
console.log(prompt.structure);    // Full structured data object

// Export formats
const yaml = prompt.toYAML();
const json = prompt.toJSON();
const md = prompt.toMarkdown();
```

### Types Reference

#### Camera Types
```typescript
type ShotType = 'extreme-close-up' | 'close-up' | 'medium-close-up' | 'medium' 
  | 'medium-wide' | 'wide' | 'extreme-wide' | 'establishing' | 'full-body' | 'portrait' | 'headshot';

type CameraAngle = 'eye-level' | 'low-angle' | 'high-angle' | 'dutch-angle' | 'birds-eye' 
  | 'worms-eye' | 'over-the-shoulder' | 'point-of-view' | 'aerial' | 'drone'
  | 'canted' | 'oblique' | 'hip-level' | 'knee-level' | 'ground-level';

type CameraMovement = 'static' | 'pan' | 'tilt' | 'dolly' | 'truck' | 'pedestal' | 'zoom' 
  | 'handheld' | 'steadicam' | 'crane' | 'drone' | 'tracking' | 'arc' | 'whip-pan'
  | 'roll' | 'boom' | 'jib' | 'cable-cam' | 'motion-control' | 'snorricam'
  | 'dutch-roll' | 'vertigo-effect' | 'crash-zoom' | 'slow-push' | 'slow-pull';

type LensType = 'wide-angle' | 'ultra-wide' | 'standard' | 'telephoto' | 'macro' | 'fisheye'
  | '14mm' | '24mm' | '35mm' | '50mm' | '85mm' | '100mm' | '135mm' | '200mm'
  | 'tilt-shift' | 'anamorphic' | 'spherical' | 'prime' | 'zoom';
```

#### Equipment Types
```typescript
type CameraBrand = 'sony' | 'canon' | 'nikon' | 'fujifilm' | 'leica' | 'hasselblad' 
  | 'red' | 'arri' | 'blackmagic' | 'panavision' | 'panasonic';

type CameraModel = 'arri-alexa-35' | 'arri-alexa-mini-lf' | 'arri-alexa-65'
  | 'red-v-raptor' | 'red-komodo' | 'sony-venice' | 'sony-fx6'
  | 'canon-c70' | 'blackmagic-ursa-mini-pro' | 'panavision-dxl2' | ...;

type CameraRig = 'tripod' | 'monopod' | 'gimbal' | 'steadicam' | 'easyrig' | 'shoulder-rig'
  | 'slider' | 'dolly' | 'jib' | 'crane' | 'technocrane' | 'russian-arm'
  | 'cable-cam' | 'drone' | 'fpv-drone' | 'motion-control' | 'handheld';

type GimbalModel = 'dji-ronin-4d' | 'dji-ronin-rs3-pro' | 'dji-ronin-rs4' 
  | 'moza-air-2' | 'zhiyun-crane-3s' | 'freefly-movi-pro' | 'tilta-gravity-g2x';
```

#### Lighting Types
```typescript
type LightingType = 'natural' | 'studio' | 'dramatic' | 'soft' | 'hard' | 'diffused'
  | 'key' | 'fill' | 'rim' | 'backlit' | 'silhouette' | 'rembrandt'
  | 'split' | 'butterfly' | 'loop' | 'broad' | 'short' | 'chiaroscuro'
  | 'high-key' | 'low-key' | 'three-point' | 'practical' | 'motivated';

type TimeOfDay = 'dawn' | 'sunrise' | 'golden-hour' | 'morning' | 'midday' | 'afternoon'
  | 'blue-hour' | 'sunset' | 'dusk' | 'twilight' | 'night' | 'midnight';

type WeatherLighting = 'sunny' | 'cloudy' | 'overcast' | 'foggy' | 'misty' 
  | 'rainy' | 'stormy' | 'snowy' | 'hazy';
```

#### Style & Color Types
```typescript
type ArtStyle = 'photorealistic' | 'hyperrealistic' | 'cinematic' | 'documentary'
  | 'editorial' | 'fashion' | 'portrait' | 'landscape' | 'street' | 'fine-art'
  | 'surreal' | 'abstract' | 'minimalist' | 'vintage' | 'retro' | 'noir'
  | 'cyberpunk' | 'steampunk' | 'fantasy' | 'sci-fi' | 'anime' | '3d-render';

type ColorPalette = 'warm' | 'cool' | 'neutral' | 'vibrant' | 'muted' | 'pastel' | 'neon'
  | 'monochrome' | 'sepia' | 'desaturated' | 'high-contrast' | 'low-contrast'
  | 'earthy' | 'oceanic' | 'forest' | 'sunset' | 'midnight' | 'golden';

type Mood = 'serene' | 'peaceful' | 'melancholic' | 'dramatic' | 'tense' | 'mysterious'
  | 'romantic' | 'nostalgic' | 'hopeful' | 'joyful' | 'energetic' | 'chaotic'
  | 'ethereal' | 'dark' | 'light' | 'whimsical' | 'eerie' | 'epic' | 'intimate';

type FilmStock = 'kodak-portra-400' | 'kodak-vision3-500t' | 'kodak-vision3-50d'
  | 'fujifilm-eterna-500t' | 'cinestill-800t' | 'ilford-hp5-plus' | ...;
```

#### Video-Specific Types
```typescript
type VideoPacing = 'slow' | 'medium' | 'fast' | 'variable' | 'building' | 'frenetic' | 'contemplative';

type VideoTransition = 'cut' | 'fade' | 'dissolve' | 'wipe' | 'morph' | 'match-cut' 
  | 'jump-cut' | 'cross-dissolve' | 'iris' | 'push' | 'slide';

type FilterType = 'uv' | 'polarizer' | 'nd' | 'nd-graduated' | 'black-pro-mist' 
  | 'white-pro-mist' | 'glimmer-glass' | 'classic-soft' | 'diffusion' | 'infrared';
```

### Methods Reference

#### Scene Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.scene()` | `scene(description: string \| VideoScene)` | Set scene description |
| `.setting()` | `setting(setting: string)` | Set location/setting |
| `.timeOfDay()` | `timeOfDay(time: TimeOfDay)` | Set time of day |
| `.weather()` | `weather(weather: WeatherLighting)` | Set weather conditions |

#### Subject Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.subject()` | `subject(main: string \| VideoSubject)` | Set main subject |
| `.appearance()` | `appearance(appearance: string)` | Set appearance details |
| `.clothing()` | `clothing(clothing: string)` | Set clothing/costume |

#### Camera Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.camera()` | `camera(settings: VideoCamera)` | Set all camera settings |
| `.shot()` | `shot(shot: ShotType)` | Set shot type |
| `.angle()` | `angle(angle: CameraAngle)` | Set camera angle |
| `.movement()` | `movement(movement: CameraMovement)` | Set camera movement |
| `.lens()` | `lens(lens: LensType)` | Set lens type |
| `.platform()` | `platform(platform)` | Set camera platform |
| `.cameraSpeed()` | `cameraSpeed(speed)` | Set movement speed |
| `.movementDirection()` | `movementDirection(direction)` | Set movement direction |
| `.rig()` | `rig(rig: CameraRig)` | Set camera rig |
| `.gimbal()` | `gimbal(gimbal: GimbalModel)` | Set gimbal model |
| `.cameraBrand()` | `cameraBrand(brand: CameraBrand)` | Set camera brand |
| `.cameraModel()` | `cameraModel(model: CameraModel)` | Set camera model |
| `.sensor()` | `sensor(sensor: SensorFormat)` | Set sensor format |
| `.lensBrand()` | `lensBrand(brand: LensBrand)` | Set lens brand |
| `.lensModel()` | `lensModel(model: LensModel)` | Set lens model |
| `.focalLength()` | `focalLength(length: string)` | Set focal length |
| `.anamorphic()` | `anamorphic(ratio?)` | Enable anamorphic |
| `.aperture()` | `aperture(aperture: string)` | Set aperture |
| `.frameRate()` | `frameRate(fps)` | Set frame rate |
| `.slowMotion()` | `slowMotion(enabled?)` | Enable slow motion |
| `.shutterAngle()` | `shutterAngle(angle: number)` | Set shutter angle |
| `.filter()` | `filter(filter: FilterType)` | Set lens filter |
| `.filmStock()` | `filmStock(stock: FilmStock)` | Set film stock |
| `.filmGrain()` | `filmGrain(grain)` | Set film grain level |
| `.halation()` | `halation(enabled?)` | Enable halation effect |

#### Lighting Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.lighting()` | `lighting(settings: VideoLighting)` | Set all lighting |
| `.lightingType()` | `lightingType(type)` | Set lighting type(s) |

#### Action & Motion Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.action()` | `action(action, options?)` | Add single action |
| `.actions()` | `actions(actions: string[])` | Add multiple actions |
| `.motion()` | `motion(settings: VideoMotion)` | Set motion settings |
| `.motionBeats()` | `motionBeats(beats: string[])` | Set motion beats |

#### Style Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.style()` | `style(settings: VideoStyle)` | Set all style settings |
| `.look()` | `look(look: ArtStyle)` | Set visual look |
| `.era()` | `era(era: string)` | Set era/time period |
| `.format()` | `format(format: string)` | Set format description |
| `.styleFilmStock()` | `styleFilmStock(stock: string)` | Set style film stock |
| `.reference()` | `reference(refs: string[])` | Set reference films |

#### Color Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.color()` | `color(settings: VideoColor)` | Set all color settings |
| `.palette()` | `palette(palette: ColorPalette)` | Set color palette |
| `.colorAnchors()` | `colorAnchors(anchors: string[])` | Set key colors |
| `.colorGrade()` | `colorGrade(grade: string)` | Set color grade |

#### Audio Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.audio()` | `audio(settings: VideoAudio)` | Set all audio |
| `.dialogue()` | `dialogue(dialogue: string)` | Set dialogue |
| `.ambient()` | `ambient(ambient: string)` | Set ambient sound |
| `.diegetic()` | `diegetic(sounds: string[])` | Set diegetic sounds |
| `.soundEffects()` | `soundEffects(effects: string[])` | Set sound effects |
| `.music()` | `music(music: string)` | Set music description |

#### Technical Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.technical()` | `technical(settings: VideoTechnical)` | Set all technical |
| `.duration()` | `duration(seconds: number)` | Set duration |
| `.resolution()` | `resolution(res)` | Set resolution |
| `.fps()` | `fps(fps)` | Set frame rate |
| `.aspectRatio()` | `aspectRatio(ratio)` | Set aspect ratio |

#### Mood, Pacing & Output Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.mood()` | `mood(mood: Mood \| Mood[])` | Set mood(s) |
| `.pacing()` | `pacing(pacing: VideoPacing)` | Set pacing |
| `.transition()` | `transition(transition)` | Add transition |
| `.transitions()` | `transitions(transitions[])` | Add transitions |
| `.addShot()` | `addShot(shot: VideoShot)` | Add to shot list |
| `.shotList()` | `shotList(shots: VideoShot[])` | Set shot list |
| `.custom()` | `custom(text: string)` | Add custom text |
| `.build()` | `build(): BuiltVideoPrompt` | Build the prompt |
| `.toString()` | `toString(): string` | Get prompt string |
| `.toJSON()` | `toJSON(): string` | Export as JSON |
| `.toYAML()` | `toYAML(): string` | Export as YAML |
| `.toMarkdown()` | `toMarkdown(): string` | Export as Markdown |

### Output Structure

```typescript
interface BuiltVideoPrompt {
  prompt: string;           // Full formatted prompt
  structure: {
    scene?: VideoScene;
    subject?: VideoSubject;
    camera?: VideoCamera;
    lighting?: VideoLighting;
    actions?: VideoAction[];
    motion?: VideoMotion;
    style?: VideoStyle;
    color?: VideoColor;
    audio?: VideoAudio;
    technical?: VideoTechnical;
    shots?: VideoShot[];
    mood?: Mood | Mood[];
    pacing?: VideoPacing;
    transitions?: VideoTransition[];
  };
}
```

### Usage Examples

#### Cinematic Product Shot
```typescript
const product = video()
  .scene("Luxury watch rotating on black velvet")
  .shot("extreme-close-up")
  .movement("slow-push")
  .lens("100mm")
  .lightingType(["rim", "key"])
  .look("commercial")
  .palette("monochrome")
  .pacing("slow")
  .duration(5)
  .resolution("4K")
  .build();
```

#### Documentary Interview
```typescript
const interview = video()
  .scene("Expert speaking in modern office")
  .subject({ main: "scientist", appearance: "professional attire" })
  .shot("medium")
  .angle("eye-level")
  .movement("static")
  .platform("tripod")
  .lightingType("three-point")
  .look("documentary")
  .dialogue("Explaining climate change impacts")
  .ambient("quiet office hum")
  .pacing("medium")
  .aspectRatio("16:9")
  .build();
```

#### Action Sequence
```typescript
const action = video()
  .scene("Car chase through city streets")
  .subject("sports car")
  .shot("tracking")
  .movement("tracking")
  .cameraSpeed("fast")
  .platform("fpv-drone")
  .lens("wide-angle")
  .lightingType("natural")
  .timeOfDay("night")
  .look("cinematic")
  .colorGrade("high contrast, neon")
  .pacing("frenetic")
  .actions([
    "Car drifts around corner",
    "Sparks fly from undercarriage",
    "Near miss with oncoming traffic"
  ])
  .soundEffects(["engine roar", "tire screech", "horns"])
  .music("intense electronic, pulsing bass")
  .fps(60)
  .slowMotion()
  .duration(8)
  .build();
```

#### Nature Documentary
```typescript
const nature = video()
  .scene("Lion stalking prey across African savanna")
  .subject({ main: "lion", appearance: "adult male, golden mane" })
  .setting("Serengeti National Park")
  .shot("wide")
  .lens("telephoto")
  .cameraBrand("red")
  .cameraModel("red-v-raptor")
  .movement("static")
  .platform("tripod")
  .timeOfDay("golden-hour")
  .weather("sunny")
  .look("documentary")
  .palette("warm")
  .mood("tense")
  .pacing("slow")
  .ambient("wind through grass, distant wildlife")
  .music("subtle, building tension")
  .resolution("4K")
  .fps(60)
  .aspectRatio("21:9")
  .build();
```

---

## 🎵 Audio Builder

Comprehensive builder for music and audio generation prompts. Works with Suno, Udio, and other music AI platforms.

### Quick Start

```typescript
import { audio } from 'prompts.chat';

const prompt = audio()
  .genre("synthwave")
  .mood("nostalgic", "dreamy")
  .bpm(110)
  .instruments(["synthesizer", "drums", "bass"])
  .build();

console.log(prompt.stylePrompt);  // "synthwave, nostalgic, dreamy, 110 BPM, synthesizer, drums, bass"
```

### Full Example

```typescript
import { audio } from 'prompts.chat';

const prompt = audio()
  // ━━━ Genre ━━━
  .genre("electronic")           // Primary genre
  .subgenre("synthwave")         // Subgenre
  .fusion(["rock", "pop"])       // Genre fusion
  
  // ━━━ Mood & Energy ━━━
  .mood("nostalgic", "triumphant", "hopeful")  // Primary + secondary moods
  .energy("high")                              // low | medium | high | building | fluctuating
  .emotion("euphoria")                         // Custom emotion descriptor
  
  // ━━━ Tempo ━━━
  .bpm(120)                      // Beats per minute
  .tempoMarking("allegro")       // Classical tempo marking
  .tempoFeel("driving")          // steady | swung | shuffled | syncopated | rubato | driving
  
  // ━━━ Vocals ━━━
  .vocalStyle("melodic")         // male | female | duet | choir | rap | falsetto | ...
  .language("english")           // english | spanish | japanese | instrumental | ...
  .lyricsTheme("retro-futuristic dreams and neon nights")
  .lyrics("[Verse 1]\nRiding through the neon glow...")
  .delivery("powerful and emotional")
  .instrumental()                // Shortcut for instrumental (no vocals)
  
  // ━━━ Instrumentation ━━━
  .instruments(["synthesizer", "drums", "bass"])  // Quick instrument list
  .leadInstrument("synthesizer")                  // Lead melody instrument
  .rhythmSection(["drums", "bass"])               // Rhythm section
  .bassInstrument("bass")                         // Bass instrument
  .percussion(["drums", "808"])                   // Percussion
  .pads(["synthesizer"])                          // Pad sounds
  .featuredInstrument("electric-guitar")          // Featured solo instrument
  
  // ━━━ Structure ━━━
  .section("intro", 8, "atmospheric synth pad build")
  .section("verse", 16, "driving rhythm with arpeggios")
  .section("pre-chorus", 8, "tension build")
  .section("chorus", 16, "anthemic, full instrumentation")
  .section("verse", 16, "variation with added elements")
  .section("chorus", 16, "bigger, more layers")
  .section("bridge", 8, "breakdown, stripped back")
  .section("drop", 16, "climactic peak")
  .section("outro", 8, "fade out with echoing synths")
  .duration(210)                 // Total duration in seconds (3:30)
  .form("ABABCB")                // Song form notation
  
  // ━━━ Production ━━━
  .productionStyle("polished")   // lo-fi | hi-fi | vintage | modern | polished | raw | ...
  .era("1980s")                  // 1950s-2020s | retro | vintage | modern | futuristic
  .reference(["Kavinsky", "Carpenter Brut", "Perturbator"])
  .texture("lush and warm")
  .effects(["reverb", "delay", "sidechain compression", "chorus"])
  
  // ━━━ Technical ━━━
  .key("Am")                     // C | Am | G | Em | D | Bm | F# | Ebm | ...
  .timeSignature("4/4")          // 4/4 | 3/4 | 6/8 | 5/4 | 7/8 | 12/8
  .formatType("song")            // song | instrumental | jingle | loop | soundtrack
  
  // ━━━ Tags & Custom ━━━
  .tag("80s")                    // Add single tag
  .tags(["retro", "neon", "cinematic"])  // Add multiple tags
  .custom("arpeggiated bassline throughout")  // Custom text
  
  .build();

// Access outputs
console.log(prompt.prompt);       // Full formatted prompt
console.log(prompt.stylePrompt);  // Style-only prompt (for Suno/Udio style field)
console.log(prompt.lyricsPrompt); // Lyrics prompt (if lyrics provided)
console.log(prompt.structure);    // Full structured data object

// Export formats
const yaml = prompt.toYAML();
const json = prompt.toJSON();
const md = prompt.toMarkdown();
```

### Types Reference

#### MusicGenre
```typescript
type MusicGenre = 
  | 'pop' | 'rock' | 'jazz' | 'classical' | 'electronic' | 'hip-hop' | 'r&b'
  | 'country' | 'folk' | 'blues' | 'metal' | 'punk' | 'indie' | 'alternative'
  | 'ambient' | 'lo-fi' | 'synthwave' | 'orchestral' | 'cinematic' | 'world'
  | 'latin' | 'reggae' | 'soul' | 'funk' | 'disco' | 'house' | 'techno' | 'edm'
  | 'trap' | 'drill' | 'k-pop' | 'j-pop' | 'bossa-nova' | 'gospel' | 'grunge'
  | 'shoegaze' | 'post-rock' | 'prog-rock' | 'psychedelic' | 'chillwave'
  | 'vaporwave' | 'drum-and-bass' | 'dubstep' | 'trance' | 'hardcore';
```

#### Instrument
```typescript
type Instrument = 
  | 'piano' | 'guitar' | 'acoustic-guitar' | 'electric-guitar' | 'bass' | 'drums'
  | 'violin' | 'cello' | 'viola' | 'flute' | 'saxophone' | 'trumpet' | 'trombone'
  | 'synthesizer' | 'organ' | 'harp' | 'percussion' | 'strings' | 'brass' | 'woodwinds'
  | 'choir' | 'vocals' | 'beatbox' | 'turntables' | 'harmonica' | 'banjo' | 'ukulele'
  | 'mandolin' | 'accordion' | 'marimba' | 'vibraphone' | 'xylophone' | 'timpani'
  | 'congas' | 'bongos' | 'djembe' | 'tabla' | 'sitar' | 'erhu' | 'koto'
  | '808' | '909' | 'moog' | 'rhodes' | 'wurlitzer' | 'mellotron' | 'theremin';
```

#### VocalStyle
```typescript
type VocalStyle = 
  | 'male' | 'female' | 'duet' | 'choir' | 'a-cappella' | 'spoken-word' | 'rap'
  | 'falsetto' | 'belting' | 'whisper' | 'growl' | 'melodic' | 'harmonized'
  | 'auto-tuned' | 'operatic' | 'soul' | 'breathy' | 'nasal' | 'raspy' | 'clear';
```

#### Other Types
```typescript
type VocalLanguage = 'english' | 'spanish' | 'french' | 'german' | 'italian' 
  | 'portuguese' | 'japanese' | 'korean' | 'chinese' | 'arabic' | 'hindi' 
  | 'russian' | 'turkish' | 'instrumental';

type TempoMarking = 'largo' | 'adagio' | 'andante' | 'moderato' | 'allegro' | 'vivace' | 'presto';

type TimeSignature = '4/4' | '3/4' | '6/8' | '2/4' | '5/4' | '7/8' | '12/8';

type MusicalKey = 'C' | 'C#' | 'Db' | 'D' | 'D#' | 'Eb' | 'E' | 'F' | 'F#' | 'Gb' 
  | 'G' | 'G#' | 'Ab' | 'A' | 'A#' | 'Bb' | 'B'
  | 'Cm' | 'C#m' | 'Dm' | 'D#m' | 'Ebm' | 'Em' | 'Fm' | 'F#m' 
  | 'Gm' | 'G#m' | 'Am' | 'A#m' | 'Bbm' | 'Bm';

type SongSection = 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'bridge' 
  | 'breakdown' | 'drop' | 'build-up' | 'outro' | 'solo' | 'interlude' | 'hook';

type ProductionStyle = 'lo-fi' | 'hi-fi' | 'vintage' | 'modern' | 'polished' | 'raw' 
  | 'organic' | 'synthetic' | 'acoustic' | 'electric' | 'hybrid' | 'minimalist' 
  | 'maximalist' | 'layered' | 'sparse' | 'dense' | 'atmospheric' | 'punchy' | 'warm' | 'bright';

type Era = '1950s' | '1960s' | '1970s' | '1980s' | '1990s' | '2000s' | '2010s' | '2020s'
  | 'retro' | 'vintage' | 'classic' | 'modern' | 'futuristic';
```

### Methods Reference

#### Genre Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.genre()` | `genre(primary: MusicGenre \| AudioGenre)` | Set primary genre |
| `.subgenre()` | `subgenre(subgenre: string)` | Set subgenre |
| `.fusion()` | `fusion(genres: MusicGenre[])` | Blend multiple genres |

#### Mood Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.mood()` | `mood(primary, ...secondary)` | Set moods (variadic) |
| `.energy()` | `energy(level)` | Set energy level |
| `.emotion()` | `emotion(emotion: string)` | Set emotion descriptor |

#### Tempo Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.tempo()` | `tempo(bpm \| AudioTempo)` | Set tempo (BPM or object) |
| `.bpm()` | `bpm(bpm: number)` | Set beats per minute |
| `.tempoMarking()` | `tempoMarking(marking: TempoMarking)` | Classical tempo term |
| `.tempoFeel()` | `tempoFeel(feel)` | Set rhythmic feel |

#### Vocal Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.vocals()` | `vocals(settings: AudioVocals)` | Set all vocal settings |
| `.vocalStyle()` | `vocalStyle(style: VocalStyle \| VocalStyle[])` | Set vocal style(s) |
| `.language()` | `language(lang: VocalLanguage)` | Set language |
| `.lyrics()` | `lyrics(lyrics: string)` | Set lyrics text |
| `.lyricsTheme()` | `lyricsTheme(theme: string)` | Set lyrics theme |
| `.delivery()` | `delivery(delivery: string)` | Set vocal delivery |
| `.instrumental()` | `instrumental()` | Make instrumental (no vocals) |

#### Instrumentation Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.instruments()` | `instruments(instruments: Instrument[])` | Set instrument list |
| `.instrumentation()` | `instrumentation(settings: AudioInstrumentation)` | Full settings object |
| `.leadInstrument()` | `leadInstrument(instrument)` | Set lead instrument |
| `.rhythmSection()` | `rhythmSection(instruments: Instrument[])` | Set rhythm section |
| `.bassInstrument()` | `bassInstrument(instrument: Instrument)` | Set bass |
| `.percussion()` | `percussion(instruments)` | Set percussion |
| `.pads()` | `pads(instruments)` | Set pad sounds |
| `.featuredInstrument()` | `featuredInstrument(instrument: Instrument)` | Featured instrument |

#### Structure Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.structure()` | `structure(settings \| { [section]: bars })` | Set structure |
| `.section()` | `section(type, bars?, description?)` | Add song section |
| `.form()` | `form(form: string)` | Set song form (e.g., "ABABCB") |
| `.duration()` | `duration(seconds: number)` | Set total duration |

#### Production Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.production()` | `production(settings: AudioProduction)` | Full production settings |
| `.productionStyle()` | `productionStyle(style)` | Set production style |
| `.era()` | `era(era: Era)` | Set era/decade |
| `.reference()` | `reference(artists: string[])` | Reference artists |
| `.texture()` | `texture(texture: string)` | Set sound texture |
| `.effects()` | `effects(effects: string[])` | Add audio effects |

#### Technical Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.technical()` | `technical(settings: AudioTechnical)` | Full technical settings |
| `.key()` | `key(key: MusicalKey)` | Set musical key |
| `.timeSignature()` | `timeSignature(sig: TimeSignature)` | Set time signature |
| `.formatType()` | `formatType(format)` | Set format type |

#### Tags & Output Methods
| Method | Signature | Description |
|--------|-----------|-------------|
| `.tag()` | `tag(tag: string)` | Add single tag |
| `.tags()` | `tags(tags: string[])` | Add multiple tags |
| `.custom()` | `custom(text: string)` | Add custom text |
| `.build()` | `build(): BuiltAudioPrompt` | Build the prompt |
| `.toString()` | `toString(): string` | Get prompt string |
| `.toStyleString()` | `toStyleString(): string` | Get style prompt only |
| `.toJSON()` | `toJSON(): string` | Export as JSON |
| `.toYAML()` | `toYAML(): string` | Export as YAML |
| `.toMarkdown()` | `toMarkdown(): string` | Export as Markdown |

### Output Structure

```typescript
interface BuiltAudioPrompt {
  prompt: string;           // Full formatted prompt
  stylePrompt: string;      // Style-only prompt (for AI style field)
  lyricsPrompt?: string;    // Lyrics prompt (if lyrics/theme provided)
  structure: {
    genre?: AudioGenre;
    mood?: AudioMood;
    tempo?: AudioTempo;
    vocals?: AudioVocals;
    instrumentation?: AudioInstrumentation;
    structure?: AudioStructure;
    production?: AudioProduction;
    technical?: AudioTechnical;
    tags?: string[];
  };
}
```

### Usage Examples

#### Lo-Fi Hip-Hop Beat
```typescript
const lofi = audio()
  .genre("lo-fi")
  .subgenre("chill hop")
  .mood("relaxed", "nostalgic")
  .bpm(85)
  .tempoFeel("swung")
  .instrumental()
  .instruments(["rhodes", "drums", "bass", "vinyl-crackle"])
  .productionStyle("lo-fi")
  .texture("warm and dusty")
  .effects(["vinyl crackle", "tape saturation", "low-pass filter"])
  .build();
```

#### Epic Orchestral Soundtrack
```typescript
const epic = audio()
  .genre("orchestral")
  .subgenre("epic cinematic")
  .mood("epic", "triumphant", "powerful")
  .energy("building")
  .tempoMarking("moderato")
  .bpm(100)
  .instrumental()
  .instruments(["strings", "brass", "timpani", "choir", "percussion"])
  .section("intro", 16, "quiet strings, building tension")
  .section("build-up", 32, "brass enters, crescendo")
  .section("drop", 32, "full orchestra, powerful theme")
  .section("outro", 16, "triumphant resolution")
  .productionStyle(["polished", "layered"])
  .era("modern")
  .key("Dm")
  .build();
```

#### Pop Song with Lyrics
```typescript
const popSong = audio()
  .genre("pop")
  .mood("uplifting", "energetic")
  .bpm(120)
  .vocalStyle("female")
  .language("english")
  .lyricsTheme("summer love and freedom")
  .lyrics(`[Verse 1]
Dancing in the summer rain
Nothing left to lose, nothing to explain

[Chorus]
We're alive, we're on fire
Take me higher, higher`)
  .instruments(["synth", "drums", "bass", "electric-guitar"])
  .section("intro", 8)
  .section("verse", 16)
  .section("chorus", 16)
  .section("verse", 16)
  .section("chorus", 16)
  .section("bridge", 8)
  .section("chorus", 16)
  .section("outro", 8)
  .productionStyle("polished")
  .key("G")
  .build();
```

---

## ✅ Quality

Local prompt quality validation (no API required).

```typescript
import { quality } from 'prompts.chat';

// Check prompt quality
const result = quality.check("Act as a senior developer...");

console.log(result.valid);   // true
console.log(result.score);   // 0.85 (0-1)
console.log(result.issues);  // Array of issues
console.log(result.stats);   // Detailed statistics

// Statistics include:
// - characterCount, wordCount, sentenceCount
// - variableCount
// - hasRole, hasTask, hasConstraints, hasExamples

// Validate (throws if invalid)
quality.validate(promptText);

// Check validity
const isValid = quality.isValid(promptText);

// Get improvement suggestions
const suggestions = quality.getSuggestions(promptText);
// → ["Add a role definition", "Consider adding examples"]
```

### Quality Checks

| Check | Type | Description |
|-------|------|-------------|
| `EMPTY` | error | Prompt is empty |
| `TOO_SHORT` | error | Below minimum length |
| `GIBBERISH` | error | Random/keyboard patterns |
| `FEW_WORDS` | warning | Very few words |
| `UNBALANCED_BRACKETS` | warning | Mismatched brackets |
| `LONG_LINES` | suggestion | Lines over 500 chars |
| `NO_CLEAR_INSTRUCTION` | suggestion | Missing role or task |

---

## 📄 Parser

Parse prompt files in YAML, JSON, Markdown, and plain text formats.

```typescript
import { parser } from 'prompts.chat';

// Auto-detect format
const prompt = parser.parse(content);

// Parse YAML
const yamlPrompt = parser.parse(`
name: Code Review
model: gpt-4
modelParameters:
  temperature: 0.7
messages:
  - role: system
    content: You are a code reviewer.
`, 'yaml');

// Parse JSON
const jsonPrompt = parser.parse(`{
  "name": "Assistant",
  "messages": [{"role": "system", "content": "You are helpful."}]
}`, 'json');

// Parse Markdown with frontmatter
const mdPrompt = parser.parse(`
---
name: Creative Writer
model: gpt-4
---
You are a creative writing assistant.
`, 'markdown');

// Parse plain text (becomes system message)
const textPrompt = parser.parse("You are a helpful assistant.", 'text');

// Serialize
const yaml = parser.toYaml(prompt);
const json = parser.toJson(prompt, true);  // pretty print

// Get system message
const systemPrompt = parser.getSystemPrompt(prompt);

// Interpolate variables
const filled = parser.interpolate(prompt, { name: "John" });
```

### ParsedPrompt Structure

```typescript
interface ParsedPrompt {
  name?: string;
  description?: string;
  model?: string;
  modelParameters?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };
  messages: PromptMessage[];
  variables?: Record<string, {
    description?: string;
    default?: string;
    required?: boolean;
  }>;
  metadata?: Record<string, unknown>;
}
```

---

## Tree-Shakeable Imports

Import only what you need for smaller bundles:

```typescript
// Full namespace imports
import { variables, similarity, quality, parser } from 'prompts.chat';

// Direct builder imports
import { builder, chat, image, video, audio } from 'prompts.chat';
import { templates, chatPresets } from 'prompts.chat';

// Direct module imports (smallest bundle)
import { detect, normalize, compile } from 'prompts.chat/variables';
import { calculate, isDuplicate } from 'prompts.chat/similarity';
import { check, validate, getSuggestions } from 'prompts.chat/quality';
import { parse, toYaml, toJson } from 'prompts.chat/parser';
import { builder, templates } from 'prompts.chat/builder';
```

---

## TypeScript Support

Full TypeScript support with comprehensive type exports:

```typescript
import type { 
  // Variables
  DetectedVariable,
  VariablePattern,
  
  // Builder
  BuiltPrompt,
  PromptVariable,
  
  // Chat
  BuiltChatPrompt,
  ChatMessage,
  ChatPersona,
  PersonaTone,
  ReasoningStyle,
  
  // Image
  BuiltImagePrompt,
  ImageSubject,
  ImageCamera,
  CameraAngle,
  ShotType,
  LensType,
  
  // Video
  BuiltVideoPrompt,
  VideoScene,
  VideoCamera,
  
  // Audio
  BuiltAudioPrompt,
  MusicGenre,
  Instrument,
  
  // Quality
  QualityResult,
  QualityIssue,
  
  // Parser
  ParsedPrompt,
  PromptMessage,
} from 'prompts.chat';
```

---

## Requirements

- **Node.js** 24.x
- **TypeScript** 5+ (optional, for type checking)

---

## Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```

---

## License

MIT © [Fatih Kadir Akın](https://github.com/f)
