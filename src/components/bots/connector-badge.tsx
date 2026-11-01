import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getConnectorRegistryEntry } from "@/lib/connectors/registry";
import { cn } from "@/lib/utils";

interface ConnectorBadgeProps {
  connector: string;
  className?: string;
}

/** A bot connector; links to its MCP Registry entry when the connector is mapped */
export function ConnectorBadge({ connector, className }: ConnectorBadgeProps) {
  const t = useTranslations("bots");
  const entry = getConnectorRegistryEntry(connector);
  const classes = cn("max-w-full whitespace-normal wrap-anywhere", className);

  if (!entry) {
    return <Badge variant="outline" className={classes}>{connector}</Badge>;
  }
  return (
    <Badge variant="outline" className={cn(classes, "hover:bg-accent hover:text-accent-foreground")} asChild>
      <a
        href={entry.registryUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={t("connectorRegistryLink", { name: connector })}
        aria-label={t("connectorRegistryLink", { name: connector })}
      >
        {connector}
        <ExternalLink aria-hidden="true" />
      </a>
    </Badge>
  );
}
