import { BUNDLED_BINARY_FILES, BUNDLED_TEXT_FILES } from "@/lib/bundled-files.generated";

/**
 * Project files embedded at build time by scripts/generate-bundled-files.mjs,
 * keyed by their path from the repository root. Reading them never touches the
 * filesystem, so it works the same on Node and in worker isolates.
 */
export function readBundledText(path: string): string | undefined {
  return Object.hasOwn(BUNDLED_TEXT_FILES, path) ? BUNDLED_TEXT_FILES[path] : undefined;
}

export function readBundledDataUri(path: string, mimeType: string): string | undefined {
  return Object.hasOwn(BUNDLED_BINARY_FILES, path) ? `data:${mimeType};base64,${BUNDLED_BINARY_FILES[path]}` : undefined;
}
