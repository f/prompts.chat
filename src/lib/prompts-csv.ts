export interface CSVUser {
  username: string;
  githubUsername: string | null;
}

// The export is published (GitHub, Hugging Face), so it must never contain emails.
export function getUserIdentifier(user: CSVUser): string {
  return user.githubUsername || user.username;
}

// Author first, then co-contributors deduplicated and sorted so the field is
// byte-stable across runs regardless of the order the database returns them in.
export function buildContributorField(author: CSVUser, contributors: CSVUser[]): string {
  const authorId = getUserIdentifier(author);
  const contributorIds = [...new Set(contributors.map(getUserIdentifier))]
    .filter((id) => id && id !== authorId)
    .sort();
  return [authorId, ...contributorIds].join(",");
}
