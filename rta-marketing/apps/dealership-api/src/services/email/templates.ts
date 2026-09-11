import type { EmailUseCase } from "./email.types.js";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function layout(title: string, preheader: string, content: string): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#f2f4f1;color:#0b2022;font-family:Arial,Helvetica,sans-serif"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f4f1;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border:1px solid #dce4df;border-radius:16px;overflow:hidden"><tr><td style="background:#071d20;padding:26px 32px;color:#fff"><div style="font-size:22px;font-weight:800;letter-spacing:-.04em">RTA<span style="color:#fa6248">.</span></div><div style="margin-top:7px;color:#aab8b5;font-size:11px;letter-spacing:.14em;text-transform:uppercase">Automotive operations &amp; vehicle intelligence</div></td></tr><tr><td style="padding:34px 32px">${content}</td></tr><tr><td style="border-top:1px solid #e6ebe8;padding:20px 32px;color:#73827f;font-size:12px;line-height:1.5">RTA Automotive Group · This is an automated message. Please do not share access links.</td></tr></table></td></tr></table></body></html>`;
}

function button(label: string, url: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;background:#fa6248;color:#fff;text-decoration:none;font-weight:700;padding:13px 19px;border-radius:8px">${escapeHtml(label)}</a>`;
}

function paragraphs(lines: string[]): string {
  return lines.map((line) => `<p style="margin:0 0 15px;color:#526460;line-height:1.65">${line}</p>`).join("");
}

export function verificationEmail(name: string, url: string, expiresMinutes: number, useCase: EmailUseCase = "verify_email") {
  const safeName = escapeHtml(name || "there");
  return {
    subject: "Verify your RTA account",
    htmlContent: layout("Verify your RTA account", "Confirm your email to open your RTA workspace.", `<h1 style="margin:0 0 18px;font-size:30px;letter-spacing:-.04em">Verify your email</h1>${paragraphs([`Hi ${safeName},`, "Thanks for creating an RTA account. Confirm your email address to continue to your workspace."])}${button("Verify email", url)}<p style="margin:22px 0 0;color:#73827f;font-size:12px;line-height:1.6">This link expires in ${expiresMinutes} minutes. If the button does not work, copy this link:<br><span style="word-break:break-all">${escapeHtml(url)}</span></p><p style="margin:18px 0 0;color:#73827f;font-size:12px">If you did not create this account, you can ignore this email.</p>`),
    textContent: `Hi ${name || "there"},\n\nVerify your RTA account: ${url}\n\nThis link expires in ${expiresMinutes} minutes. If you did not create this account, you can ignore this email.`,
    tag: useCase,
  };
}

export function passwordResetEmail(name: string, url: string, expiresMinutes: number) {
  return {
    subject: "Reset your RTA password",
    htmlContent: layout("Reset your RTA password", "Use this secure link to choose a new RTA password.", `<h1 style="margin:0 0 18px;font-size:30px;letter-spacing:-.04em">Reset your password</h1>${paragraphs([`Hi ${escapeHtml(name || "there")},`, "We received a request to reset your RTA password. The link below can be used once."])}${button("Choose a new password", url)}<p style="margin:22px 0 0;color:#73827f;font-size:12px;line-height:1.6">This link expires in ${expiresMinutes} minutes. If you did not request this, you can ignore this email.</p>`),
    textContent: `Hi ${name || "there"},\n\nReset your RTA password: ${url}\n\nThis link expires in ${expiresMinutes} minutes and can be used once.`,
    tag: "password_reset",
  };
}

export function accessRequestReceivedEmail(name: string) {
  return {
    subject: "Your RTA access request has been received",
    htmlContent: layout("Access request received", "Your RTA evaluation-access request is now with the team.", `<h1 style="margin:0 0 18px;font-size:30px;letter-spacing:-.04em">Request received</h1>${paragraphs([`Hi ${escapeHtml(name)},`, "Your request for RTA evaluation access has been received. The team will review the requested scope and duration before granting anything."])}<p style="margin:0;color:#73827f;font-size:12px">No access has been granted by this message.</p>`),
    textContent: `Hi ${name},\n\nYour RTA evaluation-access request has been received. The team will review it before granting anything.`,
    tag: "access_request_received",
  };
}

export function accessRequestAdminEmail(input: { name: string; company: string; email: string; platformScope: string; permissions: string; reason: string; duration: string; url: string }) {
  const row = (label: string, value: string) => `<tr><td style="padding:7px 0;color:#73827f;width:145px">${escapeHtml(label)}</td><td style="padding:7px 0;font-weight:700">${escapeHtml(value)}</td></tr>`;
  return {
    subject: `RTA Platform Access Request — ${input.name} / ${input.company}`,
    htmlContent: layout("RTA access request", "A recruiter has requested scoped RTA platform access.", `<h1 style="margin:0 0 18px;font-size:30px;letter-spacing:-.04em">New access request</h1><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${row("Applicant", input.name)}${row("Company", input.company)}${row("Email", input.email)}${row("Platform", input.platformScope)}${row("Permissions", input.permissions)}${row("Duration", input.duration)}</table><p style="margin:20px 0 15px;color:#526460;line-height:1.65"><strong>Reason:</strong> ${escapeHtml(input.reason)}</p>${button("Review request", input.url)}`),
    textContent: `Applicant: ${input.name}\nCompany: ${input.company}\nEmail: ${input.email}\nPlatform: ${input.platformScope}\nPermissions: ${input.permissions}\nDuration: ${input.duration}\nReason: ${input.reason}\n\nReview: ${input.url}`,
    tag: "access_request_admin",
  };
}

export function accessApprovedEmail(input: { name: string; permissions: string; expiresAt: string; setupUrl: string; loginUrl: string; scrapingUrl: string; invitation: boolean }) {
  const accessLink = input.invitation ? button("Set password and continue", input.setupUrl) : button("Open RTA workspace", input.loginUrl);
  return {
    subject: "RTA Platform Access Approved",
    htmlContent: layout("RTA access approved", "Your scoped RTA evaluation access is ready.", `<h1 style="margin:0 0 18px;font-size:30px;letter-spacing:-.04em">Access approved</h1>${paragraphs([`Hi ${escapeHtml(input.name)},`, "Your RTA evaluation access has been approved with the scoped permissions below."])}<p style="margin:0 0 8px;color:#526460"><strong>Granted permissions:</strong> ${escapeHtml(input.permissions || "Read-only evaluation")}</p><p style="margin:0 0 22px;color:#526460"><strong>Access expires:</strong> ${escapeHtml(input.expiresAt)}</p>${accessLink}<p style="margin:22px 0 0;color:#73827f;font-size:12px;line-height:1.6">You can also open the vehicle data surface here: ${escapeHtml(input.scrapingUrl)}</p>`),
    textContent: `Hi ${input.name},\n\nYour RTA access is approved. Permissions: ${input.permissions || "Read-only evaluation"}. Expires: ${input.expiresAt}.\n\n${input.invitation ? `Set your password: ${input.setupUrl}` : `Open workspace: ${input.loginUrl}`}\nVehicle data surface: ${input.scrapingUrl}`,
    tag: "access_approved",
  };
}

export function accessDecisionEmail(kind: "rejected" | "revoked" | "extended", name: string, detail: string) {
  const titles = { rejected: "Access request update", revoked: "RTA access revoked", extended: "RTA access extended" };
  const subjects = { rejected: "RTA Platform Access Request Update", revoked: "RTA Platform Access Revoked", extended: "RTA Platform Access Extended" };
  return {
    subject: subjects[kind],
    htmlContent: layout(titles[kind], titles[kind], `<h1 style="margin:0 0 18px;font-size:30px;letter-spacing:-.04em">${escapeHtml(titles[kind])}</h1>${paragraphs([`Hi ${escapeHtml(name)},`, escapeHtml(detail)])}<p style="margin:0;color:#73827f;font-size:12px">For questions, reply to the RTA team.</p>`),
    textContent: `Hi ${name},\n\n${detail}`,
    tag: `access_${kind}`,
  };
}
