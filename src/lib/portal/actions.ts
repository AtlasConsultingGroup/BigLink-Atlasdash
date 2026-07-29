"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { issueMfaCode, verifyMfaCode } from "@/lib/portal/mfa";
import { acceptInvitation, sendInvitation } from "@/lib/portal/invitations";

function requireLivePortal() {
  if (!isSupabaseConfigured()) {
    throw new Error("Connect Supabase before submitting portal changes.");
  }
}

function centsFromRand(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "0").replace(",", "."));

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  return Math.round(parsed * 100);
}

function optionalTrimmedField(value: FormDataEntryValue | null, max: number) {
  const parsed = z
    .preprocess(
      (raw) => {
        if (typeof raw !== "string") {
          return undefined;
        }

        const trimmed = raw.trim();
        return trimmed.length === 0 ? undefined : trimmed;
      },
      z.string().max(max).optional(),
    )
    .safeParse(value);

  if (!parsed.success) {
    return undefined;
  }

  return parsed.data;
}

function parsePath(formData: FormData, fallback: string) {
  const parsed = z
    .preprocess(
      (raw) => {
        if (typeof raw !== "string") {
          return undefined;
        }

        const trimmed = raw.trim();
        return trimmed.length === 0 ? undefined : trimmed;
      },
      z.string().max(140).optional(),
    )
    .safeParse(formData.get("returnPath"));

  if (!parsed.success || !parsed.data?.startsWith("/")) {
    return fallback;
  }

  return parsed.data;
}

function redirectWithError(path: string, message: string) {
  const url = new URL(path, "http://localhost");
  url.searchParams.set("error", message);
  redirect(`${url.pathname}${url.search}`);
}

function hasText(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

const referralSchema = z.object({
  clientName: z.string().trim().min(2).max(160),
  clientEmail: z.string().trim().email().optional().or(z.literal("")),
  registrationNumber: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function submitReferralAction(formData: FormData) {
  requireLivePortal();
  const values = referralSchema.parse({
    clientName: formData.get("clientName"),
    clientEmail: formData.get("clientEmail"),
    registrationNumber: formData.get("registrationNumber"),
    notes: formData.get("notes"),
  });
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_referral", {
    p_client_name: values.clientName,
    p_client_email: values.clientEmail || null,
    p_client_registration_number: values.registrationNumber || null,
    p_relationship_notes: values.notes || null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/referrals");
  redirect("/referrals");
}

const dealSchema = z.object({
  title: z.string().trim().min(2).max(180),
  customerName: z.string().trim().min(2).max(160),
  closedOn: z.string().trim().min(10),
});

export async function createDealAction(formData: FormData) {
  requireLivePortal();
  const values = dealSchema.parse({
    title: formData.get("title"),
    customerName: formData.get("customerName"),
    closedOn: formData.get("closedOn"),
  });
  const amountCents = centsFromRand(formData.get("dealValue"));
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, company_memberships!company_memberships_profile_id_fkey(company_id)")
    .eq("auth_user_id", user.id)
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const companyId = (profile.company_memberships as unknown as { company_id: string } | null | undefined)?.company_id;

  if (!companyId) {
    throw new Error("No active company membership found.");
  }

  const { error } = await supabase.from("deals").insert({
    reporting_company_id: companyId,
    customer_name: values.customerName,
    title: values.title,
    closed_on: values.closedOn,
    deal_value_cents: amountCents,
    status: "draft",
    created_by: profile.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/deals");
  redirect("/deals");
}

const partnerInvoiceSchema = z.object({
  invoiceNumber: z.string().trim().min(2).max(80),
  issueDate: z.string().date(),
  dueDate: z.string().date(),
  lineDescription: z.string().trim().min(2).max(500),
  subtotalAmount: z.string().trim().min(1),
  vatAmount: z.preprocess(
    (raw) => {
      if (typeof raw !== "string") {
        return null;
      }

      const trimmed = raw.trim();
      return trimmed.length === 0 ? null : trimmed;
    },
    z.string().trim().min(1).optional(),
  ),
});

function safeAmountFromForm(value: FormDataEntryValue | null, fieldName: string, allowZero = false) {
  try {
    if (allowZero && value !== null) {
      const parsed = Number(String(value).replace(",", "."));

      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.round(parsed * 100);
      }

      throw new Error();
    }

    return centsFromRand(value);
  } catch {
    throw new Error(`Enter a valid amount for ${fieldName}.`);
  }
}

export async function recordPartnerInvoiceAction(formData: FormData) {
  requireLivePortal();
  const returnPath = parsePath(formData, "/invoices");
  const values = partnerInvoiceSchema.safeParse({
    invoiceNumber: formData.get("invoiceNumber"),
    issueDate: formData.get("issueDate"),
    dueDate: formData.get("dueDate"),
    lineDescription: formData.get("lineDescription"),
    subtotalAmount: formData.get("subtotalAmount"),
    vatAmount: formData.get("vatAmount"),
  });

  if (!values.success) {
    return redirectWithError(returnPath, values.error.issues[0]?.message ?? "Could not record the partner invoice.");
  }

  let subtotalCents: number;
  let vatCents: number;

  try {
    subtotalCents = safeAmountFromForm(values.data.subtotalAmount, "subtotal");
    vatCents = values.data.vatAmount ? safeAmountFromForm(values.data.vatAmount, "VAT", true) : 0;
  } catch (error) {
    if (error instanceof Error) {
      return redirectWithError(returnPath, error.message);
    }

    return redirectWithError(returnPath, "Could not record the partner invoice.");
  }

  if (subtotalCents + vatCents <= 0) {
    return redirectWithError(returnPath, "Invoice total must be greater than zero.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_partner_invoice", {
    p_invoice_number: values.data.invoiceNumber,
    p_issue_date: values.data.issueDate,
    p_due_date: values.data.dueDate,
    p_line_description: values.data.lineDescription,
    p_subtotal_cents: subtotalCents,
    p_vat_cents: vatCents,
  });

  if (error) {
    return redirectWithError(returnPath, error.message);
  }

  revalidatePath("/invoices");
  revalidatePath("/ledger");
  redirect(returnPath);
}

export async function recordInvoicePaymentAction(formData: FormData) {
  requireLivePortal();
  const invoiceId = z.string().uuid().parse(formData.get("invoiceId"));
  const amountCents = centsFromRand(formData.get("amount"));
  const paidOn = z.string().trim().min(10).parse(formData.get("paidOn"));
  const reference = z.string().trim().max(120).optional().parse(formData.get("reference") || undefined);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_invoice_payment", {
    p_invoice_id: invoiceId,
    p_amount_cents: amountCents,
    p_paid_on: paidOn,
    p_reference: reference ?? null,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/invoices");
  revalidatePath("/");
  redirect("/invoices");
}

export async function openDisputeAction(formData: FormData) {
  requireLivePortal();
  const ledgerEntryId = z.string().uuid().parse(formData.get("ledgerEntryId"));
  const reason = z.string().trim().min(10).max(2000).parse(formData.get("reason"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("open_ledger_dispute", {
    p_ledger_entry_id: ledgerEntryId,
    p_reason: reason,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/disputes");
  revalidatePath("/ledger");
  redirect("/disputes");
}

export async function proposeLedgerSettlementAction(formData: FormData) {
  requireLivePortal();
  const returnPath = parsePath(formData, "/ledger");

  const ledgerEntryId = z.string().uuid().safeParse(formData.get("ledgerEntryId"));
  const paidOn = z.string().trim().min(10).max(10).safeParse(formData.get("paidOn"));
  const reference = optionalTrimmedField(formData.get("reference"), 120);

  if (!ledgerEntryId.success) {
    return redirectWithError(returnPath, "Select a valid ledger entry.");
  }

  if (!paidOn.success) {
    return redirectWithError(returnPath, "Enter a valid settlement paid-on date.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("propose_ledger_settlement", {
    p_entry_id: ledgerEntryId.data,
    p_paid_on: paidOn.data,
    p_reference: reference ?? null,
  });

  if (error) {
    return redirectWithError(returnPath, error.message);
  }

  revalidatePath("/ledger");
  revalidatePath("/disputes");
  redirect(returnPath);
}

export async function recordLedgerReceiptAction(formData: FormData) {
  requireLivePortal();
  const returnPath = parsePath(formData, "/ledger");

  const ledgerEntryId = z.string().uuid().safeParse(formData.get("ledgerEntryId"));
  const paidOn = z.string().trim().min(10).max(10).safeParse(formData.get("paidOn"));
  const reference = optionalTrimmedField(formData.get("reference"), 120);

  if (!ledgerEntryId.success) {
    return redirectWithError(returnPath, "Select a valid ledger entry.");
  }

  if (!paidOn.success) {
    return redirectWithError(returnPath, "Enter a valid receipt paid-on date.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_ledger_receipt", {
    p_entry_id: ledgerEntryId.data,
    p_paid_on: paidOn.data,
    p_reference: reference ?? null,
  });

  if (error) {
    return redirectWithError(returnPath, error.message);
  }

  revalidatePath("/ledger");
  redirect(returnPath);
}

export async function recordLedgerPaymentAction(formData: FormData) {
  requireLivePortal();
  const returnPath = parsePath(formData, "/ledger");

  const ledgerEntryId = z.string().uuid().safeParse(formData.get("ledgerEntryId"));
  const paidOn = z.string().trim().min(10).max(10).safeParse(formData.get("paidOn"));
  const reference = optionalTrimmedField(formData.get("reference"), 120);

  if (!ledgerEntryId.success) {
    return redirectWithError(returnPath, "Select a valid ledger entry.");
  }

  if (!paidOn.success) {
    return redirectWithError(returnPath, "Enter a valid payment paid-on date.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("record_ledger_payment", {
    p_entry_id: ledgerEntryId.data,
    p_paid_on: paidOn.data,
    p_reference: reference ?? null,
  });

  if (error) {
    return redirectWithError(returnPath, error.message);
  }

  revalidatePath("/ledger");
  revalidatePath("/");
  redirect(returnPath);
}

export async function decideLedgerSettlementAction(formData: FormData) {
  requireLivePortal();
  const returnPath = parsePath(formData, "/ledger");
  const values = z
    .object({
      ledgerEntryId: z.string().uuid(),
      approved: z.coerce.boolean(),
      comment: z.preprocess(
        (raw) => {
          if (typeof raw !== "string") {
            return undefined;
          }

          const trimmed = raw.trim();
          return trimmed.length === 0 ? undefined : trimmed;
        },
        z.string().max(2000).optional(),
      ),
    })
    .safeParse({
      ledgerEntryId: formData.get("ledgerEntryId"),
      approved: formData.get("approved"),
      comment: formData.get("comment"),
    });

  if (!values.success) {
    return redirectWithError(returnPath, values.error.issues[0]?.message ?? "Could not submit settlement decision.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("decide_ledger_settlement", {
    p_entry_id: values.data.ledgerEntryId,
    p_approved: values.data.approved,
    p_comment: values.data.comment ?? null,
  });

  if (error) {
    return redirectWithError(returnPath, error.message);
  }

  revalidatePath("/ledger");
  revalidatePath("/disputes");
  redirect(returnPath);
}

export async function resolveDisputeAction(formData: FormData) {
  requireLivePortal();
  const returnPath = parsePath(formData, "/disputes");
  const values = z
    .object({
      disputeId: z.string().uuid(),
      outcome: z.enum(["restore_payable", "close_with_adjustment"]),
      comment: z.preprocess(
        (raw) => {
          if (typeof raw !== "string") {
            return undefined;
          }

          const trimmed = raw.trim();
          return trimmed.length === 0 ? undefined : trimmed;
        },
        z.string().max(2000).optional(),
      ),
    })
    .safeParse({
      disputeId: formData.get("disputeId"),
      outcome: formData.get("outcome"),
      comment: formData.get("comment"),
    });

  if (!values.success) {
    return redirectWithError(returnPath, values.error.issues[0]?.message ?? "Could not resolve that dispute.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("resolve_dispute", {
    p_dispute_id: values.data.disputeId,
    p_outcome: values.data.outcome,
    p_comment: values.data.comment ?? null,
  });

  if (error) {
    return redirectWithError(returnPath, error.message);
  }

  revalidatePath("/disputes");
  revalidatePath("/ledger");
  revalidatePath("/invoices");
  redirect(returnPath);
}

export async function updateRecordNotesAction(formData: FormData) {
  requireLivePortal();
  const returnPath = parsePath(formData, "/");
  const values = z
    .object({
      recordType: z.enum(["ledger_entry", "dispute"]),
      recordId: z.string().uuid(),
      description: z.preprocess(
        (raw) => {
          if (typeof raw !== "string") {
            return undefined;
          }

          const trimmed = raw.trim();
          return trimmed.length === 0 ? undefined : trimmed;
        },
        z.string().min(2).max(500).optional(),
      ),
      reason: z.preprocess(
        (raw) => {
          if (typeof raw !== "string") {
            return undefined;
          }

          const trimmed = raw.trim();
          return trimmed.length === 0 ? undefined : trimmed;
        },
        z.string().min(10).max(2000).optional(),
      ),
      reference: z.preprocess(
        (raw) => {
          if (typeof raw !== "string") {
            return undefined;
          }

          const trimmed = raw.trim();
          return trimmed.length === 0 ? undefined : trimmed;
        },
        z.string().max(120).optional(),
      ),
      proposedResolution: z.preprocess(
        (raw) => {
          if (typeof raw !== "string") {
            return undefined;
          }

          const trimmed = raw.trim();
          return trimmed.length === 0 ? undefined : trimmed;
        },
        z.string().max(2000).optional(),
      ),
    })
    .safeParse({
      recordType: formData.get("recordType"),
      recordId: formData.get("recordId"),
      description: formData.get("description"),
      reason: formData.get("reason"),
      reference: formData.get("reference"),
      proposedResolution: formData.get("proposedResolution"),
    });

  if (!values.success) {
    return redirectWithError(returnPath, values.error.issues[0]?.message ?? "Could not update record notes.");
  }

  if (
    !hasText(values.data.description) &&
    !hasText(values.data.reason) &&
    !hasText(values.data.reference) &&
    !hasText(values.data.proposedResolution)
  ) {
    return redirectWithError(returnPath, "No note fields changed.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_record_notes", {
    p_record_type: values.data.recordType,
    p_record_id: values.data.recordId,
    p_description: values.data.description ?? null,
    p_reason: values.data.reason ?? null,
    p_reference: values.data.reference ?? null,
    p_proposed_resolution: values.data.proposedResolution ?? null,
  });

  if (error) {
    return redirectWithError(returnPath, error.message);
  }

  revalidatePath("/ledger");
  revalidatePath("/disputes");
  redirect(returnPath);
}

export async function proposeMonthlyStatementAction(formData: FormData) {
  requireLivePortal();
  const periodStart = z.string().trim().min(10).parse(formData.get("periodStart"));
  const periodEnd = z.string().trim().min(10).parse(formData.get("periodEnd"));
  const dueOn = z.string().trim().min(10).parse(formData.get("dueOn"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("propose_monthly_statement", {
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_due_on: dueOn,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/statements");
  revalidatePath("/");
  redirect("/statements");
}

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function signInAction(formData: FormData) {
  requireLivePortal();
  const email = z.string().email().safeParse(formData.get("email"));
  const password = z.string().min(8).safeParse(formData.get("password"));

  if (!email.success || !password.success) {
    redirect(`/login?error=${encodeURIComponent("Enter a valid email and your password.")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("That email and password combination was not recognised.")}`);
  }

  // Send the second factor straight away so the code is waiting when the page loads.
  let issueError: string | null = null;

  try {
    await issueMfaCode();
  } catch (caught) {
    issueError = messageFrom(caught, "Could not send your code.");
  }

  redirect(issueError ? `/mfa?error=${encodeURIComponent(issueError)}` : "/mfa?sent=1");
}

export async function requestMfaCodeAction() {
  requireLivePortal();
  let issueError: string | null = null;

  try {
    await issueMfaCode();
  } catch (caught) {
    issueError = messageFrom(caught, "Could not send your code.");
  }

  redirect(issueError ? `/mfa?error=${encodeURIComponent(issueError)}` : "/mfa?sent=1");
}

export async function verifyMfaCodeAction(formData: FormData) {
  requireLivePortal();
  const code = z
    .string()
    .trim()
    .regex(/^\d{4}$/)
    .safeParse(formData.get("code"));

  if (!code.success) {
    redirect(`/mfa?error=${encodeURIComponent("Enter the four digit code from your email.")}`);
  }

  let verifyError: string | null = null;

  try {
    await verifyMfaCode(code.data);
  } catch (caught) {
    verifyError = messageFrom(caught, "Could not verify that code.");
  }

  if (verifyError) {
    redirect(`/mfa?error=${encodeURIComponent(verifyError)}`);
  }

  redirect("/");
}

export async function sendInvitationAction(formData: FormData) {
  requireLivePortal();
  const email = z.string().trim().email().safeParse(formData.get("email"));
  const company = z.enum(["atlas", "big_link"]).safeParse(formData.get("company"));

  if (!email.success || !company.success) {
    redirect(`/settings?error=${encodeURIComponent("Enter a valid email and choose a company.")}`);
  }

  let inviteError: string | null = null;
  let invited: string | null = null;

  try {
    const result = await sendInvitation(email.data, company.data);
    invited = result.email;
  } catch (caught) {
    inviteError = messageFrom(caught, "Could not send that invitation.");
  }

  revalidatePath("/settings");
  redirect(
    inviteError
      ? `/settings?error=${encodeURIComponent(inviteError)}`
      : `/settings?invited=${encodeURIComponent(invited ?? "")}`,
  );
}

export async function acceptInvitationAction(formData: FormData) {
  requireLivePortal();
  const token = z.string().trim().min(32).safeParse(formData.get("token"));
  const fullName = z.string().trim().min(2).max(120).safeParse(formData.get("fullName"));
  const password = z.string().min(10).max(200).safeParse(formData.get("password"));
  const confirm = z.string().safeParse(formData.get("confirmPassword"));

  if (!token.success) {
    redirect(`/login?error=${encodeURIComponent("That invitation link is not valid.")}`);
  }

  if (!fullName.success || !password.success) {
    redirect(
      `/invite/${token.data}?error=${encodeURIComponent("Enter your full name and a password of at least ten characters.")}`,
    );
  }

  if (!confirm.success || confirm.data !== password.data) {
    redirect(`/invite/${token.data}?error=${encodeURIComponent("The two passwords do not match.")}`);
  }

  let acceptError: string | null = null;
  let email: string | null = null;

  try {
    const result = await acceptInvitation(token.data, fullName.data, password.data);
    email = result.email;
  } catch (caught) {
    acceptError = messageFrom(caught, "Could not complete your setup.");
  }

  if (acceptError) {
    redirect(`/invite/${token.data}?error=${encodeURIComponent(acceptError)}`);
  }

  // Sign the new administrator in immediately and post their first code.
  const supabase = await createSupabaseServerClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: email ?? "",
    password: password.data,
  });

  if (signInError) {
    redirect(`/login?error=${encodeURIComponent("Your account is ready. Sign in to continue.")}`);
  }

  let issueError: string | null = null;

  try {
    await issueMfaCode();
  } catch (caught) {
    issueError = messageFrom(caught, "Account ready, but the code could not be sent.");
  }

  redirect(issueError ? `/mfa?error=${encodeURIComponent(issueError)}` : "/mfa?sent=1");
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
