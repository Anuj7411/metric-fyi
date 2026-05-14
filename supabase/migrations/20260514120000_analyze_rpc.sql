-- METRIC.fyi · status-transition RPCs for the analyze pipeline
-- Created Day 4 (2026-05-14)
--
-- Anon role has INSERT on reports but no UPDATE policy. We deliberately
-- did not add a broad UPDATE policy because anon shouldn't be able to
-- arbitrarily flip status or write analysis data. Instead, we expose
-- three SECURITY DEFINER functions that gate the transitions:
--
--   mark_analyzing(p_id)         pending  -> analyzing
--   mark_failed(p_id, p_msg)     pending|analyzing -> failed
--   save_analysis(p_id, p_data)  analyzing -> ready (with the JSON)
--
-- Each function enforces the legal state transition inside its body, so
-- callers (the analyze route via the anon role) can only progress the
-- row in valid ways. Same security model as fetch_report.

create or replace function public.mark_analyzing(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reports
     set status = 'analyzing'
   where id = p_id and status = 'pending';

  if not found then
    raise exception 'cannot mark_analyzing: row % not in pending state', p_id;
  end if;
end;
$$;

create or replace function public.mark_failed(p_id uuid, p_msg text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reports
     set status = 'failed',
         error_message = left(coalesce(p_msg, 'unknown error'), 500)
   where id = p_id and status in ('pending', 'analyzing');

  if not found then
    raise exception 'cannot mark_failed: row % not in pending/analyzing', p_id;
  end if;
end;
$$;

create or replace function public.save_analysis(p_id uuid, p_analysis jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reports
     set status = 'ready',
         analysis = p_analysis
   where id = p_id and status = 'analyzing';

  if not found then
    raise exception 'cannot save_analysis: row % not in analyzing state', p_id;
  end if;
end;
$$;

revoke all on function public.mark_analyzing(uuid) from public;
revoke all on function public.mark_failed(uuid, text) from public;
revoke all on function public.save_analysis(uuid, jsonb) from public;

grant execute on function public.mark_analyzing(uuid)         to anon, authenticated;
grant execute on function public.mark_failed(uuid, text)      to anon, authenticated;
grant execute on function public.save_analysis(uuid, jsonb)   to anon, authenticated;
