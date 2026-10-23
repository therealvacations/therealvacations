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
