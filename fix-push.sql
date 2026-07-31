create or replace function public.push_subs_for_emails(emails text[])
returns table(id uuid, endpoint text, p256dh text, auth text) language plpgsql security definer as $$
begin
  return query
  select p.id, p.endpoint, p.p256dh, p.auth
  from public.push_subscriptions p
  join auth.users u on p.user_id = u.id
  where u.email = any(emails);
end; $$;
