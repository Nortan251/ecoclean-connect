-- ============================================================================
-- accounts_part5.sql — ASSOCIATION PORTAL (admin v2)  (run in Supabase SQL Editor)
-- ----------------------------------------------------------------------------
-- Turns the single shared "admin key" demo into a real multi-organisation model so
-- the platform can be handed to real associations across Morocco:
--   * associations  = a partner org, anchored to ONE city (lat/lng + radius_km).
--   * profiles.role = 'user' | 'admin' | 'super'; profiles.association_id links an
--     admin to their org.
--   * admin_context(uid) -> the server's single source of truth for "who is this
--     admin and what may they see": {is_super, role, association_id, city, lat,
--     lng, radius_km}. is_super is true for the SUPER_ADMIN_EMAIL env var (or a
--     profile flagged 'super') so the project owner keeps full oversight while
--     association admins see ONLY their city's reports.
--   * report_in_city(lat,lng,c_lat,c_lng,radius_km) -> bounding-box membership,
--     used to scope the report list + guard verification server-side (the client
--     filter is a convenience; THIS is the enforcement).
-- SECURITY DEFINER + execute granted only to service_role/postgres, so the
-- browser can never call them or widen its own scope. Idempotent.
-- ============================================================================
create table if not exists public.associations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  lat double precision not null,
  lng double precision not null,
  radius_km int not null default 25 check (radius_km > 0),
  contact_email text,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists role text not null default 'user'
  check (role in ('user','admin','super'));
alter table public.profiles add column if not exists association_id uuid
  references public.associations(id) on delete set null;

create or replace function public.admin_context(uid uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_role text; v_aid uuid; v_email text;
  v_name text; v_city text; v_lat float; v_lng float; v_rad int; v_super boolean;
begin
  select role, association_id into v_role, v_aid from public.profiles where id = uid;
  select email into v_email from auth.users where id = uid;
  v_super := (v_role = 'super') or (v_email = current_setting('app.super_admin_email', true));
  if v_super then
    return jsonb_build_object('is_super', true, 'role', coalesce(v_role,'super'),
           'association_id', null, 'city', null, 'lat', null, 'lng', null, 'radius_km', null);
  end if;
  if v_role = 'admin' and v_aid is not null then
    select name, city, lat, lng, radius_km into v_name, v_city, v_lat, v_lng, v_rad
      from public.associations where id = v_aid;
    return jsonb_build_object('is_super', false, 'role', 'admin',
           'association_id', v_aid, 'association_name', v_name, 'city', v_city,
           'lat', v_lat, 'lng', v_lng, 'radius_km', v_rad);
  end if;
  return jsonb_build_object('is_super', false, 'role', coalesce(v_role,'user'),
         'association_id', null, 'city', null, 'lat', null, 'lng', null, 'radius_km', null);
end; $$;

-- Bounding-box membership (degrees approx: 1deg lat ~111km; lng ~111km*cos(lat)).
-- Cheap + index-friendly; precise Haversine is overkill for a city-radius gate.
create or replace function public.report_in_city(
  r_lat double precision, r_lng double precision,
  c_lat double precision, c_lng double precision, radius_km int)
returns boolean language sql immutable as $$
  select abs(r_lat - c_lat) <= (radius_km / 111.0)
     and abs(r_lng - c_lng) <= (radius_km / greatest(1.0, 111.0 * cos(radians(c_lat))))
$$;

revoke execute on function public.admin_context(uuid) from public, anon, authenticated;
grant execute on function public.admin_context(uuid) to service_role, postgres;

-- Example: create a partner + promote a user to its admin (edit the values!):
-- insert into public.associations(name, city, lat, lng, radius_km, contact_email)
--   values ('Agadir Cleaners', 'Agadir', 30.4278, -9.5981, 25, 'assoc@agadir.ma')
--   returning id;
-- update public.profiles set role='admin', association_id='<the id above>'
--   where id='<that user''s auth id>';
