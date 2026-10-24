import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rewrite .prompt.md and .prompt.yml requests to the raw API route
  if (pathname.startsWith("/prompts/") && (pathname.endsWith(".prompt.md") || pathname.endsWith(".prompt.yml"))) {
    const id = pathname.slice("/prompts/".length);
    const url = request.nextUrl.clone();
    url.pathname = `/api/prompts/${id}/raw`;
    return NextResponse.rewrite(url);
  }

  // Add pathname header for layout detection
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  // Propagate a correlation id for request-scoped logging (Step 2).
  // Reuse an inbound id if one is present (e.g. from an upstream proxy), else mint one.
  // Read back in route handlers via request.headers.get("x-request-id").
  if (!requestHeaders.get("x-request-id")) {
    requestHeaders.set("x-request-id", crypto.randomUUID());
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
