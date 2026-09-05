import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { requireCsrf, requireRoles, requireWorkspace, type AuthenticatedUser } from "../../auth/session.js";
import { env } from "../../config/env.js";
import { db } from "../../db/client.js";
import { auditEvents, employeeDocuments, users } from "../../db/schema.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError } from "../../lib/errors.js";
import {
  createDocumentDownloadUrl,
  createDocumentUploadUrl,
  deleteDocumentObject,
  inspectDocumentObject,
} from "../../services/document-storage.js";

const uuid = z.string().uuid();
const kind = z.enum(["insurance", "drivers_license", "omvic", "employment", "other"]);
const allowedMimeTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const uploadIntentSchema = z.object({
  userId: z.string().uuid().optional(),
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.string().trim(),
  sizeBytes: z.number().int().positive(),
});
const completeSchema = uploadIntentSchema.extend({
  storageKey: z.string().min(20).max(500),
  kind,
  expiresAt: z.coerce.date().nullable().optional(),
  checksumSha256: z.string().regex(/^[a-f0-9]{64}$/i).nullable().optional(),
});
const reviewSchema = z.object({
  status: z.enum(["verified", "rejected"]),
  reviewNotes: z.string().trim().max(2_000).nullable().optional(),
});

function validateFile(input: { mimeType: string; sizeBytes: number }) {
  if (!allowedMimeTypes.has(input.mimeType)) {
    throw new AppError(400, "DOCUMENT_TYPE_NOT_ALLOWED", "Only PDF, JPEG, and PNG documents are allowed");
  }
  if (input.sizeBytes > env.DOCUMENT_UPLOAD_MAX_BYTES) {
    throw new AppError(400, "DOCUMENT_TOO_LARGE", `Documents must be smaller than ${Math.round(env.DOCUMENT_UPLOAD_MAX_BYTES / 1_000_000)} MB`);
  }
}

function safeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(-100) || "document";
}

async function targetUser(requestUser: AuthenticatedUser | undefined, workspaceId: string, requestedId?: string) {
  if (!requestUser) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  const userId = requestUser.role === "admin" ? requestedId ?? requestUser.id : requestUser.id;
  const [member] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.id, userId), eq(users.workspaceId, workspaceId), eq(users.isActive, true))).limit(1);
  if (!member) throw new AppError(400, "INVALID_DOCUMENT_USER", "Document user is not an active workspace member");
  return member.id;
}

export const documentRouter = Router();
documentRouter.use(requireRoles("admin", "employee"));

documentRouter.get(
  "/",
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const requestedUserId = request.query.userId === undefined ? undefined : uuid.parse(request.query.userId);
    const condition = request.user!.role === "admin"
      ? requestedUserId
        ? and(eq(employeeDocuments.workspaceId, workspaceId), eq(employeeDocuments.userId, requestedUserId))
        : eq(employeeDocuments.workspaceId, workspaceId)
      : and(eq(employeeDocuments.workspaceId, workspaceId), eq(employeeDocuments.userId, request.user!.id));
    const rows = await db.select({
      id: employeeDocuments.id,
      userId: employeeDocuments.userId,
      kind: employeeDocuments.kind,
      status: employeeDocuments.status,
      fileName: employeeDocuments.fileName,
      mimeType: employeeDocuments.mimeType,
      sizeBytes: employeeDocuments.sizeBytes,
      checksumSha256: employeeDocuments.checksumSha256,
      expiresAt: employeeDocuments.expiresAt,
      reviewedAt: employeeDocuments.reviewedAt,
      reviewNotes: employeeDocuments.reviewNotes,
      createdAt: employeeDocuments.createdAt,
      updatedAt: employeeDocuments.updatedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
    }).from(employeeDocuments).innerJoin(users, eq(employeeDocuments.userId, users.id))
      .where(condition).orderBy(desc(employeeDocuments.createdAt));
    response.json({ data: rows });
  }),
);

documentRouter.post(
  "/upload-intents",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const input = uploadIntentSchema.parse(request.body);
    validateFile(input);
    const userId = await targetUser(request.user, workspaceId, input.userId);
    const storageKey = `documents/${workspaceId}/${userId}/${randomUUID()}-${safeFileName(input.fileName)}`;
    const upload = await createDocumentUploadUrl({ storageKey, contentType: input.mimeType, sizeBytes: input.sizeBytes });
    response.status(201).json({ data: { storageKey, ...upload } });
  }),
);

documentRouter.post(
  "/complete",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const input = completeSchema.parse(request.body);
    validateFile(input);
    const userId = await targetUser(request.user, workspaceId, input.userId);
    const expectedPrefix = `documents/${workspaceId}/${userId}/`;
    if (!input.storageKey.startsWith(expectedPrefix)) {
      throw new AppError(400, "INVALID_DOCUMENT_KEY", "Document storage key does not belong to this user");
    }
    const object = await inspectDocumentObject(input.storageKey);
    if (object.sizeBytes !== input.sizeBytes || object.contentType !== input.mimeType) {
      await deleteDocumentObject(input.storageKey);
      throw new AppError(400, "DOCUMENT_UPLOAD_MISMATCH", "Uploaded document metadata did not match the approved upload");
    }
    const created = await db.transaction(async (tx) => {
      const [document] = await tx.insert(employeeDocuments).values({
        workspaceId,
        userId,
        uploadedByUserId: request.user!.id,
        kind: input.kind,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storageKey: input.storageKey,
        checksumSha256: input.checksumSha256 ?? null,
        expiresAt: input.expiresAt ?? null,
      }).returning();
      if (!document) throw new Error("Failed to register document");
      await tx.insert(auditEvents).values({
        workspaceId,
        actorUserId: request.user!.id,
        action: "employee_document.uploaded",
        entityType: "employee_document",
        entityId: document.id,
        metadata: { userId, kind: input.kind, sizeBytes: input.sizeBytes },
      });
      return document;
    });
    response.status(201).json({ data: created });
  }),
);

documentRouter.get(
  "/:id/download",
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const id = uuid.parse(request.params.id);
    const access = request.user!.role === "admin"
      ? eq(employeeDocuments.workspaceId, workspaceId)
      : and(eq(employeeDocuments.workspaceId, workspaceId), eq(employeeDocuments.userId, request.user!.id));
    const [document] = await db.select({ storageKey: employeeDocuments.storageKey }).from(employeeDocuments)
      .where(and(access, eq(employeeDocuments.id, id))).limit(1);
    if (!document) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document was not found");
    response.json({ data: { url: await createDocumentDownloadUrl(document.storageKey), expiresInSeconds: env.DOCUMENT_URL_TTL_SECONDS } });
  }),
);

documentRouter.patch(
  "/:id/review",
  requireRoles("admin"),
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const id = uuid.parse(request.params.id);
    const input = reviewSchema.parse(request.body);
    const updated = await db.transaction(async (tx) => {
      const [document] = await tx.update(employeeDocuments).set({
        status: input.status,
        reviewNotes: input.reviewNotes ?? null,
        reviewedByUserId: request.user!.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      }).where(and(eq(employeeDocuments.id, id), eq(employeeDocuments.workspaceId, workspaceId))).returning();
      if (!document) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document was not found");
      await tx.insert(auditEvents).values({
        workspaceId,
        actorUserId: request.user!.id,
        action: `employee_document.${input.status}`,
        entityType: "employee_document",
        entityId: id,
        metadata: { userId: document.userId },
      });
      return document;
    });
    response.json({ data: updated });
  }),
);

documentRouter.delete(
  "/:id",
  requireCsrf,
  asyncHandler(async (request, response) => {
    const workspaceId = requireWorkspace(request);
    const id = uuid.parse(request.params.id);
    const access = request.user!.role === "admin"
      ? eq(employeeDocuments.workspaceId, workspaceId)
      : and(eq(employeeDocuments.workspaceId, workspaceId), eq(employeeDocuments.userId, request.user!.id), eq(employeeDocuments.status, "pending"));
    const [document] = await db.select({ storageKey: employeeDocuments.storageKey, userId: employeeDocuments.userId }).from(employeeDocuments)
      .where(and(access, eq(employeeDocuments.id, id))).limit(1);
    if (!document) throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document was not found or can no longer be removed");
    await deleteDocumentObject(document.storageKey);
    await db.transaction(async (tx) => {
      await tx.delete(employeeDocuments).where(eq(employeeDocuments.id, id));
      await tx.insert(auditEvents).values({
        workspaceId,
        actorUserId: request.user!.id,
        action: "employee_document.deleted",
        entityType: "employee_document",
        entityId: id,
        metadata: { userId: document.userId },
      });
    });
    response.status(204).send();
  }),
);
