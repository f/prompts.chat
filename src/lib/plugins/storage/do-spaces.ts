import type { StoragePlugin, UploadResult, UploadOptions } from "../types";
import { deleteObject, putObject, type S3Credentials } from "./s3-fetch";

/**
 * DigitalOcean Spaces Storage Plugin
 * 
 * DigitalOcean Spaces is S3-compatible but uses a different endpoint format.
 * 
 * Required env vars:
 * - DO_SPACES_BUCKET
 * - DO_SPACES_REGION (e.g., nyc3, sfo3, ams3, sgp1, fra1)
 * - DO_SPACES_ACCESS_KEY_ID
 * - DO_SPACES_SECRET_ACCESS_KEY
 * 
 * Optional env vars:
 * - DO_SPACES_CDN_ENDPOINT (for CDN-enabled Spaces, e.g., https://bucket.region.cdn.digitaloceanspaces.com)
 * 
 * Note: Requires @aws-sdk/client-s3 to be installed:
 * npm install @aws-sdk/client-s3
 */

// Helper to dynamically load AWS SDK
async function getS3Client() {
  try {
    // Use webpackIgnore to prevent bundling this optional dependency
    const s3Module = await import(/* webpackIgnore: true */ "@aws-sdk/client-s3");
    return s3Module;
  } catch {
    // Worker hosts cannot load the SDK; requests are signed and sent with fetch instead
    return null;
  }
}

function fetchCredentials(): S3Credentials {
  return {
    region: process.env.DO_SPACES_REGION!,
    accessKeyId: process.env.DO_SPACES_ACCESS_KEY_ID!,
    secretAccessKey: process.env.DO_SPACES_SECRET_ACCESS_KEY!,
  };
}

function objectUrl(key: string): URL {
  return new URL(`https://${process.env.DO_SPACES_BUCKET}.${process.env.DO_SPACES_REGION}.digitaloceanspaces.com/${key}`);
}

function getEndpoint(): string {
  const region = process.env.DO_SPACES_REGION!;
  return `https://${region}.digitaloceanspaces.com`;
}

function getFileUrl(key: string): string {
  const bucket = process.env.DO_SPACES_BUCKET!;
  const region = process.env.DO_SPACES_REGION!;
  
  // Use CDN endpoint if configured, otherwise use standard Spaces URL
  if (process.env.DO_SPACES_CDN_ENDPOINT) {
    return `${process.env.DO_SPACES_CDN_ENDPOINT}/${key}`;
  }
  
  // Standard DigitalOcean Spaces URL format: https://bucket.region.digitaloceanspaces.com/key
  return `https://${bucket}.${region}.digitaloceanspaces.com/${key}`;
}

export const doSpacesStoragePlugin: StoragePlugin = {
  id: "do-spaces",
  name: "DigitalOcean Spaces",
  
  isConfigured: () => {
    return !!(
      process.env.DO_SPACES_BUCKET &&
      process.env.DO_SPACES_REGION &&
      process.env.DO_SPACES_ACCESS_KEY_ID &&
      process.env.DO_SPACES_SECRET_ACCESS_KEY
    );
  },
  
  async upload(file: File | Buffer, options?: UploadOptions): Promise<UploadResult> {
    // Check configuration
    if (!this.isConfigured()) {
      throw new Error(
        "DigitalOcean Spaces storage is not configured. Please set DO_SPACES_BUCKET, DO_SPACES_REGION, DO_SPACES_ACCESS_KEY_ID, and DO_SPACES_SECRET_ACCESS_KEY environment variables."
      );
    }

    // Dynamic import to avoid bundling issues when not used
    const sdk = await getS3Client();

    // Generate unique key
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const filename = options?.filename || `file-${timestamp}-${randomId}`;
    const folder = options?.folder || "uploads";
    const key = `${folder}/${filename}`;

    // Convert File to Buffer if needed
    let buffer: Buffer;
    let contentType: string | undefined;
    
    if (file instanceof File) {
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
      contentType = file.type;
    } else {
      buffer = file;
      contentType = options?.mimeType;
    }

    // Upload to DigitalOcean Spaces
    if (sdk) {
      const client = new sdk.S3Client({
        region: process.env.DO_SPACES_REGION!,
        endpoint: getEndpoint(),
        credentials: {
          accessKeyId: process.env.DO_SPACES_ACCESS_KEY_ID!,
          secretAccessKey: process.env.DO_SPACES_SECRET_ACCESS_KEY!,
        },
        forcePathStyle: false, // DO Spaces uses virtual-hosted style URLs
      });
      await client.send(
        new sdk.PutObjectCommand({
          Bucket: process.env.DO_SPACES_BUCKET!,
          Key: key,
          Body: buffer,
          ContentType: contentType,
          ACL: "public-read", // Make files publicly accessible
        })
      );
    } else {
      await putObject(objectUrl(key), new Uint8Array(buffer), fetchCredentials(), { contentType, acl: "public-read" });
    }

    // Construct URL
    const url = getFileUrl(key);

    return {
      url,
      key,
      size: buffer.length,
      mimeType: contentType,
    };
  },
  
  async delete(keyOrUrl: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("DigitalOcean Spaces storage is not configured.");
    }

    const sdk = await getS3Client();

    // Extract key from URL if needed
    let key = keyOrUrl;
    if (keyOrUrl.startsWith("http")) {
      const url = new URL(keyOrUrl);
      key = url.pathname.substring(1); // Remove leading slash
    }

    if (!sdk) {
      await deleteObject(objectUrl(key), fetchCredentials());
      return;
    }

    const client = new sdk.S3Client({
      region: process.env.DO_SPACES_REGION!,
      endpoint: getEndpoint(),
      credentials: {
        accessKeyId: process.env.DO_SPACES_ACCESS_KEY_ID!,
        secretAccessKey: process.env.DO_SPACES_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: false,
    });

    await client.send(
      new sdk.DeleteObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET!,
        Key: key,
      })
    );
  },
};
