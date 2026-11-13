# AGENTS.md

> Guidelines for AI coding agents working on this project.

## Project Overview

**prompts.chat** is a social platform for AI prompts built with Next.js 16. It allows users to share, discover, and collect prompts from the community. The project is open source and can be self-hosted with customizable branding, themes, and authentication.

### Tech Stack

- **Framework:** Next.js 16.0.7 (App Router) with React 19.2
- **Language:** TypeScript 5
- **Database:** PostgreSQL with Prisma ORM 6.19
- **Authentication:** NextAuth.js 5 (beta) with pluggable providers (credentials, GitHub, Google, Azure)
- **Styling:** Tailwind CSS 4 with Radix UI primitives
- **UI Components:** shadcn/ui pattern (components in `src/components/ui/`)
- **Internationalization:** next-intl with 11 supported locales
- **Icons:** Lucide React
- **Forms:** React Hook Form with Zod validation

## Project Structure

```
/
├── prisma/                 # Database schema and migrations
│   ├── schema.prisma       # Prisma schema definition
│   ├── migrations/         # Database migrations
│   └── seed.ts             # Database seeding script
├── public/                 # Static assets (logos, favicon)
├── messages/               # i18n translation files (en.json, es.json, etc.)
├── src/
│   ├── app/                # Next.js App Router pages
│   │   ├── (auth)/         # Auth pages (login, register)
│   │   ├── [username]/     # User profile pages
│   │   ├── admin/          # Admin dashboard
│   │   ├── api/            # API routes
│   │   ├── categories/     # Category pages
│   │   ├── prompts/        # Prompt CRUD pages
│   │   ├── feed/           # User feed
│   │   ├── discover/       # Discovery page
│   │   ├── settings/       # User settings
│   │   └── tags/           # Tag pages
│   ├── components/         # React components
│   │   ├── admin/          # Admin-specific components
│   │   ├── auth/           # Authentication components
│   │   ├── categories/     # Category components
│   │   ├── layout/         # Layout components (header, etc.)
│   │   ├── prompts/        # Prompt-related components
│   │   ├── providers/      # React context providers
│   │   ├── settings/       # Settings components
│   │   └── ui/             # shadcn/ui base components
│   ├── lib/                # Utility libraries
│   │   ├── ai/             # AI/OpenAI integration
│   │   ├── auth/           # NextAuth configuration
│   │   ├── config/         # Config type definitions
│   │   ├── i18n/           # Internationalization setup
│   │   ├── plugins/        # Plugin system (auth, storage)
│   │   ├── db.ts           # Prisma client instance
│   │   └── utils.ts        # Utility functions (cn)
│   └── i18n/               # i18n request handler
├── prompts.config.ts       # Main application configuration
├── prompts.csv             # Community prompts data source
└── package.json            # Dependencies and scripts
```

## Commands

```bash
# Development
npm run dev              # Start development server (localhost:3000)
npm run build            # Build for production (runs prisma generate first)
npm run start            # Start production server
npm run lint             # Run ESLint

# Database
npm run db:generate      # Generate Prisma client
npm run db:migrate       # Run database migrations
npm run db:push          # Push schema changes to database
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed database with initial data

# Type checking
npx tsc --noEmit         # Check TypeScript types without emitting

# Translations
node scripts/check-translations.js  # Check for missing translations across locales
```

## Code Style Guidelines

### TypeScript

- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use `interface` for object shapes, `type` for unions/intersections
- Functions: `camelCase` (e.g., `getUserData`, `handleSubmit`)
- Components: `PascalCase` (e.g., `PromptCard`, `AuthContent`)
- Constants: `UPPER_SNAKE_CASE` for true constants
- Files: `kebab-case.tsx` for components, `camelCase.ts` for utilities

### React/Next.js

- Use React Server Components by default
- Add `"use client"` directive only when client interactivity is needed
- Prefer server actions over API routes for mutations
- Use `next-intl` for all user-facing strings (never hardcode text)
- Import translations with `useTranslations()` or `getTranslations()`

### Component Pattern

```tsx
// Client component example
"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

interface MyComponentProps {
  title: string;
  onAction: () => void;
}

export function MyComponent({ title, onAction }: MyComponentProps) {
  const t = useTranslations("namespace");
  
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Button onClick={onAction}>{t("actionLabel")}</Button>
    </div>
  );
}
```

### Styling

- Use Tailwind CSS utility classes
- Follow mobile-first responsive design (`sm:`, `md:`, `lg:` breakpoints)
- Use `cn()` utility from `@/lib/utils` for conditional classes
- Prefer Radix UI primitives via shadcn/ui components
- Keep component styling scoped and composable

### Database

- Use Prisma Client from `@/lib/db`
- Always include proper `select` or `include` for relations
- Use transactions for multi-step operations
- Add indexes for frequently queried fields

## Configuration

The main configuration file is `prompts.config.ts`:

- **branding:** Logo, name, and description
- **theme:** Colors, border radius, UI variant
- **auth:** Authentication providers array (credentials, github, google, azure)
- **i18n:** Supported locales and default locale
- **features:** Feature flags (privatePrompts, changeRequests, categories, tags, aiSearch)
- **homepage:** Homepage customization and sponsors

## Plugin System

Authentication and storage use a plugin architecture:

### Auth Plugins (`src/lib/plugins/auth/`)
- `credentials.ts` - Email/password authentication
- `github.ts` - GitHub OAuth
- `google.ts` - Google OAuth  
- `azure.ts` - Microsoft Entra ID

### Storage Plugins (`src/lib/plugins/storage/`)
- `url.ts` - URL-based media (default)
- `s3.ts` - AWS S3 storage

## Internationalization

- Translation files are in `messages/{locale}.json`
- Currently supported: en, tr, es, zh, ja, ar, pt, fr, de, ko, it
- Add new locales to `prompts.config.ts` i18n.locales array
- Create corresponding translation file in `messages/`
- Add language to selector in `src/components/layout/header.tsx`

## Key Files

| File | Purpose |
|------|---------|
| `prompts.config.ts` | Main app configuration |
| `prisma/schema.prisma` | Database schema |
| `src/lib/auth/index.ts` | NextAuth configuration |
| `src/lib/db.ts` | Prisma client singleton |
| `src/app/layout.tsx` | Root layout with providers |
| `src/components/ui/` | Base UI components (shadcn) |

## Boundaries

### Always Do
- Run `npm run lint` before committing
- Use existing UI components from `src/components/ui/`
- Add translations for all user-facing text
- Follow existing code patterns and file structure
- Use TypeScript strict types

### Ask First
- Database schema changes (require migrations)
- Adding new dependencies
- Modifying authentication flow
- Changes to `prompts.config.ts` structure

### Never Do
- Commit secrets or API keys (use `.env`)
- Modify `node_modules/` or generated files
- Delete existing translations
- Remove or weaken TypeScript types
- Hardcode user-facing strings (use i18n)

## Environment Variables

Required in `.env`:
```
DATABASE_URL=           # PostgreSQL connection string
AUTH_SECRET=            # NextAuth secret key
```

Optional OAuth (if using those providers):
```
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_AZURE_AD_CLIENT_ID=
AUTH_AZURE_AD_CLIENT_SECRET=
AUTH_AZURE_AD_ISSUER=
```

Optional features:
```
OPENAI_API_KEY=         # For AI-powered semantic search
```

## Testing

Run `npm test` (Vitest). When adding tests:
- Place tests adjacent to source files or in `__tests__/` directories
- Use descriptive test names
- Mock external services (database, OAuth)

## Cursor Cloud specific instructions

The Cloud Agent image supplies Node.js 22. This app requires Node.js 24 (`engines` in `package.json`). The environment installs Node.js 24.22.2 under `/usr/local/lib/nodejs` and puts `node`, `npm`, and `npx` first on `PATH`.

PostgreSQL 16 is installed from Ubuntu packages. `policy-rc.d` rejects `service postgresql`, so the boot script starts the cluster with `pg_ctlcluster`. The local role, password, and database are `prompts` / `prompts` / `prompts`, matching `compose.yml`.

On boot, if `.env` is missing, it is created with `DATABASE_URL` and `DIRECT_URL` aimed at `127.0.0.1:5432/prompts`, a generated `AUTH_SECRET`, and `PCHAT_AUTH_PROVIDERS=credentials` plus `PCHAT_ALLOW_REGISTRATION=true`. That local-only switch lets an agent register and sign in without GitHub, Google, or Apple OAuth apps. The committed `prompts.config.ts` is unchanged. Do not commit `.env`.

Boot then runs `npx prisma migrate deploy` and `npm run dev` on port 3000 when `http://127.0.0.1:3000/api/health` is not already healthy. Check that URL before starting another server.

`npm run db:seed` downloads the full public catalog from prompts.chat and is optional. `npm run lint` is the lint command. `npx tsc --noEmit` currently fails on existing test-file type errors; `npm test` is the check that exercises the suite.

## Common Tasks

### Adding a new page
1. Create route in `src/app/{route}/page.tsx`
2. Use server component for data fetching
3. Add translations to `messages/*.json`

### Adding a new component
1. Create in appropriate `src/components/{category}/` folder
2. Export from component file (no barrel exports needed)
3. Follow existing component patterns

### Adding a new API route
1. Create in `src/app/api/{route}/route.ts`
2. Export appropriate HTTP method handlers (GET, POST, etc.)
3. Use Zod for request validation
4. Return proper JSON responses with status codes

### Modifying database schema
1. Update `prisma/schema.prisma`
2. Run `npm run db:migrate` to create migration
3. Update related TypeScript types if needed
