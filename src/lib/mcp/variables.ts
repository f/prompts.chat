export interface PromptVariable {
  name: string;
  defaultValue?: string;
}

const VARIABLE_PATTERN = /\$\{([a-zA-Z_][a-zA-Z0-9_\s]*?)(?::([^}]*))?\}/g;
const VARIABLE_NAME = /^[a-zA-Z_][a-zA-Z0-9_\s]*$/;

/** Template variables written as ${name} or ${name:default}, in order of first use */
export function extractVariables(content: string): PromptVariable[] {
  const variables: PromptVariable[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(VARIABLE_PATTERN)) {
    const name = match[1].trim();
    if (seen.has(name)) continue;
    seen.add(name);
    variables.push({ name, defaultValue: match[2]?.trim() });
  }
  return variables;
}

/**
 * Replaces each variable with its value, else its default. Variables with neither stay as
 * written; keys that are not valid variable names are ignored.
 */
export function fillVariables(content: string, values: Record<string, unknown>): string {
  let filled = content;
  for (const variable of extractVariables(content)) {
    const value = values[variable.name] ?? variable.defaultValue;
    if (value === undefined || !VARIABLE_NAME.test(variable.name)) continue;
    const escaped = variable.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filled = filled.replace(new RegExp(`\\$\\{\\s*${escaped}\\s*(?::[^}]*)?\\}`, "g"), () => String(value));
  }
  return filled;
}

/** Variables that have no default and were not given a value */
export function missingVariables(content: string, values: Record<string, unknown>): string[] {
  return extractVariables(content)
    .filter((variable) => values[variable.name] === undefined && variable.defaultValue === undefined)
    .map((variable) => variable.name);
}
