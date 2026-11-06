import { CLASSIFIER_CATEGORIES } from "../categories";
import type { ClassifierChain, ClassifierDefinition } from "../types";
import { CLASSIFIERS as CORE_CLASSIFIERS } from "./classifiers";
import { CHAINS as CORE_CHAINS } from "./chains";
import * as agents from "./domains/agents";
import * as billing from "./domains/billing";
import * as commerce from "./domains/commerce";
import * as documents from "./domains/documents";
import * as education from "./domains/education";
import * as engineering from "./domains/engineering";
import * as itOperations from "./domains/it-operations";
import * as logistics from "./domains/logistics";
import * as research from "./domains/research";

const DOMAINS = [commerce, logistics, billing, itOperations, engineering, documents, research, education, agents];

const byCategory = <T extends { category: ClassifierDefinition["category"] }>(items: T[]): T[] =>
  [...items].sort((a, b) => CLASSIFIER_CATEGORIES.indexOf(a.category) - CLASSIFIER_CATEGORIES.indexOf(b.category));

export const CLASSIFIERS: ClassifierDefinition[] = byCategory([
  ...CORE_CLASSIFIERS,
  ...DOMAINS.flatMap((d) => d.classifiers),
]);

export const CHAINS: ClassifierChain[] = byCategory([...CORE_CHAINS, ...DOMAINS.flatMap((d) => d.chains)]);
