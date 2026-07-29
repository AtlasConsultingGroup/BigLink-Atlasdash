-- Guard test for record_ledger_payment and the reopened dispute window.
-- Run inside a transaction and ROLLBACK: it seeds throwaway auth users and
-- settles a real entry, neither of which should survive.
--
--   psql "$(cat ~/.config/atlas-biglink/db-url)" -v ON_ERROR_STOP=1 \
--     -f supabase/tests/record_ledger_payment.sql
\set ON_ERROR_STOP on

begin;

do $$
declare
  v_atlas_company_id uuid := '00000000-0000-4000-8000-000000000001';
  v_big_link_company_id uuid := '00000000-0000-4000-8000-000000000002';
  v_atlas_auth_id uuid := '30000000-0000-4000-8000-000000000001';
  v_big_link_auth_id uuid := '30000000-0000-4000-8000-000000000002';
  v_atlas_profile_id uuid := '40000000-0000-4000-8000-000000000001';
  v_big_link_profile_id uuid := '40000000-0000-4000-8000-000000000002';
  v_entry_id uuid;
  v_settled_entry_id uuid;
  v_status public.ledger_status;
  v_metadata jsonb;
  v_raised boolean;
begin
  -- Two throwaway administrators, one per company, each with a verified
  -- email-MFA challenge bound to the session id the test will claim.
  insert into auth.users (id) values (v_atlas_auth_id), (v_big_link_auth_id)
  on conflict do nothing;

  insert into public.profiles (id, auth_user_id, full_name, email, status)
  values
    (v_atlas_profile_id, v_atlas_auth_id, 'Test Atlas Admin', 'test.atlas@example.invalid', 'active'),
    (v_big_link_profile_id, v_big_link_auth_id, 'Test Big Link Admin', 'test.biglink@example.invalid', 'active');

  insert into public.company_memberships (profile_id, company_id, status, activated_at)
  values
    (v_atlas_profile_id, v_atlas_company_id, 'active', now()),
    (v_big_link_profile_id, v_big_link_company_id, 'active', now());

  insert into public.email_mfa_challenges (profile_id, session_id, code_hash, expires_at, verified_at)
  values
    (v_atlas_profile_id, 'test-session-atlas', repeat('a', 64), now() + interval '1 hour', now()),
    (v_big_link_profile_id, 'test-session-biglink', repeat('b', 64), now() + interval '1 hour', now());

  select id into strict v_entry_id
  from public.ledger_entries
  where reference = 'LED-2026-000023';

  -- 1. The creditor must not be able to record the debtor's payment.
  perform set_config('request.jwt.claim.sub', v_big_link_auth_id::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_big_link_auth_id, 'session_id', 'test-session-biglink')::text, true);

  v_raised := false;
  begin
    perform public.record_ledger_payment(v_entry_id, current_date, 'creditor attempt');
  exception when others then
    v_raised := true;
    if sqlerrm not like '%Only the debtor can record payment%' then
      raise exception 'Wrong rejection for creditor: %', sqlerrm;
    end if;
  end;
  if not v_raised then
    raise exception 'FAIL: creditor was allowed to record payment';
  end if;

  -- 2. A normally settled entry stays undisputable.
  select id into strict v_settled_entry_id
  from public.ledger_entries
  where status = 'settled'
    and not (metadata ? 'settled_by_debtor_unconfirmed')
    and v_big_link_company_id in (debtor_company_id, creditor_company_id)
  limit 1;

  v_raised := false;
  begin
    perform public.open_ledger_dispute(v_settled_entry_id, 'should not be allowed on a confirmed settlement');
  exception when others then
    v_raised := true;
    if sqlerrm not like '%cannot be disputed%' then
      raise exception 'Wrong rejection for settled dispute: %', sqlerrm;
    end if;
  end;
  if not v_raised then
    raise exception 'FAIL: a confirmed settlement was disputable';
  end if;

  -- 3. The debtor settles it, clearing the stalled proposal.
  perform set_config('request.jwt.claim.sub', v_atlas_auth_id::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_atlas_auth_id, 'session_id', 'test-session-atlas')::text, true);

  perform public.record_ledger_payment(v_entry_id, date '2026-07-23', 'EFT to Big Link');

  select status, metadata into v_status, v_metadata
  from public.ledger_entries where id = v_entry_id;

  if v_status <> 'settled' then
    raise exception 'FAIL: expected settled, got %', v_status;
  end if;
  if not (v_metadata ? 'settled_by_debtor_unconfirmed') then
    raise exception 'FAIL: missing settled_by_debtor_unconfirmed stamp';
  end if;
  if v_metadata ? 'settlement_proposal' then
    raise exception 'FAIL: stalled settlement_proposal was not cleared';
  end if;
  if v_metadata -> 'settled_by_debtor_unconfirmed' ->> 'reference' <> 'EFT to Big Link' then
    raise exception 'FAIL: reference not recorded';
  end if;

  -- 4. The creditor can still challenge it afterwards. This is the only thing
  --    standing in for the confirmation step that was removed.
  perform set_config('request.jwt.claim.sub', v_big_link_auth_id::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_big_link_auth_id, 'session_id', 'test-session-biglink')::text, true);

  perform public.open_ledger_dispute(v_entry_id, 'We never received this commission payment.');

  select status into v_status from public.ledger_entries where id = v_entry_id;
  if v_status <> 'disputed' then
    raise exception 'FAIL: creditor could not dispute a debtor-settled entry, got %', v_status;
  end if;

  raise notice 'record_ledger_payment guards: all 4 checks passed';
end;
$$;

rollback;
