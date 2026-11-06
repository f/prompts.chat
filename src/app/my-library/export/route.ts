import { loadRepositoryLibrary } from "@/lib/my-library/repository";
import { exportPortable } from "@/lib/my-library/export";
import { compactDirectory, exportCsv } from "@/lib/my-library";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") ?? "json";
  if (!["json", "csv", "html", "compact"].includes(format)) return new Response("Unsupported format", { status: 400 });
  try {
    const prompts = await loadRepositoryLibrary();
    const body = format === "html" ? exportPortable(prompts) : format === "csv" ? exportCsv(prompts) : JSON.stringify(format === "compact" ? compactDirectory(prompts) : prompts);
    return new Response(body, { headers: {
      "Content-Type": format === "html" ? "text/html; charset=utf-8" : format === "csv" ? "text/csv; charset=utf-8" : "application/json",
      "Content-Disposition": `attachment; filename="${format === "html" ? "prompt-selector" : "prompt-directory"}.${format === "compact" ? "compact.json" : format}"`,
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    console.error("Library export failed", error);
    return new Response("Library export unavailable", { status: 500 });
  }
}
