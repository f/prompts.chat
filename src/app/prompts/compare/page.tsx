import { PromptComparison } from "@/components/prompts/prompt-comparison";
import { PromptExporter } from "@/components/prompts/prompt-exporter";

export const metadata = {
  title: "Prompt Comparison Studio | Nexus Prompts",
  description: "Compare prompt variations side-by-side with parameter controls and multi-format export.",
};

export default function ComparePage() {
  return (
    <main className="container py-8 space-y-8">
      <PromptComparison />
      <PromptExporter
        title="Software Engineer Persona Review Prompt"
        promptText="Act as a Senior Software Engineer. Review the code for security, performance, and maintainability. Output structured recommendations."
        description="Persona and constraint-based code review prompt format"
        author="Nexus Prompts Studio"
        tags={["code-review", "engineering", "security"]}
      />
    </main>
  );
}
