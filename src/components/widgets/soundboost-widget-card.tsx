"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, AudioWaveform, Clapperboard, MicVocal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyticsWidget } from "@/lib/analytics";
import { SOUNDBOOST_URL } from "@/lib/plugins/widgets/soundboost-links";

/**
 * Stills from music videos made with SoundBoost: opening shots of its best-performing ads, scenes from films by
 * Marco Caprelli and Nic Radd, and showcase films. The screen cuts to the next one every two beats.
 */
const FRAMES = [
  "prey-for-me",
  "somebody-to-love",
  "marco-caprelli",
  "woke-up-dead",
  "nic-radd",
  "doppelbangin",
  "underworld",
  "heartbreak",
  "one-tune-forever",
  "love-is-a-joke",
].map((name) => `/sponsors/soundboost/${name}.webp`);
/** One beat at 90 BPM */
const BEAT_SECONDS = 60 / 90;
const SHOT_SECONDS = BEAT_SECONDS * 2;
const LOOP_SECONDS = SHOT_SECONDS * FRAMES.length;
/** Share of the loop each still stays on screen, in percent */
const SHOT_SHARE = 100 / FRAMES.length;

/** Waveform bars per beat; the screen cuts on every second beat */
const BARS_PER_BEAT = 3;
const BARS_PER_SHOT = BARS_PER_BEAT * 2;
/** Fixed bar heights (percent): a kick on each beat that decays until the next one */
const WAVEFORM = Array.from({ length: BARS_PER_SHOT * FRAMES.length }, (_, index) => {
  const decay = [1, 0.56, 0.34][index % BARS_PER_BEAT];
  const variation = 0.78 + 0.22 * Math.abs(Math.sin(index * 2.3));
  return { height: Math.round(Math.max(decay * variation, 0.18) * 100), cut: index % BARS_PER_SHOT === 0 };
});

const FEATURES = [
  { key: "beat", icon: AudioWaveform },
  { key: "lipSync", icon: MicVocal },
  { key: "fullLength", icon: Clapperboard },
] as const;

interface SoundboostWidgetCardProps {
  widgetId: string;
}

function Waveform({ className }: { className: string }) {
  return (
    <div className="absolute inset-0 flex items-center gap-[2px]">
      {WAVEFORM.map(({ height, cut }, index) => (
        <span
          key={index}
          className={`flex-1 rounded-full ${cut ? "bg-[#00ce93]" : className}`}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

export function SoundboostWidgetCard({ widgetId }: SoundboostWidgetCardProps) {
  const t = useTranslations("widgets");
  const handleScreenClick = () => analyticsWidget.click(widgetId, "SoundBoost");
  const handleActionClick = () => analyticsWidget.action(widgetId, "Try a free storyboard", SOUNDBOOST_URL);

  return (
    <div
      data-testid="soundboost-widget"
      className="sb-widget group border rounded-[var(--radius)] overflow-hidden hover:border-foreground/20 transition-colors flex flex-col"
      style={{ "--sb-loop": `${LOOP_SECONDS}s`, "--sb-beat": `${BEAT_SECONDS}s` } as CSSProperties}
    >
      <style>{`
        @keyframes sbShot {
          0% { opacity: 1; transform: scale(1); }
          ${SHOT_SHARE.toFixed(3)}% { opacity: 1; transform: scale(1.05); }
          ${(SHOT_SHARE + 0.001).toFixed(3)}%, 100% { opacity: 0; transform: scale(1.05); }
        }
        @keyframes sbPlayed {
          from { clip-path: inset(0 100% 0 0); }
          to { clip-path: inset(0 0 0 0); }
        }
        @keyframes sbPlayhead {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @keyframes sbBeat {
          0% { transform: scaleY(1.08); }
          100% { transform: scaleY(0.92); }
        }
        @keyframes sbTally {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        .sb-shot { opacity: 0; animation: sbShot var(--sb-loop) linear infinite; }
        .sb-played { animation: sbPlayed var(--sb-loop) linear infinite; }
        .sb-playhead { animation: sbPlayhead var(--sb-loop) linear infinite; }
        .sb-beat { animation: sbBeat var(--sb-beat) cubic-bezier(.2, .7, .3, 1) infinite; }
        .sb-tally { animation: sbTally calc(var(--sb-beat) * 2) ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .sb-shot, .sb-played, .sb-playhead, .sb-beat, .sb-tally { animation: none; }
          .sb-shot[data-shot="0"] { opacity: 1; }
          .sb-played { clip-path: inset(0 50% 0 0); }
          .sb-playhead { transform: translateX(-50%); }
        }
      `}</style>

      {/* Screen: stills from SoundBoost films, cut on the beat of the timeline below */}
      <Link
        href={SOUNDBOOST_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleScreenClick}
        aria-label={`SoundBoost — ${t("soundboost.label")}`}
        className="relative block aspect-video overflow-hidden bg-muted"
      >
        {FRAMES.map((src, index) => (
          <div
            key={src}
            data-shot={index}
            aria-hidden="true"
            className="sb-shot absolute inset-0"
            style={{ animationDelay: `${-((FRAMES.length - index) % FRAMES.length) * SHOT_SECONDS}s` }}
          >
            <Image
              src={src}
              alt=""
              fill
              sizes="(min-width: 1280px) 30vw, (min-width: 768px) 45vw, 100vw"
              className="object-cover"
            />
          </div>
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-background from-[8%] via-background/30 to-transparent pointer-events-none" />

        {/* Timeline: the screen cuts on the green beats */}
        <div aria-hidden="true" className="absolute inset-x-4 bottom-2 h-6">
          <div className="sb-beat absolute inset-0">
            <Waveform className="bg-foreground/20" />
            <div className="sb-played absolute inset-0">
              <Waveform className="bg-foreground/75" />
            </div>
          </div>
          <div className="sb-playhead absolute inset-0">
            <span className="absolute -top-1 -bottom-1 right-0 w-px bg-foreground" />
          </div>
        </div>
      </Link>

      {/* Content */}
      <div className="w-full text-center px-5 pb-5 pt-3">
        <div className="flex items-center justify-center gap-2 mb-2.5">
          <span className="sb-tally h-1.5 w-1.5 rounded-full bg-[#00ce93]" />
          <span className="text-xs font-medium text-muted-foreground">{t("soundboost.label")}</span>
        </div>
        <h3 className="mb-2 flex justify-center">
          <Link
            href={SOUNDBOOST_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleScreenClick}
            className="hover:opacity-80 transition-opacity"
          >
            <Image
              src="/sponsors/soundboost.svg"
              alt="SoundBoost"
              width={157}
              height={29}
              className="h-[22px] w-auto dark:hidden"
            />
            <Image
              src="/sponsors/soundboost-dark.svg"
              alt="SoundBoost"
              width={157}
              height={29}
              className="h-[22px] w-auto hidden dark:block"
            />
          </Link>
        </h3>
        <p className="text-xs text-muted-foreground text-balance mb-3">{t("soundboost.description")}</p>

        <ul className="flex flex-wrap justify-center gap-1.5 mb-4">
          {FEATURES.map(({ key, icon: Icon }) => (
            <li
              key={key}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground"
            >
              <Icon className="h-2.5 w-2.5" />
              {t(`soundboost.features.${key}`)}
            </li>
          ))}
        </ul>

        <Button
          asChild
          size="sm"
          className="w-full bg-[#141417] text-white hover:bg-[#141417]/90 dark:bg-[#e9e8e5] dark:text-[#141417] dark:hover:bg-[#f2f1ee]"
        >
          <Link href={SOUNDBOOST_URL} target="_blank" rel="noopener noreferrer" onClick={handleActionClick}>
            {t("soundboost.cta")}
            <ArrowRight className="ml-2 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
