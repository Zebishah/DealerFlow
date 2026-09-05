import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

const client = new S3Client({ region: env.AWS_REGION });

function bucket(): string {
  if (!env.S3_DOCUMENT_BUCKET) {
    throw new AppError(503, "DOCUMENT_STORAGE_UNAVAILABLE", "Private document storage is not configured");
  }
  return env.S3_DOCUMENT_BUCKET;
}

export async function createDocumentUploadUrl(input: {
  storageKey: string;
  contentType: string;
  sizeBytes: number;
}) {
  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: input.storageKey,
    ContentType: input.contentType,
    ContentLength: input.sizeBytes,
    ServerSideEncryption: "AES256",
    Metadata: { "rta-document": "true" },
  });
  return {
    url: await getSignedUrl(client, command, { expiresIn: env.DOCUMENT_URL_TTL_SECONDS }),
    expiresInSeconds: env.DOCUMENT_URL_TTL_SECONDS,
    headers: {
      "content-type": input.contentType,
      "x-amz-server-side-encryption": "AES256",
    },
  };
}

export async function inspectDocumentObject(storageKey: string) {
  try {
    const result = await client.send(new HeadObjectCommand({ Bucket: bucket(), Key: storageKey }));
    return {
      sizeBytes: result.ContentLength ?? 0,
      contentType: result.ContentType ?? "application/octet-stream",
    };
  } catch {
    throw new AppError(400, "DOCUMENT_UPLOAD_NOT_FOUND", "The uploaded document could not be verified");
  }
}

export async function createDocumentDownloadUrl(storageKey: string): Promise<string> {
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket(), Key: storageKey }),
    { expiresIn: env.DOCUMENT_URL_TTL_SECONDS },
  );
}

export async function deleteDocumentObject(storageKey: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: storageKey }));
}
