# Security review — admin and group access (GitHub source only)

Date: 2026-10-23. Scope: code in this repository. This is **not** a production security certification.

## Verified in source
- Admin login (`public/admin-login.html`) authenticates with Supabase then checks `admin_users`.
- Admin portal (`js/admin-content.js`) redirects users who have no `admin_users` membership.
- The reviewed admin Stripe/payment endpoints call Supabase `auth.getUser` and verify `admin_users`.
- `supabase/functions/group-invite` requires the authenticated caller to be the group's leader.
- `supabase/functions/join-group` verifies the user's confirmed email and passes a hashed, expiring invite token to a server-side RPC.
- Migration `20260918102004_phase_3_group_travel.sql` defines RLS for group and group-member reads and restricts member writes to admins.
- The same migration revokes direct execution of the invitation acceptance RPC from anon/authenticated and grants it only to service_role.

## Outstanding checks (must be completed on the actual production Supabase project)
1. Confirm all relevant migrations were actually applied and RLS is enabled in production.
2. Inspect grants, views, SQL RPCs, and storage policies for access to booking records, member details, payment methods, and administrator-only data.
3. Test as a nonadmin, unrelated customer, invited traveler, group leader, and administrator. Confirm each role can see and change only intended data.
4. Verify that sensitive API secrets stay server-side in Netlify and Supabase.
5. Review logs, auth warnings, and outstanding invoices; arrange a secure database backup before SQL changes.
6. Test all Stripe Checkout flows in test mode, including retries, simultaneous group deposits and webhook delivery.
7. Verify Netlify preview environment variables, API route compatibility, headers, and build output before any production DNS changes.

## Access limitation
The connected Supabase integration currently exposes an inactive mirror project (`hdpggavpokknjhygvrnd`), NOT the website's production project (`lqdflvnkiskzmvvknmmh`). The production project returned a permission error. Do **not** apply migrations to the mirror as if it were production.

## Notes
The admin HTML is publicly fetchable, as is normal for a static-site SPA; confidentiality and integrity depend on the **database RLS and server-side authorization**, not whether a user can load `/admin` HTML.
