import { SpacefastWidgetCard } from "@/components/widgets/spacefast-widget-card";
import { SPACEFAST_MCP_REGISTRY_URL, SPACEFAST_URL } from "./spacefast-links";
import type { WidgetPlugin } from "./types";

const WIDGET_ID = "spacefast-bots-publish";

export const spacefastWidget: WidgetPlugin = {
  id: "spacefast",
  name: "Spacefast",
  prompts: [
    {
      id: WIDGET_ID,
      slug: "spacefast-bots-publish",
      title: "Spacefast — Bots that answer with a live link",
      description:
        "Add the Spacefast MCP connector and your bots publish sites, reports and dashboards. Private by default, same link every time they republish.",
      content: "",
      type: "TEXT",
      sponsor: {
        name: "Spacefast",
        logo: "/sponsors/spacefast.svg",
        url: SPACEFAST_URL,
      },
      tags: ["MCP", "Bots", "Hosting"],
      category: "Development",
      actionUrl: SPACEFAST_MCP_REGISTRY_URL,
      actionLabel: "Add MCP connector",
      placements: ["bots", "teams"],
      positioning: {
        position: 4,
        mode: "repeat",
        repeatEvery: 48,
        maxCount: 3,
      },
      shouldInject: ({ filters }) => {
        if (!filters?.q && !filters?.category && !filters?.tag) {
          return true;
        }
        const query = filters?.q?.toLowerCase() ?? "";
        return ["publish", "site", "report", "dashboard", "deploy", "host", "web"].some((keyword) => query.includes(keyword));
      },
      render: (instanceIndex, placement) => (
        <SpacefastWidgetCard
          widgetId={instanceIndex > 0 ? `${WIDGET_ID}-${instanceIndex}` : WIDGET_ID}
          placement={placement}
        />
      ),
    },
  ],
};
