import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { importLibrary, normalizeRows, type LibraryPrompt } from "./index";

let cached: { signature: string; data: Promise<LibraryPrompt[]> } | undefined;

export async function loadRepositoryLibrary(): Promise<LibraryPrompt[]> {
  const filename = path.join(process.cwd(), "prompts.csv");
  const info = await stat(filename);
  const signature = `${info.mtimeMs}:${info.size}`;
  if (cached?.signature === signature) return cached.data;
  const data = readFile(filename, "utf8").then(text => {
    const source = "https://github.com/emmanueljosephyniesta-glitch/prompts.chat/blob/main/prompts.csv";
    return normalizeRows(importLibrary(text, "csv").map(p => ({ ...p, source })));
  });
  cached = { signature, data };
  try { return await data; }
  catch (error) { if (cached?.data === data) cached = undefined; throw error; }
}
