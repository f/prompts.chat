import { extractVariables, fillVariables } from "../mcp/variables";

export interface LibraryPrompt {
  id: string;
  title: string;
  description: string;
  category: string;
  subcategory: string;
  tags: string[];
  prompt: string;
  variables: string[];
  source: string;
  version: string;
  updatedAt: string | null;
}

export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;
export const MAX_PROMPTS = 10000;

/** RFC 4180 records, including embedded newlines and escaped quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = "", quoted = false, closed = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else field += c;
    } else if (c === '"') {
      if (field || closed) throw new Error("Invalid CSV quotation");
      quoted = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field); field = ""; closed = false;
      if (c !== ',') {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (c === '\r' && input[i + 1] === '\n') i++;
      }
    } else {
      if (closed) throw new Error("Unexpected text after CSV quotation");
      field += c;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quotation");
  row.push(field);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function fingerprint(text: string): string {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) {
    a = Math.imul(a ^ text.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(i);
  }
  return (a >>> 0).toString(16).padStart(8, "0") + (b >>> 0).toString(16).padStart(8, "0");
}

export function variablesFor(prompt: string): string[] {
  return [...new Set([...extractVariables(prompt).map(v => v.name),
    ...Array.from(prompt.matchAll(/\[([A-Z][A-Z0-9_ ]{1,60})\]/g), m => m[1])])];
}

export function customize(prompt: string, values: Record<string, string>): string {
  // Replace against the original template once: values containing placeholders stay literal.
  return prompt.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_\s]*?)(?::([^}]*))?\}|\[([A-Z][A-Z0-9_ ]{1,60})\]/g,
    (original, name: string | undefined, _fallback: string | undefined, bracket: string | undefined) => {
      const key = (name ?? bracket ?? "").trim();
      const value = Object.hasOwn(values, key) ? values[key] : undefined;
      return value ? value : name ? fillVariables(original, Object.create(null)) : original;
    });
}

export function safeSource(source: string): string {
  try { const url = new URL(source); return url.protocol === "https:" ? url.href : ""; }
  catch { return ""; }
}

function inferredCategory(title: string, developer: boolean): string {
  if (developer) return "Coding";
  if (/business|market|sales|startup|finance|entrepreneur/i.test(title)) return "Business";
  if (/research|scientist|fact.check|analysis/i.test(title)) return "Research";
  if (/writer|writing|poet|story|translator|editor/i.test(title)) return "Writing";
  if (/teacher|tutor|learn|education|instructor/i.test(title)) return "Education";
  if (/workflow|automat/i.test(title)) return "Automation";
  return "General";
}

function stringField(row: Record<string, unknown>, key: string, max: number, fallback = ""): string {
  const value = row[key] ?? fallback;
  if (typeof value !== "string" || value.length > max) throw new Error(`Invalid ${key}`);
  return value;
}

export function normalizeRows(rows: unknown[]): LibraryPrompt[] {
  if (rows.length > MAX_PROMPTS) throw new Error("Too many prompts");
  const unique = new Map<string, LibraryPrompt>();
  for (const input of rows) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid prompt record");
    const row = input as Record<string, unknown>;
    const title = stringField(row, "title", 500, typeof row.act === "string" ? row.act : "");
    const prompt = stringField(row, "prompt", 200000);
    if (!title.trim() || !prompt.trim()) throw new Error("Title and prompt are required");
    const tags = row.tags ?? [];
    if (!Array.isArray(tags) || tags.length > 100 || tags.some(t => typeof t !== "string" || t.length > 200)) throw new Error("Invalid tags");
    const updatedAt = row.updatedAt ?? null;
    if (updatedAt !== null && (typeof updatedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(updatedAt) || !Number.isFinite(Date.parse(updatedAt)))) throw new Error("Invalid updatedAt");
    const source = stringField(row, "source", 2000);
    if (source && !safeSource(source)) throw new Error("Source must be an HTTPS URL");
    const category = stringField(row, "category", 200) || inferredCategory(title, String(row.for_devs).toUpperCase() === "TRUE");
    const subcategory = stringField(row, "subcategory", 200) || stringField(row, "type", 200);
    // Content-addressed records keep revisions distinct and never overwrite earlier content.
    const version = fingerprint(prompt);
    const id = `prompt-${fingerprint(JSON.stringify([title, prompt, source, category, subcategory, tags]))}`;
    const item: LibraryPrompt = { id, title, prompt, description: stringField(row, "description", 2000), category, subcategory,
      tags: tags as string[], source, version, updatedAt: updatedAt as string | null, variables: variablesFor(prompt) };
    if (!unique.has(id)) unique.set(id, item);
  }
  return [...unique.values()];
}

export function importLibrary(text: string, format: "json" | "csv"): LibraryPrompt[] {
  if (new TextEncoder().encode(text).byteLength > MAX_IMPORT_BYTES) throw new Error("Import exceeds 25 MB");
  if (format === "json") {
    const data: unknown = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error("Expected a JSON array");
    return normalizeRows(data);
  }
  const [headers, ...records] = parseCsv(text);
  if (!headers || new Set(headers).size !== headers.length || !headers.includes("prompt") || !(headers.includes("title") || headers.includes("act"))) throw new Error("CSV requires title (or act) and prompt columns");
  return normalizeRows(records.map(record => {
    if (record.length !== headers.length) throw new Error("CSV column count mismatch");
    const row = Object.fromEntries(headers.map((key, i) => [key, record[i]]));
    return { ...row, tags: row.tags ? JSON.parse(row.tags) : [], updatedAt: row.updatedAt || null };
  }));
}

export function exportCsv(prompts: LibraryPrompt[]): string {
  const headers = ["title", "description", "category", "subcategory", "tags", "prompt", "source", "version", "updatedAt"] as const;
  const quote = (s: string) => `"${s.replace(/"/g, '""')}"`;
  return [headers.join(","), ...prompts.map(p => headers.map(key => quote(key === "tags" ? JSON.stringify(p.tags) : p[key] ?? "")).join(","))].join("\r\n");
}

export function searchLibrary(prompts: LibraryPrompt[], query: string, category = "", subcategory = ""): LibraryPrompt[] {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return prompts.filter(p => {
    if ((category && p.category !== category) || (subcategory && p.subcategory !== subcategory)) return false;
    if (!terms.length) return true;
    const text = [p.title, p.description, p.prompt, p.category, p.subcategory, ...p.tags].join(" ").toLocaleLowerCase();
    return terms.every(term => text.includes(term));
  });
}

export function mergeLibrary(existing: LibraryPrompt[], incoming: LibraryPrompt[]): LibraryPrompt[] {
  const merged = new Map(existing.map(p => [p.id, p]));
  for (const p of incoming) if (!merged.has(p.id)) merged.set(p.id, p);
  if (merged.size > MAX_PROMPTS) throw new Error("Too many prompts");
  return [...merged.values()];
}
