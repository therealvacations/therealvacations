# TRV content freshness and Metricool workflow audit — 2026-10-23

## Verified in repository
- Public blog `/blog` loads `blog_posts` from Supabase using `js/content-public.js`; it displays rows with `is_published = true` and `published_at <= now()`.
- Admin `js/admin-content.js` can add/edit/delete blog posts and set dates; this is NOT a Metricool import/export connection.
- `build-nav-safe.js` installs Metricool website visitor analytics. Analytics tracking does not sync Facebook or Instagram content.
- The `/trips` page promoted an Atlanta interest poll with closing date October 17, 2026. This draft branch removes the expired poll banner from the listing (the landing page still requires separate review).
- A Jamaica campaign on `/trips` lists a November 2, 2026 request deadline and future travel windows. Whether its offers are currently valid is **unverified**.
- Social destinations currently linked by the website: Facebook page `therealvacations.trv`, Facebook group `4533661796904105`, Instagram `therealvacations`, YouTube `@TheRealVacations`.

## NOT verified
- Posts, comments, pinned announcements, group events, archives, Instagram reels/stories, or Metricool scheduled drafts. Public scraping is incomplete and Metricool is not connected to this chat.
- Live Supabase `blog_posts` records and trip availability; production Supabase project cannot be read by the current connector.

## Safe two-way workflow
1. Website to socials: publish approved blog post, send an RSS or API-based notification to Metricool, schedule platform-adapted excerpts linking to the original blog URL. Confirm Metricool account/plan capabilities first.
2. Socials to website: ingest only approved business-owned posts using authorized Metricool/Meta integrations, with source ID dedupe; place lightweight social updates in a separate `From Our Socials` section. Do NOT convert all captions into blog articles.
3. Quarantine posts containing prices, dates, availability, deadlines, booking calls-to-action, or personal group-member information until an administrator reviews them.
4. Never copy Facebook group member posts/comments to the public site without consent.
5. For all date-limited site promos, provide expiry dates and automatic hiding; keep completed trips as dated archives or real stories.
6. Test preview in Vercel before deploy. Do not combine this editorial change with payment/security PR #15.

## Outstanding manual review
- Confirm Atlanta poll landing page status, October 24 option, November 7/14 options.
- Confirm Jamaica campaign deadline and available trips.
- Confirm February 2027 Mary J. Blige booking details and status from owners and their booking data, not just poster imagery.
- Reconcile posts from Metricool with actual published website content and identify duplicates, expired items, and missing stories.
