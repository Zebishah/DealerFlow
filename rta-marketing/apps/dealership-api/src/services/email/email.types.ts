export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface TransactionalEmail {
  to: EmailRecipient[];
  subject: string;
  htmlContent: string;
  textContent: string;
  tag?: string;
}

export type EmailUseCase =
  | "verify_email"
  | "resend_verification"
  | "password_reset"
  | "access_request_admin"
  | "access_request_received"
  | "access_approved"
  | "access_rejected"
  | "access_revoked"
  | "access_extended";
