-- Security fix: close the Supabase Data API (PostgREST) exposure on public tables.
--
-- Investigation (RLS review) proved that anon/authenticated held full DML grants on
-- every public table while RLS was disabled, making users.password, accounts OAuth
-- tokens, verification_tokens, etc. readable AND writable via the public anon key
-- over HTTPS. Empirically confirmed: anon GET on /rest/v1/users returned 200 with a
-- password hash.
--
-- The application is pure-Prisma and connects as the bypass role `postgres`
-- (rolbypassrls = true); it does NOT use the Supabase Data API (no @supabase/* dep,
-- no anon key usage). Therefore revoking these grants and enabling RLS does not
-- affect the app.
--
-- 1) Revoke all Data-API grants from anon/authenticated on every public table.
-- 2) Enable RLS deny-by-default (no permissive policies) as defense-in-depth.
-- 3) Reverse the postgres default privileges so FUTURE postgres-created tables do
--    not auto-grant anon/authenticated (prevents silent regression).
--
-- NOTE: the supabase_admin default privileges are intentionally left as Supabase
-- manages them; they govern Supabase-internal table creation, not app tables.

-- 1) Revoke existing grants on all 26 public tables
REVOKE ALL PRIVILEGES ON TABLE
  "_PromptContributors", "_prisma_migrations", "accounts", "categories",
  "category_subscriptions", "change_requests", "collections", "comment_votes",
  "comments", "execution_records", "notifications", "organizations", "pinned_prompts",
  "prompt_connections", "prompt_reports", "prompt_tags", "prompt_versions",
  "prompt_votes", "prompts", "sessions", "stage_traces", "tags",
  "user_prompt_examples", "users", "verification_tokens", "webhook_configs"
  FROM anon, authenticated;

-- 2) Enable RLS deny-by-default on all 26 public tables
ALTER TABLE "_PromptContributors" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "category_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "change_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "collections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comment_votes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "execution_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pinned_prompts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prompt_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prompt_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prompt_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prompt_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prompt_votes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prompts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stage_traces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_prompt_examples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_configs" ENABLE ROW LEVEL SECURITY;

-- 3) Prevent future postgres-created tables from auto-granting anon/authenticated
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
