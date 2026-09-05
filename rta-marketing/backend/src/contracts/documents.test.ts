import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../lib/errors.js";
import {
  createDocumentStorageKey,
  ownsDocumentStorageKey,
  sanitizeDocumentFileName,
  validateDocumentFile,
} from "./documents.js";

test("document policy accepts only approved files within the size limit", () => {
  assert.doesNotThrow(() => validateDocumentFile({ mimeType: "application/pdf", sizeBytes: 1_000 }, 10_000));
  assert.throws(
    () => validateDocumentFile({ mimeType: "text/html", sizeBytes: 1_000 }, 10_000),
    (error) => error instanceof AppError && error.code === "DOCUMENT_TYPE_NOT_ALLOWED",
  );
  assert.throws(
    () => validateDocumentFile({ mimeType: "image/png", sizeBytes: 10_001 }, 10_000),
    (error) => error instanceof AppError && error.code === "DOCUMENT_TOO_LARGE",
  );
});

test("document object keys are normalized and isolated by workspace and user", () => {
  assert.equal(sanitizeDocumentFileName("../../Policy Résumé (final).pdf"), "..-..-Policy-R-sum-final-.pdf");
  const key = createDocumentStorageKey("workspace-a", "user-a", "../policy.pdf");
  assert.equal(ownsDocumentStorageKey(key, "workspace-a", "user-a"), true);
  assert.equal(ownsDocumentStorageKey(key, "workspace-a", "user-b"), false);
  assert.equal(ownsDocumentStorageKey(key, "workspace-b", "user-a"), false);
});
