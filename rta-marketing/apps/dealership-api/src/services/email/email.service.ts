import { logger } from "../../lib/logger.js";
import { env } from "../../config/env.js";
import type { EmailRecipient, EmailUseCase, TransactionalEmail } from "./email.types.js";

export class EmailServiceError extends Error {
  constructor(public readonly code: "EMAIL_NOT_CONFIGURED" | "EMAIL_PROVIDER_FAILED") {
    super(code);
  }
}

export interface EmailServiceConfig {
  apiKey?: string | undefined;
  from?: string | undefined;
  fromName: string;
}

function recipientDomain(email: string): string {
  return email.split("@")[1] ?? "unknown";
}

function mailbox({ email, name }: EmailRecipient): string {
  const displayName = name?.replace(/[\r\n]+/g, " ").trim();
  if (!displayName) return email;
  // Quote mailbox display names containing punctuation, such as "Doe, Jane".
  const formattedName = /[",;<>@()[\]\\]/.test(displayName)
    ? `"${displayName.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
    : displayName;
  return `${formattedName} <${email}>`;
}

export function addressEmail(message: Omit<TransactionalEmail, "to">, recipient: EmailRecipient): TransactionalEmail {
  return { ...message, to: [recipient] };
}

export function createEmailService(config: EmailServiceConfig, fetcher?: typeof fetch) {
  return {
    async send(message: TransactionalEmail, useCase: EmailUseCase): Promise<void> {
      const apiKey = config.apiKey?.trim();
      const from = config.from?.trim();
      if (!apiKey || !from) throw new EmailServiceError("EMAIL_NOT_CONFIGURED");
      let response: Response;
      try {
        response = await (fetcher ?? fetch)("https://api.resend.com/emails", {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            from: mailbox({ email: from, name: config.fromName }),
            to: message.to.map(mailbox),
            subject: message.subject,
            html: message.htmlContent,
            text: message.textContent,
            tags: [{ name: "use_case", value: message.tag ?? useCase }],
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (error) {
        const reason = error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name) ? "timeout" : "network_error";
        logger.warn({ event: "email.provider_unreachable", provider: "resend", useCase, reason }, "Transactional email provider was unreachable");
        throw new EmailServiceError("EMAIL_PROVIDER_FAILED");
      }
      if (!response.ok) {
        logger.warn({ event: "email.provider_rejected", provider: "resend", useCase, status: response.status }, "Transactional email provider rejected a message");
        throw new EmailServiceError("EMAIL_PROVIDER_FAILED");
      }
    },
  };
}

const emailService = createEmailService({ apiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM, fromName: env.EMAIL_FROM_NAME });

export function sendTransactionalEmail(message: TransactionalEmail, useCase: EmailUseCase): Promise<void> {
  return emailService.send(message, useCase);
}

export async function sendEmailSafely(message: TransactionalEmail, useCase: EmailUseCase): Promise<boolean> {
  try {
    await sendTransactionalEmail(message, useCase);
    return true;
  } catch (error) {
    logger.warn({ event: "email.delivery_failed", provider: "resend", useCase, recipientDomain: message.to[0] ? recipientDomain(message.to[0].email) : "unknown", code: error instanceof EmailServiceError ? error.code : "EMAIL_PROVIDER_FAILED" }, "Transactional email delivery failed; application state remains recoverable");
    return false;
  }
}
