-- Add optional user-supplied context to reports.
--
-- Solves a real product failure: when a creator uploads a screen
-- recording of themselves using App A to view content B, Gemini sees
-- the visible pixels (mostly content B's UI) and analyzes it AS
-- content B — missing the user's intent that App A be the subject.
--
-- The user_context column lets the creator pre-state intent at upload
-- time ("this is a Loom of my product demo, not a Secret Santa video")
-- which gets prepended to the Gemini prompt so the model has framing.
--
-- Anon RLS already allows this — the existing INSERT policy's WITH
-- CHECK enforces user_id IS NULL / status='pending' / analysis IS NULL
-- / error_message IS NULL, and is silent on user_context, so the new
-- column is freely settable on insert without a policy change.

alter table public.reports
  add column if not exists user_context text;

comment on column public.reports.user_context is
  'Optional user-supplied framing for the video, e.g. "screen recording of my product demo". Prepended to the Gemini system prompt at analyze time. Max ~500 chars enforced at the API layer.';
