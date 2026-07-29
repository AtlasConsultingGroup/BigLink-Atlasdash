"use client";

import { WalletCards } from "lucide-react";
import { formatZar } from "@/domain/money";
import { StatusBadge } from "@/components/status-badge";
import { InlineNoteField } from "@/components/record-detail/inline-note-field";
import { RowAction } from "@/components/record-detail/row-action";
import {
  decideLedgerSettlementAction,
  openDisputeAction,
  proposeLedgerSettlementAction,
  recordLedgerPaymentAction,
  recordLedgerReceiptAction,
} from "@/lib/portal/actions";
import type { LedgerEntryView } from "@/lib/portal/types";
import { RecordDetailWorkspace } from "@/components/record-detail/record-detail-workspace";

type Props = {
  entries: LedgerEntryView[];
  userCompanyId: string | null;
  live: boolean;
  error?: string;
};

const rowActionHints = {
  confirmSettlement: "ledger-confirm-settlement",
  declarePaid: "ledger-declare-paid",
  markPaid: "ledger-mark-paid",
  markReceived: "ledger-mark-received",
} as const;

export function LedgerRecordDetails({ entries, userCompanyId, live, error }: Props) {
  return (
    <RecordDetailWorkspace
      records={entries}
      listHeading={
        <>
          <div>
            <p className="eyebrow">All records</p>
            <h2>Shared ledger</h2>
          </div>
          <WalletCards className="size-5 text-ink" aria-hidden="true" />
        </>
      }
      emptyMessage="No ledger entries are available for your account."
      renderPanelTitle={(entry) => entry.reference}
      renderRow={(entry, isSelected, openRecord) => {
        const canPropose =
          live &&
          entry.statusCode === "payable" &&
          userCompanyId !== null &&
          entry.debtorCompanyId === userCompanyId &&
          entry.settlementProposal === null;
        const canRecordReceipt =
          live &&
          (entry.statusCode === "payable" || entry.statusCode === "included_in_statement") &&
          userCompanyId !== null &&
          entry.creditorCompanyId === userCompanyId;
        const canDecide =
          live &&
          entry.statusCode === "payable" &&
          userCompanyId !== null &&
          entry.creditorCompanyId === userCompanyId &&
          entry.settlementProposal !== null;
        const canRecordPayment =
          live &&
          (entry.statusCode === "payable" || entry.statusCode === "included_in_statement") &&
          userCompanyId !== null &&
          entry.debtorCompanyId === userCompanyId;
        const isPayable = entry.statusCode === "payable";
        const isParty =
          userCompanyId !== null && (entry.debtorCompanyId === userCompanyId || entry.creditorCompanyId === userCompanyId);

        // A stalled proposal is the deadlock case, so lead with "Mark paid" there.
        const primaryAction = canDecide
          ? rowActionHints.confirmSettlement
          : canRecordReceipt
            ? rowActionHints.markReceived
            : canPropose
              ? rowActionHints.declarePaid
              : canRecordPayment
                ? rowActionHints.markPaid
                : null;

        const noActionReason = !live
          ? "Actions are unavailable while disconnected."
          : !isParty
            ? "No action for this company."
            : !isPayable
              ? "Settled"
              : "No quick action";

        return (
          <>
            <div>
              <span className="reference">{entry.reference}</span>
              <h3>{entry.description}</h3>
              <p>
                {entry.date}, {entry.direction}
              </p>
            </div>
            <div className="record-row-meta">
              <strong>{formatZar(entry.amount)}</strong>
              <StatusBadge tone={entry.tone}>{entry.status}</StatusBadge>
              {primaryAction === rowActionHints.confirmSettlement ? (
                <RowAction
                  mode="confirm"
                  label="Confirm settlement"
                  confirmMessage="Confirm settlement and mark this payable as settled."
                  action={decideLedgerSettlementAction}
                >
                  <input type="hidden" name="ledgerEntryId" value={entry.id} />
                  <input type="hidden" name="returnPath" value="/ledger" />
                  <input type="hidden" name="approved" value="true" />
                </RowAction>
              ) : primaryAction === rowActionHints.markReceived ? (
                <RowAction
                  mode="open"
                  label="Mark received"
                  onActivate={() => openRecord(entry.id, rowActionHints.markReceived)}
                />
              ) : primaryAction === rowActionHints.declarePaid ? (
                <RowAction
                  mode="open"
                  label="Declare paid"
                  onActivate={() => openRecord(entry.id, rowActionHints.declarePaid)}
                />
              ) : primaryAction === rowActionHints.markPaid ? (
                <RowAction
                  mode="open"
                  label="Mark paid"
                  onActivate={() => openRecord(entry.id, rowActionHints.markPaid)}
                />
              ) : (
                <RowAction reason={noActionReason} />
              )}
            </div>
          </>
        );
      }}
      renderPanel={(entry, closePanel, rowActionHint) => {
        const canPropose =
          live &&
          entry.statusCode === "payable" &&
          userCompanyId !== null &&
          entry.debtorCompanyId === userCompanyId &&
          entry.settlementProposal === null;
        const canRecordReceipt =
          live &&
          (entry.statusCode === "payable" || entry.statusCode === "included_in_statement") &&
          userCompanyId !== null &&
          entry.creditorCompanyId === userCompanyId;
        const canDecide =
          live &&
          entry.statusCode === "payable" &&
          userCompanyId !== null &&
          entry.creditorCompanyId === userCompanyId &&
          entry.settlementProposal !== null;
        const canRecordPayment =
          live &&
          (entry.statusCode === "payable" || entry.statusCode === "included_in_statement") &&
          userCompanyId !== null &&
          entry.debtorCompanyId === userCompanyId;
        const canOpenDispute =
          live &&
          entry.statusCode !== "disputed" &&
          userCompanyId !== null &&
          (entry.debtorCompanyId === userCompanyId || entry.creditorCompanyId === userCompanyId);
        const receiptActionFocus =
          rowActionHint === rowActionHints.markReceived ||
          rowActionHint === rowActionHints.declarePaid ||
          rowActionHint === rowActionHints.markPaid;
        return (
          <div className="record-detail-panel-content">
            {error ? <p className="auth-error" role="alert">{error}</p> : null}
            <div className="detail-metadata">
              <p>
                <span className="detail-label">Direction</span>
                <strong>{entry.direction}</strong>
              </p>
              <p>
                <span className="detail-label">Date</span>
                <strong>{entry.date}</strong>
              </p>
              <p>
                <span className="detail-label">Amount</span>
                <strong>{formatZar(entry.amount)}</strong>
              </p>
              <p>
                <span className="detail-label">Status</span>
                <strong>{entry.status}</strong>
              </p>
              {entry.disputeStatus ? (
                <p>
                  <span className="detail-label">Dispute</span>
                  <strong>{entry.disputeStatus}</strong>
                </p>
              ) : null}
            </div>

            <InlineNoteField
              recordType="ledger_entry"
              recordId={entry.id}
              returnPath="/ledger"
              fieldName="description"
              label="Description"
              value={entry.description}
              disabled={!live}
            />
            <InlineNoteField
              recordType="ledger_entry"
              recordId={entry.id}
              returnPath="/ledger"
              fieldName="reference"
              label="Reference"
              value={entry.reference}
              disabled={!live}
              allowEmpty
            />

            {canPropose ? (
              <form action={proposeLedgerSettlementAction} className="action-form">
                <input type="hidden" name="ledgerEntryId" value={entry.id} />
                <input type="hidden" name="returnPath" value="/ledger" />
                <label>
                  <span>Paid on</span>
                  <input
                    type="date"
                    className="text-field"
                    name="paidOn"
                    required
                    data-record-action-focus={receiptActionFocus && rowActionHint === rowActionHints.declarePaid ? `${entry.id}:${rowActionHint}` : undefined}
                  />
                </label>
                <label>
                  <span>Settlement reference</span>
                  <input className="text-field" name="reference" placeholder="Optional" />
                </label>
                <button className="primary-button full-width" type="submit" disabled={!live}>
                  Propose settlement
                </button>
              </form>
            ) : null}

            {canRecordReceipt ? (
              <form action={recordLedgerReceiptAction} className="action-form">
                <input type="hidden" name="ledgerEntryId" value={entry.id} />
                <input type="hidden" name="returnPath" value="/ledger" />
                <label>
                  <span>Paid on</span>
                  <input
                    type="date"
                    className="text-field"
                    name="paidOn"
                    required
                    data-record-action-focus={
                      receiptActionFocus && rowActionHint === rowActionHints.markReceived
                        ? `${entry.id}:${rowActionHint}`
                        : undefined
                    }
                  />
                </label>
                <label>
                  <span>Receipt reference</span>
                  <input className="text-field" name="reference" placeholder="Optional" />
                </label>
                <button className="primary-button full-width" type="submit" disabled={!live}>
                  Record money received
                </button>
              </form>
            ) : null}

            {canRecordPayment ? (
              <form action={recordLedgerPaymentAction} className="action-form">
                <input type="hidden" name="ledgerEntryId" value={entry.id} />
                <input type="hidden" name="returnPath" value="/ledger" />
                <label>
                  <span>Paid on</span>
                  <input
                    type="date"
                    className="text-field"
                    name="paidOn"
                    required
                    defaultValue={entry.settlementProposal?.paidOn ?? undefined}
                    data-record-action-focus={
                      receiptActionFocus && rowActionHint === rowActionHints.markPaid
                        ? `${entry.id}:${rowActionHint}`
                        : undefined
                    }
                  />
                </label>
                <label>
                  <span>Payment reference</span>
                  <input
                    className="text-field"
                    name="reference"
                    placeholder="Optional"
                    defaultValue={entry.settlementProposal?.reference ?? undefined}
                  />
                </label>
                <button className="primary-button full-width" type="submit" disabled={!live}>
                  Mark paid without confirmation
                </button>
                <p className="detail-hint">
                  Settles this entry now and notifies the counterparty, who can still open a dispute afterwards. Use
                  this when they cannot confirm it themselves.
                </p>
              </form>
            ) : null}

            {canDecide ? (
              <form action={decideLedgerSettlementAction} className="action-form">
                <input type="hidden" name="ledgerEntryId" value={entry.id} />
                <input type="hidden" name="returnPath" value="/ledger" />
                <label>
                  <span>Decision comment</span>
                  <textarea className="text-field" name="comment" rows={4} />
                </label>
                <label>
                  <span>Current proposal</span>
                  <input
                    className="text-field"
                    value={`${entry.settlementProposal?.paidOn ?? ""}${
                      entry.settlementProposal?.reference ? `, ${entry.settlementProposal.reference}` : ""
                    }`}
                    readOnly
                    disabled
                  />
                </label>
                <div className="detail-form-actions">
                  <button
                    className="primary-button"
                    type="submit"
                    name="approved"
                    value="true"
                    disabled={!live}
                  >
                    Confirm settlement
                  </button>
                  <button
                    className="secondary-button"
                    type="submit"
                    name="approved"
                    value="false"
                    disabled={!live}
                  >
                    Reject settlement
                  </button>
                </div>
              </form>
            ) : null}

            {canOpenDispute ? (
              <form action={openDisputeAction} className="action-form">
                <input type="hidden" name="ledgerEntryId" value={entry.id} />
                <label>
                  <span>Open dispute reason</span>
                  <textarea className="text-field" name="reason" rows={4} />
                </label>
                <button className="secondary-button full-width" type="submit" disabled={!live}>
                  Open dispute
                </button>
              </form>
            ) : null}

            <div className="detail-actions">
              <button className="link-button" type="button" onClick={closePanel}>
                Dismiss
              </button>
            </div>
          </div>
        );
      }}
    />
  );
}
