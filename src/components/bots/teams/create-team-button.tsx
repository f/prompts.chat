import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Floating "Create team" link; signed-out visitors are sent to log in first */
export function CreateTeamButton({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = useTranslations("bots.teams");
  return (
    <Button size="lg" className="fixed bottom-6 right-6 z-40 h-12 rounded-full px-5 shadow-lg" asChild>
      <Link href={isLoggedIn ? "/bots/teams/new" : "/login"} title={isLoggedIn ? undefined : t("loginToCreate")}>
        {isLoggedIn ? <Plus className="h-5 w-5" /> : <Users className="h-5 w-5" />}
        {t("create")}
      </Link>
    </Button>
  );
}
