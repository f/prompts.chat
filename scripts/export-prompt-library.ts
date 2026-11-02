import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadRepositoryLibrary } from "../src/lib/my-library/repository";
import { exportPortable } from "../src/lib/my-library/export";
import { exportCsv } from "../src/lib/my-library";

async function main() {
  const directory = path.resolve(process.argv[2] ?? "out/prompt-library");
  const prompts = await loadRepositoryLibrary();
  await mkdir(directory, { recursive: true });
  await Promise.all([
    writeFile(path.join(directory, "prompt-selector.html"), exportPortable(prompts)),
    writeFile(path.join(directory, "prompt-directory.json"), JSON.stringify(prompts)),
    writeFile(path.join(directory, "prompt-directory.csv"), exportCsv(prompts)),
  ]);
  console.log(`Exported ${prompts.length} prompts to ${directory}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
