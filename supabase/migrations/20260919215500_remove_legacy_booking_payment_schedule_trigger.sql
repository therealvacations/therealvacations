-- Remove obsolete legacy booking payment schedule trigger.
-- The current Stripe booking flow owns payment rows and installment generation.
-- Keeping the legacy trigger caused webhook booking updates to reference a removed
-- public."Trips" table and roll back otherwise successful Stripe payments.

drop trigger if exists booking_rebuild_payment_schedule on public.bookings;
drop function if exists public.trg_booking_rebuild_schedule();
drop function if exists public.rebuild_booking_payment_schedule(uuid);
