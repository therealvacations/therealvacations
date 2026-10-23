# Netlify migration — staging checklist

This branch is for testing only. Do not merge or move production DNS until checks pass.

## Netlify import
- Repository: therealvacations/therealvacations
- Branch for the initial preview: `chore/netlify-migration-preview` (NOT main)
- Build: `node build-nav-safe.js`
- Publish: `public`
- Functions: `netlify/functions`
- These values are also declared in `netlify.toml`.

## Secrets in Netlify UI — do not commit values
- `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `PUBLIC_SITE_URL` (preview origin while testing; production origin after cutover)
- Audit all other Vercel environment variables and migrate necessary ones to Netlify.
- Ensure Supabase auth allowed redirects and relevant webhooks/URLs are checked.

## Required pre-cutover checks
- Every route/rewrite and important security header works.
- Login, reset password, and account management work.
- Customer booking retrieval and administrator permissions work.
- Test all /api endpoints, particularly Stripe checkout, return and payment confirmation in Stripe TEST mode; never make a live payment as a test.
- Check any custom integrations, webhooks, CORS, and file uploads.
- Check production domain DNS/SSL and rollback plan before cutover.
- Set Terms of Service URL to https://therealvacations.com/terms-of-service in Stripe Dashboard public business details. Code alone cannot set it.

## Notes
- The adapter maps existing Vercel request/response handlers into Netlify Functions. This is an initial compatibility layer, not a production certification. Test each endpoint; further changes may be required for streamed responses or specialized headers.
- Keep Vercel serving the production domain until the full preview checklist passes.

## Additional staged payment fixes (not deployed)
- Apply Supabase migrations `20261023095000_atomic_group_member_deposit.sql` and `20261023095500_reserve_custom_checkout_payment.sql` to a **staging Supabase project first**.
- Deploy staging versions of `supabase/functions/stripe-webhook` and `supabase/functions/create-group-deposit-checkout`; the group deposit webhook now requires the new database RPC.
- Custom checkout API now requires `reserve_custom_checkout_payment` RPC before requests work. Never ship API changes without its migration.
- Stripe test mode: repeated same-session webhooks; two simultaneous checkout requests; invalid/mismatched amount; expired checkout retry; different group members paying simultaneously; post-payment confirmation after webhook.
- Check existing historical open payment records and group member session links before production rollout.
- No production changes should happen until Netlify staging and Supabase staging tests pass.
