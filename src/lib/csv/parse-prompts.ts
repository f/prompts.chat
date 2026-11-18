/**
 * Shared CSV parser for the prompts dataset (`prompts.csv`).
 *
 * Extracted from the admin import route so it can be reused and unit tested.
 * Handles quoted fields, escaped quotes (""), and multi-line quoted values.
 */

export interface CsvRow {
  act: string;
  prompt: string;
  for_devs: string;
  type: string;
  contributor: string;
}

/** Unescape literal escape sequences like \n, \t, etc. */
export function unescapeString(str: string): string {
  return str
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\\\/g, "\\");
}

export function parsePromptsCsv(content: string): CsvRow[] {
  const rows: CsvRow[] = [];
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  let isFirstRow = true;

  const pushRow = () => {
    if (isFirstRow) {
      isFirstRow = false;
      return;
    }
    if (values.some((v) => v.trim())) {
      rows.push({
        act: values[0]?.trim() || "",
        prompt: unescapeString(values[1] || ""),
        for_devs: values[2]?.trim() || "",
        type: values[3]?.trim() || "",
        contributor: values[4]?.trim() || "",
      });
    }
  };

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = false;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else if ((char === "\n" || (char === "\r" && nextChar === "\n")) && !inQuotes) {
      if (char === "\r") i++;
      values.push(current);
      current = "";
      pushRow();
      values.length = 0;
    } else {
      current += char;
    }
  }

  if (current || values.length > 0) {
    values.push(current);
    pushRow();
  }

  return rows;
}
