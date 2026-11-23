# Big Link email branding

The invitation and MFA code templates use the Big Link website email frame from gtm-suite. Keep `src/lib/email/brand.ts` in sync with `gtm-suite/lib/partner-portals/email-brand.ts`. The frame uses Big Link's PNG logo, navy/white palette, Manrope/Inter fonts with Arial fallback, presentation tables and inline styles.

The ledger remains a joint Atlas and Big Link service. Its heading and existing support/security wording preserve that context. Sender settings, recipient selection, tokens, code expiry and sign-in behaviour are unchanged. User-supplied names and link attributes are HTML escaped.

Prepared for review only. Do not send revised emails or deploy these templates before Ofentse has reviewed the exact resulting template and its sender/recipient rules. His current branding approval covers the LinkedIn password template and self-test, not a new ledger email.

Validation on 23/11/2026: TypeScript, all 22 existing tests and targeted email-file ESLint pass. Full-repository lint has four existing React errors in `record-detail-workspace.tsx` and four unrelated unused-variable warnings. No ledger deployment or email send occurred during preparation.
