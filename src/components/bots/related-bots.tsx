import { useTranslations } from "next-intl";
import { BotCard, type BotCardData } from "@/components/bots/bot-card";

interface RelatedBotsProps {
  bots: BotCardData[];
}

export function RelatedBots({ bots }: RelatedBotsProps) {
  const t = useTranslations("prompts");

  if (bots.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">{t("relatedBots")}</h2>
      </div>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        {bots.map((bot) => (
          <BotCard key={bot.id} bot={bot} />
        ))}
      </div>
    </section>
  );
}
