import type { MDXComponents } from "mdx/types";
import type { ComponentPropsWithoutRef } from "react";
import { HarnessDemo } from "@/components/book/elements/harness-demo";
import { ToolsDemo } from "@/components/book/elements/tools-demo";
import { BeforeAfterEditor, BookPartsNav, BREAKFramework, Callout, ChainErrorDemo, ChainExample, ChainFlowDemo, Checklist, CodeEditor, Collapsible, Compare, ContentPipelineDemo, ContextPlayground, ContextWindowDemo, CostCalculatorDemo, CRISPEFramework, DiffView, EmbeddingsDemo, FallbackDemo, FewShotDemo, FillInTheBlank, IconCheck, IconClipboard, IconLightbulb, IconLock, IconSettings, IconStar, IconTarget, IconUser, IconX, InfoGrid, InteractiveChecklist, IterativeRefinementDemo, JailbreakDemo, JsonYamlDemo, LLMCapabilitiesDemo, LoopEngineeringLab, NavButton, NavFooter, PrinciplesSummary, PromptAnalyzer, PromptBreakdown, PromptBuilder, PromptChallenge, PromptDebugger, Quiz, RTFFramework, SpecificitySpectrum, StructuredOutputDemo, SummarizationDemo, TemperatureDemo, TextToImageDemo, TextToVideoDemo, TokenizerDemo, TokenPredictionDemo, TryIt, ValidationDemo, VersionDiff } from "@/components/book/interactive";
import { PromiCharacter, PromiWithMessage, Panel, StoryScene, PromptVsMistake, MagicWords, DragDropPrompt, LevelComplete, Section, PromptParts, ExampleMatcher, PromptDoctor, StepByStep, PromptLab, WordPredictor } from "@/components/kids/elements";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    table: ({ ref: _ref, ...props }: ComponentPropsWithoutRef<"table"> & { ref?: unknown }) => (
      <div className="my-6 w-full overflow-x-auto">
        <table className="w-full border-collapse text-sm" {...props} />
      </div>
    ),
    thead: ({ ref: _ref, ...props }: ComponentPropsWithoutRef<"thead"> & { ref?: unknown }) => (
      <thead className="bg-muted/50" {...props} />
    ),
    tbody: ({ ref: _ref, ...props }: ComponentPropsWithoutRef<"tbody"> & { ref?: unknown }) => (
      <tbody {...props} />
    ),
    th: ({ ref: _ref, ...props }: ComponentPropsWithoutRef<"th"> & { ref?: unknown }) => (
      <th className="border border-border px-4 py-2 text-start font-semibold" {...props} />
    ),
    td: ({ ref: _ref, ...props }: ComponentPropsWithoutRef<"td"> & { ref?: unknown }) => (
      <td className="border border-border px-4 py-2" {...props} />
    ),
    tr: ({ ref: _ref, ...props }: ComponentPropsWithoutRef<"tr"> & { ref?: unknown }) => (
      <tr className="even:bg-muted/30" {...props} />
    ),
    BeforeAfterEditor,
    BookPartsNav,
    BREAKFramework,
    Callout,
    ChainErrorDemo,
    ChainExample,
    ChainFlowDemo,
    Checklist,
    CodeEditor,
    Collapsible,
    Compare,
    ContentPipelineDemo,
    ContextPlayground,
    ContextWindowDemo,
    CostCalculatorDemo,
    CRISPEFramework,
    DiffView,
    EmbeddingsDemo,
    FallbackDemo,
    FewShotDemo,
    FillInTheBlank,
    HarnessDemo,
    ToolsDemo,
    IconCheck,
    IconClipboard,
    IconLightbulb,
    IconLock,
    IconSettings,
    IconStar,
    IconTarget,
    IconUser,
    IconX,
    InfoGrid,
    InteractiveChecklist,
    IterativeRefinementDemo,
    JailbreakDemo,
    JsonYamlDemo,
    LLMCapabilitiesDemo,
    LoopEngineeringLab,
    NavButton,
    NavFooter,
    PrinciplesSummary,
    PromptAnalyzer,
    PromptBreakdown,
    PromptBuilder,
    PromptChallenge,
    PromptDebugger,
    Quiz,
    RTFFramework,
    SpecificitySpectrum,
    StructuredOutputDemo,
    SummarizationDemo,
    TemperatureDemo,
    TextToImageDemo,
    TextToVideoDemo,
    TokenizerDemo,
    TokenPredictionDemo,
    TryIt,
    ValidationDemo,
    VersionDiff,
    // Kids components
    PromiCharacter,
    PromiWithMessage,
    Panel,
    StoryScene,
    PromptVsMistake,
    MagicWords,
    DragDropPrompt,
    LevelComplete,
    Section,
    PromptParts,
    ExampleMatcher,
    PromptDoctor,
    StepByStep,
    PromptLab,
    WordPredictor,
  };
}
