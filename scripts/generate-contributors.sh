#!/bin/bash

# Script to generate contributor commits from prompts.csv
# Fetches latest prompts from prompts.chat/prompts.csv
# Compares with existing prompts.csv and creates commits only for new prompts

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CSV_FILE="$PROJECT_DIR/prompts.csv"
REMOTE_CSV="$PROJECT_DIR/prompts.csv.remote"
REMOTE_CSV_URL="https://prompts.chat/prompts.csv"

# Fetch latest prompts.csv from prompts.chat
echo "Fetching latest prompts.csv from $REMOTE_CSV_URL..."
if ! curl -fsSL "$REMOTE_CSV_URL" -o "$REMOTE_CSV"; then
    echo "Error: Failed to fetch prompts.csv from $REMOTE_CSV_URL"
    echo "Make sure prompts.chat is running and the endpoint is available."
    exit 1
fi
echo "Successfully fetched remote prompts.csv"

# Initialize local CSV if it doesn't exist
if [ ! -f "$CSV_FILE" ]; then
    echo "Local prompts.csv not found, initializing with header..."
    head -1 "$REMOTE_CSV" > "$CSV_FILE"
    git add "$CSV_FILE"
    git commit -m "Initialize prompts.csv with header" --allow-empty 2>/dev/null || true
fi

echo ""
echo "Comparing local and remote prompts.csv..."

# Process diffs and create commits for new prompts
export PROJECT_DIR
set +e  # Temporarily allow non-zero exit
python3 << 'PYTHON_SCRIPT'
import csv
import subprocess
import os
import sys
import re

csv.field_size_limit(sys.maxsize)

project_dir = os.environ.get('PROJECT_DIR', '.')
csv_file = os.path.join(project_dir, 'prompts.csv')
remote_csv = os.path.join(project_dir, 'prompts.csv.remote')
prompts_md_path = os.path.join(project_dir, 'PROMPTS.md')

# --- CSV I/O (ordered, roundtrip-safe) ---

def read_csv(path):
    """Read CSV into an ordered list of rows and an act->index map."""
    rows = []
    index = {}
    skipped = 0
    with open(path, 'r', newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames) if reader.fieldnames else []
        while True:
            try:
                row = next(reader)
                act = (row.get('act') or '').strip()
                if act:
                    index[act] = len(rows)
                    rows.append(row)
            except csv.Error as e:
                skipped += 1
                print(f"Skipping row due to CSV error: {e}")
            except StopIteration:
                break
    return rows, index, fieldnames, skipped

def write_csv(rows, fieldnames, path):
    """Write CSV deterministically — unchanged rows produce identical bytes."""
    with open(path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

def rebuild_index(rows):
    """Rebuild the act->index map after mutations."""
    return {(r.get('act') or '').strip(): i for i, r in enumerate(rows)}

def normalize(s):
    """Normalize a string for comparison only."""
    return (s or '').replace('\r\n', '\n').replace('\r', '\n').strip()

# --- Contributor helpers ---

BOT_NAME = 'github-actions[bot]'
BOT_EMAIL = '41898333+github-actions[bot]@users.noreply.github.com'

def sanitize_contributors(field):
    """Drop email-like entries and duplicates; the CSV and git history are public."""
    seen = []
    for c in (field or '').split(','):
        c = c.strip()
        if c and '@' not in c and c not in seen:
            seen.append(c)
    return ','.join(seen)

def sanitize_row(row):
    row['contributor'] = sanitize_contributors(row.get('contributor'))
    return row

def parse_contributors(field):
    parts = [c for c in sanitize_contributors(field).split(',') if c]
    if not parts:
        return None, []
    return parts[0], parts[1:]

def commit_identity(name):
    if not name:
        return BOT_NAME, BOT_EMAIL
    return name, f'{name}@users.noreply.github.com'

def build_commit_msg(action, act, co_authors):
    msg = f'{action} prompt: {act}'
    if co_authors:
        msg += '\n\n'
        for ca in co_authors:
            msg += f'Co-authored-by: {ca} <{commit_identity(ca)[1]}>\n'
    return msg

def git_commit(author_name, author_email, message):
    """Stage CSV + PROMPTS.md and commit if there are real changes. Returns True if committed."""
    subprocess.run(['git', 'add', csv_file, prompts_md_path], check=True)
    if subprocess.run(['git', 'diff', '--cached', '--quiet'], capture_output=True).returncode == 0:
        return False
    env = os.environ.copy()
    env['GIT_AUTHOR_NAME'] = author_name
    env['GIT_AUTHOR_EMAIL'] = author_email
    env['GIT_COMMITTER_NAME'] = author_name
    env['GIT_COMMITTER_EMAIL'] = author_email
    subprocess.run([
        'git', 'commit', '-m', message,
        f'--author={author_name} <{author_email}>'
    ], env=env, check=True)
    return True

# --- PROMPTS.md helpers ---

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
GITHUB_USERNAME_RE = re.compile(r'^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$')

def format_contributor_links(contributor_field):
    if not contributor_field:
        return '@anonymous'
    contributors = [c.strip() for c in contributor_field.split(',') if c.strip()]
    if not contributors:
        return '@anonymous'

    links = []
    for contributor in contributors:
        normalized = contributor.lstrip('@')
        if EMAIL_RE.match(normalized):
            links.append('@anonymous')
        elif GITHUB_USERNAME_RE.match(normalized):
            links.append(f'[@{normalized}](https://github.com/{normalized})')
        elif normalized:
            links.append(f'@{normalized}')
    return ', '.join(links) if links else '@anonymous'

def generate_prompt_block(row):
    act = row.get('act', 'Untitled')
    prompt = row.get('prompt', '')
    contributor = row.get('contributor', '')
    prompt_type = (row.get('type') or 'TEXT').upper()

    lang = {'TEXT': 'md', 'JSON': 'json', 'YAML': 'yaml'}.get(prompt_type, 'md')
    contributor_links = format_contributor_links(contributor)

    return (
        f'<details>\n'
        f'<summary><strong>{act}</strong></summary>\n\n'
        f'## {act}\n\n'
        f'Contributed by {contributor_links}\n\n'
        f'```{lang}\n'
        f'{prompt}\n'
        f'```\n\n'
        f'</details>\n\n'
    )

def init_prompts_md():
    if not os.path.exists(prompts_md_path):
        with open(prompts_md_path, 'w', encoding='utf-8') as f:
            f.write('# prompts.chat\n\n')
            f.write('> A curated list of prompts for ChatGPT and other AI models.\n\n')
            f.write('---\n\n')

def append_prompt_to_md(row):
    init_prompts_md()
    with open(prompts_md_path, 'a', encoding='utf-8') as f:
        f.write(generate_prompt_block(row))

def update_prompt_in_md(row):
    act = row.get('act', '')
    if not os.path.exists(prompts_md_path):
        append_prompt_to_md(row)
        return
    with open(prompts_md_path, 'r', encoding='utf-8') as f:
        content = f.read()
    pattern = rf'<details>\n<summary><strong>{re.escape(act)}</strong></summary>.*?</details>\n\n'
    new_content, count = re.subn(pattern, generate_prompt_block(row), content, flags=re.DOTALL)
    if count > 0:
        with open(prompts_md_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
    else:
        append_prompt_to_md(row)

def remove_prompt_from_md(act):
    if not os.path.exists(prompts_md_path):
        return
    with open(prompts_md_path, 'r', encoding='utf-8') as f:
        content = f.read()
    pattern = rf'<details>\n<summary><strong>{re.escape(act)}</strong></summary>.*?</details>\n\n'
    new_content = re.sub(pattern, '', content, flags=re.DOTALL)
    with open(prompts_md_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

# --- Main ---

local_rows, local_index, fieldnames, skipped_l = read_csv(csv_file)
remote_rows, remote_index, remote_fieldnames, skipped_r = read_csv(remote_csv)
remote_rows = [sanitize_row(r) for r in remote_rows]

if not fieldnames:
    fieldnames = remote_fieldnames

print(f"Local: {len(local_rows)} prompts" + (f" (skipped {skipped_l})" if skipped_l else ""))
print(f"Remote: {len(remote_rows)} prompts" + (f" (skipped {skipped_r})" if skipped_r else ""))

# Compute diffs
remote_acts = set(remote_index.keys())
new_prompts = []
updated_prompts = []
deleted_prompts = []

for row in remote_rows:
    act = (row.get('act') or '').strip()
    if not act:
        continue
    if act not in local_index:
        new_prompts.append(row)
    else:
        local_row = local_rows[local_index[act]]
        if (normalize(row.get('prompt')) != normalize(local_row.get('prompt')) or
                normalize(row.get('contributor')) != normalize(local_row.get('contributor'))):
            updated_prompts.append(row)

for act in list(local_index):
    if act not in remote_acts:
        deleted_prompts.append(local_rows[local_index[act]])

print(f"\nNew: {len(new_prompts)}, Updated: {len(updated_prompts)}, Deleted: {len(deleted_prompts)}")

if not new_prompts and not updated_prompts and not deleted_prompts:
    print("Already up to date!")
    sys.exit(0)

counts = {'add': 0, 'update': 0, 'remove': 0}

# 1) Deletes — remove one row at a time, keeping other rows untouched
if deleted_prompts:
    print("\nRemoving unlisted/deleted prompts...")
for i, row in enumerate(deleted_prompts, 1):
    act = (row.get('act') or '').strip()
    contributor = (row.get('contributor') or '').strip()
    primary, coauthors = parse_contributors(contributor)
    author_name, author_email = commit_identity(primary)

    if act in local_index:
        local_rows.pop(local_index[act])
        local_index = rebuild_index(local_rows)

    remove_prompt_from_md(act)
    write_csv(local_rows, fieldnames, csv_file)

    msg = build_commit_msg('Remove', act, coauthors)
    if git_commit(author_name, author_email, msg):
        ca = f" (+ {', '.join(coauthors)})" if coauthors else ""
        print(f"  [{i}/{len(deleted_prompts)}] {author_name}{ca}: {act}")
        counts['remove'] += 1
    else:
        print(f"  [{i}/{len(deleted_prompts)}] {act} — no changes, skipping")

# 2) Updates — replace only the specific row in-place
if updated_prompts:
    print("\nUpdating existing prompts...")
for i, row in enumerate(updated_prompts, 1):
    act = (row.get('act') or '').strip()
    contributor = (row.get('contributor') or '').strip()
    primary, coauthors = parse_contributors(contributor)
    author_name, author_email = commit_identity(primary)

    if act in local_index:
        local_rows[local_index[act]] = row

    update_prompt_in_md(row)
    write_csv(local_rows, fieldnames, csv_file)

    msg = build_commit_msg('Update', act, coauthors)
    if git_commit(author_name, author_email, msg):
        ca = f" (+ {', '.join(coauthors)})" if coauthors else ""
        print(f"  [{i}/{len(updated_prompts)}] {author_name}{ca}: {act}")
        counts['update'] += 1
    else:
        print(f"  [{i}/{len(updated_prompts)}] {act} — no changes, skipping")

# 3) New prompts — append one at a time
if new_prompts:
    print("\nAdding new prompts...")
for i, row in enumerate(new_prompts, 1):
    act = (row.get('act') or '').strip()
    contributor = (row.get('contributor') or '').strip()
    primary, coauthors = parse_contributors(contributor)
    author_name, author_email = commit_identity(primary)

    local_rows.append(row)
    local_index[act] = len(local_rows) - 1

    append_prompt_to_md(row)
    write_csv(local_rows, fieldnames, csv_file)

    msg = build_commit_msg('Add', act, coauthors)
    if git_commit(author_name, author_email, msg):
        ca = f" (+ {', '.join(coauthors)})" if coauthors else ""
        print(f"  [{i}/{len(new_prompts)}] {author_name}{ca}: {act}")
        counts['add'] += 1
    else:
        print(f"  [{i}/{len(new_prompts)}] {act} — no changes, skipping")

print(f"\nDone! {counts['add']} added, {counts['update']} updated, {counts['remove']} removed.")

PYTHON_SCRIPT
PYTHON_EXIT=$?
set -e  # Re-enable exit on error

# Clean up
rm -f "$REMOTE_CSV"

# Check for actual Python errors
if [ $PYTHON_EXIT -ne 0 ]; then
    echo "Error: Script failed with exit code $PYTHON_EXIT"
    exit 1
fi

echo ""
echo "Review with: git log --oneline prompts.csv PROMPTS.md"
echo ""
echo "To push: git push origin main"
