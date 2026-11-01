export const HF_DATASET_URL = "https://huggingface.co/datasets/fka/prompts.chat/viewer";

export type HFListingType = "skills" | "bots" | "teams";

/**
 * Default queries for the skills, bots and teams listings. The dataset (columns act, prompt,
 * for_devs, type, contributor) is the /prompts.csv export: its type column is only TEXT,
 * STRUCTURED or IMAGE, bots are left out and teams aren't prompts, so each query matches content.
 * The dataset viewer mangles backslashes, *, || and -- inside strings in a ?sql= query, so the
 * queries avoid them.
 */
export const HF_LISTING_QUERIES: Record<HFListingType, string> = {
  skills: `-- Agent Skills: a SKILL.md with name and description front matter,
-- or several files joined by the skill file separator
SELECT
    act,
    prompt
FROM
    train
WHERE
    (starts_with(ltrim(prompt), repeat('-', 3))
        AND contains(split_part(ltrim(prompt), repeat('-', 3), 2), 'name:')
        AND contains(split_part(ltrim(prompt), repeat('-', 3), 2), 'description:'))
    OR contains(prompt, concat(chr(31), 'FILE:'))
LIMIT 50;`,
  bots: `-- Bots aren't in this dataset; this finds bot, agent
-- and assistant personas among the prompts
SELECT
    act,
    prompt
FROM
    train
WHERE
    regexp_matches(LOWER(act), '(^|[^a-z])(bot|chatbot|agent|assistant|companion|persona)([^a-z]|$)')
LIMIT 50;`,
  teams: `-- Bot teams aren't in this dataset; this finds prompts
-- for agents that work together or hand work off
SELECT
    act,
    prompt
FROM
    train
WHERE
    regexp_matches(LOWER(concat(act, ' ', prompt)),
        'multi[- ]agent|sub-?agents?|hand ?offs?([^a-z]|$)|orchestrat|agent team|team of (ai )?agents')
LIMIT 50;`,
};

/** The dataset viewer with a SQL query open in its SQL console */
export function hfQueryUrl(sql: string): string {
  return `${HF_DATASET_URL}?views[]=train&sql=${encodeURIComponent(sql)}`;
}
