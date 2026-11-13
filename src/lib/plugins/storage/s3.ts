import type { StoragePlugin, UploadResult, UploadOptions } from "../types";
import { deleteObject, putObject, type S3Credentials } from "./s3-fetch";

/**
 * S3 Storage Plugin
 * 
 * Supports AWS S3 and S3-compatible services (MinIO, DigitalOcean Spaces, etc.)
 * 
 * Required env vars:
 * - S3_BUCKET
 * - S3_REGION
 * - S3_ACCESS_KEY_ID
 * - S3_SECRET_ACCESS_KEY
 * - S3_ENDPOINT (optional, for S3-compatible services)
 * 
 * Note: Requires @aws-sdk/client-s3 to be installed:
 * npm install @aws-sdk/client-s3
 */

// Helper to dynamically load AWS SDK. Null where it cannot load (worker hosts),
// in which case requests are signed and sent with fetch instead.
async function getS3Client() {
  try {
    // Use webpackIgnore to prevent bundling this optional dependency
    const s3Module = await import(/* webpackIgnore: true */ "@aws-sdk/client-s3");
    return s3Module;
  } catch {
    return null;
  }
}

function fetchCredentials(): S3Credentials {
  return {
    region: process.env.S3_REGION!,
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  };
}

/** Path-style under S3_ENDPOINT (as forcePathStyle), else AWS's virtual-hosted style */
function objectUrl(key: string): URL {
  const bucket = process.env.S3_BUCKET!;
  return process.env.S3_ENDPOINT
    ? new URL(`${process.env.S3_ENDPOINT.replace(/\/+$/, "")}/${bucket}/${key}`)
    : new URL(`https://${bucket}.s3.${process.env.S3_REGION}.amazonaws.com/${key}`);
}

export const s3StoragePlugin: StoragePlugin = {
  id: "s3",
  name: "Amazon S3",
  
  isConfigured: () => {
    return !!(
      process.env.S3_BUCKET &&
      process.env.S3_REGION &&
      process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY
    );
  },
  
  async upload(file: File | Buffer, options?: UploadOptions): Promise<UploadResult> {
    // Check configuration
    if (!this.isConfigured()) {
      throw new Error(
        "S3 storage is not configured. Please set S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, and S3_SECRET_ACCESS_KEY environment variables."
      );
    }

    // Dynamic import to avoid bundling issues when S3 is not used
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

    // Upload to S3
    if (sdk) {
      const client = new sdk.S3Client({
        region: process.env.S3_REGION!,
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID!,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        },
        forcePathStyle: !!process.env.S3_ENDPOINT, // Required for S3-compatible services
      });
      await client.send(
        new sdk.PutObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        })
      );
    } else {
      await putObject(objectUrl(key), new Uint8Array(buffer), fetchCredentials(), { contentType });
    }

    // Construct URL
    const endpoint = process.env.S3_ENDPOINT || `https://s3.${process.env.S3_REGION}.amazonaws.com`;
    const url = `${endpoint}/${process.env.S3_BUCKET}/${key}`;

    return {
      url,
      key,
      size: buffer.length,
      mimeType: contentType,
    };
  },
  
  async delete(keyOrUrl: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new Error("S3 storage is not configured.");
    }

    const sdk = await getS3Client();

    // Extract key from URL if needed
    let key = keyOrUrl;
    if (keyOrUrl.startsWith("http")) {
      const url = new URL(keyOrUrl);
      key = url.pathname.substring(1); // Remove leading slash
      // Remove bucket name from path if present
      if (key.startsWith(process.env.S3_BUCKET!)) {
        key = key.substring(process.env.S3_BUCKET!.length + 1);
      }
    }

    if (!sdk) {
      await deleteObject(objectUrl(key), fetchCredentials());
      return;
    }

    const client = new sdk.S3Client({
      region: process.env.S3_REGION!,
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: !!process.env.S3_ENDPOINT,
    });

    await client.send(
      new sdk.DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
      })
    );
  },
};
