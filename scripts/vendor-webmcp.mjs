#!/usr/bin/env node
/**
 * Vendors the browser widget of WebMCP (https://webmcp.dev, npm @jason.today/webmcp) into
 * public/vendor/webmcp so the site serves it from its own origin, with no CDN or runtime npm
 * dependency. The npm package also ships a Node bridge server that the site does not need.
 *
 * Usage: node scripts/vendor-webmcp.mjs
 * To upgrade, change VERSION and INTEGRITY (`npm view @jason.today/webmcp@<version> dist.integrity`)
 * and WEBMCP_WIDGET_VERSION in src/lib/webmcp/widget.ts.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { transform } from "esbuild";

const VERSION = "0.1.13";
const INTEGRITY = "sha512-FpFfgZFhLukAphGLK6SkM8NHvqdsVIRfqy2cOlyrU+TNGp7FugL8y2sXx87lrgEhlfdDdxdF7Ywaf4XN/IlXDA==";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "vendor", "webmcp");
const work = mkdtempSync(join(tmpdir(), "webmcp-"));

try {
  execFileSync("npm", ["pack", `@jason.today/webmcp@${VERSION}`, "--silent"], { cwd: work, stdio: ["ignore", "pipe", "inherit"] });
  const tarball = readdirSync(work).find((f) => f.endsWith(".tgz"));
  if (!tarball) throw new Error("npm pack produced no tarball");

  const actual = `sha512-${createHash("sha512").update(readFileSync(join(work, tarball))).digest("base64")}`;
  if (actual !== INTEGRITY) throw new Error(`Integrity mismatch: expected ${INTEGRITY}, got ${actual}`);

  execFileSync("tar", ["-xzf", tarball], { cwd: work });
  const source = readFileSync(join(work, "package", "src", "webmcp.js"), "utf8");
  const license = readFileSync(join(work, "package", "LICENSE"), "utf8");

  // The widget logs every message; console.log calls are dropped, warnings and errors are kept.
  const { code } = await transform(source, { minify: true, pure: ["console.log"], target: "es2019" });

  // The script declares `class WebMCP` at the top level of a classic script; it is exposed on
  // window so the bundled loader can reach it.
  const banner = `/*! WebMCP ${VERSION} | https://webmcp.dev | (c) Jason McGhee | MIT License, see LICENSE */\n`;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `webmcp-${VERSION}.min.js`), `${banner}${code.trim()}\nwindow.WebMCP=WebMCP;\n`);
  writeFileSync(join(outDir, "LICENSE"), license);
  console.log(`Vendored WebMCP ${VERSION} into ${outDir}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
