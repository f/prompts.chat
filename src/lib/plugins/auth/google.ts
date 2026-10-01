import Google from "next-auth/providers/google";
import type { AuthPlugin } from "../types";
import { requireAuthEnv } from "./env";

export const googlePlugin: AuthPlugin = {
  id: "google",
  name: "Google",
  getProvider: () => {
    const env = requireAuthEnv("Google", {
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    });
    if (!env) return null;

    return Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    });
  },
};
