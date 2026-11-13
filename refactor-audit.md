# Hardcoded-content audit

Audited repository: `therealvacations/therealvacations` on `main` (tree at `6e6d1a73ed588a037ab12fa9d70e975e7ed98de2`). This is an audit only; no application, schema, or migration code was changed.

## Mapping conventions

- `site_content` is the proposed generic editable-content table using the schema supplied in the task: `key text primary key`, `value jsonb not null`, `updated_at`, and `updated_by`. The table was not present in the migrations inspected. Unless noted otherwise, `site_content.value.<path>` below means a JSON property in that `value` column, retrieved by `key` (for example `key = 'page.home'`). Store related page copy, page theme tokens, metadata, image URLs, and link labels in the JSON document. Apply the requested public-read/admin-write RLS when the table is created.
- Existing appropriate content sources should be reused: `site_settings.home_content`, `site_settings.about_content`, `site_settings.branding_content`, `site_settings.page_content`, `site_settings` contact fields, `trips`, `trip_packages`, `trip_addons`, `resources`, `blog_posts`, `deals`, `wheel_settings`, `gallery_items`, and `testimonials`. Their use is already evident in the frontend/migrations inspected.
- Rows group related literals in the same section/line range; they are not instructions to make one-off overrides. CSS color and spacing tokens are included because the request explicitly includes color and spacing. Exclude technical constants (DOM selectors, HTML attributes, protocol/security allowlists, payment logic, and layout mechanics) unless they are displayed as user-facing content.
- Dynamic records already read from a suitable Supabase table are not listed as hardcoded. The line numbers refer to the audited `main` snapshot above.

## Home — `public/index.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Metadata | 7–8, 119–128 | Page title, description, Open Graph/Twitter title and description, canonical/social URLs, social image | `site_settings.home_content` (add `meta_title`, `meta_description`, `canonical_url`, `og_image_url`) |
| Theme / layout tokens | 16–48, 50–117 | Inline CSS palette, typography, spacing, gradients, borders, shadows, and component colors | `site_content.value.theme` (propose `page.home` JSON keys `colors`, `spacing`, `typography`, `gradients`, `shadows`) |
| Announcement | 134–136 | Announcement text, link label, link URL | `site_settings.home_content.announcement`, `.announcement_url`, add `.announcement_link_label` |
| Navigation | 138–157 | Logo image path/alt, nav labels and destinations, login/signup labels and URLs | `site_settings.branding_content.logo_url`, `.site_name`, `.nav` (nav-auth labels/URLs need additional JSON keys) |
| Hero | 161–175 | Video poster/source URLs, hero tag/title/body, trust-item copy, primary/secondary/spin CTA labels and URLs | Existing `site_settings.home_content.hero_tag`, `.hero_title`, `.hero_text`, `.trust_items`, `.cta_label`, `.cta_url`; add secondary/spin CTA and video URL fields |
| Perks | 181–210 | Section label, heading/subheading, four icons, card titles/body, CTA labels/URLs | `site_settings.home_content.perks_heading`, `.perks_subheading`, `.perks[]`; add `.perks_section_label` |
| Trips section | 214–219 | Section label, heading/subheading, loading copy | Heading/subheading exist in `site_settings.home_content`; trip records already use `trips` and `trip_packages`; add section-label/loading-state keys |
| Process | 223–248 | Section label, four numbered step titles and body copy | Existing `site_settings.home_content.process_heading`, `.steps[]`; add `.process_section_label` |
| FAQ | 251–278 | FAQ heading, five questions/answers, signup CTA copy/URL | Existing `site_settings.home_content.faq_heading`, `.faqs[]`; add/edit nested link labels/URLs or represent answer links as structured content |
| Bottom CTA | 282–288 | Heading, body, spin and trips CTA labels/URLs | Existing `site_settings.home_content.bottom_heading`, `.bottom_text`; add CTA label/URL keys |
| Spin modal | 290–313 | Modal title/body, spin states, result/claim text, input placeholders, subscription disclosure, CTA labels | Existing `wheel_settings` for prizes/colors; propose `site_content.value.spin_modal` for editorial copy/labels and `wheel_settings` for editable prize labels/colors |
| Footer | 315–345 | Logo path/alt, brand statement, social labels/URLs, link headings/labels/URLs, contact email, copyright year/text, attribution label/URL | Existing `site_settings.branding_content` and contact email; propose `site_content.value.global_footer` for remaining content and links |
| Spin behavior messages | 381–458 | User-visible unavailable, error, success, expiry, opt-in and validation messages | `site_content.value.spin_messages` (functional messages remain in frontend logic; only message strings become editable) |

## About — `public/about.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Metadata | 6–8, 66–75 | Title, description, favicon path, Open Graph/Twitter text, canonical/social URLs and image | `site_settings.about_content` (add metadata/image fields) |
| Theme / layout tokens | 13–63 | Palette, gradients, typography, shadows, all CSS spacing and colors | `site_content.value.theme` (propose `page.about` theme JSON) |
| Navigation | 78–93 | Nav logo path/alt, nav labels and URLs | `site_settings.branding_content.logo_url`, `.site_name`, `.nav` |
| Hero and story | 95–125 | Hero heading/subtitle, story heading and all story paragraphs/highlights | Existing `site_settings.about_content.hero_title`, `.hero_subtitle`, `.story_heading`, `.story[]` |
| Story image | 127–129 | Background color, image path, alt text | Existing `site_settings.about_content` (add `story_image_url`, `story_image_alt`); color in `site_content.value.theme` |
| Values and stats | 131–151 | Values heading, icons/titles/descriptions, statistics heading/numbers/labels | Existing `site_settings.about_content.values_heading`, `.values[]`, `.stats_heading`, `.stats[]` |
| CTA | 153–157 | Heading/body/button label and URL | Existing `site_settings.about_content.cta_heading`, `.cta_text`, `.cta_label`, `.cta_url` |
| Footer | 159–196 | Logo, brand copy, social URLs/labels, footer link labels/URLs, email, copyright | `site_settings.branding_content`, contact email; propose `site_content.value.global_footer` |

## Trips — `public/trips.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Metadata/theme | 6–23 | Title, description, palette, typography, spacing, gradients, shadows and card styling | Propose `site_content.value.page.trips` (metadata and theme JSON) |
| Navigation | 24 | Logo/image path and alt, nav labels/URLs/auth labels | `site_settings.branding_content.logo_url`, `.nav` and global navigation content |
| Atlanta campaign banner | 25–31 | Banner colors/spacing, kicker, headline, body, CTA label/URL, deadline/disclaimer | Propose `site_content` key `campaign.atlanta` (or a campaign table) with `theme`, `kicker`, `title`, `body`, `cta_label`, `cta_url`, `deadline_text` |
| Jamaica campaign banner | 32–38 | Banner colors/spacing, kicker, headline, body, CTA label/URL, deadline/disclaimer | Propose `site_content` key `campaign.jamaica` with matching campaign fields |
| Trip introduction and listing | 39 onward | Intro copy and any hardcoded card/loading labels; trip data | Intro/state copy in `site_content.value.page.trips`; trip content/prices already belong to `trips` / `trip_packages` |

## Contact — `public/contact.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Metadata/theme | 6–8, 13–73, 75–84 | Title/description, favicon, palette, gradients, spacing, typography, component colors, social metadata/canonical | Propose `site_content.value.page.contact` metadata/theme; favicon can use `site_settings.branding_content` |
| Navigation | 87–101 | Logo path/alt, nav labels and destinations | `site_settings.branding_content.logo_url`, `.nav` |
| Hero/contact intro | 103–108 | Contact heading and intro | Existing `site_settings.contact_heading`, `.contact_intro` (already applied by `site-settings.js`) |
| Contact information | 110–129 | Section headings, explanatory text, email fallback, message CTA, business-hours heading/note | Existing `site_settings.contact_email`, `.business_hours`; propose `site_content.value.page.contact.contact_sections` for remaining labels/copy |
| Contact form | 131–172 | Form headings, labels, select options, placeholders, submit/status copy | Propose `site_content.value.page.contact.form` (field labels/options/placeholders and status messages) |
| Newsletter | 174–185 | Heading/body, input placeholders, opt-in disclosure, button/status/note copy | Propose `site_content.value.page.contact.newsletter` |
| Footer | 187–217 | Logo, brand copy, social links, link labels/URLs, contact fallback, copyright | `site_settings.branding_content`, contact email; propose `site_content.value.global_footer` |
| Form runtime messages | 228–263 | Sending/success/error/subscription status copy | `site_content.value.page.contact.messages` |

## How It Works — `public/how-it-works.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Metadata/theme | 6–8, 13–71, 73–82 | Title/description, favicon, palette, gradients, spacing, typography, shadows and card colors | Propose `site_content.value.page.how_it_works` metadata/theme JSON |
| Navigation | 85–98 | Logo and nav labels/URLs | `site_settings.branding_content.logo_url`, `.nav` |
| Hero/process | 100–117 | Hero title/body, section heading, six process step titles/body copy | Propose `site_content.value.page.how_it_works.hero` and `.steps[]` |
| Payment cards | 119–128 | Section title, card icons/headings/body | Propose `site_content.value.page.how_it_works.payment_options[]` |
| FAQs | 130–142 | FAQ heading, all question/answer copy | Propose `site_content.value.page.how_it_works.faqs[]` |
| CTA | 144–148 | CTA heading/body/button label/URL | Propose `site_content.value.page.how_it_works.cta` |
| Footer | 150–181 | Logo, brand copy, social links, footer links, email and copyright | `site_settings.branding_content`, contact email; propose `site_content.value.global_footer` |

## Real Stories — `public/real-stories.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Metadata/theme | 6–8, 13–79, 81–90 | Title/description, favicon, palette, gradients, spacing, typography, cards and image styling, social metadata | Propose `site_content.value.page.real_stories` metadata/theme JSON |
| Navigation | 93–106 | Logo and nav labels/URLs | `site_settings.branding_content.logo_url`, `.nav` |
| Hero/section copy | 108–120 | Hero title/body, gallery heading/description, reviews heading/description | Propose `site_content.value.page.real_stories.sections` |
| Gallery | 121–154 | Image paths, alt text and captions | Existing `gallery_items.image_url`, `.alt_text`, `.caption`, `.sort_order` (page currently uses this table with hardcoded fallback records) |
| Testimonials | 157–188 | Section heading/body and fallback reviews, names, initials, destinations/dates, review text and ratings | Existing `testimonials` columns; section heading/body in `site_content.value.page.real_stories` |
| Services and CTA | 190–213 | Services heading/body/cards; closing CTA heading/body/labels/URLs/help copy | Propose `site_content.value.page.real_stories.services[]` and `.cta` |
| Footer | 215–246 | Logo, brand text, social URLs/labels, footer links/email/copyright | `site_settings.branding_content`, contact email; propose `site_content.value.global_footer` |

## Travel Blog — `public/blog.html`; Article — `public/blog-post.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Blog page metadata/theme | `public/blog.html`: 6–23 | Title/description, palette, spacing, typography, card colors and loading/empty/error copy | Propose `site_content.value.page.blog` metadata/theme/messages |
| Blog navigation/intro/footer | `public/blog.html`: 24 onward | Logo, nav labels/URLs, hero/section text, link labels/URLs, footer copy/contact/copyright | `site_settings.branding_content`, contact email; propose `site_content.value.page.blog` and `global_footer` |
| Blog articles | `js/content-public.js`: 157–183; `public/blog-post.html`: 1 | Article titles, excerpts, body, category, image and publish dates already belong to `blog_posts`; hardcoded card labels (`Trip Recap`, `Travel`, `Read More →`) and loading/error/empty states need editable labels | Existing `blog_posts` for records; propose `site_content.value.page.blog.labels` and `.messages` |
| Article detail page | `js/content-public.js`: 318–335; `public/blog-post.html`: 1 | Article detail state messages, default category/brand suffix and image alt fallback | Existing `blog_posts`; shared display labels in `site_content.value.page.blog.labels` |

## Travel Resources — `public/resources.html`, `js/content-public.js`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Metadata/theme | `public/resources.html`: 6–23 | Title/description, palette, spacing, typography, shadows, card styling | Propose `site_content.value.page.resources` metadata/theme JSON |
| Navigation/intro/footer | `public/resources.html`: 24 onward | Logo, navigation, hero/section copy, search placeholder, footer copy/contact/links | `site_settings.branding_content`, contact email; propose `site_content.value.page.resources` and `global_footer` |
| Resource cards | `js/content-public.js`: 85–155 | Loading/error/empty/search messages, category-name dictionary, default icon, default CTA label | Existing `resources` table has card title/description/category/icon/image/link label/url; move UI labels/messages/category display names to `site_content.value.page.resources.labels` |

## Trip Detail — `public/trip.html`, `js/content-public.js`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Detail-page metadata/theme | `public/trip.html`: 1–2 | Default title/description and page theme tokens | Propose `site_content.value.page.trip_detail` metadata/theme |
| Trip detail fallback/state copy | `js/content-public.js`: 195–316 | Incomplete/unavailable trip, default kicker/description, section headings, booking labels, package/add-on fallbacks and button labels | Trip-specific copy already uses `trips`, `trip_packages`, `trip_addons`; generic UI labels in `site_content.value.page.trip_detail.labels` / `.messages` |
| Detail links/images | `js/content-public.js`: 201–219, 259–290 | Default CTA labels and brand suffix; actual trip images/official info URLs and labels belong to `trips` | Existing `trips.cover_image_url`, `.external_info_url`, `.external_info_label`; CTA label defaults in `site_content.value.page.trip_detail.labels` |

## Flights — `public/flights.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Metadata/theme | 6–18 | Title/description, palette, spacing, typography, iframe/fallback styling | Propose `site_content.value.page.flights` metadata/theme |
| Navigation | 21–27 | Logo, navigation labels/URLs, login/signup labels | `site_settings.branding_content.logo_url`, `.nav` |
| Hero and support CTA | 28–34 | Hero heading/body, request-help notice and link text/URL, iframe title/URL, fallback text/link | Propose `site_content.value.page.flights.hero`, `.notice`, `.search_partner`, `.messages` |
| Footer | 36 | Copyright, privacy/terms labels and URLs | Propose `site_content.value.global_footer` |

## Hotels & Stays — `public/stays.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Page metadata/theme | 1–2 | Title, palette, typography, spacing and visual treatment | Propose `site_content.value.page.stays` metadata/theme |
| Header/hero/search | 3–4 | Logo, help CTA, hero title/body, search labels/placeholders/defaults and button copy | Propose `site_content.value.page.stays` content/form fields; partner links/search URL should be editable configuration |

## Add-On Experiences — `public/experiences.html`; Travel Essentials — `public/travel-essentials.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Page metadata/theme/navigation | `public/experiences.html`: 1; `public/travel-essentials.html`: 1 | Page titles, icon/image paths, branding, navigation, colors, spacing, typography | Propose `site_content.value.page.experiences` and `.travel_essentials` metadata/theme/navigation JSON |
| Hero, filters, cards and empty states | Both files: full compact HTML on line 1 and linked scripts | Page headings/body, filter labels, card captions/CTAs, search field copy and loading/error states | Existing `resources` for managed resources; remaining page chrome in each `site_content.value.page.*` document |

## Deals — `public/deals.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Metadata/theme | 6–40 | Title, palette, gradients, spacing, typography, filter/card colors, social metadata/canonical | Propose `site_content.value.page.deals` metadata/theme |
| Navigation and hero | 43–47 | Logo/nav labels and URLs, hero title/body, filter names, empty/loading labels, bottom CTA | Existing `deals` for deal records; propose `site_content.value.page.deals` for page chrome and filter labels |
| Deals cards | 84–103 | Loading/error/empty messages and default CTA label | Existing `deals` table for card content; `site_content.value.page.deals.messages` for states/labels |
| Footer | 48–78 | Social links, quick links, contact email, copyright | `site_settings.branding_content`, contact email; propose `site_content.value.global_footer` |

## Spin & Save — `public/spin.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Metadata/theme | 5–17 | Title, colors, typography, spacing, gradients, wheel and card presentation | Propose `site_content.value.page.spin` metadata/theme |
| Navigation/intro | 19–26 | Logo/nav labels/URLs, hero title/body and introductory heading/body | Propose `site_content.value.page.spin` content/navigation |
| Wheel/claim UI | 28–41 | Spin labels, prize fallback labels/colors, results/claim copy, input placeholders, consent and terms/footer labels | Existing `wheel_settings` for prize labels/inventory/colors; propose `site_content.value.page.spin.labels`, `.messages`, `.disclosure` |
| Runtime messages | 44–52 | Spin/claim loading, error, success and validation messages | `site_content.value.page.spin.messages` |

## Travel Trivia — `public/travel-trivia.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Metadata/theme | 6–33 | Title/description, palette, typography, all page spacing/colors and card styling | Propose `site_content.value.page.travel_trivia` metadata/theme |
| Navigation/hero/quizzes | 36–65 | Logo/nav labels/URLs, hero and quiz copy, Facebook/quiz URLs, CTA labels | Propose `site_content.value.page.travel_trivia.hero`, `.quizzes[]`, `.links` |
| Qualification/prize/rules | 66–94 | Steps, eligibility copy, prize description, dates, terms/offer copy | Propose `site_content.value.page.travel_trivia.promotion` JSON (promotion configuration and legally reviewed rules) |
| Entry form/footer | 96–145 | Form labels/placeholders/consent copy, submit/result messages, privacy/terms/footer text and copyright | Propose `site_content.value.page.travel_trivia.form`, `.messages`, and `global_footer` |

## Vacationers VIP — `public/vip.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Metadata/theme/intro | 3–16 | Title, palette/spacing/typography, hero title/body, status labels | Propose `site_content.value.page.vip` metadata/theme/content |
| Membership offers | 37–44 | Welcome gift, plan names/prices/promotional terms, descriptions, labels and form placeholders | Use existing `site_settings`/VIP configuration if it contains editable plan copy; otherwise propose `site_content.value.page.vip.plans[]` (prices must remain consistent with Stripe/server configuration) |
| Membership/status/errors | 45–77 | Checkout, billing, welcome-item, offer-empty, status, validation, success and error messages | Propose `site_content.value.page.vip.messages`; offer records already use `vip_offers` |

## Atlanta campaign — `public/atlanta-eat-sip-stay.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Metadata/theme | 6–34 | Title/description, color/spacing/typography/theme tokens and hero decoration | Propose `site_content` key `campaign.atlanta`, `value.metadata` and `value.theme` |
| Hero/offer/dates | 37–49, 68 | Logo/nav, kicker/title/body/deadline, date options, experience promises, intro/final copy | `site_content.value` under key `campaign.atlanta` (`hero`, `dates[]`, `promises[]`, `intro`, `closing`) |
| Interest form | 49–66 | Labels/options/opt-in disclosure/CTA/fine print and defaults | `site_content.value` under `campaign.atlanta` (`form`, `traveler_options[]`, `weekend_options[]`, `package_options[]`, `extras[]`) |
| Form messages | 69–80 | Saving/error/success copy | `site_content.value.campaign.atlanta.messages` |

## Jamaica campaign — `public/jamaica-reopening-rush.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Metadata/theme | 6–18 | Title/description, palette, typography, spacing and styling | Propose `site_content` key `campaign.jamaica` (`metadata`, `theme`) |
| Hero/seasons/offer | 21–42 | Logo/link, hero kicker/title/body/deadline, headings, all season labels/descriptions and terms copy | `site_content.value.campaign.jamaica` (`hero`, `seasons[]`, `request_copy`, `deadline`) |
| Request form/footer | 43–57 | Labels, option values, opt-in text, CTA/fine print, footer/copyright | `site_content.value.campaign.jamaica.form` and `global_footer` |
| Form messages | 58–75 | Sending, failure and success labels/copy | `site_content.value.campaign.jamaica.messages` |

## Host acquisition — `public/host.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Page theme/hero | 1–10 | Title, logo path, theme colors/spacing, kicker, hero title/body and CTA label/anchor | Propose `site_content.value.page.host` (`metadata`, `theme`, `hero`) |
| Editorial sections | 13–47 | Quote, urgency copy/deadline, headings, explanatory paragraphs and feature-card copy | `site_content.value.page.host.sections[]` |
| Application form | 49–68 | Headings, guidance, login notice, labels/placeholders, button and status copy | `site_content.value.page.host.application` and `.messages` |
| Plans and next steps | 71–79 | Membership/host plan headings, monthly/annual prices, billing disclaimers, CTA | Editable plan records/configuration (prices must match Stripe/server authority); prose in `site_content.value.page.host.plans` |

## Login — `public/login.html`; Signup — `public/signup.html`
| Section | Line | Hardcoded value | Supabase table.column |
|---------|------|----------------|----------------------|
| Login page/theme | `login.html`: 6–68 | Title, palette, typography, spacing, visual decorative content and theme colors | Propose `site_content.value.page.login` (`metadata`, `theme`) |
| Login content/form | `login.html`: 71–146 | Logo/nav links, member benefits, headings, labels, placeholders, CTA labels, security note, footer/contact/copyright | `site_content.value.page.login` (`navigation`, `benefits[]`, `form`, `footer`) and shared brand/contact content |
| Login messages | `login.html`: 162–181 | Validation, pending, failure messages | `site_content.value.page.login.messages` |
| Signup page/theme | `signup.html`: 6–63 | Title, palette, spacing, typography, gradients, component colors and theme | Propose `site_content.value.page.signup` (`metadata`, `theme`) |
| Signup content/form | `signup.html`: 66–177 | Logo/nav, benefit copy, testimonial, form labels/options/placeholders/consents, CTAs, security note, footer/contact/copyright | `site_content.value.page.signup` (`navigation`, `benefits[]`, `testimonial`, `form`, `footer`) |
| Signup messages | `signup.html`: 188–240 | Validation, pending, success and error messages | `site_content.value.page.signup.messages` |

## Contact-supporting and account pages
| Page Name — file path | Section | Line | Hardcoded value | Supabase table.column |
|----------------------|---------|------|----------------|----------------------|
| Forgot Password — `public/forgot-password.html` | Page/form | 6–28 | Title, theme, headings, explanatory text, labels/placeholders, button/back link, footer/email/copyright | `site_content.value.page.forgot_password` and shared footer/contact config |
| Forgot Password — `public/forgot-password.html` | Runtime | 34–65 | Admin-mode headings, button states, validation/success/error text | `site_content.value.page.forgot_password.messages` |
| Reset Password — `public/reset-password.html` | Page/form | 6–54 | Title, theme, headings, descriptions, input labels/placeholders, buttons, back link, footer/email/copyright | `site_content.value.page.reset_password` and shared footer/contact config |
| Reset Password — `public/reset-password.html` | Runtime | 68–161 | Invalid/expired/reset link, validation, update states, errors and success text | `site_content.value.page.reset_password.messages` |
| Account Confirmed — `public/account-confirmed.html` | Page/status | 6–21 | Title, theme, logo, heading/body/status, CTA and helper copy | `site_content.value.page.account_confirmed` |
| Account Confirmed — `public/account-confirmed.html` | Runtime | 39–65 | Confirmation failures, sign-in state, dynamic CTA labels | `site_content.value.page.account_confirmed.messages` |
| My Trips — `public/my-trips.html` | Page chrome | 6–60 | Title, palette/spacing, nav labels, welcome/subhead, portal section headings/loading messages | `site_content.value.page.my_trips` (`metadata`, `theme`, `navigation`, `sections`, `messages`) |
| My Trips — `public/my-trips.html` | Runtime UI | 75–352 | Empty/error states, VIP copy/statuses, booking/payment/group labels, button and confirmation/error messages | `site_content.value.page.my_trips.labels` and `.messages`; record-specific names/prices/status values remain data-driven |
| Member Profile — `public/member-profile.html` | Page/form | 3–18 | Title/theme, navigation labels, profile/email headings, explanatory text, labels/placeholders/CTAs | `site_content.value.page.member_profile` |
| Member Profile — `public/member-profile.html` | Runtime | 27–69 | Load/save/email-change validation, status and error messages | `site_content.value.page.member_profile.messages` |
| Member Book — `public/member-book.html` | Page/cards | 3–14 | Title/theme, member navigation, hero/card headings/body/CTA, section copy and loading messages | `site_content.value.page.member_book`; resource/trip cards remain sourced from `resources`, `trips`, and `trip_packages` |
| Member Book — `public/member-book.html` | Runtime | 34–64 | Resource/trip empty/error labels, default category labels and CTA fallbacks | `site_content.value.page.member_book.messages` and `.labels` |
| Request Travel — `public/request-travel.html` | Page/form | 6–212 | Metadata/theme, member navigation, hero, account gate, all service labels/field labels/options/placeholders/disclosures/consent and CTA/footer | `site_content.value.page.request_travel` (`metadata`, `theme`, `navigation`, `hero`, `form`, `legal_copy`, `footer`) |
| Request Travel — `public/request-travel.html` | Runtime | 252–444 | Payment/account/error/status messages, urgency/service guidance, validation and submit states | `site_content.value.page.request_travel.messages`; business rules stay in code |
| Custom Trip — `public/custom-trip-form.html` | Page/form | 5–104 | Metadata/theme/navigation, hero/account gate, section headings, labels/options/placeholders/disclosures, CTAs/footer | `site_content.value.page.custom_trip` (`metadata`, `theme`, `navigation`, `hero`, `form`, `legal_copy`, `footer`) |
| Custom Trip — `public/custom-trip-form.html` | Runtime | 142–270 | Payment/account/error/validation/saving/status messages | `site_content.value.page.custom_trip.messages`; booking/payment logic stays in code |
| Request Received — `public/request-received.html` | Page/status | 6–33 | Metadata/theme/icon, default heading/body, CTA labels/URLs | `site_content.value.page.request_received` |
| Request Received — `public/request-received.html` | Mode messages | 34–52 | Secured/inquiry headings, body copy and CTA labels/URLs | `site_content.value.page.request_received.modes` |
| Host Center — `public/host-center.html` | Page/UI | 1–12 | Title/theme/navigation, hero copy, gate/proposal labels, form placeholders, plan descriptions/prices, button/status copy | `site_content.value.page.host_center`; prices should source authoritative configurable plan data, not duplicate display-only values |
| Host Profile — `public/host-profile.html` | Page/UI | 1 | Compact single-line page: title, theme, navigation, headings, form labels/placeholders and status copy | `site_content.value.page.host_profile` |
| VIP — `public/vip.html` | Page/UI | 3–16, 36–77 | See VIP audit above; plan pricing requires consistency with server/Stripe configuration | `site_content.value.page.vip` |

## Legal and campaign/legal pages
| Page Name — file path | Section | Line | Hardcoded value | Supabase table.column |
|----------------------|---------|------|----------------|----------------------|
| Privacy Policy — `public/privacy-policy.html` | Metadata/theme | 6–38 | Title/description/favicon, palette, spacing, typography and theme | Propose `site_content.value.legal.privacy_policy` (`metadata`, `theme`) |
| Privacy Policy — `public/privacy-policy.html` | Legal content | 42–110 | Navigation, title/subtitle, updated date, all section headings/body, contact links/email | `site_content.value.legal.privacy_policy.sections[]`, `.updated_at`; legal review required for content edits |
| Privacy Policy — `public/privacy-policy.html` | Footer | 112–143 | Logo, brand copy, social links, link labels/URLs, contact and copyright | Shared `site_content.value.global_footer`, with `site_settings` brand/contact fields |
| Terms of Service — `public/terms-of-service.html` | Metadata/theme | 6–41 | Title/description/favicon, palette, spacing, typography and theme | Propose `site_content.value.legal.terms_of_service` (`metadata`, `theme`) |
| Terms of Service — `public/terms-of-service.html` | Legal content | 45–137 | Navigation, title/subtitle, updated date, all legal section headings/body, contact links/email | `site_content.value.legal.terms_of_service.sections[]`, `.updated_at`; legal review required |
| Terms of Service — `public/terms-of-service.html` | Footer | 139–170 | Logo, brand copy, social links, footer links, contact and copyright | Shared `site_content.value.global_footer`, with `site_settings` brand/contact fields |
| 404 — `public/404.html` | Page/theme/content | 6–40, 44–79 | Title/description/canonical, page palette/spacing, nav, error heading/body, CTA labels/URLs, quick links | Propose `site_content.value.page.not_found` (`metadata`, `theme`, `navigation`, `copy`, `links`) |
| 404 — `public/404.html` | Footer | 81–110 | Logo, brand copy, social URLs/labels, footer links/contact/copyright | Shared `site_content.value.global_footer`, with `site_settings` brand/contact fields |
| Atlanta campaign — `public/atlanta-eat-sip-stay.html` | All editorial/form sections | 1–84 | See Atlanta campaign audit above; includes compact markup line 1 and campaign/date/form details | `site_content` key `campaign.atlanta` |
| Jamaica campaign — `public/jamaica-reopening-rush.html` | All editorial/form sections | 1–78 | See Jamaica campaign audit above; includes dates, options and campaign copy | `site_content` key `campaign.jamaica` |

## Shared fragments and public-content rendering
| Page Name — file path | Section | Line | Hardcoded value | Supabase table.column |
|----------------------|---------|------|----------------|----------------------|
| Shared Navigation — `public/nav.html` | Logo/navigation/auth | 1–23 | Logo path/alt, all navigation labels/URLs, login/signup copy/URLs | `site_settings.branding_content.logo_url`, `.site_name`, `.nav`; propose auth nav fields if not already present |
| Shared Footer — `public/footer.html` | Footer | 1–31 | Logo path/alt, brand statement, social links/labels, link headings/destinations, contact email, copyright | `site_settings.branding_content`, contact email; propose `site_content.value.global_footer` |
| Public content renderer — `js/content-public.js` | Trips | 20–82 | Date fallback, currency locale, loading/error/empty copy, default description, card CTA | Existing `trips`/`trip_packages`; propose `site_content.value.labels.trip_cards` and `.messages.trips` |
| Public content renderer — `js/content-public.js` | Resources | 85–155 | Loading/error/empty/search copy, category labels, default icon/link CTA | Existing `resources`; labels/states in `site_content.value.labels.resources` and `.messages.resources` |
| Public content renderer — `js/content-public.js` | Blog | 157–183 | Loading/error/empty copy, category fallback, type/date labels, read-more CTA | Existing `blog_posts`; labels/states in `site_content.value.labels.blog` and `.messages.blog` |
| Public content renderer — `js/content-public.js` | Trip detail | 195–316 | Incomplete/unavailable/fallback content and section/button labels | Existing trip/package/add-on fields; common labels/states in `site_content.value.labels.trip_detail` and `.messages.trip_detail` |
| Public content renderer — `js/content-public.js` | Blog detail | 318–335 | Incomplete/unavailable copy and category/date fallback | Existing `blog_posts`; common labels/states in `site_content.value.labels.blog_detail` and `.messages.blog_detail` |
| Site settings renderer — `js/site-settings.js` | Global host banner | 4–11 | Host campaign banner copy, target URL, colors, spacing, typography | `site_content.value.global_campaign_banner` (or existing `site_settings` if extended); no inline hardcoded presentation override |
| Site settings renderer — `js/site-settings.js` | Navigation fallbacks | 27–82 | Logo/site-name fallbacks, member navigation labels/URLs, login/signup/logout labels | Existing `site_settings.branding_content`; propose member navigation/auth fallback values under global navigation config |
| Site settings renderer — `js/site-settings.js` | Generic page headings/contact/home/about | 84–171 | Default contact heading, homepage/about fallbacks and content labels | Existing `site_settings` contact/home/about/page fields; migrate missing values into those fields or `site_content` |
| Site settings renderer — `js/site-settings.js` | Member issue-report widget | 190–299 | Widget theme colors/spacing, button/dialog/field labels, placeholders, validation/submission/success/error copy | Propose `site_content.value.global_issue_report` (`theme`, `labels`, `messages`) |

## Additional public pages in repository inventory

These routes are present in `public/` but were not fully line-inspected in this pass. They contain user-facing page copy and should be included in the next detailed line-by-line pass before claiming this inventory is exhaustive. Their static content should use `site_content.value.page.<slug>` (or the existing structured source where indicated):

| Page Name — file path | Proposed Supabase content source |
|----------------------|----------------------------------|
| Admin Login — `public/admin-login.html`; Admin — `public/admin.html` | Admin workflow labels/messages are functional interface copy; if editable is required, `site_content.value.page.admin_login` / `.admin` with admin-only writes. Do not expose private/admin content publicly. |
| Booking/checkout — `public/book-trip.html`, `public/group-deposit.html`, `public/quote-checkout.html`, `public/proposal.html`, `public/payment-result.html`, `public/custom-payment-result.html`, `public/request-payment-result.html`, `public/update-payment-method.html`, `public/pay/orlando-7q9k2m.html` | `site_content.value.page.<slug>` for public-facing labels/messages; prices, amounts, supplier terms and payment status must remain sourced from authoritative booking/quote/payment records. |
| Group and host pages — `public/join-group.html`, `public/host-center.html`, `public/host-profile.html`, `public/host.html` | `site_content.value.page.<slug>` for copy and form labels; group/host records remain in their corresponding data tables. |
| Forms/service pages — `public/forms-corporate-travel.html`, `public/forms-destination-weddings.html`, `public/forms-on-tour-travel-management.html`, `public/forms-travel-consulting.html` | `site_content.value.page.<slug>` for copy, theme, labels and options; use existing `resources` records where the page renders managed resource listings. |
| Portals — `public/supplier-portal.html` and other authenticated member/host pages | `site_content.value.page.<slug>` for user-visible labels/messages, protected by public-read content RLS only for content intended for public display; private user/supplier data must not be stored in public content. |

## Tables/columns proposed if not already present

1. `public.site_content(key text primary key, value jsonb not null, updated_at timestamptz not null default now(), updated_by uuid references auth.users(id))`, using the provided schema and public-read/admin-write RLS. Suggested keys: `global_navigation`, `global_footer`, `global_campaign_banner`, `global_issue_report`, `page.<slug>`, `campaign.<slug>`, `legal.<slug>`, and shared `labels.*`/`messages.*`.
2. No new table is proposed for trips, packages, add-ons, resources, blog posts, deals, wheel settings, galleries, or testimonials because suitable tables already exist in the repository.
3. Theme JSON should hold only editable presentation tokens (colors, spacing, typography, gradients, image URLs); structural layout and business behavior remain code. The supplied example query can fetch an individual JSON document by key, e.g. `site_content.key = 'page.home'`, then read the required property from `value`.
