import type { ClassifierChain, ClassifierDefinition } from "../../../../src/lib/classifiers/types";
import { choiceOutcome, lowConfidence, noulOutcomes } from "../outcomes";

const ACCOUNT = { plan: "Team (monthly)", seats: 8, last_invoice: "2026-03-01", status: "active" };

export const classifiers: ClassifierDefinition[] = [
  {
    slug: "billing-issue-type",
    name: "Billing issue type",
    category: "support",
    summary: "Sort a SaaS billing message into unrecognized charge, duplicate charge, plan question, failed payment or cancellation.",
    problem:
      "\"Billing\" is one queue in most support tools, but a failed card, an unknown charge and a cancellation need different people, different urgency and different tools.",
    goal: "Send each billing message to the flow that can resolve it, and keep possible fraud apart from routine questions.",
    input: {
      summary: "The customer's message and account facts from your billing system.",
      fields: [
        { name: "message", description: "The customer's message." },
        { name: "account", description: "Plan, seat count, recent invoices and status, looked up in code." },
      ],
    },
    question: {
      key: "billing_issue",
      type: "choice",
      instructions: "What billing issue is the customer raising?",
      options: [
        { key: "unrecognized_charge", description: "A charge the customer doesn't recognize or didn't authorize." },
        { key: "duplicate_or_post_cancel_charge", description: "Charged twice, or charged after they cancelled." },
        { key: "plan_or_price_question", description: "A question about plans, prices, seats, proration or an invoice amount." },
        { key: "failed_payment", description: "Their payment failed or their card was declined." },
        { key: "cancellation_request", description: "Wants to cancel the subscription or stop renewal." },
      ],
    },
    outcomes: [
      choiceOutcome("unrecognized_charge", "Unrecognized charge", "caution"),
      choiceOutcome("duplicate_or_post_cancel_charge", "Duplicate or post-cancel charge"),
      choiceOutcome("plan_or_price_question", "Plan or price question"),
      choiceOutcome("failed_payment", "Failed payment"),
      choiceOutcome("cancellation_request", "Cancellation"),
      lowConfidence("Billing agent"),
    ],
    guidance: [
      "Check charge amounts and dates in code against the billing system. The model reads the message; it shouldn't do the arithmetic.",
      "An unrecognized charge may mean someone else used the account. Check for that before treating it as a pricing question.",
    ],
    scenarios: [
      {
        id: "unknown-49",
        title: "Charge nobody recognizes",
        state: { message: "There's a $49 charge from you on our card and nobody here signed up for anything.", account: ACCOUNT },
        outcome: "unrecognized_charge",
        rationale: "The customer doesn't recognize the charge.",
      },
      {
        id: "charged-after-cancel",
        title: "Charged after cancelling",
        state: { message: "I cancelled in February and you charged me again on March 1st.", account: { ...ACCOUNT, status: "cancelled" } },
        outcome: "duplicate_or_post_cancel_charge",
        rationale: "Charged after cancellation.",
      },
      {
        id: "seat-proration",
        title: "Why the invoice went up",
        state: { message: "Why is this month's invoice higher? We only added one person mid-month.", account: ACCOUNT },
        outcome: "plan_or_price_question",
        rationale: "A question about proration.",
      },
      {
        id: "card-declined",
        title: "Card declined",
        state: { message: "Got an email that my payment failed, the card expired last month.", account: { ...ACCOUNT, status: "past_due" } },
        outcome: "failed_payment",
        rationale: "Payment failed due to an expired card.",
      },
      {
        id: "stop-renewal",
        title: "Stop the renewal",
        state: { message: "Please don't renew us next month, we're winding the project down.", account: ACCOUNT },
        outcome: "cancellation_request",
        rationale: "Asks to stop renewal.",
      },
      {
        id: "everything-wrong",
        title: "Several billing issues",
        state: { message: "Card got declined, then I was charged twice, and now I just want out.", account: ACCOUNT },
        outcome: "low_confidence",
        rationale: "Three different billing issues in one message.",
      },
    ],
    betterTogether: [
      { slug: "support-ticket-routing", reason: "Runs after a message has been routed to billing." },
      { slug: "account-takeover-signal", reason: "Unrecognized charges are checked for signs that someone else used the account." },
      { slug: "cancellation-reason", reason: "Cancellations are processed as asked; the reason is recorded for the product team." },
      { slug: "refund-request-detection", reason: "Duplicate and post-cancel charges usually come with a refund request." },
    ],
    references: ["typesafe-system-one", "typesafe-jaggedness", "kev-4b-model-card"],
    tags: ["billing", "saas", "routing"],
  },
  {
    slug: "customer-frustration",
    name: "Customer frustration",
    category: "support",
    summary: "Rate how frustrated a customer sounds, so tone and seniority of the reply can match.",
    problem:
      "A calm question and a furious third follow-up land in the same queue with the same template reply, which escalates the furious one further.",
    goal: "Bring very upset customers to an experienced person sooner, without letting tone override what the issue actually needs.",
    input: {
      summary: "The latest message and, if there is one, how many times they've written about it.",
      fields: [
        { name: "message", description: "The customer's latest message." },
        { name: "prior_contacts", description: "How many times they've contacted you about this issue, counted in code." },
      ],
    },
    question: {
      key: "frustration",
      type: "score",
      instructions: "How frustrated does the customer sound in this message?",
      options: [
        { key: "0", description: "Calm or positive." },
        { key: "1", description: "Mildly annoyed or impatient." },
        { key: "2", description: "Clearly frustrated: repeated complaints, sharp wording, or mentions of wasted time." },
        { key: "3", description: "Very upset: angry, threatening to leave or escalate, or saying the problem is harming them." },
      ],
    },
    outcomes: [
      { id: "calm_or_mild", label: "Standard reply", when: "Most likely level is 0 or 1 and confidence meets your threshold.", tone: "proceed" },
      { id: "frustrated", label: "Prioritize and acknowledge", when: "Most likely level is 2 and confidence meets your threshold.", tone: "caution" },
      { id: "very_upset", label: "Experienced agent", when: "Most likely level is 3 and confidence meets your threshold.", tone: "review" },
      lowConfidence(),
    ],
    guidance: [
      "Use frustration to choose who replies and how, not whether the issue gets resolved.",
      "Sarcasm and short messages are hard to read; spread probability is an honest answer for them.",
      "Count prior contacts in code and include the number; repeat contact is a strong signal the model can't see otherwise.",
    ],
    caveats: ["Don't use this score to deprioritize calm customers or to judge the person."],
    scenarios: [
      {
        id: "polite-question",
        title: "Polite question",
        state: { message: "Hi! Quick question about how seats are billed. Thanks!", prior_contacts: 0 },
        outcome: "calm_or_mild",
        rationale: "Calm and friendly.",
      },
      {
        id: "third-time",
        title: "Third time asking",
        state: { message: "This is the third time I'm writing about this. Nobody has answered.", prior_contacts: 2 },
        outcome: "frustrated",
        rationale: "Repeated contact and sharper wording.",
      },
      {
        id: "leaving",
        title: "Threatening to leave",
        state: { message: "Absolutely unacceptable. Payroll is blocked because of your bug and I'm moving the whole company off your product.", prior_contacts: 1 },
        outcome: "very_upset",
        rationale: "Angry, says the problem harms their business and threatens to leave.",
      },
      {
        id: "great-thanks",
        title: "Sarcasm",
        state: { message: "Great. Just great. Thanks so much.", prior_contacts: 1 },
        outcome: "low_confidence",
        rationale: "Could be sincere or sarcastic; there's too little to tell.",
      },
    ],
    betterTogether: [
      { slug: "ticket-urgency", reason: "Urgency is about the problem; frustration is about the person. Combine them to choose the queue and the replier." },
      { slug: "resolution-preference", reason: "A very upset customer with a clear preference still needs a person to reply." },
      { slug: "shipment-delay-impact", reason: "For delays, impact on plans and tone together decide how much contact is needed." },
      { slug: "reply-resolution-check", reason: "Track whether frustration drops after a reply that the customer says resolved their issue." },
      { slug: "feedback-sentiment", reason: "The same tone reading, aggregated over feedback instead of applied to one conversation." },
    ],
    references: ["typesafe-quickstart", "typesafe-system-one", "typesafe-confidence-routing"],
    tags: ["support", "tone", "score"],
  },
  {
    slug: "reply-resolution-check",
    name: "Reply resolution check",
    category: "support",
    summary: "Read a customer's reply to tell whether the issue is resolved, still open, or a new issue.",
    problem:
      "Tickets reopen on every \"thanks!\" and close on replies that actually say the fix didn't work. Agents re-read whole threads to find out which.",
    goal: "Close resolved tickets, reopen unresolved ones with priority, and split new issues into their own tickets.",
    input: {
      summary: "The customer's reply and a one-line summary of the issue.",
      fields: [
        { name: "reply", description: "The customer's latest reply." },
        { name: "issue_summary", description: "One line describing the original issue." },
      ],
    },
    question: {
      key: "resolution_status",
      type: "choice",
      instructions: "What does the customer's reply say about the original issue?",
      options: [
        { key: "resolved", description: "Confirms the issue is fixed or thanks you without raising anything new." },
        { key: "still_unresolved", description: "Says the original issue is still happening or the suggestion didn't work." },
        { key: "new_issue", description: "The original issue is fine, but the customer raises a different problem." },
      ],
    },
    outcomes: [
      choiceOutcome("resolved", "Close ticket"),
      choiceOutcome("still_unresolved", "Reopen with priority", "caution"),
      choiceOutcome("new_issue", "Open a new ticket"),
      lowConfidence("Agent reads the thread"),
    ],
    guidance: [
      "Pass a short summary of the original issue instead of the whole thread; long threads blur which problem is meant.",
      "Let customers reopen a ticket with one click whatever the answer was.",
    ],
    scenarios: [
      {
        id: "works-now",
        title: "Works now",
        state: { reply: "That worked, export is fine now. Thanks!", issue_summary: "CSV export times out" },
        outcome: "resolved",
        rationale: "Confirms the fix.",
      },
      {
        id: "still-timing-out",
        title: "Still failing",
        state: { reply: "Cleared the cache like you said, still times out after 30 seconds.", issue_summary: "CSV export times out" },
        outcome: "still_unresolved",
        rationale: "The suggestion didn't work.",
      },
      {
        id: "now-sso",
        title: "Different problem",
        state: { reply: "Export works, thanks. Unrelated, but SSO login has been failing for two of our users.", issue_summary: "CSV export times out" },
        outcome: "new_issue",
        rationale: "Original issue fixed; a new one raised.",
      },
      {
        id: "will-check",
        title: "Not tried yet",
        state: { reply: "Ok, I'll try that tomorrow when I'm back.", issue_summary: "CSV export times out" },
        outcome: "low_confidence",
        rationale: "Neither resolved nor unresolved yet.",
      },
    ],
    betterTogether: [
      { slug: "support-ticket-routing", reason: "New issues raised in a reply need routing like a new ticket." },
      { slug: "customer-frustration", reason: "An unresolved issue with a frustrated reply should reach a senior agent." },
    ],
    references: ["typesafe-system-one", "typesafe-confidence-routing"],
    tags: ["support", "tickets", "follow-up"],
  },
  {
    slug: "account-takeover-signal",
    name: "Account takeover signal",
    category: "security",
    summary: "Flag messages describing signs that someone else accessed or used a customer's account.",
    problem:
      "Reports of account takeover arrive as billing questions (\"what is this charge?\") or login problems, and sit in ordinary queues while an attacker still has access.",
    goal: "Send possible takeovers to a security-trained person quickly, without exposing account details in the reply.",
    input: {
      summary: "The customer's message and recent account security events.",
      fields: [
        { name: "message", description: "The customer's message." },
        { name: "security_events", description: "Recent password, email, MFA and login-location changes from your logs." },
      ],
    },
    question: {
      key: "takeover_signal",
      type: "noul",
      instructions: "Does this message, with these account events, describe signs that someone other than the customer accessed or used the account?",
      options: [
        { key: "true", description: "Describes unrecognized logins, changes, purchases or messages, or being locked out after a change they didn't make." },
        { key: "false", description: "Describes the customer's own actions, ordinary questions, or problems with no sign of someone else." },
      ],
    },
    outcomes: noulOutcomes(
      { id: "signal_present", label: "Security team", tone: "stop" },
      { id: "no_signal", label: "Continue normal flow", tone: "proceed" },
      "Possible signal"
    ),
    guidance: [
      "Set a low upper threshold: a false alarm costs a security review; a missed takeover costs much more.",
      "Never confirm account details or recent activity in an automated reply; the person writing may be the attacker.",
      "This is a triage signal. Locking accounts and verifying identity belong to your security process.",
    ],
    caveats: ["Not a fraud detection system. Use it to route messages, alongside your security tooling."],
    scenarios: [
      {
        id: "email-changed",
        title: "Email changed by someone else",
        state: { message: "I can't log in and I just got an email saying my address was changed. I didn't do that.", security_events: ["email changed 2h ago", "new login from unfamiliar country"] },
        outcome: "signal_present",
        rationale: "An account change the customer didn't make.",
      },
      {
        id: "unknown-charge-new-device",
        title: "Unknown charge and new device",
        state: { message: "There's a charge I don't recognize.", security_events: ["new device login 1d ago"] },
        outcome: "unclear",
        rationale: "Could be a colleague on the same account or someone else.",
      },
      {
        id: "forgot-password",
        title: "Forgot password",
        state: { message: "I forgot my password and the reset email isn't arriving.", security_events: [] },
        outcome: "no_signal",
        rationale: "An ordinary login problem with no sign of someone else.",
      },
    ],
    betterTogether: [
      { slug: "billing-issue-type", reason: "Unrecognized charges are checked for takeover before any billing reply." },
      { slug: "phishing-report-triage", reason: "Credential phishing reports often precede takeover reports from the same people." },
    ],
    references: ["typesafe-noul-screen", "typesafe-probability-routing"],
    tags: ["security", "accounts", "noul"],
  },
  {
    slug: "cancellation-reason",
    name: "Cancellation reason",
    category: "research",
    summary: "Categorize why a customer is cancelling, for product and pricing insight. The cancellation always goes ahead.",
    problem:
      "Cancellation surveys get a free-text answer that nobody reads, or a forced dropdown that hides the real reason.",
    goal: "Turn cancellation comments into reasons product and pricing teams can count, while the cancellation itself is processed as asked.",
    input: {
      summary: "What the customer wrote when cancelling, and their plan.",
      fields: [
        { name: "comment", description: "The customer's cancellation message or survey answer." },
        { name: "plan", description: "Plan and tenure, for reporting." },
      ],
    },
    question: {
      key: "cancellation_reason",
      type: "choice",
      instructions: "What is the main reason the customer gives for cancelling?",
      options: [
        { key: "too_expensive", description: "Price, budget cuts or poor value for money." },
        { key: "missing_feature", description: "Needs a capability the product doesn't have." },
        { key: "switching_tools", description: "Moving to a named or unnamed competitor or an in-house tool." },
        { key: "not_using_enough", description: "Not using it, project ended, or team too small." },
        { key: "technical_problems", description: "Bugs, outages, performance or integrations not working." },
        { key: "temporary_pause", description: "Expects to come back, for example seasonal work or a break." },
      ],
    },
    outcomes: [
      choiceOutcome("too_expensive", "Too expensive"),
      choiceOutcome("missing_feature", "Missing feature"),
      choiceOutcome("switching_tools", "Switching tools"),
      choiceOutcome("not_using_enough", "Not using enough"),
      choiceOutcome("technical_problems", "Technical problems", "caution"),
      choiceOutcome("temporary_pause", "Temporary pause"),
      lowConfidence("Record as unclear"),
    ],
    guidance: [
      "Process the cancellation before or regardless of this answer. The reason is for insight, never a gate.",
      "Technical problems are worth a follow-up from support after the cancellation is confirmed.",
    ],
    caveats: ["Never use the reason to delay, block or add steps to a cancellation."],
    scenarios: [
      {
        id: "budget-cut",
        title: "Budget cut",
        state: { comment: "Budget got cut for next quarter, can't justify it right now.", plan: "Team, 14 months" },
        outcome: "too_expensive",
        rationale: "Budget is the stated reason.",
      },
      {
        id: "no-gantt",
        title: "Missing feature",
        state: { comment: "We really needed Gantt views for client projects.", plan: "Team, 3 months" },
        outcome: "missing_feature",
        rationale: "A specific missing capability.",
      },
      {
        id: "summer-break",
        title: "Seasonal break",
        state: { comment: "We're a school club, we'll be back in September.", plan: "Starter, 2 years" },
        outcome: "temporary_pause",
        rationale: "Expects to return.",
      },
      {
        id: "sync-broken",
        title: "Integration broken",
        state: { comment: "The calendar sync has been broken for weeks.", plan: "Team, 8 months" },
        outcome: "technical_problems",
        rationale: "A technical problem caused the cancellation.",
      },
      {
        id: "just-cancel",
        title: "No reason given",
        state: { comment: "just cancel pls", plan: "Starter, 1 month" },
        outcome: "low_confidence",
        rationale: "No reason given; recorded as unclear.",
      },
    ],
    betterTogether: [
      { slug: "billing-issue-type", reason: "Cancellation requests found in the billing inbox lead here." },
      { slug: "feedback-topic", reason: "Cancellation reasons and general feedback can share one theme report." },
    ],
    references: ["typesafe-system-one", "typesafe-confidence-routing"],
    tags: ["churn", "saas", "research"],
  },
];

export const chains: ClassifierChain[] = [
  {
    slug: "saas-billing-desk",
    name: "SaaS billing desk",
    category: "support",
    summary: "Sort billing messages, check unknown charges for account takeover, process cancellations as asked, and match the reply to the customer's mood.",
    goal: "Every billing message ends in the refund flow, a card update link, a processed cancellation, the right billing queue, the security team, or a person.",
    input: {
      summary: "The customer's message, account and billing facts, and recent security events.",
      fields: [
        { name: "message", description: "The customer's message." },
        { name: "account", description: "Plan, invoices and status from your billing system." },
        { name: "security_events", description: "Recent login and account changes." },
        { name: "prior_contacts", description: "Earlier contacts about the same issue, counted in code." },
      ],
    },
    entry: "issue",
    steps: [
      {
        id: "issue",
        classifier: "billing-issue-type",
        purpose: "Name the billing issue.",
        receives: [
          { from: "input", value: "message" },
          { from: "input", value: "account" },
        ],
        branches: [
          { outcomes: ["unrecognized_charge"], to: "takeover" },
          { outcomes: ["duplicate_or_post_cancel_charge"], to: "refund_handoff" },
          { outcomes: ["plan_or_price_question"], to: "tone" },
          { outcomes: ["failed_payment"], to: "payment_link" },
          { outcomes: ["cancellation_request"], to: "reason" },
          { outcomes: ["low_confidence"], to: "billing_agent" },
        ],
      },
      {
        id: "takeover",
        classifier: "account-takeover-signal",
        purpose: "Check whether someone else may have used the account.",
        receives: [
          { from: "input", value: "message" },
          { from: "input", value: "security_events" },
        ],
        branches: [
          { outcomes: ["signal_present"], to: "security_team" },
          { outcomes: ["unclear"], to: "billing_agent", note: "A billing agent checks with the account owner through a known contact." },
          { outcomes: ["no_signal"], to: "tone" },
        ],
      },
      {
        id: "reason",
        classifier: "cancellation-reason",
        purpose: "Record why they're leaving. The cancellation is not held up.",
        receives: [
          { from: "input", value: "message" },
          { from: "issue", value: "Issue: cancellation" },
        ],
        branches: [
          { outcomes: ["too_expensive", "missing_feature", "switching_tools", "not_using_enough", "low_confidence"], to: "cancel" },
          { outcomes: ["technical_problems"], to: "cancel_and_follow_up" },
          { outcomes: ["temporary_pause"], to: "cancel_with_pause_note" },
        ],
      },
      {
        id: "tone",
        classifier: "customer-frustration",
        purpose: "Match the replier to the customer's mood.",
        receives: [
          { from: "input", value: "message" },
          { from: "input", value: "prior_contacts" },
        ],
        branches: [
          { outcomes: ["calm_or_mild"], to: "billing_queue" },
          { outcomes: ["frustrated"], to: "billing_priority" },
          { outcomes: ["very_upset", "low_confidence"], to: "billing_agent" },
        ],
      },
    ],
    terminals: [
      { id: "refund_handoff", label: "Refund request resolution", description: "Duplicate and post-cancel charges continue in the refund chain.", kind: "handoff", handoffChain: "refund-request-resolution" },
      { id: "payment_link", label: "Send payment update link", description: "A secure link to update the card; no card details in the conversation.", kind: "automated" },
      { id: "cancel", label: "Cancel and confirm", description: "Cancelled as asked; the reason is stored for reporting.", kind: "automated" },
      { id: "cancel_and_follow_up", label: "Cancel, then support follow-up", description: "Cancelled as asked; support later asks about the technical problem.", kind: "automated" },
      { id: "cancel_with_pause_note", label: "Cancel, mention pausing", description: "Cancelled as asked; the confirmation mentions that a paused plan is available for next time.", kind: "automated" },
      { id: "billing_queue", label: "Billing queue", description: "Standard billing queue.", kind: "automated" },
      { id: "billing_priority", label: "Billing priority queue", description: "Top of the billing queue with an acknowledgement sent.", kind: "automated" },
      { id: "security_team", label: "Security team", description: "A security-trained person verifies the owner and secures the account.", kind: "human" },
      { id: "billing_agent", label: "Billing agent", description: "An experienced billing agent handles it personally.", kind: "human" },
    ],
    scenarios: [
      {
        id: "email-changed-charge",
        title: "Unknown charge after an email change",
        summary: "An unrecognized charge with signs of takeover goes to security first.",
        input: { message: "There's a $49 charge I don't recognize and I got an email that my login email changed.", account: ACCOUNT, security_events: ["email changed 2h ago"], prior_contacts: 0 },
        path: [
          { step: "issue", outcome: "unrecognized_charge", note: "The customer doesn't recognize the charge." },
          { step: "takeover", outcome: "signal_present", note: "An account change they didn't make." },
        ],
        terminal: "security_team",
      },
      {
        id: "colleague-upgrade",
        title: "Charge explained by a colleague",
        summary: "No sign of takeover: the charge is handled as an ordinary billing question.",
        input: { message: "We got charged for 9 seats instead of 8, did someone add a user?", account: { ...ACCOUNT, seats: 9 }, security_events: [], prior_contacts: 0 },
        path: [
          { step: "issue", outcome: "unrecognized_charge", note: "The customer doesn't recognize the amount." },
          { step: "takeover", outcome: "no_signal", note: "No unusual account events." },
          { step: "tone", outcome: "calm_or_mild", note: "A calm question." },
        ],
        terminal: "billing_queue",
      },
      {
        id: "charged-after-cancel",
        title: "Charged after cancelling",
        summary: "A charge after cancellation goes to the refund chain.",
        input: { message: "I cancelled in February and you charged me again. Refund please.", account: { ...ACCOUNT, status: "cancelled" }, security_events: [], prior_contacts: 0 },
        path: [{ step: "issue", outcome: "duplicate_or_post_cancel_charge", note: "Charged after cancellation." }],
        terminal: "refund_handoff",
      },
      {
        id: "school-club",
        title: "Seasonal cancellation",
        summary: "The cancellation goes ahead; the confirmation mentions pausing for next time.",
        input: { message: "Please cancel, we're a school club and stop for the summer. Back in September!", account: ACCOUNT, security_events: [], prior_contacts: 0 },
        path: [
          { step: "issue", outcome: "cancellation_request", note: "Asks to cancel." },
          { step: "reason", outcome: "temporary_pause", note: "Expects to come back." },
        ],
        terminal: "cancel_with_pause_note",
      },
      {
        id: "just-cancel",
        title: "Cancellation with no reason",
        summary: "An unclear reason never holds up the cancellation.",
        input: { message: "just cancel pls", account: ACCOUNT, security_events: [], prior_contacts: 0 },
        path: [
          { step: "issue", outcome: "cancellation_request", note: "Asks to cancel." },
          { step: "reason", outcome: "low_confidence", note: "No reason given; recorded as unclear." },
        ],
        terminal: "cancel",
      },
      {
        id: "third-proration",
        title: "Frustrated pricing question",
        summary: "A routine question asked for the third time goes to the priority queue.",
        input: { message: "Third time asking: why did the invoice go up when we added ONE person?", account: ACCOUNT, security_events: [], prior_contacts: 2 },
        path: [
          { step: "issue", outcome: "plan_or_price_question", note: "A proration question." },
          { step: "tone", outcome: "frustrated", note: "Repeated contact, sharp wording." },
        ],
        terminal: "billing_priority",
      },
      {
        id: "expired-card",
        title: "Expired card",
        summary: "A failed payment gets a secure update link.",
        input: { message: "Payment failed, my card expired. How do I update it?", account: { ...ACCOUNT, status: "past_due" }, security_events: [], prior_contacts: 0 },
        path: [{ step: "issue", outcome: "failed_payment", note: "Expired card." }],
        terminal: "payment_link",
      },
      {
        id: "everything-wrong",
        title: "Several billing issues at once",
        summary: "A declined card, a double charge and a cancellation in one message go to a billing agent.",
        input: { message: "Card got declined, then I was charged twice, and now I just want out.", account: ACCOUNT, security_events: [], prior_contacts: 1 },
        path: [{ step: "issue", outcome: "low_confidence", note: "Three issues in one message." }],
        terminal: "billing_agent",
      },
    ],
    notes: [
      "The cancellation branch has no path that stops or delays a cancellation; every reason, including an unclear one, ends in the cancellation being processed.",
      "Billing issue, takeover signal and frustration can be asked in one fan-out request; code follows the branches above to decide which answers count.",
    ],
    references: ["typesafe-system-one", "typesafe-fan-out", "typesafe-probability-routing", "kev-4b-model-card"],
  },
];
