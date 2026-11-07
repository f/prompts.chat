import type { ClassifierChain, ClassifierDefinition } from "../../../../src/lib/classifiers/types";
import { choiceOutcome, lowConfidence, noulOutcomes } from "../outcomes";

const SERVICE_RULES =
  "Drivers may leave parcels with a named neighbour or in a safe place out of sight from the street. Signature-required parcels must be handed to the recipient or collected from a pickup point. Drivers cannot enter gated areas without a code.";

export const classifiers: ClassifierDefinition[] = [
  {
    slug: "delivery-exception-type",
    name: "Delivery exception type",
    category: "logistics",
    summary: "Read carrier scan notes and the customer's message to tell why a delivery didn't happen as planned.",
    problem:
      "Carrier exception codes are inconsistent across carriers and driver notes are free text. Logistics teams spend their time decoding scans before they can fix anything.",
    goal: "Name the exception so address fixes, redelivery, delay updates, damage claims and traces each start in the right place.",
    input: {
      summary: "The latest carrier events and, when there is one, the customer's message.",
      fields: [
        { name: "carrier_events", description: "Recent tracking events with the driver's notes, as returned by the carrier." },
        { name: "customer_message", description: "The customer's message, if they contacted you." },
      ],
    },
    question: {
      key: "exception_type",
      type: "choice",
      instructions: "What is the main reason this delivery did not complete as planned?",
      options: [
        { key: "address_problem", description: "The address is incomplete, wrong or couldn't be found." },
        { key: "recipient_unavailable", description: "The driver reached the address but nobody could receive the parcel." },
        { key: "damaged_in_transit", description: "The carrier reports the parcel or its contents damaged." },
        { key: "delayed_in_network", description: "The parcel is moving but behind schedule, for example a missed connection or weather." },
        { key: "lost_or_no_scan", description: "No movement for an unusually long time, or the carrier cannot locate the parcel." },
        { key: "customs_hold", description: "Held at customs, for example waiting for documents or duties." },
      ],
    },
    outcomes: [
      choiceOutcome("address_problem", "Address problem"),
      choiceOutcome("recipient_unavailable", "Recipient unavailable"),
      choiceOutcome("damaged_in_transit", "Damaged in transit", "caution"),
      choiceOutcome("delayed_in_network", "Delayed in network"),
      choiceOutcome("lost_or_no_scan", "Lost or no scan", "caution"),
      choiceOutcome("customs_hold", "Customs hold"),
      lowConfidence("Logistics agent"),
    ],
    guidance: [
      "Compute how long the parcel has been without a scan in code and pass the number of days; don't ask the model to compare timestamps.",
      "Normalize events from different carriers to one shape before sending them, so the same exception reads the same way.",
      "Carrier text is external input. If it feeds an assistant later, keep it marked as data.",
    ],
    scenarios: [
      {
        id: "no-flat-number",
        title: "Flat number missing",
        state: { carrier_events: [{ status: "exception", note: "Address incomplete - no flat number, building has 40 units" }], customer_message: "" },
        outcome: "address_problem",
        rationale: "The driver couldn't find the right unit.",
      },
      {
        id: "card-left",
        title: "Nobody home",
        state: { carrier_events: [{ status: "attempted", note: "No answer, card left" }], customer_message: "I was at work, can you leave it next door?" },
        outcome: "recipient_unavailable",
        rationale: "The driver reached the address but nobody could receive it.",
      },
      {
        id: "crushed-in-depot",
        title: "Damaged in depot",
        state: { carrier_events: [{ status: "exception", note: "Parcel damaged in handling, contents exposed" }], customer_message: "" },
        outcome: "damaged_in_transit",
        rationale: "The carrier reports damage.",
      },
      {
        id: "missed-trunk",
        title: "Missed connection",
        state: { carrier_events: [{ status: "in_transit", note: "Missed linehaul due to weather, rescheduled" }], customer_message: "" },
        outcome: "delayed_in_network",
        rationale: "Moving but behind schedule.",
      },
      {
        id: "silent-nine-days",
        title: "No scan for nine days",
        state: { carrier_events: [{ status: "in_transit", note: "Arrived at sort centre" }], days_since_last_scan: 9, customer_message: "Where is my parcel??" },
        outcome: "lost_or_no_scan",
        rationale: "Nine days without movement, computed in code.",
      },
      {
        id: "duties-due",
        title: "Waiting for duties",
        state: { carrier_events: [{ status: "held", note: "Held by customs - import duties unpaid" }], customer_message: "" },
        outcome: "customs_hold",
        rationale: "Held at customs pending duties.",
      },
      {
        id: "exception-no-note",
        title: "Exception with no detail",
        state: { carrier_events: [{ status: "exception", note: "" }], customer_message: "Tracking says exception, what does that mean?" },
        outcome: "low_confidence",
        rationale: "Nothing says what the exception was.",
      },
    ],
    betterTogether: [
      { slug: "address-completeness", reason: "Address exceptions continue with a check of what exactly is missing." },
      { slug: "delivery-instruction-feasibility", reason: "When nobody was home, check whether the customer's instruction for the next attempt can be followed." },
      { slug: "shipment-delay-impact", reason: "Delays and customs holds need an impact read before you decide how proactively to contact the customer." },
      { slug: "order-issue-type", reason: "The customer's own description of the problem complements the carrier's view." },
    ],
    references: ["typesafe-system-one", "typesafe-jaggedness", "typesafe-confidence-routing"],
    tags: ["delivery", "carrier", "logistics"],
  },
  {
    slug: "address-completeness",
    name: "Address completeness",
    category: "logistics",
    summary: "Check whether a delivery address has what a driver needs, or is missing a unit, ambiguous or outside the service area.",
    problem:
      "Address validation services confirm that a street exists, but not that a driver can find the right door. Missing flat numbers and vague rural directions cause repeat failed attempts.",
    goal: "Catch addresses that will fail before dispatch or a re-attempt, and ask the customer one specific question.",
    input: {
      summary: "The address as entered, any delivery notes, and facts your address service already returned.",
      fields: [
        { name: "address", description: "The address lines as the customer entered them." },
        { name: "address_service", description: "Facts from your address lookup, such as \"multi-unit building\" or \"outside service area\"." },
        { name: "delivery_notes", description: "Any directions the customer added." },
      ],
    },
    question: {
      key: "address_status",
      type: "choice",
      instructions: "Does this address give a driver what they need to deliver to the right door?",
      options: [
        { key: "deliverable", description: "Complete and specific enough for a driver to find the door." },
        { key: "missing_unit", description: "A multi-unit building with no flat, suite or unit number." },
        { key: "ambiguous_location", description: "The location can't be pinned down, for example vague rural directions or conflicting details." },
        { key: "not_serviceable", description: "Your address facts say the carrier cannot deliver here, for example outside the service area." },
      ],
    },
    outcomes: [
      choiceOutcome("deliverable", "Deliverable"),
      choiceOutcome("missing_unit", "Ask for unit number", "caution"),
      choiceOutcome("ambiguous_location", "Ask for directions", "caution"),
      choiceOutcome("not_serviceable", "Not serviceable", "review"),
      lowConfidence(),
    ],
    guidance: [
      "Postcode and street validation belong to an address service. Pass its results in; this question covers what the service can't judge.",
      "Ask the customer for exactly the missing detail. A generic \"please check your address\" is often ignored.",
    ],
    scenarios: [
      {
        id: "house-complete",
        title: "Complete house address",
        state: { address: "27 Mill Lane, Hebden Bridge, HX7 8AB", address_service: "single dwelling, in service area", delivery_notes: "" },
        outcome: "deliverable",
        rationale: "A single dwelling with a full address.",
      },
      {
        id: "tower-no-flat",
        title: "Tower block without a flat number",
        state: { address: "Riverside Tower, 1 Quay Street, Manchester", address_service: "multi-unit building (120 units)", delivery_notes: "" },
        outcome: "missing_unit",
        rationale: "No unit in a large building.",
      },
      {
        id: "farm-track",
        title: "Vague rural directions",
        state: { address: "The Old Barn, near the church", address_service: "postcode covers 14 properties", delivery_notes: "third gate on the left after the bridge, or maybe the fourth" },
        outcome: "ambiguous_location",
        rationale: "The directions are uncertain and the postcode is shared.",
      },
      {
        id: "island",
        title: "Outside the service area",
        state: { address: "Croft 3, Isle of Foula", address_service: "outside carrier service area", delivery_notes: "" },
        outcome: "not_serviceable",
        rationale: "The address service says the carrier can't deliver there.",
      },
      {
        id: "two-addresses",
        title: "Two addresses in one field",
        state: { address: "12 Park Road or my work at 40 High St, Leeds", address_service: "two candidate matches", delivery_notes: "" },
        outcome: "low_confidence",
        rationale: "The customer gave two addresses.",
      },
    ],
    betterTogether: [
      { slug: "delivery-exception-type", reason: "Address exceptions from the carrier lead here." },
      { slug: "order-change-request", reason: "A new address from a change request should be checked before it replaces the old one." },
      { slug: "delivery-instruction-feasibility", reason: "Delivery notes attached to the address can be checked against what drivers are allowed to do." },
    ],
    references: ["typesafe-system-one", "typesafe-confidence-routing"],
    tags: ["delivery", "address", "logistics"],
  },
  {
    slug: "delivery-instruction-feasibility",
    name: "Delivery instruction feasibility",
    category: "logistics",
    summary: "Check whether a customer's delivery instruction can be followed under the carrier's service rules.",
    problem:
      "Customers add instructions like \"leave it on the porch\" to parcels that need a signature, or name places drivers can't reach. The driver finds out at the door.",
    goal: "Pass feasible instructions to the driver, and reply before the next attempt when an instruction can't be followed.",
    input: {
      summary: "The customer's instruction, the parcel's service level, and your carrier's rules.",
      fields: [
        { name: "instruction", description: "What the customer asked the driver to do." },
        { name: "service", description: "Parcel service level, for example \"standard\" or \"signature required\"." },
        { name: "service_rules", description: "Short summary of what drivers are allowed to do." },
      ],
    },
    question: {
      key: "instruction_feasible",
      type: "noul",
      instructions: "Can a driver follow this instruction for this parcel under the service rules?",
      options: [
        { key: "true", description: "The instruction is allowed for this parcel and specific enough to follow." },
        { key: "false", description: "The service rules don't allow it for this parcel, or it asks for something drivers cannot do." },
      ],
    },
    outcomes: noulOutcomes(
      { id: "can_follow", label: "Pass to driver", tone: "proceed" },
      { id: "cannot_follow", label: "Offer an alternative", tone: "caution" }
    ),
    guidance: [
      "Keep the rules short and concrete. Long terms of carriage make the question harder to answer consistently.",
      "When an instruction can't be followed, offer the alternatives your rules do allow, such as a pickup point.",
    ],
    scenarios: [
      {
        id: "neighbour",
        title: "Leave with a neighbour",
        state: { instruction: "Leave with Mrs Patel at number 14.", service: "standard", service_rules: SERVICE_RULES },
        outcome: "can_follow",
        rationale: "A named neighbour is allowed for a standard parcel.",
      },
      {
        id: "porch-signature",
        title: "Porch for a signature parcel",
        state: { instruction: "Just leave it on the porch.", service: "signature required", service_rules: SERVICE_RULES },
        outcome: "cannot_follow",
        rationale: "Signature parcels must be handed over or collected.",
      },
      {
        id: "gate-no-code",
        title: "Behind a gate, no code",
        state: { instruction: "Put it behind the gate in the back garden.", service: "standard", service_rules: SERVICE_RULES },
        outcome: "unclear",
        rationale: "Allowed as a safe place, but the gate may need a code the driver doesn't have.",
      },
      {
        id: "safe-place",
        title: "Out of sight in the shed",
        state: { instruction: "Unlocked shed to the left of the house, please close the door after.", service: "standard", service_rules: SERVICE_RULES },
        outcome: "can_follow",
        rationale: "A specific safe place out of sight from the street.",
      },
    ],
    betterTogether: [
      { slug: "delivery-exception-type", reason: "Runs after a failed attempt where nobody was home." },
      { slug: "address-completeness", reason: "Directions in delivery notes are part of whether the driver can find the door." },
    ],
    references: ["typesafe-noul-screen", "typesafe-system-one"],
    tags: ["delivery", "instructions", "noul"],
  },
  {
    slug: "shipment-delay-impact",
    name: "Shipment delay impact",
    category: "logistics",
    summary: "Gauge how much a delay matters to this customer, from a notification to urgent handling.",
    problem:
      "Every delay gets the same templated email, whether the parcel is a spare phone case or the outfit for a wedding on Saturday.",
    goal: "Spend proactive contact and paid upgrades where a delay actually affects a customer's plans.",
    input: {
      summary: "The delay computed in code, the order, and anything the customer said about why they need it.",
      fields: [
        { name: "delay_days", description: "Days past the promised date, computed in code." },
        { name: "order_summary", description: "What was ordered." },
        { name: "customer_context", description: "Anything the customer said about when or why they need it." },
      ],
    },
    question: {
      key: "delay_impact",
      type: "score",
      instructions: "How much does this delay affect the customer, given what they ordered and said?",
      options: [
        { key: "0", description: "Minor: no stated need and a small delay." },
        { key: "1", description: "Noticeable: a longer delay, or the customer has asked where it is." },
        { key: "2", description: "Affects a plan: the customer mentions a date, event or task the delay puts at risk." },
        { key: "3", description: "Time-critical: perishable goods, or the delay will miss a stated date unless something changes now." },
      ],
    },
    outcomes: [
      { id: "notify_only", label: "Notify", when: "Most likely level is 0 and confidence meets your threshold.", tone: "proceed" },
      { id: "proactive_update", label: "Proactive update", when: "Most likely level is 1 and confidence meets your threshold.", tone: "proceed" },
      { id: "offer_options", label: "Offer options", when: "Most likely level is 2 and confidence meets your threshold.", tone: "caution" },
      { id: "urgent_handling", label: "Urgent handling", when: "Most likely level is 3 and confidence meets your threshold.", tone: "review" },
      lowConfidence("Logistics agent"),
    ],
    guidance: [
      "Compute the delay from dates in code and pass the number. Date arithmetic is a known weak spot for language models.",
      "What counts as an option (upgrade, reship, refund of shipping) is your policy, applied in code.",
    ],
    scenarios: [
      {
        id: "phone-case",
        title: "Small delay, no stated need",
        state: { delay_days: 1, order_summary: "Phone case", customer_context: "" },
        outcome: "notify_only",
        rationale: "A one-day delay with nothing at stake.",
      },
      {
        id: "where-is-it",
        title: "Customer asking where it is",
        state: { delay_days: 4, order_summary: "Bookshelf", customer_context: "It's been four days past the date, any news?" },
        outcome: "proactive_update",
        rationale: "Longer delay and the customer is waiting for news.",
      },
      {
        id: "wedding-saturday",
        title: "Needed for an event",
        state: { delay_days: 2, order_summary: "Suit, tailored trousers", customer_context: "I need this for my brother's wedding on Saturday." },
        outcome: "offer_options",
        rationale: "A stated event is at risk.",
      },
      {
        id: "frozen-goods",
        title: "Perishable goods",
        state: { delay_days: 2, order_summary: "Frozen meal box, ships with ice packs", customer_context: "" },
        outcome: "urgent_handling",
        rationale: "Perishable contents won't survive a longer delay.",
      },
      {
        id: "need-it-soon",
        title: "Vague urgency",
        state: { delay_days: 2, order_summary: "Printer ink", customer_context: "kind of need this soon-ish" },
        outcome: "low_confidence",
        rationale: "The stated need is too vague to place.",
      },
    ],
    betterTogether: [
      { slug: "delivery-exception-type", reason: "Runs after delays and customs holds are identified." },
      { slug: "customer-frustration", reason: "Impact is about the customer's plans; frustration is about their tone. Both shape who replies." },
    ],
    references: ["typesafe-system-one", "typesafe-jaggedness", "typesafe-probability-routing"],
    tags: ["delivery", "delay", "score"],
  },
];

export const chains: ClassifierChain[] = [
  {
    slug: "delivery-exception-routing",
    name: "Delivery exception routing",
    category: "logistics",
    summary: "Decode a carrier exception, then fix the address, adjust the next attempt, or tell the customer what the delay means for them.",
    goal: "Every exception ends in a re-attempt, a specific question to the customer, a delay update, a damage claim, a trace, or a person.",
    input: {
      summary: "Normalized carrier events, the customer's message and address, and the parcel's service level.",
      fields: [
        { name: "carrier_events", description: "Recent tracking events with driver notes." },
        { name: "customer_message", description: "The customer's message, if any." },
        { name: "address", description: "The delivery address and notes." },
        { name: "service", description: "Parcel service level and your carrier rules." },
        { name: "delay_days", description: "Days past the promised date, computed in code." },
      ],
    },
    entry: "exception",
    steps: [
      {
        id: "exception",
        classifier: "delivery-exception-type",
        purpose: "Name what went wrong.",
        receives: [
          { from: "input", value: "carrier_events" },
          { from: "input", value: "customer_message" },
        ],
        branches: [
          { outcomes: ["address_problem"], to: "address" },
          { outcomes: ["recipient_unavailable"], to: "instruction" },
          { outcomes: ["delayed_in_network", "customs_hold"], to: "impact" },
          { outcomes: ["damaged_in_transit"], to: "order_handoff" },
          { outcomes: ["lost_or_no_scan"], to: "carrier_trace" },
          { outcomes: ["low_confidence"], to: "logistics_agent" },
        ],
      },
      {
        id: "address",
        classifier: "address-completeness",
        purpose: "Find what the driver was missing.",
        receives: [
          { from: "input", value: "address" },
          { from: "exception", value: "Exception: address problem" },
        ],
        branches: [
          { outcomes: ["deliverable"], to: "reattempt", note: "The address is fine; the next attempt includes the driver's note." },
          { outcomes: ["missing_unit", "ambiguous_location"], to: "ask_customer" },
          { outcomes: ["not_serviceable", "low_confidence"], to: "logistics_agent" },
        ],
      },
      {
        id: "instruction",
        classifier: "delivery-instruction-feasibility",
        purpose: "Check the customer's instruction for the next attempt.",
        receives: [
          { from: "input", value: "customer_message as the instruction" },
          { from: "input", value: "service" },
        ],
        branches: [
          { outcomes: ["can_follow"], to: "reattempt" },
          { outcomes: ["cannot_follow"], to: "offer_pickup" },
          { outcomes: ["unclear"], to: "ask_customer" },
        ],
      },
      {
        id: "impact",
        classifier: "shipment-delay-impact",
        purpose: "Decide how much contact the delay needs.",
        receives: [
          { from: "input", value: "delay_days" },
          { from: "input", value: "order and customer_message" },
          { from: "exception", value: "Exception: delay or customs hold" },
        ],
        branches: [
          { outcomes: ["notify_only", "proactive_update"], to: "status_update" },
          { outcomes: ["offer_options"], to: "offer_options" },
          { outcomes: ["urgent_handling", "low_confidence"], to: "logistics_agent" },
        ],
      },
    ],
    terminals: [
      { id: "reattempt", label: "Schedule re-attempt", description: "The next attempt is booked with the instruction or note passed to the driver.", kind: "automated" },
      { id: "ask_customer", label: "Ask the customer", description: "One specific question: the unit number, clearer directions, or what the instruction means.", kind: "automated" },
      { id: "offer_pickup", label: "Offer a pickup point", description: "Explains why the instruction can't be followed and offers the alternatives the rules allow.", kind: "automated" },
      { id: "status_update", label: "Send status update", description: "A delay notice with the new estimate from the carrier.", kind: "automated" },
      { id: "offer_options", label: "Offer options", description: "Offers the choices your policy allows, such as an upgrade or a reship.", kind: "automated" },
      { id: "order_handoff", label: "Order problem resolution", description: "Damage continues in the order chain, which reads what the customer wants.", kind: "handoff", handoffChain: "order-problem-resolution" },
      { id: "carrier_trace", label: "Carrier trace", description: "A logistics agent opens a trace with the carrier.", kind: "human" },
      { id: "logistics_agent", label: "Logistics agent", description: "A person handles urgent, unusual or unclear cases.", kind: "human" },
    ],
    scenarios: [
      {
        id: "flat-number",
        title: "Missing flat number",
        summary: "An address exception becomes one precise question to the customer.",
        input: { carrier_events: [{ status: "exception", note: "No flat number, 120-unit building" }], customer_message: "", address: "Riverside Tower, 1 Quay Street", service: "standard", delay_days: 0 },
        path: [
          { step: "exception", outcome: "address_problem", note: "The driver couldn't find the unit." },
          { step: "address", outcome: "missing_unit", note: "A large building with no unit number." },
        ],
        terminal: "ask_customer",
      },
      {
        id: "neighbour-next-time",
        title: "Leave with a neighbour next time",
        summary: "A feasible instruction goes to the driver for the re-attempt.",
        input: { carrier_events: [{ status: "attempted", note: "No answer, card left" }], customer_message: "Please leave it with Mrs Patel at number 14.", address: "12 Park Road", service: "standard", delay_days: 0 },
        path: [
          { step: "exception", outcome: "recipient_unavailable", note: "Nobody was home." },
          { step: "instruction", outcome: "can_follow", note: "A named neighbour is allowed." },
        ],
        terminal: "reattempt",
      },
      {
        id: "porch-signature",
        title: "Porch requested for a signature parcel",
        summary: "An instruction the rules don't allow becomes a pickup point offer, before the next failed attempt.",
        input: { carrier_events: [{ status: "attempted", note: "Signature required, no answer" }], customer_message: "Just leave it on the porch.", address: "8 Hill View", service: "signature required", delay_days: 0 },
        path: [
          { step: "exception", outcome: "recipient_unavailable", note: "Nobody home to sign." },
          { step: "instruction", outcome: "cannot_follow", note: "Signature parcels can't be left." },
        ],
        terminal: "offer_pickup",
      },
      {
        id: "wedding-delay",
        title: "Delay puts an event at risk",
        summary: "The same delay gets options instead of a template when the customer has a date.",
        input: { carrier_events: [{ status: "in_transit", note: "Missed linehaul, rescheduled" }], customer_message: "I need this for a wedding on Saturday.", address: "4 Green Row", service: "standard", delay_days: 2 },
        path: [
          { step: "exception", outcome: "delayed_in_network", note: "Missed connection." },
          { step: "impact", outcome: "offer_options", note: "A stated event is at risk." },
        ],
        terminal: "offer_options",
      },
      {
        id: "customs-routine",
        title: "Routine customs hold",
        summary: "A customs hold with nothing at stake gets a status update.",
        input: { carrier_events: [{ status: "held", note: "Customs clearance in progress" }], customer_message: "", address: "22 Rue des Lilas", service: "standard", delay_days: 1 },
        path: [
          { step: "exception", outcome: "customs_hold", note: "Held at customs." },
          { step: "impact", outcome: "notify_only", note: "Small delay, no stated need." },
        ],
        terminal: "status_update",
      },
      {
        id: "nine-days-silent",
        title: "No scan for nine days",
        summary: "A parcel without movement goes to a person who opens a trace.",
        input: { carrier_events: [{ status: "in_transit", note: "Arrived at sort centre" }], customer_message: "Where is my parcel?", address: "9 Bay Close", service: "standard", delay_days: 6, days_since_last_scan: 9 },
        path: [{ step: "exception", outcome: "lost_or_no_scan", note: "Nine days without a scan, computed in code." }],
        terminal: "carrier_trace",
      },
      {
        id: "damaged-depot",
        title: "Damaged in the depot",
        summary: "Carrier-reported damage continues in the order chain.",
        input: { carrier_events: [{ status: "exception", note: "Damaged in handling, contents exposed" }], customer_message: "", address: "3 Elm Court", service: "standard", delay_days: 0 },
        path: [{ step: "exception", outcome: "damaged_in_transit", note: "The carrier reports damage." }],
        terminal: "order_handoff",
      },
      {
        id: "frozen-box",
        title: "Perishable parcel delayed",
        summary: "A delay to perishable goods goes straight to a person.",
        input: { carrier_events: [{ status: "in_transit", note: "Vehicle breakdown, delayed 24h" }], customer_message: "", address: "15 Oak Way", service: "standard", delay_days: 1, order: "Frozen meal box with ice packs" },
        path: [
          { step: "exception", outcome: "delayed_in_network", note: "Delayed by a breakdown." },
          { step: "impact", outcome: "urgent_handling", note: "Contents won't survive a longer delay." },
        ],
        terminal: "logistics_agent",
      },
    ],
    notes: [
      "Dates, scan gaps and service rules are computed or looked up in code and passed as facts. The classifiers judge text, not timestamps.",
      "The order chain hands \"not received\" messages here, and this chain hands carrier-reported damage back. Each handoff starts the other chain from its entry; neither loops within a chain.",
    ],
    references: ["typesafe-system-one", "typesafe-jaggedness", "typesafe-confidence-routing"],
  },
];
