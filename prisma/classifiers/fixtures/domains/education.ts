import type { ClassifierChain, ClassifierDefinition } from "../../../../src/lib/classifiers/types";
import { choiceOutcome, lowConfidence, noulOutcomes } from "../outcomes";

const COURSE = "Intro to Statistics, week 6: hypothesis testing";

export const classifiers: ClassifierDefinition[] = [
  {
    slug: "student-question-type",
    name: "Student question type",
    category: "education",
    summary: "Route a student's message to a course assistant: concept help, a request for graded answers, logistics, a platform problem, or something staff should see.",
    problem:
      "Course assistants and forums get everything from concept questions to \"what's the answer to question 3?\" to messages from students who are struggling. Each needs a different response, and some need a person.",
    goal: "Let an assistant help with concepts and logistics, decline to do graded work, and bring personal messages to staff.",
    input: {
      summary: "The student's message and the course context.",
      fields: [
        { name: "message", description: "The student's message." },
        { name: "course", description: "Course and current topic." },
        { name: "open_assessments", description: "Titles of assessments currently open, from your course system." },
      ],
    },
    question: {
      key: "question_type",
      type: "choice",
      instructions: "What is the student asking for?",
      options: [
        { key: "concept_help", description: "Help understanding a concept, method or example from the course." },
        { key: "graded_work_answer_request", description: "Asks for answers or solutions to an open assignment, quiz or exam." },
        { key: "course_logistics", description: "Deadlines, submission, grading policy or where to find materials." },
        { key: "platform_technical", description: "Problems with the learning platform, logins, uploads or videos." },
        { key: "personal_wellbeing", description: "Mentions stress, personal difficulty, illness or needing support beyond the course content." },
      ],
    },
    outcomes: [
      choiceOutcome("concept_help", "Concept help"),
      choiceOutcome("graded_work_answer_request", "Explain, don't solve", "caution"),
      choiceOutcome("course_logistics", "Logistics"),
      choiceOutcome("platform_technical", "Platform support"),
      choiceOutcome("personal_wellbeing", "Staff follow-up", "review"),
      lowConfidence("Teaching assistant"),
    ],
    guidance: [
      "Messages mentioning personal difficulty go to a person every time, even when they also ask a course question.",
      "Pass the open assessments so a question that quotes one can be recognized.",
    ],
    caveats: ["Routes messages only. It doesn't assess a student's wellbeing, integrity or ability."],
    scenarios: [
      {
        id: "p-value",
        title: "Concept question",
        state: { message: "I don't get why a small p-value means we reject the null.", course: COURSE, open_assessments: ["Problem set 6"] },
        outcome: "concept_help",
        rationale: "Asks to understand a concept.",
      },
      {
        id: "q3-answer",
        title: "Answer request",
        state: { message: "What's the answer to problem set 6 question 3? Just the number.", course: COURSE, open_assessments: ["Problem set 6"] },
        outcome: "graded_work_answer_request",
        rationale: "Asks for the answer to open graded work.",
      },
      {
        id: "deadline",
        title: "Deadline",
        state: { message: "Is problem set 6 due Friday or Sunday?", course: COURSE, open_assessments: ["Problem set 6"] },
        outcome: "course_logistics",
        rationale: "A deadline question.",
      },
      {
        id: "video-wont-play",
        title: "Video won't play",
        state: { message: "Lecture 11 video just shows a spinning wheel.", course: COURSE, open_assessments: [] },
        outcome: "platform_technical",
        rationale: "A platform problem.",
      },
      {
        id: "falling-behind",
        title: "Struggling",
        state: { message: "I've been sick for two weeks and I'm really behind and stressed. Not sure I can finish.", course: COURSE, open_assessments: ["Problem set 6"] },
        outcome: "personal_wellbeing",
        rationale: "Mentions illness and stress; staff should respond.",
      },
      {
        id: "check-my-work",
        title: "Check my work",
        state: { message: "Can you check if my approach to q3 is right? I used a two-tailed test.", course: COURSE, open_assessments: ["Problem set 6"] },
        outcome: "low_confidence",
        rationale: "Between concept help and checking graded work.",
      },
    ],
    betterTogether: [
      { slug: "course-material-answerability", reason: "Concept and logistics questions are checked against the course material." },
      { slug: "answer-giveaway-check", reason: "Drafted replies are checked for giving away graded answers." },
      { slug: "it-request-type", reason: "Platform problems can be routed with your IT helpdesk categories." },
    ],
    references: ["typesafe-system-one", "typesafe-confidence-routing"],
    tags: ["education", "routing", "students"],
  },
  {
    slug: "course-material-answerability",
    name: "Course material answerability",
    category: "education",
    summary: "Check whether the retrieved course material covers a student's question, partly covers it, doesn't, or whether the question needs clarifying.",
    problem:
      "Course assistants answer from general knowledge when the course material doesn't cover a question, which can contradict how the course teaches it.",
    goal: "Answer from the course when it covers the question, say what's missing when it partly does, and pass the rest to a teaching assistant.",
    input: {
      summary: "The question and the passages retrieved from the course.",
      fields: [
        { name: "question", description: "The student's question." },
        { name: "passages", description: "Retrieved passages from lecture notes, slides and the syllabus." },
      ],
    },
    question: {
      key: "answerability",
      type: "choice",
      instructions: "Can this question be answered from these course passages?",
      options: [
        { key: "covered", description: "The passages contain what's needed to answer the question." },
        { key: "partially_covered", description: "The passages answer part of the question." },
        { key: "not_covered", description: "The passages don't address the question." },
        { key: "needs_clarification", description: "The question is too ambiguous to tell what's being asked." },
      ],
    },
    outcomes: [
      choiceOutcome("covered", "Answer from course"),
      choiceOutcome("partially_covered", "Answer the covered part", "caution"),
      choiceOutcome("not_covered", "Teaching assistant", "review"),
      choiceOutcome("needs_clarification", "Ask the student", "caution"),
      lowConfidence("Teaching assistant"),
    ],
    guidance: [
      "Retrieval quality matters more than this question. Score passages first and pass only relevant ones.",
      "When partially covered, say which part the course material doesn't cover.",
    ],
    scenarios: [
      {
        id: "p-value-covered",
        title: "Covered",
        state: { question: "Why does a small p-value mean we reject the null?", passages: ["Lecture 11: if p < α we reject H0, because data this extreme would be unlikely if H0 were true."] },
        outcome: "covered",
        rationale: "The lecture explains it.",
      },
      {
        id: "bayes-vs",
        title: "Partly covered",
        state: { question: "How is this different from the Bayesian approach?", passages: ["Lecture 11: frequentist hypothesis testing..."] },
        outcome: "partially_covered",
        rationale: "Covers one side of the comparison only.",
      },
      {
        id: "bootstrap",
        title: "Not covered",
        state: { question: "Can we use bootstrapping instead?", passages: ["Lecture 11: t-tests and z-tests."] },
        outcome: "not_covered",
        rationale: "Bootstrapping isn't in the material.",
      },
      {
        id: "the-thing",
        title: "Ambiguous",
        state: { question: "How does the thing from Tuesday work?", passages: ["Lecture 10: confidence intervals", "Lecture 11: hypothesis tests"] },
        outcome: "needs_clarification",
        rationale: "\"The thing\" could be several topics.",
      },
    ],
    betterTogether: [
      { slug: "student-question-type", reason: "Runs for concept and logistics questions." },
      { slug: "passage-relevance", reason: "Score retrieved passages before checking whether they cover the question." },
      { slug: "reading-level-fit", reason: "Check that the answer drafted from the material fits the learners." },
    ],
    references: ["typesafe-rag-passages", "typesafe-system-one"],
    tags: ["education", "retrieval", "answerability"],
  },
  {
    slug: "answer-giveaway-check",
    name: "Answer giveaway check",
    category: "education",
    summary: "Check whether a drafted tutoring reply gives away the answer to graded work instead of guiding the student.",
    problem:
      "Even when instructed to give hints, assistants sometimes work a problem all the way through. In a graded course that undermines the assessment.",
    goal: "Send hint-style replies, and replace replies that solve the graded problem before the student sees them.",
    input: {
      summary: "The student's question, the open assessment it relates to, and the drafted reply.",
      fields: [
        { name: "question", description: "The student's question." },
        { name: "assessment", description: "The open graded item it relates to, if any." },
        { name: "draft_reply", description: "The reply drafted by your assistant." },
      ],
    },
    question: {
      key: "gives_away_answer",
      type: "noul",
      instructions: "Does the drafted reply give the student the answer or full solution to the graded item?",
      options: [
        { key: "true", description: "States the final answer, or works through every step so none is left to the student." },
        { key: "false", description: "Explains concepts, points to material, or gives a first step, leaving the work to the student." },
      ],
    },
    outcomes: noulOutcomes(
      { id: "gives_away", label: "Rewrite as hint", tone: "stop" },
      { id: "guides", label: "Send", tone: "proceed" }
    ),
    guidance: [
      "Pass the graded item itself so the check can tell a worked example of the same method from the actual answer.",
      "Teachers set the line between a hint and a solution. Calibrate on replies they've marked.",
    ],
    scenarios: [
      {
        id: "full-working",
        title: "Full solution",
        state: { question: "Help with q3?", assessment: "PS6 q3: test whether mean > 50, n=25, x̄=53, s=6", draft_reply: "t = (53-50)/(6/5) = 2.5, p ≈ 0.01, so reject H0." },
        outcome: "gives_away",
        rationale: "Works the graded problem to the end.",
      },
      {
        id: "first-step",
        title: "Hint",
        state: { question: "Help with q3?", assessment: "PS6 q3: test whether mean > 50, n=25, x̄=53, s=6", draft_reply: "Start by writing H0 and H1. Which test fits when σ is unknown? Lecture 11, slide 14 shows the formula." },
        outcome: "guides",
        rationale: "Points to the method and leaves the work.",
      },
      {
        id: "similar-example",
        title: "Worked similar example",
        state: { question: "Help with q3?", assessment: "PS6 q3: test whether mean > 50, n=25, x̄=53, s=6", draft_reply: "Here's a similar example: n=16, x̄=105, s=8, testing mean > 100: t = 5/2 = 2.5..." },
        outcome: "unclear",
        rationale: "Different numbers, but every step carries straight over.",
      },
    ],
    betterTogether: [
      { slug: "student-question-type", reason: "Most relevant when the question relates to graded work." },
      { slug: "answer-groundedness", reason: "A reply can be a proper hint and still be wrong; check it against the course material too." },
      { slug: "reading-level-fit", reason: "Hints only help if students can follow them." },
    ],
    references: ["typesafe-noul-screen", "typesafe-guardrails"],
    tags: ["education", "integrity", "noul"],
  },
  {
    slug: "reading-level-fit",
    name: "Reading level fit",
    category: "education",
    summary: "Rate whether a text is pitched at the right level for its intended learners.",
    problem:
      "Generated explanations and course materials are often written for experts, or oversimplified, and teachers only notice when students struggle.",
    goal: "Catch explanations that are too hard or too simple before learners see them, and flag them for revision.",
    input: {
      summary: "The text and a description of the learners.",
      fields: [
        { name: "text", description: "The explanation, reply or material." },
        { name: "audience", description: "Who it's for, for example \"first-year undergraduates, no prior statistics\"." },
      ],
    },
    question: {
      key: "level_fit",
      type: "score",
      instructions: "How well does this text's difficulty match the intended learners?",
      options: [
        { key: "0", description: "Much simpler than they need; leaves out what they're ready for." },
        { key: "1", description: "About right." },
        { key: "2", description: "Somewhat hard: some terms or steps need explaining." },
        { key: "3", description: "Much too hard: assumes knowledge they don't have." },
      ],
    },
    outcomes: [
      { id: "too_simple", label: "Too simple", when: "Most likely level is 0 and confidence meets your threshold.", tone: "caution" },
      { id: "fits", label: "Fits", when: "Most likely level is 1 and confidence meets your threshold.", tone: "proceed" },
      { id: "somewhat_hard", label: "Explain terms", when: "Most likely level is 2 and confidence meets your threshold.", tone: "caution" },
      { id: "too_hard", label: "Rewrite", when: "Most likely level is 3 and confidence meets your threshold.", tone: "review" },
      lowConfidence("Teacher reviews"),
    ],
    guidance: [
      "Describe the audience concretely: prior courses, age group and language background.",
      "Readability formulas count syllables; this question judges assumed knowledge. Use both if you like.",
    ],
    scenarios: [
      {
        id: "fits-first-years",
        title: "About right",
        state: { text: "A p-value tells you how surprising your data would be if nothing interesting were going on.", audience: "first-year undergraduates, no prior statistics" },
        outcome: "fits",
        rationale: "Plain language with the key idea.",
      },
      {
        id: "measure-theory",
        title: "Far too hard",
        state: { text: "Under H0 the test statistic is a measurable function whose pushforward measure...", audience: "first-year undergraduates, no prior statistics" },
        outcome: "too_hard",
        rationale: "Assumes measure theory.",
      },
      {
        id: "unexplained-alpha",
        title: "Undefined term",
        state: { text: "Reject H0 when p < α; α is usually 0.05.", audience: "first-year undergraduates, no prior statistics" },
        outcome: "somewhat_hard",
        rationale: "Uses α without explaining it.",
      },
      {
        id: "too-simple-grads",
        title: "Too simple",
        state: { text: "Statistics helps us learn from numbers!", audience: "graduate students in a methods course" },
        outcome: "too_simple",
        rationale: "Far below what the learners need.",
      },
      {
        id: "no-audience",
        title: "Audience unclear",
        state: { text: "The t-test compares means when the variance is unknown.", audience: "students" },
        outcome: "low_confidence",
        rationale: "\"Students\" doesn't say what they already know.",
      },
    ],
    betterTogether: [
      { slug: "answer-giveaway-check", reason: "Hints should be both non-revealing and easy to follow." },
      { slug: "course-material-answerability", reason: "Answers drafted from course material can still be pitched wrongly." },
    ],
    references: ["typesafe-system-one"],
    tags: ["education", "content", "score"],
  },
];

export const chains: ClassifierChain[] = [
  {
    slug: "course-assistant-questions",
    name: "Course assistant questions",
    category: "education",
    summary: "Route student questions, answer only from relevant course material, and check drafted replies for giveaways and unsupported claims.",
    goal: "Every question ends answered from the course, as a hint, with an integrity reply, as a clarifying question, with platform support, or with a teaching assistant or staff member.",
    input: {
      summary: "The student's message, open assessments, retrieved course passages and the assistant's draft reply.",
      fields: [
        { name: "message", description: "The student's message." },
        { name: "open_assessments", description: "Graded items currently open." },
        { name: "passages", description: "Passages retrieved from the course." },
        { name: "draft_reply", description: "The reply drafted from the relevant passages." },
      ],
    },
    entry: "type",
    steps: [
      {
        id: "type",
        classifier: "student-question-type",
        purpose: "Decide what kind of help is needed.",
        receives: [
          { from: "input", value: "message" },
          { from: "input", value: "open_assessments" },
        ],
        branches: [
          { outcomes: ["concept_help", "course_logistics"], to: "passages" },
          { outcomes: ["graded_work_answer_request"], to: "integrity_reply" },
          { outcomes: ["platform_technical"], to: "it_handoff" },
          { outcomes: ["personal_wellbeing"], to: "student_support" },
          { outcomes: ["low_confidence"], to: "teaching_assistant" },
        ],
      },
      {
        id: "passages",
        classifier: "passage-relevance",
        purpose: "Keep only relevant course passages. Asked once per passage; the branch follows the best one.",
        receives: [
          { from: "input", value: "message as the question" },
          { from: "input", value: "passages" },
        ],
        branches: [
          { outcomes: ["include_passage", "borderline"], to: "answerability" },
          { outcomes: ["exclude_passage"], to: "teaching_assistant", note: "No relevant course material was found." },
        ],
      },
      {
        id: "answerability",
        classifier: "course-material-answerability",
        purpose: "Check the relevant passages cover the question.",
        receives: [
          { from: "input", value: "message" },
          { from: "passages", value: "Relevant passages" },
        ],
        branches: [
          { outcomes: ["covered", "partially_covered"], to: "giveaway" },
          { outcomes: ["needs_clarification"], to: "ask_student" },
          { outcomes: ["not_covered", "low_confidence"], to: "teaching_assistant" },
        ],
      },
      {
        id: "giveaway",
        classifier: "answer-giveaway-check",
        purpose: "Make sure the draft guides rather than solves graded work.",
        receives: [
          { from: "input", value: "draft_reply" },
          { from: "input", value: "open_assessments" },
        ],
        branches: [
          { outcomes: ["guides"], to: "grounded" },
          { outcomes: ["gives_away"], to: "hint_rewrite" },
          { outcomes: ["unclear"], to: "teaching_assistant" },
        ],
      },
      {
        id: "grounded",
        classifier: "answer-groundedness",
        purpose: "Check the draft against the course passages.",
        receives: [
          { from: "input", value: "draft_reply" },
          { from: "passages", value: "Relevant passages" },
        ],
        branches: [
          { outcomes: ["supported"], to: "send_answer" },
          { outcomes: ["contradicted", "not_addressed", "low_confidence"], to: "teaching_assistant" },
        ],
      },
    ],
    terminals: [
      { id: "send_answer", label: "Send answer", description: "The reply is sent with links to the course passages it uses.", kind: "automated" },
      { id: "hint_rewrite", label: "Replace with a hint", description: "The draft is discarded and a hint-only reply is drafted, which runs through these checks again.", kind: "automated" },
      { id: "integrity_reply", label: "Explain, don't solve", description: "Explains that graded answers aren't given and offers help with the underlying concept.", kind: "automated" },
      { id: "ask_student", label: "Ask a clarifying question", description: "Asks which topic or lecture the student means.", kind: "automated" },
      { id: "it_handoff", label: "IT helpdesk intake", description: "Platform problems continue in the helpdesk chain.", kind: "handoff", handoffChain: "it-helpdesk-intake" },
      { id: "student_support", label: "Student support staff", description: "A staff member responds personally; the assistant doesn't reply.", kind: "human" },
      { id: "teaching_assistant", label: "Teaching assistant", description: "A teaching assistant answers questions the material can't, or the checks didn't clear.", kind: "human" },
    ],
    scenarios: [
      {
        id: "p-value",
        title: "Concept question answered",
        summary: "A covered concept question gets a grounded, hint-style answer.",
        input: { message: "Why does a small p-value mean we reject the null?", open_assessments: ["Problem set 6"], passages: ["Lecture 11: if p < α we reject H0..."], draft_reply: "Lecture 11 explains: a small p-value means data this extreme would rarely happen if H0 were true..." },
        path: [
          { step: "type", outcome: "concept_help", note: "Understanding a concept." },
          { step: "passages", outcome: "include_passage", note: "Lecture 11 is on point." },
          { step: "answerability", outcome: "covered", note: "The lecture explains it." },
          { step: "giveaway", outcome: "guides", note: "Explains, doesn't solve graded work." },
          { step: "grounded", outcome: "supported", note: "Matches the lecture." },
        ],
        terminal: "send_answer",
      },
      {
        id: "q3-answer",
        title: "Graded answer requested",
        summary: "A request for graded answers gets an integrity reply offering concept help.",
        input: { message: "What's the answer to PS6 q3? Just the number.", open_assessments: ["Problem set 6"] },
        path: [{ step: "type", outcome: "graded_work_answer_request", note: "Asks for a graded answer." }],
        terminal: "integrity_reply",
      },
      {
        id: "draft-solves",
        title: "Draft solves the problem",
        summary: "A draft that works the graded problem through is replaced with a hint.",
        input: { message: "I'm stuck on how to set up the test in q3.", open_assessments: ["Problem set 6"], passages: ["Lecture 11, slide 14: one-sample t-test"], draft_reply: "t = (53-50)/(6/5) = 2.5, p ≈ 0.01, reject H0." },
        path: [
          { step: "type", outcome: "concept_help", note: "Asks how to set up a method." },
          { step: "passages", outcome: "include_passage", note: "Slide 14 covers it." },
          { step: "answerability", outcome: "covered", note: "The method is in the lecture." },
          { step: "giveaway", outcome: "gives_away", note: "Works q3 to the end." },
        ],
        terminal: "hint_rewrite",
      },
      {
        id: "bootstrap",
        title: "Beyond the course",
        summary: "A question the course doesn't cover goes to a teaching assistant.",
        input: { message: "Can we use bootstrapping instead of a t-test?", open_assessments: [], passages: ["Lecture 11: t-tests and z-tests"] },
        path: [
          { step: "type", outcome: "concept_help", note: "A method question." },
          { step: "passages", outcome: "borderline", note: "Related, but about other tests." },
          { step: "answerability", outcome: "not_covered", note: "Bootstrapping isn't in the material." },
        ],
        terminal: "teaching_assistant",
      },
      {
        id: "tuesday-thing",
        title: "Ambiguous question",
        summary: "An ambiguous question gets a clarifying question instead of a guess.",
        input: { message: "How does the thing from Tuesday work?", open_assessments: [], passages: ["Lecture 10: confidence intervals", "Lecture 11: hypothesis tests"] },
        path: [
          { step: "type", outcome: "concept_help", note: "Asks about course content." },
          { step: "passages", outcome: "borderline", note: "Two possible lectures." },
          { step: "answerability", outcome: "needs_clarification", note: "\"The thing\" is ambiguous." },
        ],
        terminal: "ask_student",
      },
      {
        id: "sick-behind",
        title: "Student struggling",
        summary: "A personal message goes to staff, not to the assistant.",
        input: { message: "I've been sick for two weeks and I'm really behind and stressed.", open_assessments: ["Problem set 6"] },
        path: [{ step: "type", outcome: "personal_wellbeing", note: "Illness and stress mentioned." }],
        terminal: "student_support",
      },
      {
        id: "video-spinner",
        title: "Video won't load",
        summary: "A platform problem continues in the IT helpdesk chain.",
        input: { message: "Lecture 11 video just shows a spinning wheel.", open_assessments: [] },
        path: [{ step: "type", outcome: "platform_technical", note: "A platform problem." }],
        terminal: "it_handoff",
      },
    ],
    notes: [
      "Passage relevance and answer groundedness are the same classifiers used by the grounded support assistant; only the source material changes.",
      "Nothing here grades, scores or judges students. Messages about personal circumstances always reach a person.",
    ],
    references: ["typesafe-rag-passages", "typesafe-citation-check", "typesafe-noul-screen", "typesafe-system-one"],
  },
];
