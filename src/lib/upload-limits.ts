/** Upload size limit in MB, set by NEXT_PUBLIC_MAX_UPLOAD_MB at build time (default 4, Vercel's request body limit) */
export const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB) || 4;

export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
