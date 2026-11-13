-- Extend supplier assignments to directly cover confirmed client bookings and custom bookings.
-- Existing group-trip, request, and quote assignments remain valid and unchanged.
alter table public.supplier_assignments
  add column if not exists booking_id uuid references public.bookings(booking_id) on delete cascade,
  add column if not exists custom_booking_id uuid references public.custom_bookings(custom_booking_id) on delete cascade;

alter table public.supplier_assignments
  drop constraint if exists supplier_assignments_context_type_check,
  drop constraint if exists supplier_assignment_context_check;

alter table public.supplier_assignments
  add constraint supplier_assignments_context_type_check
    check (context_type = any (array[
      'travel_request'::text,
      'travel_quote'::text,
      'group_trip'::text,
      'client_booking'::text,
      'custom_booking'::text
    ])),
  add constraint supplier_assignment_context_check
    check (
      (context_type = 'travel_request' and request_id is not null and quote_id is null and trip_id is null and booking_id is null and custom_booking_id is null)
      or (context_type = 'travel_quote' and quote_id is not null and request_id is null and trip_id is null and booking_id is null and custom_booking_id is null)
      or (context_type = 'group_trip' and trip_id is not null and request_id is null and quote_id is null and booking_id is null and custom_booking_id is null)
      or (context_type = 'client_booking' and booking_id is not null and request_id is null and quote_id is null and trip_id is null and custom_booking_id is null)
      or (context_type = 'custom_booking' and custom_booking_id is not null and request_id is null and quote_id is null and trip_id is null and booking_id is null)
    );

create index if not exists supplier_assignments_booking_idx
  on public.supplier_assignments(booking_id);
create index if not exists supplier_assignments_custom_booking_idx
  on public.supplier_assignments(custom_booking_id);

-- Supplier portal RLS remains unchanged: only visible assignments belonging to that supplier are readable.
-- Admin financial-field permissions remain governed by the existing admins_manage_supplier_assignments policy.
