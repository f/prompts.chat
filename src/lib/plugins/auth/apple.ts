import Apple from "next-auth/providers/apple";
import type { AuthPlugin } from "../types";
import { requireAuthEnv } from "./env";

export const applePlugin: AuthPlugin = {
  id: "apple",
  name: "Apple",
  getProvider: () => {
    const env = requireAuthEnv("Apple", {
      AUTH_APPLE_ID: process.env.AUTH_APPLE_ID,
      AUTH_APPLE_SECRET: process.env.AUTH_APPLE_SECRET,
    });
    if (!env) return null;

    return Apple({
      clientId: env.AUTH_APPLE_ID,
      clientSecret: env.AUTH_APPLE_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name?.firstName
            ? `${profile.name.firstName} ${profile.name.lastName || ""}`.trim()
            : profile.email?.split("@")[0] || "User",
          email: profile.email,
          image: null,
        };
      },
    });
  },
};
