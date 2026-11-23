import { bigLinkEmailButton, escapeEmailHtml, renderBigLinkEmail } from "./brand";

// Table-based HTML so the layout survives Gmail, Outlook and Apple Mail.
// Palette matches the portal tokens in globals.css.

const INK = "#181a42";
const TEXT = "#252832";
const MUTED = "#6d7280";
const LINE = "#dfe2e7";
const CANVAS = "#f4f5f7";

function shell(heading: string, body: string) {
  return renderBigLinkEmail({ subject: heading, label: "Partnership ledger", heading, intro: "Atlas and Big Link", body: `${body}<p style="margin:24px 0 0;font:400 12px/1.6 Inter,Arial,sans-serif;color:${MUTED};">Atlas Consulting Group. This is an automated message from the partnership ledger. If you were not expecting it, ignore it and tell Ofentse.</p>` });
}

function paragraph(content: string) {
  return `<p style="margin:0 0 14px;font:400 15px/1.65 Inter,Arial,sans-serif;color:${TEXT};">${content}</p>`;
}

export function mfaCodeEmail(code: string, minutes: number) {
  const html = shell(
    "Your sign in code",
    [
      paragraph("Use this code to finish signing in to the partnership ledger."),
      `<div style="margin:24px 0;padding:20px;background:${CANVAS};border:1px solid ${LINE};border-radius:10px;text-align:center;">
         <div style="font:700 40px/1 'SFMono-Regular',Consolas,monospace;letter-spacing:.36em;color:${INK};padding-left:.36em;">${escapeEmailHtml(code)}</div>
       </div>`,
      paragraph(`The code expires in ${minutes} minutes and works once. After five wrong attempts it is cancelled and you will need a new one.`),
      paragraph(`<strong>If you did not just try to sign in, do not enter this code.</strong> Someone has your password. Tell Ofentse immediately.`),
    ].join(""),
  );

  const text = [
    "Your partnership ledger sign in code",
    "",
    code,
    "",
    `Expires in ${minutes} minutes. Works once. Cancelled after five wrong attempts.`,
    "If you did not just try to sign in, do not enter this code and tell Ofentse immediately.",
  ].join("\n");

  return { subject: `${code} is your partnership ledger sign in code`, html, text };
}

export function invitationEmail(inviteUrl: string, companyName: string, invitedByName: string, days: number) {
  const html = shell(
    `You have been invited to the partnership ledger`,
    [
      paragraph(`${escapeEmailHtml(invitedByName)} has invited you to join the Atlas and Big Link partnership ledger as a <strong>${escapeEmailHtml(companyName)}</strong> administrator.`),
      paragraph("The ledger shows every invoice, commission, payment and credit between the two companies, and the single net balance that results."),
      bigLinkEmailButton("Set up your account", inviteUrl),
      paragraph(`This invitation expires in ${days} days and can be used once.`),
      paragraph(`If the button does not work, paste this into your browser:<br><span style="font:400 13px/1.5 'SFMono-Regular',Consolas,monospace;color:${MUTED};word-break:break-all;">${escapeEmailHtml(inviteUrl)}</span>`),
      paragraph("Once you set a password you will be asked for a code sent to this address. That second step runs on every sign in."),
    ].join(""),
  );

  const text = [
    `${invitedByName} has invited you to the Atlas and Big Link partnership ledger as a ${companyName} administrator.`,
    "",
    "Set up your account:",
    inviteUrl,
    "",
    `This invitation expires in ${days} days and can be used once.`,
    "After setting a password you will be asked for a code sent to this address. That second step runs on every sign in.",
  ].join("\n");

  return { subject: "Your invitation to the Atlas and Big Link partnership ledger", html, text };
}
