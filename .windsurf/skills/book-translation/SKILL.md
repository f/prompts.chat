---
name: book-translation
description: Translate "The Interactive Book of Prompting" chapters and UI strings to a new language
---

# Book Translation Skill

This skill guides translation of book content for **The Interactive Book of Prompting** at prompts.chat.

## Overview

The book has **30 chapters** across 7 parts. Translation requires:
1. **MDX content files** - Full chapter content in `src/content/book/{locale}/`
2. **JSON translation keys** - UI strings, chapter titles, and descriptions in `messages/{locale}.json`

## Prerequisites

Before starting, identify:
- **Target locale code** (e.g., `de`, `fr`, `es`, `ja`, `ko`, `zh`)
- Check if locale exists in `messages/` directory
- Check if `src/content/book/{locale}/` folder exists

## Step 1: Copy Turkish Folder as Base

The Turkish (`tr`) translation is complete and well-tested. **Copy it as your starting point** instead of translating from English:

```bash
mkdir -p src/content/book/{locale}
cp -r src/content/book/*.mdx src/content/book/{locale}/
cp src/components/book/elements/locales/en.ts src/components/book/elements/locales/{locale}.ts
```

**⚠️ IMPORTANT: After copying, you MUST register the new locale in `src/components/book/elements/locales/index.ts`:**
1. Add import: `import {locale} from "./{locale}";`
2. Add to `locales` object: `{locale},`
3. Add to named exports: `export { en, tr, az, {locale} };`

This is faster because:
- Turkish and many languages share similar sentence structures
- All JSX/React components are already preserved correctly
- File structure is already set up
- You only need to translate the prose, not recreate the structure

## Step 2: Translate MDX Content Files

Edit each copied file in `src/content/book/{locale}/` to translate from Turkish to your target language.

Process files one by one:

### Chapter List (in order)

| Slug | English Title |
|------|---------------|
| `00a-preface` | Preface |
| `00b-history` | History |
| `00c-introduction` | Introduction |
| `01-understanding-ai-models` | Understanding AI Models |
| `02-anatomy-of-effective-prompt` | Anatomy of an Effective Prompt |
| `03-core-prompting-principles` | Core Prompting Principles |
| `04-role-based-prompting` | Role-Based Prompting |
| `05-structured-output` | Structured Output |
| `06-chain-of-thought` | Chain of Thought |
| `07-few-shot-learning` | Few-Shot Learning |
| `08-iterative-refinement` | Iterative Refinement |
| `09-json-yaml-prompting` | JSON & YAML Prompting |
| `10-system-prompts-personas` | System Prompts & Personas |
| `11-prompt-chaining` | Prompt Chaining |
| `12-handling-edge-cases` | Handling Edge Cases |
| `13-multimodal-prompting` | Multimodal Prompting |
| `14-context-engineering` | Context Engineering |
| `15-common-pitfalls` | Common Pitfalls |
| `16-ethics-responsible-use` | Ethics & Responsible Use |
| `17-prompt-optimization` | Prompt Optimization |
| `18-writing-content` | Writing & Content |
| `19-programming-development` | Programming & Development |
| `20-education-learning` | Education & Learning |
| `21-business-productivity` | Business & Productivity |
| `22-creative-arts` | Creative Arts |
| `23-research-analysis` | Research & Analysis |
| `24-future-of-prompting` | The Future of Prompting |
| `24a-from-prompt-to-team` | From Prompt to Team |
| `25-agents-and-skills` | Agents & Skills |
| `27-tools-mcp-connectors` | Tools, MCP and Connectors |
| `26-the-harnesses` | The Harnesses |
| `28-persistent-bots` | Always-On Bots: Agents That Keep Working |

### MDX Translation Guidelines

1. **Preserve all JSX/React components** - Keep `<div>`, `<img>`, `className`, etc. unchanged
2. **Preserve code blocks** - Code examples should remain in English (variable names, keywords)
3. **Translate prose content** - Headings, paragraphs, lists
4. **Keep Markdown syntax** - `##`, `**bold**`, `*italic*`, `[links](url)`
5. **Preserve component imports** - Any `import` statements at the top

## Step 3: Translate JSON Keys

In `messages/{locale}.json`, translate the `"book"` section. Key areas:

### Book Metadata
```json
"book": {
  "title": "The Interactive Book of Prompting",
  "subtitle": "An Interactive Guide to Crafting Clear and Effective Prompts",
  "metaTitle": "...",
  "metaDescription": "...",
  ...
}
```

### Chapter Titles (`book.chapters`)
```json
"chapters": {
  "00a-preface": "Preface",
  "00b-history": "History",
  "00c-introduction": "Introduction",
  ...
}
```

### Chapter Descriptions (`book.chapterDescriptions`)
```json
"chapterDescriptions": {
  "00a-preface": "A personal note from the author",
  "00b-history": "The story of Awesome ChatGPT Prompts",
  ...
}
```

### Part Names (`book.parts`)
```json
"parts": {
  "introduction": "Introduction",
  "foundations": "Foundations",
  "techniques": "Techniques",
  "advanced": "Advanced Strategies",
  "bestPractices": "Best Practices",
  "useCases": "Use Cases",
  "conclusion": "Conclusion"
}
```

### Interactive Demo Examples (`book.interactive.demoExamples`)
Localize example text for demos (tokenizer samples, temperature examples, etc.):
```json
"demoExamples": {
  "tokenPrediction": {
    "tokens": ["The", " capital", " of", " France", " is", " Paris", "."],
    "fullText": "The capital of France is Paris."
  },
  "temperature": {
    "prompt": "What is the capital of France?",
    ...
  }
}
```

### Book Elements Locales (REQUIRED)

**⚠️ DO NOT SKIP THIS STEP** - The interactive demos will not work in the new language without this.

Translate the locale data file at `src/components/book/elements/locales/{locale}.ts`:
- Temperature examples, token predictions, embedding words
- Capabilities list, sample conversations, strategies
- Tokenizer samples, builder fields, chain types
- Frameworks (CRISPE, BREAK, RTF), exercises
- Image/video prompt options, validation demos

**Then register it in `src/components/book/elements/locales/index.ts`:**
```typescript
import {locale} from "./{locale}";

const locales: Record<string, LocaleData> = {
  en,
  tr,
  az,
  {locale},  // Add your new locale here
};

export { en, tr, az, {locale} };  // Add to exports
```

### UI Strings (`book.interactive.*`, `book.chapter.*`, `book.search.*`)
Translate all interactive component labels and navigation strings.

## Step 4: Verify Translation

1. Run the check script:
   ```bash
   node scripts/check-translations.js
   ```

2. Start dev server and test:
   ```bash
   npm run dev
   ```

3. Navigate to `/book` with the target locale to verify content loads

## Reference: English Translation

The English (`en`) translation is complete and serves as the **base template** for all new translations:
- MDX files: `src/content/book/*.mdx` — copy this files to `src/content/book/{locale}/*.mdx`
- JSON keys: `messages/en.json` → `book` section — use as reference for structure

### Recommended Workflow

1. Copy `src/content/book/*.mdx` to `src/content/book/{locale}/*.mdx`
2. Copy the `"book"` section from `messages/en.json` to `messages/{locale}.json`. Translate these in multiple agentic session instead of single time (token limit may exceed at once)
3. Edit each file, translating English → target language
4. Keep all JSX components, code blocks, and Markdown syntax intact

## Quality Guidelines

- **Consistency**: Use consistent terminology throughout (e.g., always translate "prompt" the same way)
- **Technical terms**: Some terms like "AI", "ChatGPT", "API" may stay in English
- **Cultural adaptation**: Adapt examples to be relevant for the target audience where appropriate
- **Natural language**: Prioritize natural-sounding translations over literal ones
