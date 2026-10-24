-- Security consistency: the Composition Engine tables were created after the
-- RLS hardening migration, so enable RLS deny-by-default on them too (no anon
-- grants exist on them thanks to the default-privileges revoke). App is
-- pure-Prisma on the bypass `postgres` role, so this does not affect it.
ALTER TABLE "compositions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "stages" ENABLE ROW LEVEL SECURITY;
