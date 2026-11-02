# Download the offline Prompt Library

Download [My-Prompt-Library.zip](https://github.com/emmanueljosephyniesta-glitch/prompts.chat/raw/refs/heads/feat/personal-prompt-library/downloads/My-Prompt-Library.zip).

1. Extract the ZIP (on Windows: right-click → **Extract All**).
2. Open **My-Prompt-Library.html** in Chrome or Edge.
3. Search, filter by category, select a prompt, and copy it.

The HTML contains 2,860 repository prompts and works offline. If the browser blocks
clipboard access, select the preview text and press **Ctrl+C**.

This is a downloadable file, not a hosted website. To refresh its source data,
run `node --import tsx scripts/export-prompt-library.ts` from the repository root.
The generated HTML is `out/prompt-library/prompt-selector.html`; package it into a
ZIP as `My-Prompt-Library.html` when replacing this download.
