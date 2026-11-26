/**
 * Minimal S3-compatible client over `fetch` with AWS Signature Version 4,
 * using Web Crypto only. Worker hosts cannot load @aws-sdk/client-s3, so the
 * S3 and DigitalOcean Spaces plugins fall back to this for PUT and DELETE.
 */

export interface S3Credentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === "string" ? encoder.encode(data) : data;
  return toHex(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
}

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

/** RFC 3986 encoding of each path segment, as S3 expects in the canonical URI */
function canonicalPath(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) =>
      encodeURIComponent(decodeURIComponent(segment)).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    )
    .join("/");
}

/**
 * Returns the headers that sign a request: `authorization`, `x-amz-date`,
 * `x-amz-content-sha256` plus the given headers. `host` is taken from the URL.
 */
export async function signS3Request(input: {
  method: string;
  url: URL;
  headers?: Record<string, string>;
  body?: Uint8Array;
  credentials: S3Credentials;
  date?: Date;
  /** Precomputed payload hash, e.g. the SHA-256 of an empty body */
  payloadHash?: string;
}): Promise<Record<string, string>> {
  const { method, url, credentials } = input;
  const amzDate = (input.date ?? new Date()).toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = input.payloadHash ?? (await sha256Hex(input.body ?? new Uint8Array()));

  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(input.headers ?? {})) headers[name.toLowerCase()] = value.trim();
  headers["host"] = url.host;
  headers["x-amz-content-sha256"] = payloadHash;
  headers["x-amz-date"] = amzDate;

  const signedNames = Object.keys(headers).sort();
  const canonicalHeaders = signedNames.map((name) => `${name}:${headers[name]}\n`).join("");
  const signedHeaders = signedNames.join(";");
  const canonicalQuery = [...url.searchParams]
    .map(([k, v]) => [encodeURIComponent(k), encodeURIComponent(v)])
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const canonicalRequest = [method, canonicalPath(url.pathname), canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/${credentials.region}/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, await sha256Hex(canonicalRequest)].join("\n");

  const kDate = await hmac(encoder.encode(`AWS4${credentials.secretAccessKey}`), dateStamp);
  const kRegion = await hmac(kDate, credentials.region);
  const kService = await hmac(kRegion, "s3");
  const kSigning = await hmac(kService, "aws4_request");
  const signature = toHex(await hmac(kSigning, stringToSign));

  // fetch sets Host itself and refuses it as a request header
  const sent = { ...headers };
  delete sent["host"];
  return {
    ...sent,
    authorization: `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

async function send(method: string, url: URL, credentials: S3Credentials, headers?: Record<string, string>, body?: Uint8Array) {
  const signed = await signS3Request({ method, url, headers, body, credentials });
  const response = await fetch(url, { method, headers: signed, body: body as BodyInit | undefined });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`S3 ${method} ${url.pathname} failed with ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
}

export async function putObject(
  objectUrl: URL,
  body: Uint8Array,
  credentials: S3Credentials,
  { contentType, acl }: { contentType?: string; acl?: string } = {}
): Promise<void> {
  const headers: Record<string, string> = {};
  if (contentType) headers["content-type"] = contentType;
  if (acl) headers["x-amz-acl"] = acl;
  await send("PUT", objectUrl, credentials, headers, body);
}

export async function deleteObject(objectUrl: URL, credentials: S3Credentials): Promise<void> {
  await send("DELETE", objectUrl, credentials);
}
