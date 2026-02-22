import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import { getConfig } from "@/lib/config";
import { initializePlugins, getAuthPlugin } from "@/lib/plugins";
import type { Adapter, AdapterUser } from "next-auth/adapters";

// Extended interface for adapter user data with optional username fields
interface ExtendedAdapterUser extends AdapterUser {
  username?: string;
  githubUsername?: string;
}

// Initialize plugins before use
initializePlugins();

// Generate a unique username from email or name
async function generateUsername(email: string, name?: string | null): Promise<string> {
  // Try to use the part before @ in email
  let baseUsername = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "");
  
  // If too short, use name
  if (baseUsername.length < 3 && name) {
    baseUsername = name.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 15);
  }
  
  // Ensure minimum length
  if (baseUsername.length < 3) {
    baseUsername = "user";
  }
  
  // Check if username exists and append number if needed
  let username = baseUsername;
  let counter = 1;
  while (await db.user.findUnique({ where: { username } })) {
    username = `${baseUsername}${counter}`;
    counter++;
  }
  
  return username;
}

// Custom adapter that wraps PrismaAdapter to add username
function CustomPrismaAdapter(): Adapter {
  const prismaAdapter = PrismaAdapter(db);
  
  return {
    ...prismaAdapter,
    async createUser(data: ExtendedAdapterUser) {
      // Use GitHub username if provided, otherwise generate one
      let username = data.username;
      const githubUsername = data.githubUsername;
      
      if (!username) {
        username = await generateUsername(data.email, data.name);
      } else {
        username = username.toLowerCase();
        
        // Check if there's an unclaimed account with this username
        const unclaimedEmail = `${username}@unclaimed.prompts.chat`;
        const unclaimedUser = await db.user.findUnique({
          where: { email: unclaimedEmail },
        });
        
        if (unclaimedUser) {
          // Claim this account - update with real user info
          const claimedUser = await db.user.update({
            where: { id: unclaimedUser.id },
            data: {
              name: data.name,
              email: data.email,
              avatar: data.image,
              emailVerified: data.emailVerified,
              githubUsername: githubUsername || undefined, // Store immutable GitHub username
            },
          });
          
          return {
            ...claimedUser,
            image: claimedUser.avatar,
          } as AdapterUser;
        }
        
        // Ensure GitHub username is unique, append number if taken
        const baseUsername = username;
        let finalUsername = baseUsername;
        let counter = 1;
        while (await db.user.findUnique({ where: { username: finalUsername } })) {
          finalUsername = `${baseUsername}${counter}`;
          counter++;
        }
        username = finalUsername;
      }
      
      const user = await db.user.create({
        data: {
          name: data.name,
          email: data.email,
          avatar: data.image,
          emailVerified: data.emailVerified,
          username,
          githubUsername: githubUsername || undefined, // Store immutable GitHub username
        },
      });
      
      return {
        ...user,
        image: user.avatar,
      } as AdapterUser;
    },
  };
}

// Helper to get providers from config (supports both old `provider` and new `providers` array)
function getConfiguredProviders(config: Awaited<ReturnType<typeof getConfig>>): string[] {
  // Support new `providers` array
  if (config.auth.providers && config.auth.providers.length > 0) {
    return config.auth.providers;
  }
  // Backward compatibility with old `provider` string
  if (config.auth.provider) {
    return [config.auth.provider];
  }
  // Default to credentials
  return ["credentials"];
}

// Build auth config dynamically based on prompts.config.ts
async function buildAuthConfig() {
  const config = await getConfig();
  const providerIds = getConfiguredProviders(config);
  
  const authProviders = providerIds
    .map((id) => {
      const plugin = getAuthPlugin(id);
      if (!plugin) {
        console.warn(`Auth plugin "${id}" not found, skipping`);
        return null;
      }
      return plugin.getProvider();
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  if (authProviders.length === 0) {
    throw new Error(`No valid auth plugins found. Configured: ${providerIds.join(", ")}`);
  }

  return {
    adapter: CustomPrismaAdapter(),
    providers: authProviders,
    session: {
      strategy: "jwt" as const,
    },
    pages: {
      signIn: "/login",
      signUp: "/register",
      error: "/login",
    },
    callbacks: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async jwt({ token, user, trigger }: { token: any; user?: any; trigger?: string }) {
        // On sign in, look up the actual database user by email to ensure correct ID
        if (user && user.email) {
          const dbUser = await db.user.findUnique({
            where: { email: user.email },
            select: { id: true, role: true, username: true, locale: true, name: true, avatar: true },
          });

          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.username = dbUser.username;
            token.locale = dbUser.locale;
            token.name = dbUser.name;
            token.picture = dbUser.avatar;
          }
        }

        // On subsequent requests, verify user exists and refresh data
        if (token.id && !user) {
          const dbUser = await db.user.findUnique({
            where: { id: token.id as string },
            select: { id: true, role: true, username: true, locale: true, name: true, avatar: true },
          });

          // User no longer exists - invalidate token
          if (!dbUser) {
            return null;
          }

          // Update token with latest user data on explicit update or if data missing
          if (trigger === "update" || !token.username) {
            token.role = dbUser.role;
            token.username = dbUser.username;
            token.locale = dbUser.locale;
            token.name = dbUser.name;
            token.picture = dbUser.avatar;
          }
        }

        return token;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async session({ session, token }: { session: any; token: any }) {
        // If token is null/invalid, return empty session
        if (!token) {
          return { ...session, user: undefined };
        }
        if (token && session.user) {
          session.user.id = token.id as string;
          session.user.role = token.role as string;
          session.user.username = token.username as string;
          session.user.locale = token.locale as string;
          session.user.name = token.name ?? null;
          session.user.image = token.picture ?? null;
        }
        return session;
      },
    },
  };
}

// Export auth handlers
const authConfig = await buildAuthConfig();

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig);

// Extended session type
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      username: string;
      locale: string;
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    role: string;
    username: string;
    locale: string;
    name?: string | null;
    picture?: string | null;
  }
}
