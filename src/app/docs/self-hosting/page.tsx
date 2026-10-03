import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Server, Database, Key, Palette, Globe, Settings, Cpu } from "lucide-react";
import DeepWikiIcon from "@/../public/deepwiki.svg";
import Context7Icon from "@/../public/context7.svg";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supportedLocales } from "@/lib/i18n/config";

export const metadata = {
  title: "Self-Hosting Guide - prompts.chat",
  description: "Deploy your own prompts.chat instance with customizable branding, themes, and authentication",
};

export default async function SelfHostingPage() {
  const t = await getTranslations("selfHosting");

  return (
    <div className="container max-w-4xl py-10">
      <h1 className="text-2xl font-bold mb-2">Self-Hosting Guide</h1>
      <p className="text-muted-foreground mb-8">
        Deploy your own prompts.chat instance with customizable branding, themes, and authentication.
      </p>

      <div className="prose prose-neutral dark:prose-invert max-w-none space-y-10">
        {/* Features */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Server className="h-5 w-5" />
            What You Get
          </h2>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Curated prompt library with 100+ community-tested prompts</li>
            <li>Custom branding, logos, and themes</li>
            <li>Multiple auth providers (GitHub, Google, Azure, credentials)</li>
            <li>AI-powered semantic search and generation (optional)</li>
            <li>Multi-language support ({supportedLocales.length} locales)</li>
            <li>CC0 licensed - use freely for any purpose</li>
          </ul>
        </section>

        {/* Using Documentation AI-Agents */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold">Using Documentation AI-Agents</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* DeepWiki */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Image src={DeepWikiIcon} alt="" width={20} height={20} />
                DeepWiki
              </h3>
              <p className="text-muted-foreground">
                <Link 
                  href="https://deepwiki.com/f/prompts.chat" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="underline hover:text-foreground"
                >
                  DeepWiki
                </Link>
                {" "}provides AI-powered documentation and insights for this repository.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                <li>AI-generated documentation from source code</li>
                <li>Interactive codebase exploration</li>
                <li>Architecture diagrams and component relationships</li>
                <li>Available as an MCP server</li>
              </ul>
            </div>

            {/* Context7 */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Image src={Context7Icon} alt="" width={20} height={20} className="rounded" />
                Context7
              </h3>
              <p className="text-muted-foreground">
                <Link 
                  href="https://context7.com/f/prompts.chat?tab=chat" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="underline hover:text-foreground"
                >
                  Context7
                </Link>
                {" "}is an AI-powered chat interface for exploring and understanding this repository.
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 text-sm">
                <li>Chat with the codebase using natural language</li>
                <li>Get answers with code references</li>
                <li>Understand implementation details quickly</li>
                <li>Available as an MCP server</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Manually */}
        <section className="space-y-6">
          <h2 className="text-xl font-bold">Manually</h2>

          {/* Prerequisites */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Database className="h-5 w-5" />
              Prerequisites
            </h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>{t("prerequisites.nodeJs")}</li>
              <li>{t("prerequisites.postgresql")}</li>
              <li>{t("prerequisites.npm")}</li>
            </ul>
          </div>

          {/* Recommended Database */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Database className="h-5 w-5" />
              Recommended Database
            </h3>
            <div className="rounded-lg border p-4 space-y-4">
              <p className="text-muted-foreground">
                prompts.chat requires PostgreSQL. For a hosted database, we recommend{" "}
                <Link
                  href="https://get.neon.com/VqfnMo4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Neon
                </Link>
                {" "}for serverless Postgres, connection pooling, and database branching.
              </p>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Sponsored by</p>
                <Link
                  href="https://get.neon.com/VqfnMo4"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Image
                    src="/sponsors/neon.svg"
                    alt="Neon"
                    width={250}
                    height={72}
                    className="h-10 w-auto dark:hidden"
                  />
                  <Image
                    src="/sponsors/neon-dark.svg"
                    alt="Neon"
                    width={250}
                    height={72}
                    className="h-10 w-auto hidden dark:block"
                  />
                </Link>
              </div>
            </div>
          </div>

          {/* Installation */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Quick Start</h3>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-1 overflow-x-auto">
            <p className="text-muted-foreground"># Clone the repository</p>
            <p>git clone https://github.com/f/prompts.chat.git</p>
            <p>cd prompts.chat</p>
            <p className="text-muted-foreground mt-3"># Install dependencies</p>
            <p>npm install</p>
            <p className="text-muted-foreground mt-3"># Configure environment</p>
            <p>cp .env.example .env</p>
            <p className="text-muted-foreground mt-3"># Run migrations & seed</p>
            <p>npm run db:migrate</p>
            <p>npm run db:seed</p>
            <p className="text-muted-foreground mt-3"># Start development server</p>
            <p>npm run dev</p>
          </div>
          </div>

          {/* Environment Variables */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Key className="h-5 w-5" />
              Environment Variables
            </h3>
          <p className="text-muted-foreground">
            Create a <code className="bg-muted px-1.5 py-0.5 rounded text-sm">.env</code> file based on <code className="bg-muted px-1.5 py-0.5 rounded text-sm">.env.example</code>:
          </p>

          {/* Core Variables */}
          <div className="space-y-3">
            <h3 className="font-medium">Core (Required)</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[240px]">Variable</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">DATABASE_URL</TableCell>
                    <TableCell className="text-muted-foreground text-sm">PostgreSQL connection string. Add <code className="text-xs">?connection_limit=5&pool_timeout=10</code> for serverless.</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">NEXTAUTH_URL</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Your app URL (e.g., <code className="text-xs">http://localhost:3000</code>)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">NEXTAUTH_SECRET</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Random secret for NextAuth session encryption</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* OAuth Variables */}
          <div className="space-y-3">
            <h3 className="font-medium">OAuth Providers (Optional)</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[240px]">Variable</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">GITHUB_CLIENT_ID</TableCell>
                    <TableCell className="text-muted-foreground text-sm">GitHub OAuth App client ID</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">GITHUB_CLIENT_SECRET</TableCell>
                    <TableCell className="text-muted-foreground text-sm">GitHub OAuth App client secret</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">GOOGLE_CLIENT_ID</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Google OAuth client ID</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">GOOGLE_CLIENT_SECRET</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Google OAuth client secret</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">AZURE_AD_CLIENT_ID</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Azure AD application client ID</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">AZURE_AD_CLIENT_SECRET</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Azure AD application client secret</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">AZURE_AD_TENANT_ID</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Azure AD tenant ID</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Storage Variables */}
          <div className="space-y-3">
            <h3 className="font-medium">Storage Providers (Optional)</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[240px]">Variable</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">ENABLED_STORAGE</TableCell>
                    <TableCell className="text-muted-foreground text-sm"><code className="text-xs">url</code> | <code className="text-xs">s3</code> | <code className="text-xs">do-spaces</code></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">S3_BUCKET</TableCell>
                    <TableCell className="text-muted-foreground text-sm">S3 bucket name</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">S3_REGION</TableCell>
                    <TableCell className="text-muted-foreground text-sm">S3 region (e.g., us-east-1)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">S3_ACCESS_KEY_ID</TableCell>
                    <TableCell className="text-muted-foreground text-sm">S3 access key</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">S3_SECRET_ACCESS_KEY</TableCell>
                    <TableCell className="text-muted-foreground text-sm">S3 secret key</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">S3_ENDPOINT</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Custom endpoint for S3-compatible services (MinIO, etc.)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">DO_SPACES_*</TableCell>
                    <TableCell className="text-muted-foreground text-sm">DigitalOcean Spaces: BUCKET, REGION, ACCESS_KEY_ID, SECRET_ACCESS_KEY, CDN_ENDPOINT</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* AI Variables */}
          <div className="space-y-3">
            <h3 className="font-medium">AI Features (Optional)</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[240px]">Variable</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">OPENAI_API_KEY</TableCell>
                    <TableCell className="text-muted-foreground text-sm">OpenAI API key for AI search and generation</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">OPENAI_BASE_URL</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Custom base URL for OpenAI-compatible APIs</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">OPENAI_EMBEDDING_MODEL</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Embedding model (default: <code className="text-xs">text-embedding-3-small</code>)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">OPENAI_GENERATIVE_MODEL</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Generative model (default: <code className="text-xs">gpt-4o-mini</code>)</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Analytics */}
          <div className="space-y-3">
            <h3 className="font-medium">Analytics (Optional)</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[240px]">Variable</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">GOOGLE_ANALYTICS_ID</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Google Analytics measurement ID (e.g., <code className="text-xs">G-XXXXXXXXX</code>)</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
          </div>

          {/* Configuration */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Configuration (prompts.config.ts)
            </h3>
          <p className="text-muted-foreground">
            Customize your instance by editing <code className="bg-muted px-1.5 py-0.5 rounded text-sm">prompts.config.ts</code>:
          </p>

          {/* Branding */}
          <div className="space-y-3">
            <h3 className="font-medium">Branding</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Option</TableHead>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">name</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Your app name displayed in header and footer</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">logo</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Path to logo for light mode</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">logoDark</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Path to logo for dark mode</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">favicon</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Path to favicon</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">description</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-muted-foreground text-sm">App description for SEO and homepage</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Theme */}
          <div className="space-y-3">
            <h3 className="font-medium">Theme</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Option</TableHead>
                    <TableHead className="w-[200px]">Values</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">radius</TableCell>
                    <TableCell className="text-muted-foreground text-xs"><code>none</code> | <code>sm</code> | <code>md</code> | <code>lg</code></TableCell>
                    <TableCell className="text-muted-foreground text-sm">Border radius for UI components</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">variant</TableCell>
                    <TableCell className="text-muted-foreground text-xs"><code>flat</code> | <code>default</code> | <code>brutal</code></TableCell>
                    <TableCell className="text-muted-foreground text-sm">UI style variant</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">density</TableCell>
                    <TableCell className="text-muted-foreground text-xs"><code>compact</code> | <code>default</code> | <code>comfortable</code></TableCell>
                    <TableCell className="text-muted-foreground text-sm">Spacing density</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">colors.primary</TableCell>
                    <TableCell className="text-muted-foreground text-xs">hex or oklch</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Primary brand color (e.g., <code>#6366f1</code>)</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Auth */}
          <div className="space-y-3">
            <h3 className="font-medium">Authentication</h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Option</TableHead>
                    <TableHead className="w-[200px]">Values</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">providers</TableCell>
                    <TableCell className="text-muted-foreground text-xs">array</TableCell>
                    <TableCell className="text-muted-foreground text-sm"><code>credentials</code>, <code>github</code>, <code>google</code>, <code>azure</code></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">allowRegistration</TableCell>
                    <TableCell className="text-muted-foreground text-xs">boolean</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Allow public sign-up (credentials provider only)</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* i18n */}
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Internationalization
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Option</TableHead>
                    <TableHead className="w-[200px]">Type</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">locales</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string[]</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Supported locales: {supportedLocales.join(", ")}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">defaultLocale</TableCell>
                    <TableCell className="text-muted-foreground text-xs">string</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Default language</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Features
            </h3>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Option</TableHead>
                    <TableHead className="w-[100px]">Default</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-mono text-xs">privatePrompts</TableCell>
                    <TableCell className="text-muted-foreground text-xs">true</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Allow users to create private prompts</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">changeRequests</TableCell>
                    <TableCell className="text-muted-foreground text-xs">true</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Enable version control with change requests</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">categories</TableCell>
                    <TableCell className="text-muted-foreground text-xs">true</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Enable prompt categories</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">tags</TableCell>
                    <TableCell className="text-muted-foreground text-xs">true</TableCell>
                    <TableCell className="text-muted-foreground text-sm">Enable prompt tags</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">aiSearch</TableCell>
                    <TableCell className="text-muted-foreground text-xs">false</TableCell>
                    <TableCell className="text-muted-foreground text-sm">AI-powered semantic search (requires OPENAI_API_KEY)</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-mono text-xs">aiGeneration</TableCell>
                    <TableCell className="text-muted-foreground text-xs">false</TableCell>
                    <TableCell className="text-muted-foreground text-sm">AI-powered generation features (requires OPENAI_API_KEY)</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
          </div>

          {/* White-label */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="h-5 w-5" />
              White-Label Mode
            </h3>
          <p className="text-muted-foreground">
            Set <code className="bg-muted px-1.5 py-0.5 rounded text-sm">useCloneBranding = true</code> at the top of the config to:
          </p>
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>Display your branding name and description on the homepage</li>
            <li>Use your logo as the hero background watermark</li>
            <li>Hide prompts.chat achievements (GitHub stars, Forbes, etc.)</li>
            <li>Hide sponsor section and &quot;Become a Sponsor&quot; CTA</li>
            <li>Hide &quot;Clone on GitHub&quot; button</li>
          </ul>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm">
            <p className="text-muted-foreground">{"// prompts.config.ts"}</p>
            <p>const useCloneBranding = true;</p>
          </div>
          </div>

          {/* Production */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Production Deployment
            </h3>
          <div className="bg-muted rounded-lg p-4 font-mono text-sm space-y-1">
            <p>npm run build</p>
            <p>npm run start</p>
          </div>
          <p className="text-muted-foreground">
            Deploy to Vercel, Railway, Render, or any Node.js hosting platform. Make sure to set all environment variables in your hosting provider&apos;s dashboard.
          </p>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Support</h3>
          <p className="text-muted-foreground">
            For issues and questions, please open a{" "}
            <Link 
              href="https://github.com/f/prompts.chat/issues" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="underline hover:text-foreground"
            >
              GitHub Issue
            </Link>
            . For the complete documentation, see the{" "}
            <Link 
              href="https://github.com/f/prompts.chat/blob/main/SELF-HOSTING.md" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="underline hover:text-foreground"
            >
              SELF-HOSTING.md
            </Link>
            {" "}file in the repository.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
