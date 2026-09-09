import { randomUUID } from "node:crypto";
import { AppError } from "../lib/errors.js";

const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);

export function validateDocumentFile(
  input: { mimeType: string; sizeBytes: number },
  maxBytes: number,
): void {
  if (!allowedMimeTypes.has(input.mimeType)) {
    throw new AppError(400, "DOCUMENT_TYPE_NOT_ALLOWED", "Only PDF, JPEG, and PNG documents are allowed");
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > maxBytes) {
    throw new AppError(400, "DOCUMENT_TOO_LARGE", `Documents must be smaller than ${Math.round(maxBytes / 1_000_000)} MB`);
  }
}

export function sanitizeDocumentFileName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-100) || "document";
}

export function documentStoragePrefix(workspaceId: string, userId: string): string {
  return `documents/${workspaceId}/${userId}/`;
}

export function createDocumentStorageKey(
  workspaceId: string,
  userId: string,
  fileName: string,
): string {
  return `${documentStoragePrefix(workspaceId, userId)}${randomUUID()}-${sanitizeDocumentFileName(fileName)}`;
}

export function ownsDocumentStorageKey(
  storageKey: string,
  workspaceId: string,
  userId: string,
): boolean {
  return storageKey.startsWith(documentStoragePrefix(workspaceId, userId));
}
