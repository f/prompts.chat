import { NextResponse } from "next/server";
import { readBundledText } from "@/lib/bundled-files";
import { SKILLS_DIR } from "../skills-dir";

export async function GET() {
  try {
    const indexContent = readBundledText(`${SKILLS_DIR}/index.json`);
    if (indexContent === undefined) throw new Error(`${SKILLS_DIR}/index.json is not bundled`);
    const index = JSON.parse(indexContent);

    return NextResponse.json(index, {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Error reading skills index:", error);
    return NextResponse.json(
      { error: "Skills index not found" },
      { status: 404 }
    );
  }
}
