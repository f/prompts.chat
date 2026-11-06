import type { ClassifierOutcome, OutcomeTone } from "../../../src/lib/classifiers/types";

/** Outcome for a Choice option, taken when the model picks it with enough confidence. */
export function choiceOutcome(id: string, label: string, tone: OutcomeTone = "proceed"): ClassifierOutcome {
  return { id, label, tone, when: `Choice is ${id} and confidence meets your threshold.` };
}

/** The outcome every Choice needs for answers whose probability is spread across options. */
export function lowConfidence(label = "Needs a person"): ClassifierOutcome {
  return {
    id: "low_confidence",
    label,
    tone: "review",
    when: "Confidence is below your threshold: probability is spread across options.",
  };
}

interface NoulSide {
  id: string;
  label: string;
  tone: OutcomeTone;
}

/** Yes / unclear / no outcomes for a Noul read with two thresholds. */
export function noulOutcomes(yes: NoulSide, no: NoulSide, unclearLabel = "Unclear"): ClassifierOutcome[] {
  return [
    { ...yes, when: "Probability of yes is above your upper threshold." },
    { id: "unclear", label: unclearLabel, tone: "review", when: "Probability falls between your two thresholds." },
    { ...no, when: "Probability of yes is below your lower threshold." },
  ];
}
