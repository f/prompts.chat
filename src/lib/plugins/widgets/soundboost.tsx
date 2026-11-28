import { SoundboostWidgetCard } from "@/components/widgets/soundboost-widget-card";
import { SOUNDBOOST_URL } from "./soundboost-links";
import type { WidgetPlugin } from "./types";

const WIDGET_ID = "soundboost-music-video";

export const soundboostWidget: WidgetPlugin = {
  id: "soundboost",
  name: "SoundBoost",
  prompts: [
    {
      id: WIDGET_ID,
      slug: "soundboost-music-video-generator",
      title: "SoundBoost — AI Music Video Generator",
      description: "Upload your song and get a music video made for it: cut to the beat, with lip sync, full length.",
      content: "",
      type: "TEXT",
      sponsor: {
        name: "SoundBoost",
        logo: "/sponsors/soundboost.svg",
        logoDark: "/sponsors/soundboost-dark.svg",
        url: SOUNDBOOST_URL,
      },
      tags: ["Music Video", "Video Generation", "Music"],
      category: "Video Generation",
      actionUrl: SOUNDBOOST_URL,
      actionLabel: "Try a free storyboard",
      // The third card of the video generation category
      positioning: {
        position: 2,
        mode: "once",
      },
      shouldInject: ({ filters }) => {
        if (filters?.type === "SKILL" || filters?.type === "TASTE") {
          return false;
        }
        return filters?.categorySlug === "video-generation";
      },
      render: (instanceIndex) => (
        <SoundboostWidgetCard widgetId={instanceIndex > 0 ? `${WIDGET_ID}-${instanceIndex}` : WIDGET_ID} />
      ),
    },
  ],
};
