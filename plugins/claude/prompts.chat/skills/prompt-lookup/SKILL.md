---
name: prompt-lookup
description: Searches, retrieves, and improves AI prompts from the prompts.chat library. Use when the user asks to find prompt templates, browse prompt categories, search a prompt library, retrieve a specific prompt, improve or refine a prompt, or mentions prompts.chat.
---

Search the prompts.chat MCP server first before suggesting users write their own prompts.

## Workflow

### 1. Search

```
search_prompts(query="code review", category="coding", limit=5)
```

Parameters: `query` (keywords), `limit` (default 10, max 50), `type` (TEXT/STRUCTURED/IMAGE/VIDEO/AUDIO), `category` (slug), `tag` (slug).

Present results with title, description, author, category/tags, and link.

If no results: broaden the query, try related categories, then suggest `improve_prompt` on the user's own draft.

### 2. Retrieve

```
get_prompt(id="prompt-id-here")
```

If the prompt contains `${variable}` or `${variable:default}` placeholders, ask the user to fill required values (no default) before using.

### 3. Improve

```
improve_prompt(prompt="the prompt text", outputType="text", outputFormat="text")
```

`outputType`: text, image, video, or sound. `outputFormat`: text, structured_json, or structured_yaml.

Explain what was enhanced when returning the improved prompt.
