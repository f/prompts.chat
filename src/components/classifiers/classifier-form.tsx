"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Braces,
  Check,
  CircleHelp,
  ClipboardCheck,
  FileText,
  FlaskConical,
  Loader2,
  Plus,
  Split,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CLASSIFIER_CATEGORIES,
  formatClassifierDefinition,
  validateClassifierDefinition,
  type ClassifierCategoryId,
  type OutcomeTone,
  type QuestionType,
} from "@/lib/classifiers";
import { CLASSIFIER_LIMITS as L, classifierConfigSchema, classifierSummarySchema, classifierTitleSchema, definitionFromConfig } from "@/lib/classifiers/schema";
import type { ClassifierFields } from "@/lib/classifiers/change-snapshot";
import { getClassifierUrl } from "@/lib/urls";
import { cn } from "@/lib/utils";
import { QUESTION_TYPE_ICONS } from "./classifier-styles";

const C = classifierConfigSchema.shape;
const QUESTION_TYPES: QuestionType[] = ["choice", "score", "noul"];
const TONES: OutcomeTone[] = ["proceed", "caution", "review", "stop"];

const formSchema = z.object({
  title: classifierTitleSchema,
  description: classifierSummarySchema,
  category: C.category,
  problem: C.problem,
  goal: C.goal,
  inputSummary: C.input.shape.summary,
  inputFields: C.input.shape.fields,
  questionType: C.question.shape.type,
  questionKey: C.question.shape.key,
  instructions: C.question.shape.instructions,
  options: C.question.shape.options,
  outcomes: C.outcomes,
  guidance: z.string().max(L.guidance * (L.listItem + 1)),
  caveats: z.string().max(L.caveats * (L.listItem + 1)),
  tags: z.string().max(L.tags * (L.tag + 2)),
  scenarios: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().trim().min(1).max(L.scenarioTitle),
        state: z.string().trim().min(1).max(L.stateChars),
        outcome: z.string().trim().min(1),
        rationale: z.string().trim().min(1).max(L.listItem),
        adaptedFrom: z.string().optional(),
      })
    )
    .min(1)
    .max(L.scenarios),
  references: z.array(z.string()),
  isPrivate: z.boolean(),
  reason: z.string().trim().max(2000),
});

export type ClassifierFormValues = z.infer<typeof formSchema>;

const STEPS: { id: string; icon: LucideIcon; fields: FieldPath<ClassifierFormValues>[] }[] = [
  { id: "basics", icon: FileText, fields: ["title", "description", "category", "problem", "goal"] },
  { id: "input", icon: Braces, fields: ["inputSummary", "inputFields"] },
  { id: "question", icon: CircleHelp, fields: ["questionType", "questionKey", "instructions", "options"] },
  { id: "outcomes", icon: Split, fields: ["outcomes", "guidance", "caveats"] },
  { id: "scenarios", icon: FlaskConical, fields: ["scenarios", "tags"] },
  { id: "review", icon: ClipboardCheck, fields: [] },
];

function kebab(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function lines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** A scenario state: a JSON object when the text is one, otherwise the text itself */
function parseState(text: string): string | Record<string, unknown> {
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const value = JSON.parse(trimmed);
      if (value && typeof value === "object" && !Array.isArray(value)) return value;
    } catch {
      // Not JSON: keep it as text
    }
  }
  return trimmed;
}

function optionsFor(type: QuestionType, current: { key: string; description: string }[]) {
  if (type === "noul") {
    return ["true", "false"].map((key, i) => ({ key, description: current[i]?.description ?? "" }));
  }
  const options = current.length >= 2 ? current : [...current, ...Array.from({ length: 2 - current.length }, () => ({ key: "", description: "" }))];
  if (type === "score") return options.map((o, i) => ({ ...o, key: String(i) }));
  return options.map((o) => ({ ...o, key: /^\d+$|^true$|^false$/.test(o.key) ? "" : o.key }));
}

/** The structured fields a form submits, exactly as the API validates them */
function fieldsFromForm(values: ClassifierFormValues): ClassifierFields {
  const usedIds = new Set<string>();
  const scenarios = values.scenarios.map((s, index) => {
    let id = s.id || kebab(s.title) || `scenario-${index + 1}`;
    while (usedIds.has(id)) id = `${id}-${index + 1}`;
    usedIds.add(id);
    return {
      id,
      title: s.title.trim(),
      state: parseState(s.state),
      outcome: s.outcome,
      rationale: s.rationale.trim(),
      ...(s.adaptedFrom && { adaptedFrom: s.adaptedFrom }),
    };
  });
  const caveats = lines(values.caveats);
  return {
    description: values.description.trim(),
    config: {
      category: values.category,
      problem: values.problem.trim(),
      goal: values.goal.trim(),
      input: { summary: values.inputSummary.trim(), fields: values.inputFields },
      question: { key: values.questionKey.trim(), type: values.questionType, instructions: values.instructions.trim(), options: values.options },
      outcomes: values.outcomes,
      guidance: lines(values.guidance),
      ...(caveats.length > 0 && { caveats }),
      scenarios: scenarios as ClassifierFields["config"]["scenarios"],
      references: values.references,
      tags: values.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    },
  };
}

function formValuesFromFields(title: string, fields: ClassifierFields, isPrivate: boolean): ClassifierFormValues {
  const { config } = fields;
  return {
    title,
    description: fields.description,
    category: config.category,
    problem: config.problem,
    goal: config.goal,
    inputSummary: config.input.summary,
    inputFields: config.input.fields,
    questionType: config.question.type,
    questionKey: config.question.key,
    instructions: config.question.instructions,
    options: config.question.options,
    outcomes: config.outcomes,
    guidance: config.guidance.join("\n"),
    caveats: (config.caveats ?? []).join("\n"),
    tags: config.tags.join(", "),
    scenarios: config.scenarios.map((s) => ({
      id: s.id,
      title: s.title,
      state: typeof s.state === "string" ? s.state : JSON.stringify(s.state, null, 2),
      outcome: s.outcome,
      rationale: s.rationale,
      adaptedFrom: s.adaptedFrom,
    })),
    references: config.references,
    isPrivate,
    reason: "",
  };
}

interface ClassifierFormProps {
  mode: "create" | "edit" | "propose";
  /** Prompt id of the classifier being edited or proposed against */
  promptId?: string;
  classifierSlug?: string;
  /** The classifier being edited or proposed against */
  initial?: { title: string; fields: ClassifierFields; isPrivate: boolean };
  /** Ids of known sources, for the same checks as the server */
  sourceIds: string[];
}

export function ClassifierForm({ mode, promptId, classifierSlug, initial, sourceIds }: ClassifierFormProps) {
  const t = useTranslations("classifiers.form");
  const tClassifiers = useTranslations("classifiers");
  const tPrompts = useTranslations("prompts");
  const tChanges = useTranslations("changeRequests");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const isProposal = mode === "propose";
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(mode === "create" ? 0 : STEPS.length - 1);
  const [isLoading, setIsLoading] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  const form = useForm<ClassifierFormValues>({
    resolver: zodResolver(formSchema),
    mode: "onTouched",
    defaultValues: initial ? formValuesFromFields(initial.title, initial.fields, initial.isPrivate) : {
      title: "",
      description: "",
      category: "support" as ClassifierCategoryId,
      problem: "",
      goal: "",
      inputSummary: "",
      inputFields: [{ name: "", description: "" }],
      questionType: "choice",
      questionKey: "",
      instructions: "",
      options: [
        { key: "", description: "" },
        { key: "", description: "" },
      ],
      outcomes: [{ id: "needs_review", label: t("defaultReviewLabel"), when: t("defaultReviewWhen"), tone: "review" }],
      guidance: "",
      caveats: "",
      tags: "",
      scenarios: [{ id: "", title: "", state: "", outcome: "", rationale: "" }],
      references: [],
      isPrivate: false,
      reason: "",
    },
  });

  const inputFields = useFieldArray({ control: form.control, name: "inputFields" });
  const options = useFieldArray({ control: form.control, name: "options" });
  const outcomes = useFieldArray({ control: form.control, name: "outcomes" });
  const scenarios = useFieldArray({ control: form.control, name: "scenarios" });
  const questionType = form.watch("questionType");
  const watchedOutcomes = form.watch("outcomes");
  const isReview = STEPS[step].id === "review";

  const review = useMemo(() => {
    if (!isReview) return null;
    const values = form.getValues();
    const fields = fieldsFromForm(values);
    const parsed = classifierConfigSchema.safeParse(fields.config);
    if (!parsed.success) {
      return { errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`), text: "" };
    }
    const definition = definitionFromConfig({ slug: classifierSlug ?? (kebab(values.title) || "classifier"), name: values.title, summary: fields.description }, parsed.data);
    return {
      errors: validateClassifierDefinition(definition, { sources: new Set(sourceIds) }).map((e) => e.replace(/^classifier "[^"]*": /, "")),
      text: formatClassifierDefinition(definition),
    };
  }, [isReview, form, classifierSlug, sourceIds]);

  async function next() {
    const valid = await form.trigger(STEPS[step].fields);
    if (!valid) return;
    const target = Math.min(step + 1, STEPS.length - 1);
    setStep(target);
    setReached((r) => Math.max(r, target));
  }

  function setQuestionType(type: QuestionType) {
    form.setValue("questionType", type, { shouldDirty: true });
    form.setValue("options", optionsFor(type, form.getValues("options")), { shouldDirty: true, shouldValidate: false });
  }

  function addOutcomesForOptions() {
    const existing = new Set(form.getValues("outcomes").map((o) => o.id));
    for (const option of form.getValues("options")) {
      const id = option.key.trim();
      if (!id || existing.has(id)) continue;
      outcomes.append({ id, label: id.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()), when: t("defaultOptionWhen", { option: id }), tone: "proceed" });
      existing.add(id);
    }
  }

  async function onSubmit(values: ClassifierFormValues) {
    if (!isReview) return next();
    if (review && review.errors.length > 0) return;
    setIsLoading(true);
    setServerErrors([]);
    try {
      const fields = fieldsFromForm(values);
      const request = isProposal
        ? {
            url: `/api/prompts/${promptId}/changes`,
            method: "POST",
            body: { proposedTitle: values.title, reason: values.reason || undefined, proposedClassifier: fields },
          }
        : mode === "edit"
          ? { url: `/api/prompts/${promptId}`, method: "PATCH", body: { title: values.title, isPrivate: values.isPrivate, classifier: fields } }
          : { url: "/api/prompts", method: "POST", body: { type: "CLASSIFIER", title: values.title, isPrivate: values.isPrivate, tagIds: [], classifier: fields } };
      const response = await fetch(request.url, {
        method: request.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });
      const result = await response.json();
      if (!response.ok) {
        if (Array.isArray(result.details) && result.details.every((d: unknown) => typeof d === "string")) {
          setServerErrors(result.details);
        }
        if (result.error === "rate_limit") return void toast.error(tPrompts("rateLimitError"));
        if (result.error === "daily_limit") return void toast.error(tPrompts("dailyLimitError"));
        if (result.error === "duplicate_prompt") return void toast.error(tPrompts("duplicatePromptError"));
        if (result.error === "no_change") return void toast.error(tChanges("mustMakeChanges"));
        return void toast.error(result.message || tCommon("somethingWentWrong"));
      }
      if (isProposal) {
        toast.success(tChanges("created"));
        router.push(`${getClassifierUrl(classifierSlug!)}/changes/${result.id}`);
      } else {
        toast.success(mode === "edit" ? t("updated") : t("created"));
        router.push(getClassifierUrl(result.classifierSlug ?? classifierSlug));
      }
      router.refresh();
    } catch {
      toast.error(tCommon("somethingWentWrong"));
    } finally {
      setIsLoading(false);
    }
  }

  const removeButton = (onClick: () => void, disabled: boolean) => (
    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClick} disabled={disabled} aria-label={t("remove")}>
      <Trash2 className="h-4 w-4" />
    </Button>
  );

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-lg font-semibold">
            {isProposal ? tChanges("proposeClassifierTitle") : mode === "edit" ? t("editTitle") : t("createTitle")}
          </h1>
          {!isProposal && (
            <FormField
              control={form.control}
              name="isPrivate"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0 text-sm font-normal">{tClassifiers("private")}</FormLabel>
                </FormItem>
              )}
            />
          )}
        </div>
        {isProposal && <p className="-mt-4 text-sm text-muted-foreground">{tChanges("proposeClassifierIntro")}</p>}

        <ol className="flex flex-wrap gap-1.5" aria-label={t("steps")}>
          {STEPS.map((s, index) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => index <= reached && setStep(index)}
                disabled={index > reached}
                aria-current={index === step ? "step" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  index === step
                    ? "border-primary bg-primary text-primary-foreground"
                    : index <= reached
                      ? "bg-background text-foreground hover:bg-accent"
                      : "bg-background text-muted-foreground opacity-60"
                )}
              >
                <s.icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t(`step.${s.id}`)}
                {index < reached && index !== step && <Check className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />}
              </button>
            </li>
          ))}
        </ol>

        <p className="text-sm text-muted-foreground">{t(`stepHint.${STEPS[step].id}`)}</p>

        {STEPS[step].id === "basics" && (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("name")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("namePlaceholder")} maxLength={L.name} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("summary")}</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder={t("summaryPlaceholder")} maxLength={L.summary} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("category")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full sm:w-64">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CLASSIFIER_CATEGORIES.map((id) => (
                        <SelectItem key={id} value={id}>
                          {tClassifiers(`categories.${id}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="problem"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tClassifiers("problem")}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder={t("problemPlaceholder")} maxLength={L.longText} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="goal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tClassifiers("goal")}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder={t("goalPlaceholder")} maxLength={L.longText} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {STEPS[step].id === "input" && (
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="inputSummary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("inputSummary")}</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder={t("inputSummaryPlaceholder")} maxLength={L.shortText} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("inputFields")}</p>
              <p className="text-xs text-muted-foreground">{t("inputFieldsHint")}</p>
              {inputFields.fields.map((item, index) => (
                <div key={item.id} className="flex items-start gap-2">
                  <FormField
                    control={form.control}
                    name={`inputFields.${index}.name`}
                    render={({ field }) => (
                      <FormItem className="w-40 shrink-0 sm:w-48">
                        <FormControl>
                          <Input placeholder="customer_message" aria-label={t("fieldName")} className="font-mono text-xs" maxLength={L.fieldName} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`inputFields.${index}.description`}
                    render={({ field }) => (
                      <FormItem className="min-w-0 flex-1">
                        <FormControl>
                          <Input placeholder={t("fieldDescription")} aria-label={t("fieldDescription")} maxLength={L.shortText} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {removeButton(() => inputFields.remove(index), inputFields.fields.length <= 1)}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => inputFields.append({ name: "", description: "" })}
                disabled={inputFields.fields.length >= L.inputFields}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t("addInputField")}
              </Button>
            </div>
          </div>
        )}

        {STEPS[step].id === "question" && (
          <div className="space-y-4">
            <FormItem>
              <FormLabel>{t("questionType")}</FormLabel>
              <div role="radiogroup" aria-label={t("questionType")} className="grid gap-2 sm:grid-cols-3">
                {QUESTION_TYPES.map((type) => {
                  const TypeIcon = QUESTION_TYPE_ICONS[type];
                  const selected = questionType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setQuestionType(type)}
                      className={cn(
                        "rounded-md border p-3 text-left transition-colors hover:bg-accent/50",
                        selected && "border-primary bg-primary/5"
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <TypeIcon className={cn("h-4 w-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} aria-hidden />
                        {tClassifiers(`questionTypes.${type}`)}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{t(`questionTypeHint.${type}`)}</span>
                    </button>
                  );
                })}
              </div>
            </FormItem>
            <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
              <FormField
                control={form.control}
                name="questionKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tClassifiers("questionKey")}</FormLabel>
                    <FormControl>
                      <Input placeholder="route" className="font-mono text-xs" maxLength={L.fieldName} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("question")}</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder={t("questionPlaceholder")} maxLength={L.longText} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{tClassifiers(`optionsHeading.${questionType}`)}</p>
              <p className="text-xs text-muted-foreground">{t(`optionsHint.${questionType}`)}</p>
              {options.fields.map((item, index) => (
                <div key={item.id} className="flex items-start gap-2">
                  <FormField
                    control={form.control}
                    name={`options.${index}.key`}
                    render={({ field }) => (
                      <FormItem className="w-32 shrink-0 sm:w-44">
                        <FormControl>
                          <Input
                            placeholder={questionType === "choice" ? "refund" : ""}
                            aria-label={t("optionKey")}
                            className="font-mono text-xs"
                            readOnly={questionType !== "choice"}
                            maxLength={L.fieldName}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`options.${index}.description`}
                    render={({ field }) => (
                      <FormItem className="min-w-0 flex-1">
                        <FormControl>
                          <Input placeholder={t("optionDescription")} aria-label={t("optionDescription")} maxLength={L.optionText} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {removeButton(() => {
                    options.remove(index);
                    if (questionType === "score") form.setValue("options", optionsFor("score", form.getValues("options")));
                  }, questionType === "noul" || options.fields.length <= 2)}
                </div>
              ))}
              {questionType !== "noul" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => options.append({ key: questionType === "score" ? String(options.fields.length) : "", description: "" })}
                  disabled={options.fields.length >= (questionType === "score" ? 10 : L.options)}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t("addOption")}
                </Button>
              )}
            </div>
          </div>
        )}

        {STEPS[step].id === "outcomes" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">{tClassifiers("outcomes")}</p>
                {questionType === "choice" && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={addOutcomesForOptions}>
                    {t("addOutcomesForOptions")}
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("outcomesHint")}</p>
              {outcomes.fields.map((item, index) => (
                <div key={item.id} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-start gap-2">
                    <FormField
                      control={form.control}
                      name={`outcomes.${index}.id`}
                      render={({ field }) => (
                        <FormItem className="w-32 shrink-0 sm:w-44">
                          <FormControl>
                            <Input placeholder="needs_review" aria-label={t("outcomeId")} className="font-mono text-xs" maxLength={L.fieldName} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`outcomes.${index}.label`}
                      render={({ field }) => (
                        <FormItem className="min-w-0 flex-1">
                          <FormControl>
                            <Input placeholder={t("outcomeLabel")} aria-label={t("outcomeLabel")} maxLength={L.outcomeLabel} {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`outcomes.${index}.tone`}
                      render={({ field }) => (
                        <FormItem className="w-28 shrink-0 sm:w-32">
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger aria-label={t("outcomeTone")}>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {TONES.map((tone) => (
                                <SelectItem key={tone} value={tone}>
                                  {t(`tones.${tone}`)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    {removeButton(() => outcomes.remove(index), outcomes.fields.length <= 1)}
                  </div>
                  <FormField
                    control={form.control}
                    name={`outcomes.${index}.when`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input placeholder={t("outcomeWhen")} aria-label={t("outcomeWhen")} maxLength={L.shortText} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
              <FormField control={form.control} name="outcomes" render={() => <FormMessage />} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => outcomes.append({ id: "", label: "", when: "", tone: "proceed" })}
                disabled={outcomes.fields.length >= L.outcomes}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                {t("addOutcome")}
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="guidance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tClassifiers("guidance")}</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder={t("onePerLine")} {...field} />
                    </FormControl>
                    <FormDescription>{t("guidanceHint")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="caveats"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tClassifiers("caveats")}</FormLabel>
                    <FormControl>
                      <Textarea rows={4} placeholder={t("onePerLine")} {...field} />
                    </FormControl>
                    <FormDescription>{t("caveatsHint")}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {STEPS[step].id === "scenarios" && (
          <div className="space-y-4">
            {scenarios.fields.map((item, index) => (
              <div key={item.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-start gap-2">
                  <FormField
                    control={form.control}
                    name={`scenarios.${index}.title`}
                    render={({ field }) => (
                      <FormItem className="min-w-0 flex-1">
                        <FormControl>
                          <Input placeholder={t("scenarioTitle")} aria-label={t("scenarioTitle")} maxLength={L.scenarioTitle} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`scenarios.${index}.outcome`}
                    render={({ field }) => (
                      <FormItem className="w-36 shrink-0 sm:w-44">
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger aria-label={t("scenarioOutcome")}>
                              <SelectValue placeholder={t("scenarioOutcome")} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {watchedOutcomes
                              .filter((o) => o.id.trim())
                              .map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                  {o.label || o.id}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {removeButton(() => scenarios.remove(index), scenarios.fields.length <= 1)}
                </div>
                <FormField
                  control={form.control}
                  name={`scenarios.${index}.state`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          rows={4}
                          placeholder={t("scenarioStatePlaceholder")}
                          aria-label={t("scenarioState")}
                          className="font-mono text-xs"
                          maxLength={L.stateChars}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`scenarios.${index}.rationale`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder={t("scenarioRationale")} aria-label={t("scenarioRationale")} maxLength={L.listItem} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => scenarios.append({ id: "", title: "", state: "", outcome: "", rationale: "" })}
              disabled={scenarios.fields.length >= L.scenarios}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t("addScenario")}
            </Button>
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("tags")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("tagsPlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {isReview && review && (
          <div className="space-y-4">
            {[...review.errors, ...serverErrors].length > 0 ? (
              <div role="alert" className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-destructive">{t("fixBeforeSaving")}</p>
                <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {[...new Set([...review.errors, ...serverErrors])].map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("readyToSave")}</p>
            )}
            {review.text && (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
                {review.text}
              </pre>
            )}
            {isProposal && (
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tChanges("reason")}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} placeholder={tChanges("reasonPlaceholder")} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t pt-4">
          <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || isLoading}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("back")}
          </Button>
          {isReview ? (
            <Button type="submit" disabled={isLoading || (review?.errors.length ?? 0) > 0}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isProposal ? tChanges("submit") : mode === "edit" ? t("save") : t("create")}
            </Button>
          ) : (
            <Button type="button" onClick={next}>
              {t("next")}
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
