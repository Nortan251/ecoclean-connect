-- ============================================================================
-- accounts_part3.sql — SERVER-SIDE STREAK v2  (run in Supabase SQL Editor)
-- ----------------------------------------------------------------------------
-- Moves the streak from "localStorage only" (streak.js v1) to the server so it
-- survives devices / logouts and can drive a tamper-proof point-multiplier.
-- Idempotent: safe to re-run. The two RPCs are SECURITY DEFINER so the serverless
-- functions (service role) can update any user's row; RLS still blocks the browser
-- from touching `points`/streaks directly, and we GRANT EXECUTE only to the
-- service roles (never anon/authenticated), so a client cannot call them.
--
-- Semantics:
--   record_daily_activity(uid)  -> called on every accepted REPORT (POST). Advances
--       the consecutive-day streak (local-calendar-day math, server clock) and the
--       personal best. Idempotent within a day, so re-submits don't inflate it.
--   apply_streak_bonus(uid)     -> called at VERIFICATION, after award_points. Reads
--       the reporter's CURRENT streak and adds a tiered bonus (the "multiplier"):
--       streak>=14 -> +20, >=7 -> +10, >=3 -> +5, else 0. It does NOT change the
--       streak itself (activity owns that), keeping the two concerns separate.
-- ============================================================================

alter table public.profiles add column if not exists streak_cur int not null default 0 check (streak_cur >= 0);
alter table public.profiles add column if not exists streak_best int not null default 0 check (streak_best >= 0);
alter table public.profiles add column if not exists streak_last date;

create or replace function public.record_daily_activity(uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_last date; v_cur int; v_best int; v_diff int; v_today date := current_date;
begin
  select streak_last, streak_cur, streak_best into v_last, v_cur, v_best
    from public.profiles where id = uid for update;
  if not found then
    -- profile missing (rare race before the auth trigger ran): create minimal row
    insert into public.profiles(id, display_name) values (uid, 'Guardian')
      on conflict (id) do nothing;
    v_last := null; v_cur := 0; v_best := 0;
  end if;

  if v_last is null then
    v_cur := 1;                                  -- first ever active day
  elsif v_last = v_today then
    -- already counted today: no change (idempotent)
    return jsonb_build_object('streak_cur', v_cur, 'streak_best', v_best, 'changed', false);
  elsif v_last = v_today - 1 then
    v_cur := v_cur + 1;                          -- chain continues
  else
    v_cur := 1;                                  -- a day was missed -> reset
  end if;
  if v_cur > v_best then v_best := v_cur; end if;

  update public.profiles
     set streak_last = v_today, streak_cur = v_cur, streak_best = v_best
   where id = uid;
  return jsonb_build_object('streak_cur', v_cur, 'streak_best', v_best, 'changed', true);
end; $$;

create or replace function public.apply_streak_bonus(uid uuid)
returns int language plpgsql security definer set search_path = public as $$
declare v_cur int; v_bonus int;
begin
  select coalesce(streak_cur, 0) into v_cur from public.profiles where id = uid;
  if v_cur is null then v_cur := 0; end if;
  v_bonus := case when v_cur >= 14 then 20 when v_cur >= 7 then 10 when v_cur >= 3 then 5 else 0 end;
  if v_bonus > 0 then
    update public.profiles set points = points + v_bonus where id = uid;
  end if;
  return v_bonus;
end; $$;

-- Only the server (service role / postgres) may invoke these; the browser cannot.
revoke execute on function public.record_daily_activity(uuid) from public, anon, authenticated;
revoke execute on function public.apply_streak_bonus(uuid) from public, anon, authenticated;
grant execute on function public.record_daily_activity(uuid) to service_role, postgres;
grant execute on function public.apply_streak_bonus(uuid) to service_role, postgres;
