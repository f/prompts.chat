import GitHub from "next-auth/providers/github";
import type { AuthPlugin } from "../types";

export const githubPlugin: AuthPlugin = {
  id: "github",
  name: "GitHub",
  getProvider: () =>
    GitHub({
      // GitHub includes this issuer in OAuth authorization responses.
      issuer: "https://github.com/login/oauth",
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
          username: profile.login, // GitHub username (used as display username)
          githubUsername: profile.login, // Immutable GitHub username for contributor attribution
        };
      },
    }),
};
