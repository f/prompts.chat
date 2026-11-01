export interface Chapter {
  slug: string;
  title: string;
  part: string;
  partNumber: number;
  chapterNumber: number;
  description?: string;
}

export interface Part {
  number: number;
  title: string;
  slug: string;
  chapters: Chapter[];
}

export const parts: Part[] = [
  {
    number: 0,
    title: "Introduction",
    slug: "introduction",
    chapters: [
      { slug: "00a-preface", title: "Preface", part: "Introduction", partNumber: 0, chapterNumber: 0, description: "A personal note from the author" },
      { slug: "00b-history", title: "History", part: "Introduction", partNumber: 0, chapterNumber: 1, description: "The story of Awesome ChatGPT Prompts" },
      { slug: "00c-introduction", title: "Introduction", part: "Introduction", partNumber: 0, chapterNumber: 2, description: "What is prompt engineering and why it matters" },
    ],
  },
  {
    number: 1,
    title: "Foundations",
    slug: "part-i-foundations",
    chapters: [
      { slug: "01-understanding-ai-models", title: "Understanding AI Models", part: "Foundations", partNumber: 1, chapterNumber: 1, description: "How large language models work" },
      { slug: "02-anatomy-of-effective-prompt", title: "Anatomy of an Effective Prompt", part: "Foundations", partNumber: 1, chapterNumber: 2, description: "Components that make prompts work" },
      { slug: "03-core-prompting-principles", title: "Core Prompting Principles", part: "Foundations", partNumber: 1, chapterNumber: 3, description: "Fundamental principles for better prompts" },
    ],
  },
  {
    number: 2,
    title: "Techniques",
    slug: "part-ii-techniques",
    chapters: [
      { slug: "04-role-based-prompting", title: "Role-Based Prompting", part: "Techniques", partNumber: 2, chapterNumber: 4, description: "Using personas and roles effectively" },
      { slug: "05-structured-output", title: "Structured Output", part: "Techniques", partNumber: 2, chapterNumber: 5, description: "Getting consistent, formatted responses" },
      { slug: "06-chain-of-thought", title: "Chain of Thought", part: "Techniques", partNumber: 2, chapterNumber: 6, description: "Step-by-step reasoning for complex tasks" },
      { slug: "07-few-shot-learning", title: "Few-Shot Learning", part: "Techniques", partNumber: 2, chapterNumber: 7, description: "Teaching by example" },
      { slug: "08-iterative-refinement", title: "Iterative Refinement", part: "Techniques", partNumber: 2, chapterNumber: 8, description: "Improving prompts through iteration" },
      { slug: "09-json-yaml-prompting", title: "JSON & YAML Prompting", part: "Techniques", partNumber: 2, chapterNumber: 9, description: "Structured data formats in prompts" },
    ],
  },
  {
    number: 3,
    title: "Advanced Strategies",
    slug: "part-iii-advanced",
    chapters: [
      { slug: "10-system-prompts-personas", title: "System Prompts & Personas", part: "Advanced", partNumber: 3, chapterNumber: 10, description: "Creating consistent AI personalities" },
      { slug: "11-prompt-chaining", title: "Prompt Chaining", part: "Advanced", partNumber: 3, chapterNumber: 11, description: "Connecting multiple prompts" },
      { slug: "12-handling-edge-cases", title: "Handling Edge Cases", part: "Advanced", partNumber: 3, chapterNumber: 12, description: "Dealing with unexpected inputs" },
      { slug: "13-multimodal-prompting", title: "Multimodal Prompting", part: "Advanced", partNumber: 3, chapterNumber: 13, description: "Working with images, audio, and video" },
      { slug: "14-context-engineering", title: "Context Engineering", part: "Advanced", partNumber: 3, chapterNumber: 14, description: "RAG, embeddings, function calling, and MCP" },
      { slug: "14a-loop-engineering", title: "The Loop Engineering", part: "Advanced", partNumber: 3, chapterNumber: 26, description: "Designing feedback cycles that act, verify, adapt, and know when to stop" },
      { slug: "24a-from-prompt-to-team", title: "From Prompt to Team", part: "Advanced", partNumber: 3, chapterNumber: 30, description: "Prompts, skills, agents, bots, and teams in plain words, and how they differ" },
      { slug: "25-agents-and-skills", title: "Agents & Skills", part: "Advanced", partNumber: 3, chapterNumber: 25, description: "Building AI agents with reusable skill packages" },
      { slug: "27-tools-mcp-connectors", title: "Tools, MCP and Connectors", part: "Advanced", partNumber: 3, chapterNumber: 27, description: "How tools, MCP, and connectors give AI access to data and actions" },
      { slug: "26-the-harnesses", title: "The Harnesses", part: "Advanced", partNumber: 3, chapterNumber: 28, description: "How harnesses connect models, prompts, skills, and tools" },
      { slug: "28-persistent-bots", title: "Always-On Bots: Agents That Keep Working", part: "Advanced", partNumber: 3, chapterNumber: 29, description: "How persistent bots use memory, routines, and approvals to keep working" },
    ],
  },
  {
    number: 4,
    title: "Best Practices",
    slug: "part-iv-best-practices",
    chapters: [
      { slug: "15-common-pitfalls", title: "Common Pitfalls", part: "Best Practices", partNumber: 4, chapterNumber: 15, description: "Mistakes to avoid" },
      { slug: "16-ethics-responsible-use", title: "Ethics & Responsible Use", part: "Best Practices", partNumber: 4, chapterNumber: 16, description: "Ethical considerations in AI" },
      { slug: "17-prompt-optimization", title: "Prompt Optimization", part: "Best Practices", partNumber: 4, chapterNumber: 17, description: "Testing and improving prompts" },
    ],
  },
  {
    number: 5,
    title: "Use Cases",
    slug: "part-v-use-cases",
    chapters: [
      { slug: "18-writing-content", title: "Writing & Content", part: "Use Cases", partNumber: 5, chapterNumber: 18, description: "Content creation and copywriting" },
      { slug: "19-programming-development", title: "Programming & Development", part: "Use Cases", partNumber: 5, chapterNumber: 19, description: "Code generation and debugging" },
      { slug: "20-education-learning", title: "Education & Learning", part: "Use Cases", partNumber: 5, chapterNumber: 20, description: "Teaching and learning applications" },
      { slug: "21-business-productivity", title: "Business & Productivity", part: "Use Cases", partNumber: 5, chapterNumber: 21, description: "Professional and workplace applications" },
      { slug: "22-creative-arts", title: "Creative Arts", part: "Use Cases", partNumber: 5, chapterNumber: 22, description: "Artistic and creative applications" },
      { slug: "23-research-analysis", title: "Research & Analysis", part: "Use Cases", partNumber: 5, chapterNumber: 23, description: "Data analysis and research tasks" },
    ],
  },
  {
    number: 6,
    title: "Conclusion",
    slug: "part-vi-conclusion",
    chapters: [
      { slug: "24-future-of-prompting", title: "The Future of Prompting", part: "Conclusion", partNumber: 6, chapterNumber: 24, description: "Emerging trends and looking ahead" },
    ],
  },
];

export function getAllChapters(): Chapter[] {
  return parts.flatMap((part) => part.chapters);
}

export function getChapterBySlug(slug: string): Chapter | undefined {
  return getAllChapters().find((chapter) => chapter.slug === slug);
}

export function getAdjacentChapters(slug: string): { prev?: Chapter; next?: Chapter } {
  const chapters = getAllChapters();
  const index = chapters.findIndex((chapter) => chapter.slug === slug);
  return {
    prev: index > 0 ? chapters[index - 1] : undefined,
    next: index < chapters.length - 1 ? chapters[index + 1] : undefined,
  };
}
