import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { AuthPlugin } from "../types";
import { requireAuthEnv } from "./env";

export const azurePlugin: AuthPlugin = {
  id: "azure",
  name: "Azure AD",
  getProvider: () => {
    const env = requireAuthEnv("Azure AD", {
      AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID,
      AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET,
    });
    if (!env) return null;

    return MicrosoftEntraID({
      clientId: env.AZURE_AD_CLIENT_ID,
      clientSecret: env.AZURE_AD_CLIENT_SECRET,
      issuer: process.env.AZURE_AD_TENANT_ID
        ? `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`
        : undefined,
    });
  },
};
