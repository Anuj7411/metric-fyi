-- METRIC.fyi · reset a failed report so it can be re-analyzed
-- Created Day 8 (2026-05-15)
--
-- The analyze pipeline marks a row 'failed' on any error (Zod schema
-- violation, Gemini quota, download fail, etc). Before this RPC, the
-- only way out was uploading a new file — wasteful when the failure
-- was transient (e.g. a one-off schema rejection).
--
-- This adds a third anon-callable SECURITY DEFINER function that flips
-- failed → pending and clears the previous analysis+error. The
-- existing mark_analyzing RPC then picks up from there as if it were
-- a fresh upload.
--
-- Same security model as the rest: anon has no UPDATE policy on
-- reports; this function gates the legal transition. Only 'failed'
-- rows can be reset; anything else raises.

create or replace function public.reset_failed_report(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reports
     set status = 'pending',
         error_message = null,
         analysis = null
   where id = p_id and status = 'failed';

  if not found then
    raise exception 'cannot reset_failed_report: row % not in failed state', p_id;
  end if;
end;
$$;

revoke all on function public.reset_failed_report(uuid) from public;
grant execute on function public.reset_failed_report(uuid) to anon, authenticated;
