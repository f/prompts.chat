import messages from "../../../messages/en.json";
import { portableHtml } from "./portable";
import type { LibraryPrompt } from "./index";

export function exportPortable(prompts: LibraryPrompt[]): string {
  const t = messages.myLibrary;
  return portableHtml(prompts, { title: t.portableTitle, intro: t.portableIntro, search: t.search,
    category: t.category, all: t.all, preview: t.preview, copy: t.copy, copied: t.copied,
    copyError: t.portableCopyError, empty: t.portableEmpty, source: t.portableSource, count: t.portableCount });
}
