import Link from "next/link";
import { ArrowRight, Mic, Monitor, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { WidgetPlugin } from "./types";

function TextreamWidget() {
  return (
    <div className="group border rounded-[var(--radius)] overflow-hidden hover:border-foreground/20 transition-colors bg-gradient-to-b from-zinc-100 to-zinc-50 dark:from-zinc-900 dark:to-zinc-950">
      <style>{`
        @keyframes textreamWord {
          0%, 100% { color: rgba(255,255,255,0.35); }
          15%, 35% { color: rgba(255,255,255,1); text-shadow: 0 0 12px rgba(168,85,247,0.6); }
        }
        @keyframes textreamWave {
          0%, 100% { transform: scaleY(0.3); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      
      <div className="flex flex-col items-center">
        {/* Notch - flush to top */}
        <Link href="https://textream.net" className="block w-full">
          <div className="flex justify-center pt-0">
            <div 
              className="relative bg-black rounded-b-[22px] px-6 py-3 min-w-[200px] hover:pb-4 transition-all duration-300 shadow-lg"
            >
              {/* Camera dot */}
              <div className="absolute right-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-zinc-800 border border-zinc-700">
                <div className="absolute inset-0.5 rounded-full bg-zinc-900" />
              </div>
              
              {/* Text with word highlighting */}
              <div className="pr-5 flex flex-col items-center gap-1.5">
                <p className="text-[13px] font-medium tracking-tight whitespace-nowrap">
                  <span style={{ animation: "textreamWord 2.5s ease-in-out infinite" }} className="text-white/35">Your </span>
                  <span style={{ animation: "textreamWord 2.5s ease-in-out 0.5s infinite" }} className="text-white/35">script </span>
                  <span style={{ animation: "textreamWord 2.5s ease-in-out 1s infinite" }} className="text-white/35">highlights </span>
                  <span style={{ animation: "textreamWord 2.5s ease-in-out 1.5s infinite" }} className="text-white/35">as </span>
                  <span style={{ animation: "textreamWord 2.5s ease-in-out 2s infinite" }} className="text-white/35">you speak</span>
                </p>
                
                {/* Waveform */}
                <div className="flex items-center justify-center gap-[3px] h-3">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                    <div
                      key={i}
                      className="w-[3px] h-3 bg-violet-400 rounded-full origin-center"
                      style={{
                        animation: `textreamWave 0.6s ease-in-out ${i * 0.08}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Link>

        {/* Content */}
        <div className="w-full text-center px-5 pb-5 pt-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Mic className="h-4 w-4 text-violet-500" />
            <span className="text-xs font-medium text-violet-500">Free & Open Source</span>
          </div>
          <h3 className="font-semibold text-base mb-1.5">
            Textream
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            macOS teleprompter with real-time word tracking. Perfect for streamers & presenters.
          </p>
          
          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-1.5 mb-4">
            {[
              { icon: Mic, label: "Word Tracking" },
              { icon: Monitor, label: "Dynamic Island" },
              { icon: Sparkles, label: "100% Private" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground"
              >
                <Icon className="h-2.5 w-2.5" />
                {label}
              </span>
            ))}
          </div>
          
          <Button asChild size="sm" className="w-full bg-violet-600 hover:bg-violet-700">
            <Link href="https://textream.net">
              Download Free
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export const textreamWidget: WidgetPlugin = {
  id: "textream",
  name: "Textream",
  prompts: [
    {
      id: "textream-promo",
      slug: "textream-teleprompter",
      title: "Textream — macOS Teleprompter",
      description: "Free, open-source macOS teleprompter with real-time word tracking and Dynamic Island overlay.",
      content: "",
      type: "TEXT",
      tags: ["Productivity", "macOS", "Streaming", "Open Source"],
      category: "Productivity",
      actionUrl: "https://textream.net",
      actionLabel: "Download Free",
      positioning: {
        position: 6,
        mode: "repeat",
        repeatEvery: 45,
        maxCount: 3,
      },
      shouldInject: (context) => {
        const { filters } = context;
        
        // Don't inject on the skills or tastes pages
        if (filters?.type === "SKILL" || filters?.type === "TASTE") {
          return false;
        }
        
        // Show when no filters active
        if (!filters?.q && !filters?.category && !filters?.tag) {
          return true;
        }
        
        // Show for relevant search queries
        const query = filters?.q?.toLowerCase() || "";
        if (["stream", "present", "speak", "script", "teleprompt", "video", "record"].some(kw => query.includes(kw))) {
          return true;
        }
        
        // Show for relevant categories
        const slug = filters?.categorySlug?.toLowerCase() || "";
        if (["product", "content", "video", "stream", "present"].some(kw => slug.includes(kw))) {
          return true;
        }
        
        return false;
      },
      render: () => <TextreamWidget />,
    },
  ],
};
