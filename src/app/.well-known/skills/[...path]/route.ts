import { NextRequest, NextResponse } from "next/server";
import { readBundledText } from "@/lib/bundled-files";
import { SKILLS_DIR } from "../skills-dir";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    // Security: only plain names, so the lookup cannot leave SKILLS_DIR
    if (pathSegments.some((segment) => segment === "" || segment === "." || segment === ".." || /[/\\]/.test(segment))) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const relativePath = pathSegments.join("/");
    const content = readBundledText(`${SKILLS_DIR}/${relativePath}`);
    if (content === undefined) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const ext = relativePath.slice(relativePath.lastIndexOf(".")).toLowerCase();

    // Determine content type
    let contentType = "text/plain";
    if (ext === ".json") {
      contentType = "application/json";
    } else if (ext === ".md") {
      contentType = "text/markdown";
    }

    return new NextResponse(content, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error reading skill file:", error);
    return NextResponse.json(
      { error: "Error reading file" },
      { status: 500 }
    );
  }
}
