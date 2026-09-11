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

export function addressEmail(message: Omit<TransactionalEmail, "to">, recipient: EmailRecipient): TransactionalEmail {
  return { ...message, to: [recipient] };
}

export function createEmailService(config: EmailServiceConfig, fetcher: typeof fetch = fetch) {
  return {
    async send(message: TransactionalEmail, useCase: EmailUseCase): Promise<void> {
      if (!config.apiKey || !config.from) throw new EmailServiceError("EMAIL_NOT_CONFIGURED");
      let response: Response;
      try {
        response = await fetcher("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { accept: "application/json", "content-type": "application/json", "api-key": config.apiKey },
          body: JSON.stringify({ sender: { email: config.from, name: config.fromName }, to: message.to, subject: message.subject, htmlContent: message.htmlContent, textContent: message.textContent, tag: message.tag ?? useCase }),
        });
      } catch (error) {
        logger.warn({ event: "email.provider_unreachable", useCase, err: error instanceof Error ? error.message : "unknown" }, "Transactional email provider was unreachable");
        throw new EmailServiceError("EMAIL_PROVIDER_FAILED");
      }
      if (!response.ok) {
        logger.warn({ event: "email.provider_rejected", useCase, status: response.status }, "Transactional email provider rejected a message");
        throw new EmailServiceError("EMAIL_PROVIDER_FAILED");
      }
    },
  };
}

const emailService = createEmailService({ apiKey: env.BREVO_API_KEY, from: env.EMAIL_FROM, fromName: env.EMAIL_FROM_NAME });

export function sendTransactionalEmail(message: TransactionalEmail, useCase: EmailUseCase): Promise<void> {
  return emailService.send(message, useCase);
}

export async function sendEmailSafely(message: TransactionalEmail, useCase: EmailUseCase): Promise<boolean> {
  try {
    await sendTransactionalEmail(message, useCase);
    return true;
  } catch (error) {
    logger.warn({ event: "email.delivery_failed", useCase, recipientDomain: message.to[0] ? recipientDomain(message.to[0].email) : "unknown", code: error instanceof EmailServiceError ? error.code : "EMAIL_PROVIDER_FAILED" }, "Transactional email delivery failed; application state remains recoverable");
    return false;
  }
}
