-- Debtor-side mirror of record_ledger_receipt.
--
-- The original model is "debtor proposes, creditor confirms". That deadlocks
-- whenever the creditor has no account: LED-2026-000023 (R539 commission owed
-- to Big Link) sat payable with a proposal nobody could ever confirm.
--
-- A debtor settling its own debt is NOT self-limiting, so the guard moves from
-- pre-approval to post-challenge: the entry is stamped
-- settled_by_debtor_unconfirmed, the creditor is notified, and
-- open_ledger_dispute is opened up for exactly these entries so the creditor
-- can still challenge it after the fact.

create or replace function public.record_ledger_payment(
  p_entry_id uuid,
  p_paid_on date,
  p_reference text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_entry public.ledger_entries%rowtype;
  v_before_data jsonb;
  v_after_entry public.ledger_entries%rowtype;
  v_reference text;
  v_metadata jsonb;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  if p_entry_id is null then
    raise exception 'Ledger entry id is required';
  end if;

  if p_paid_on is null then
    raise exception 'Payment paid-on date is required';
  end if;

  v_reference := nullif(trim(p_reference), '');

  if v_reference is not null and char_length(v_reference) > 120 then
    raise exception 'Reference is too long';
  end if;

  select *
  into v_entry
  from public.ledger_entries
  where id = p_entry_id
  for update;

  if not found then
    raise exception 'Ledger entry not found';
  end if;

  if v_entry.status not in ('payable', 'included_in_statement') then
    raise exception 'Only payable or included-in-statement ledger entries can be recorded as paid';
  end if;

  if v_actor.company_id <> v_entry.debtor_company_id then
    raise exception 'Only the debtor can record payment';
  end if;

  v_before_data := to_jsonb(v_entry);

  v_metadata := (coalesce(v_entry.metadata, '{}'::jsonb) || jsonb_build_object(
    'settled_by_debtor_unconfirmed', jsonb_build_object(
      'recorded_by_company_id', v_actor.company_id,
      'recorded_by_profile_id', v_actor.profile_id,
      'recorded_at', now(),
      'paid_on', p_paid_on,
      'reference', coalesce(v_reference, v_entry.metadata -> 'settlement_proposal' ->> 'reference')
    )
  )) - 'settlement_proposal';

  perform set_config('app.allow_ledger_mutation', 'on', true);

  update public.ledger_entries
  set status = 'settled',
    metadata = v_metadata
  where id = p_entry_id
  returning * into v_after_entry;

  perform public.notify_company_admins(
    v_entry.creditor_company_id,
    'payment_submitted',
    'Payment recorded without your confirmation',
    'The debtor marked a payable as paid. Review it and open a dispute if you have not received the money.',
    'ledger_entries',
    p_entry_id
  );

  perform public.write_audit_event(
    'record_ledger_payment',
    'ledger_entries',
    p_entry_id,
    v_before_data,
    to_jsonb(v_after_entry)
  );
end;
$$;

grant execute on function public.record_ledger_payment(uuid, date, text) to authenticated;

-- Settled entries stay closed, EXCEPT ones the debtor closed unilaterally.
-- Without this the creditor has no recourse at all and the post-challenge
-- guard above is fiction.
create or replace function public.open_ledger_dispute(
  p_ledger_entry_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor record;
  v_entry public.ledger_entries%rowtype;
  v_dispute_id uuid;
begin
  select *
  into v_actor
  from public.require_portal_admin();

  select *
  into v_entry
  from public.ledger_entries
  where id = p_ledger_entry_id
  for update;

  if not found then
    raise exception 'Ledger entry not found';
  end if;

  if v_actor.company_id not in (v_entry.debtor_company_id, v_entry.creditor_company_id) then
    raise exception 'Actor company must be party to the ledger entry';
  end if;

  if v_entry.status in ('rejected', 'voided_by_adjustment')
    or (v_entry.status = 'settled' and not (v_entry.metadata ? 'settled_by_debtor_unconfirmed')) then
    raise exception 'This ledger entry cannot be disputed';
  end if;

  insert into public.disputes (
    ledger_entry_id,
    opened_by_company_id,
    opened_by,
    reason
  )
  values (
    p_ledger_entry_id,
    v_actor.company_id,
    v_actor.profile_id,
    p_reason
  )
  returning id into v_dispute_id;

  perform set_config('app.allow_ledger_mutation', 'on', true);

  update public.ledger_entries
  set status = 'disputed',
      metadata = metadata || jsonb_build_object('status_before_dispute', v_entry.status)
  where id = p_ledger_entry_id;

  perform public.notify_company_admins(
    case
      when v_actor.company_id = v_entry.debtor_company_id then v_entry.creditor_company_id
      else v_entry.debtor_company_id
    end,
    'dispute_opened',
    'Ledger item disputed',
    'A ledger item has been disputed and is excluded from payable balance.',
    'disputes',
    v_dispute_id
  );

  return v_dispute_id;
end;
$$;
