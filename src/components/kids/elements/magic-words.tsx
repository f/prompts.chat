"use client";

import { useState, useCallback, useEffect, useId } from "react";
import { useTranslations } from "next-intl";
import { Check, RefreshCw, Sparkles, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLevelSlug, useSectionNavigation } from "@/components/kids/providers/level-context";
import { getComponentState, saveComponentState, markSectionCompleted } from "@/lib/kids/progress";

interface BlankConfig {
  id?: string;
  hint: string;
  answers: string[]; // Words to choose from (all are correct)
  emoji?: string;
}

interface MagicWordsProps {
  title?: string;
  sentence: string; // Use _ for blanks
  blanks: BlankConfig[];
  successMessage?: string;
}

interface SavedState {
  placements: Record<string, string>;
  submitted: boolean;
  availableWords: { word: string; blankId: string }[];
}

export function MagicWords({
  title,
  sentence,
  blanks,
  successMessage,
}: MagicWordsProps) {
  const t = useTranslations("kids.magicWords");
  const levelSlug = useLevelSlug();
  const { currentSection, markSectionComplete, registerSectionRequirement } =
    useSectionNavigation();
  const componentId = useId();
  const displayTitle = title || t("title");

  // Register that this section has an interactive element requiring completion
  useEffect(() => {
    registerSectionRequirement(currentSection);
  }, [currentSection, registerSectionRequirement]);

  const [placements, setPlacements] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [draggedWord, setDraggedWord] = useState<string | null>(null);
  const [availableWords, setAvailableWords] = useState<
    { word: string; blankId: string }[]
  >([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Generate IDs for blanks if not provided
  const blanksWithIds = blanks.map((blank, index) => ({
    ...blank,
    id: blank.id || `blank-${index}`,
  }));

  // Load saved state on mount
  useEffect(() => {
    const shuffleWords = () => {
      const words = blanksWithIds.flatMap((blank) =>
        blank.answers.map((answer) => ({ word: answer, blankId: blank.id! })),
      );
      for (let i = words.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [words[i], words[j]] = [words[j], words[i]];
      }
      return words;
    };

    if (!levelSlug) {
      setPlacements({});
      setAvailableWords(shuffleWords());
      setIsLoaded(true);
      return;
    }

    const saved = getComponentState<SavedState>(levelSlug, componentId);
    if (
      saved &&
      saved.placements &&
      saved.availableWords &&
      saved.availableWords.length > 0
    ) {
      setPlacements(saved.placements);
      setSubmitted(saved.submitted || false);
      setAvailableWords(saved.availableWords);
    } else {
      setPlacements({});
      setAvailableWords(shuffleWords());
    }
    setIsLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelSlug, componentId]);

  // Save state when it changes
  useEffect(() => {
    if (!levelSlug || !isLoaded || availableWords.length === 0) return;

    saveComponentState<SavedState>(levelSlug, componentId, {
      placements,
      submitted,
      availableWords,
    });
  }, [levelSlug, componentId, placements, submitted, availableWords, isLoaded]);

  const checkAnswer = useCallback(
    (blankId: string, value: string): boolean => {
      const blank = blanksWithIds.find((b) => b.id === blankId);
      if (!blank) return false;
      return blank.answers.some(
        (answer) => answer.toLowerCase() === value.toLowerCase(),
      );
    },
    [blanksWithIds],
  );

  // Don't render until loaded to prevent hydration mismatch
  if (!isLoaded) return null;

  const allCorrect =
    submitted &&
    blanksWithIds.every((blank) =>
      checkAnswer(blank.id, placements[blank.id] || ""),
    );
  const score = blanksWithIds.filter((blank) =>
    checkAnswer(blank.id, placements[blank.id] || ""),
  ).length;

  const usedWords = Object.values(placements);

  const handleDragStart = (word: string) => {
    setDraggedWord(word);
  };

  const handleDragEnd = () => {
    setDraggedWord(null);
  };

  const handleDrop = (blankId: string) => {
    if (draggedWord && !submitted) {
      // Remove word from previous placement if it was placed somewhere
      const newPlacements = { ...placements };
      Object.keys(newPlacements).forEach((key) => {
        if (newPlacements[key] === draggedWord) {
          delete newPlacements[key];
        }
      });
      newPlacements[blankId] = draggedWord;
      setPlacements(newPlacements);
      setDraggedWord(null);
    }
  };

  const handleClickWord = (word: string) => {
    if (submitted) return;

    // Find first empty blank
    const emptyBlank = blanksWithIds.find((blank) => !placements[blank.id]);
    if (emptyBlank) {
      // Remove word from previous placement
      const newPlacements = { ...placements };
      Object.keys(newPlacements).forEach((key) => {
        if (newPlacements[key] === word) {
          delete newPlacements[key];
        }
      });
      newPlacements[emptyBlank.id] = word;
      setPlacements(newPlacements);
    }
  };

  const handleClickBlank = (blankId: string) => {
    if (submitted) return;
    // Remove word from this blank
    const newPlacements = { ...placements };
    delete newPlacements[blankId];
    setPlacements(newPlacements);
  };


const handleSubmit = () => {
  setSubmitted(true);

  // FIX: Every blank must contain a valid answer.
  const allCorrect = blanksWithIds.every((blank) =>
    checkAnswer(blank.id, placements[blank.id] ?? ""),
  );

  if (allCorrect && levelSlug) {
    markSectionCompleted(levelSlug, currentSection);
    markSectionComplete(currentSection);
  }
};


  const handleReset = () => {
    setPlacements({});
    setSubmitted(false);
  };

  // Parse sentence and render with drop zones
  const renderSentence = () => {
    // Split by underscore placeholders OR {{placeholder}} syntax
    const parts = sentence.split(/(_+|\{\{[^}]+\}\})/g);
    let blankIndex = 0;

    return parts.map((part, index) => {
      // Check if this is a blank placeholder (underscores or {{...}})
      if (/^_+$/.test(part) || /^\{\{[^}]+\}\}$/.test(part)) {
        const blank = blanksWithIds[blankIndex];
        if (!blank) return <span key={index}>{part}</span>;

        const blankId = blank.id;
        const placedWord = placements[blankId];
        const isCorrect = submitted && checkAnswer(blankId, placedWord || "");
        const isWrong = submitted && !isCorrect;

        blankIndex++;

        return (
          <span
            key={index}
            className="inline-flex items-center gap-1 mx-1 my-1"
          >
            <span
              onClick={() => placedWord && handleClickBlank(blankId)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(blankId)}
              className={cn(
                "px-3 py-2 border-2 border-dashed rounded-lg min-w-[100px] text-xl text-center font-medium transition-all cursor-pointer text-[#2C1810]",
                !placedWord && "bg-white border-purple-400",
                placedWord &&
                  !submitted &&
                  "bg-purple-100 border-purple-500 border-solid",
                isCorrect && "border-green-500 border-solid bg-green-50",
                isWrong && "border-red-400 border-solid bg-red-50",
                draggedWord &&
                  !placedWord &&
                  "border-purple-500 bg-purple-50 scale-105",
              )}
              title={blank.hint}
            >
              {placedWord || blank.hint}
            </span>
            {submitted && isCorrect && (
              <Check className="h-6 w-6 text-green-500" />
            )}
          </span>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  return (
    <div className="my-4 pixel-panel pixel-panel-purple overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-100 to-pink-100 border-b-2 border-purple-200">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-purple-500" />
          <span className="font-bold text-2xl text-[#2C1810]">
            {displayTitle}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Sentence with blanks */}
        <div
          className="text-xl leading-relaxed p-4 bg-purple-50 flex flex-wrap items-center text-[#2C1810]"
          style={{
            clipPath:
              "polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)",
          }}
        >
          {renderSentence()}
        </div>

        {/* Word bank */}
        <div
          className="p-4 bg-purple-100"
          style={{
            clipPath:
              "polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)",
          }}
        >
          <p className="text-lg font-medium text-purple-700 mb-3 m-0">
            {t("dragOrTap")}
          </p>
          <div className="flex flex-wrap gap-2">
            {availableWords.map(({ word }, index) => {
              const isUsed = usedWords.includes(word);
              return (
                <button
                  key={`${word}-${index}`}
                  draggable={!submitted && !isUsed}
                  onDragStart={() => handleDragStart(word)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={() =>
                    !isUsed && !submitted && handleDragStart(word)
                  }
                  onTouchEnd={() => handleDragEnd()}
                  onClick={() => !isUsed && handleClickWord(word)}
                  disabled={submitted || isUsed}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3 border-2 text-xl font-medium transition-all text-[#2C1810]",
                    !isUsed &&
                      !submitted &&
                      "bg-white border-purple-300 hover:border-purple-500 hover:shadow-md cursor-grab active:cursor-grabbing",
                    isUsed &&
                      "bg-gray-100 border-gray-300 text-gray-400 opacity-50 cursor-not-allowed",
                    submitted && "cursor-default",
                  )}
                  style={{
                    clipPath:
                      "polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)",
                  }}
                >
                  {!submitted && !isUsed && (
                    <GripVertical className="h-5 w-5 text-purple-400" />
                  )}
                  {word}
                </button>
              );
            })}
          </div>
        </div>

        {/* Result */}
        {submitted && (
          <div
            className={cn(
              "p-4 text-center",
              allCorrect
                ? "bg-green-100 border-2 border-green-300"
                : "bg-amber-100 border-2 border-amber-300",
            )}
            style={{
              clipPath:
                "polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px)",
            }}
          >
            {allCorrect ? (
              <p className="font-bold text-xl m-0 text-green-800">
                🎉 {successMessage || "Amazing!"}
              </p>
            ) : (
              <p className="font-bold text-lg m-0 text-amber-800">
                {score} / {blanksWithIds.length} {t("correct")}! {t("tryAgain")}
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {!submitted ? (
            <Button
              onClick={handleSubmit}
              className="rounded-full h-12 text-xl px-6"
              disabled={Object.keys(placements).length < blanksWithIds.length}
            >
              <Check className="h-5 w-5 mr-2" />
              {t("check")}
            </Button>
          ) : !allCorrect ? (
            <Button
              onClick={handleReset}
              variant="outline"
              className="rounded-full h-12 text-xl px-6"
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              {t("retry")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
