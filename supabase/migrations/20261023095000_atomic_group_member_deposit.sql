-- Atomically reconcile each group-member Stripe deposit exactly once.
-- Apply to Supabase staging before deploying the corresponding webhook.
create or replace function public.complete_group_member_deposit(
  p_membership_id uuid,
  p_booking_id uuid,
  p_checkout_session_id text,
  p_amount_total integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings%rowtype;
  v_member public.travel_group_members%rowtype;
  v_group_id uuid;
  v_paid integer;
  v_balance integer;
begin
  if p_checkout_session_id is null or p_checkout_session_id !~ '^cs_' or
     p_amount_total is null or p_amount_total <= 0 then
    raise exception 'Invalid Stripe group deposit';
  end if;
  -- Serialize changes to the shared booking before locking individual members.
  select * into v_booking from public.bookings
  where booking_id = p_booking_id for update;
  if v_booking.booking_id is null then raise exception 'Group booking not found'; end if;

  select * into v_member from public.travel_group_members
  where membership_id = p_membership_id and booking_id = p_booking_id for update;
  if v_member.membership_id is null then raise exception 'Group member not found'; end if;
  if v_member.stripe_deposit_session_id is distinct from p_checkout_session_id then
    raise exception 'Unexpected Stripe deposit session';
  end if;
  if v_member.deposit_required <> p_amount_total then
    raise exception 'Group deposit amount mismatch';
  end if;

  if v_member.deposit_paid_at is null then
    update public.travel_group_members
    set deposit_paid_at = now(),
        share_paid = coalesce(share_paid, 0) + p_amount_total,
        share_status = case when coalesce(share_paid, 0) + p_amount_total >= share_total
                            then 'paid' else 'partial' end,
        updated_at = now()
    where membership_id = p_membership_id;

    v_paid := least(v_booking.total_amount, coalesce(v_booking.amount_paid,0) + p_amount_total);
    v_balance := greatest(0, v_booking.total_amount - v_paid);
    update public.bookings
    set amount_paid = v_paid, balance_due = v_balance, updated_at = now()
    where booking_id = p_booking_id;
  end if;

  v_group_id := v_member.group_id;
  if not exists (
    select 1 from public.travel_group_members
    where group_id = v_group_id and coalesce(deposit_required,0) > 0
      and deposit_paid_at is null
  ) then
    update public.travel_groups set status = 'confirmed', updated_at = now()
    where group_id = v_group_id;
    update public.bookings set status = 'confirmed', updated_at = now()
    where booking_id = p_booking_id;
  end if;
  return p_booking_id;
end;
$$;
revoke all on function public.complete_group_member_deposit(uuid,uuid,text,integer)
  from public, anon, authenticated;
grant execute on function public.complete_group_member_deposit(uuid,uuid,text,integer) to service_role;
