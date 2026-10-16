import { supabase } from './supabase-client.js'

const { data: { session } } = await supabase.auth.getSession()
const hostCampaignExcluded = /^(\/admin|\/admin-login|\/login|\/signup|\/forgot-password|\/reset-password|\/book-trip|\/quote-checkout|\/payment-result|\/custom-payment-result|\/request-payment-result|\/supplier-portal|\/host-center|\/member-|\/my-trips)/.test(window.location.pathname)
if (!hostCampaignExcluded) {
  const banner = document.createElement('div')
  banner.id = 'trvHostUrgencyBanner'
  banner.innerHTML = '<strong>FORMER JOINMYTRIP TRIPLEADERS:</strong> JoinMyTrip is closing at the end of 2026. Do not let your 2027 trips lose momentum. <a href="/host">Move to TRV Host now →</a> <span>Verified former TripLeaders receive the $79 activation-fee waiver.</span>'
  banner.style.cssText = 'background:#f4c542;color:#1a0533;padding:11px 16px;text-align:center;font:800 13px/1.45 Segoe UI,Arial,sans-serif;position:relative;z-index:9997'
  banner.querySelector('a').style.cssText='color:#1a0533;text-decoration:underline;font-weight:900;margin:0 5px'
  document.body.prepend(banner)
}

const currentPath = window.location.pathname.replace(/\/$/, '') || '/'
const hostReferral = new URLSearchParams(window.location.search).get('host') || ''
if (/^[a-z0-9-]{3,120}$/.test(hostReferral)) sessionStorage.setItem('trv_host_referral', hostReferral)

const { data: settings } = await supabase.from('site_settings')
  .select('contact_email,contact_phone,contact_heading,contact_intro,business_hours,home_content,about_content,branding_content,page_content')
  .eq('id', 1).maybeSingle()

const setText = (selector, value) => {
  const element = document.querySelector(selector)
  if (element && value) element.textContent = value
}

if (settings) {
  const brand = settings.branding_content || {}
  const logoUrl = brand.logo_url || '/newtrv180x180no bckgrd logo favi.jpg'
  document.querySelectorAll('nav img, .nav-logo img, a.logo img').forEach((img) => { img.src = logoUrl; img.alt = brand.site_name || 'The Real Vacations' })
  document.querySelectorAll('nav .logo span').forEach((el) => { if (brand.site_name) el.textContent = brand.site_name })
  document.querySelectorAll('nav .logo small').forEach((el) => { if (brand.tagline) el.textContent = brand.tagline })
  if (session) {
    const memberItems = [
      { label: 'Member Home', url: '/my-trips' },
      { label: 'My Trips', url: '/my-trips#travel-groups' },
      { label: 'Request a Trip', url: '/request-travel' },
      { label: 'Search & Book', url: '/member-book' },
      { label: 'Host a Trip', url: '/host' },
      { label: 'Profile', url: '/member-profile' },
      { label: 'Payment Method', url: '/update-payment-method' },
    ]
    const { data: hostProfile } = await supabase.from('host_profiles').select('user_id').eq('user_id', session.user.id).maybeSingle()
    if (hostProfile) memberItems.splice(2, 0, { label: 'Host Center', url: '/host-center' })
    document.querySelectorAll('nav .nav-links').forEach((container) => {
      container.replaceChildren(...memberItems.map((item) => {
        const a = document.createElement('a')
        a.textContent = item.label
        a.href = item.url
        return a
      }))
    })
    document.querySelectorAll('nav .nav-auth').forEach((container) => {
      const logout = document.createElement('button')
      logout.type = 'button'
      logout.textContent = 'Logout'
      logout.style.cssText = 'border:0;background:#7c3aed;color:#fff;padding:8px 15px;border-radius:999px;font-weight:800;cursor:pointer'
      logout.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.assign('/')
      })
      container.replaceChildren(logout)
    })
    document.querySelectorAll('nav > a.nav-logo, nav > a:first-child').forEach((link) => {
      if (link.querySelector('img')) link.href = '/my-trips'
    })
  } else {
    if (Array.isArray(brand.nav)) {
      document.querySelectorAll('nav .nav-links').forEach((container) => {
        container.replaceChildren(...brand.nav.map((item) => {
          const a = document.createElement('a')
          a.textContent = item.label || ''
          a.href = item.url || '#'
          return a
        }))
      })
    }
    document.querySelectorAll('nav .nav-auth').forEach((container) => {
      const login = document.createElement('a'); login.href = brand.login_url || '/login'; login.textContent = brand.login_label || 'Login'
      const signup = document.createElement('a'); signup.href = brand.signup_url || '/signup'; signup.textContent = brand.signup_label || 'Sign Up'
      container.replaceChildren(login, signup)
    })
  }
  const pathname = currentPath
  const page = settings.page_content?.[pathname]
  if (page) {
    const heading = document.querySelector('[data-page-heading], .hero h1, header.hero h1, main h1')
    const subheading = document.querySelector('[data-page-subheading], .hero p, header.hero p, .hero .subtitle, .hero .sub')
    if (heading && page.heading) heading.textContent = page.heading
    if (subheading && page.subheading) subheading.textContent = page.subheading
  }

  const email = settings.contact_email?.trim()
  const phone = settings.contact_phone?.trim()
  document.querySelectorAll('[data-site-email]').forEach((link) => { link.textContent = email || ''; link.href = email ? `mailto:${email}` : '#'; link.hidden = !email })
  document.querySelectorAll('[data-site-phone]').forEach((link) => { link.textContent = phone || ''; link.href = phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : '#' })
  document.querySelectorAll('[data-site-phone-section]').forEach((section) => { section.hidden = !phone })
  setText('[data-contact-heading]', settings.contact_heading || 'Get In Touch')
  setText('[data-contact-intro]', settings.contact_intro)
  const hours = document.querySelector('[data-business-hours]')
  if (hours && settings.business_hours) hours.replaceChildren(...settings.business_hours.split('\n').filter(Boolean).map((line) => { const p = document.createElement('p'); p.textContent = line; return p }))

  const home = settings.home_content || {}
  const announcement = document.querySelector('#homeAnnouncement')
  if (announcement && home.announcement) {
    const span = announcement.querySelector('span'); const link = announcement.querySelector('a')
    if (span) span.textContent = home.announcement
    if (link && home.announcement_url) link.href = home.announcement_url
  }
  setText('#homeHeroTag', home.hero_tag); setText('#homeHeroTitle', home.hero_title); setText('#homeHeroText', home.hero_text)
  setText('#homePerksHeading', home.perks_heading); setText('#homePerksSubheading', home.perks_subheading)
  setText('#homeTripsHeading', home.trips_heading); setText('#homeTripsSubheading', home.trips_subheading)
  setText('#homeProcessHeading', home.process_heading); setText('#homeFaqHeading', home.faq_heading)
  setText('#homeBottomHeading', home.bottom_heading); setText('#homeBottomText', home.bottom_text)
  const trust = document.querySelector('#homeTrustItems')
  if (trust && Array.isArray(home.trust_items)) trust.replaceChildren(...home.trust_items.map((item) => { const span = document.createElement('span'); span.textContent = item; return span }))
  const mainCta = document.querySelector('#homeMainCta')
  if (mainCta) { if (home.cta_label) mainCta.textContent = home.cta_label; if (home.cta_url) mainCta.href = home.cta_url }
  const perks = document.querySelector('#homePerks')
  if (perks && Array.isArray(home.perks)) perks.replaceChildren(...home.perks.map((item) => {
    const card = document.createElement('div'); card.className = 'perk-card'
    const icon = document.createElement('div'); icon.className = 'perk-icon'; icon.textContent = item.icon
    const title = document.createElement('h3'); title.textContent = item.title
    const description = document.createElement('p'); description.textContent = item.description
    const link = document.createElement('a'); link.className = 'perk-btn'; link.textContent = item.label; link.href = item.url
    if (/^https?:\/\//.test(item.url)) { link.target = '_blank'; link.rel = 'noopener' }
    card.append(icon, title, description, link); return card
  }))
  const steps = document.querySelector('#homeSteps')
  if (steps && Array.isArray(home.steps)) steps.replaceChildren(...home.steps.map((item, index) => {
    const card = document.createElement('div'); card.className = 'step'
    const number = document.createElement('div'); number.className = 'step-num'; number.textContent = String(index + 1)
    const title = document.createElement('h3'); title.textContent = item.title
    const description = document.createElement('p'); description.textContent = item.description
    card.append(number, title, description); return card
  }))
  const faqs = document.querySelector('#homeFaqs')
  if (faqs && Array.isArray(home.faqs)) faqs.replaceChildren(...home.faqs.map((item) => {
    const card = document.createElement('div'); card.className = 'faq-item'
    const title = document.createElement('h3'); title.textContent = item.question
    const answer = document.createElement('p'); answer.textContent = item.answer
    card.append(title, answer); return card
  }))

  const about = settings.about_content || {}
  setText('#aboutHeroTitle', about.hero_title); setText('#aboutHeroSubtitle', about.hero_subtitle); setText('#aboutStoryHeading', about.story_heading)
  setText('#aboutValuesHeading', about.values_heading); setText('#aboutStatsHeading', about.stats_heading)
  setText('#aboutCtaHeading', about.cta_heading); setText('#aboutCtaText', about.cta_text)
  const story = document.querySelector('#aboutStory')
  if (story && Array.isArray(about.story)) story.replaceChildren(...about.story.map((text) => {
    const highlighted = text.startsWith('[highlight]'); const paragraph = document.createElement('p'); paragraph.textContent = text.replace(/^\[highlight\]\s*/, '')
    if (!highlighted) return paragraph
    const box = document.createElement('div'); box.className = 'highlight-text'; box.append(paragraph); return box
  }))
  const values = document.querySelector('#aboutValues')
  if (values && Array.isArray(about.values)) values.replaceChildren(...about.values.map((item) => {
    const card = document.createElement('div'); card.className = 'value-card'
    const icon = document.createElement('div'); icon.className = 'value-icon'; icon.textContent = item.icon
    const title = document.createElement('h3'); title.textContent = item.title
    const description = document.createElement('p'); description.textContent = item.description
    card.append(icon, title, description); return card
  }))
  const stats = document.querySelector('#aboutStats')
  if (stats && Array.isArray(about.stats)) stats.replaceChildren(...about.stats.map((item) => {
    const card = document.createElement('div'); card.className = 'stat-item'
    const number = document.createElement('div'); number.className = 'stat-number'; number.textContent = item.number
    const label = document.createElement('div'); label.className = 'stat-label'; label.textContent = item.label
    card.append(number, label); return card
  }))
  const aboutCta = document.querySelector('#aboutCtaButton')
  if (aboutCta) { if (about.cta_label) aboutCta.textContent = about.cta_label; if (about.cta_url) aboutCta.href = about.cta_url }
}


if (session) {
  let lastClientError = null;
  const rememberError = (message, source = 'browser') => {
    const safe = String(message || '').slice(0, 1000);
    if (!safe) return;
    lastClientError = { message: safe, source, at: new Date().toISOString() };
    try { sessionStorage.setItem('trv_last_client_error', JSON.stringify(lastClientError)); } catch {}
  };
  window.addEventListener('error', (event) => rememberError(event.message, 'window.error'));
  window.addEventListener('unhandledrejection', (event) => rememberError(event.reason?.message || event.reason || 'Unhandled promise rejection', 'unhandledrejection'));
  try {
    const stored = sessionStorage.getItem('trv_last_client_error');
    if (stored) lastClientError = JSON.parse(stored);
  } catch {}

  const style = document.createElement('style');
  style.textContent = `
    #trvReportProblemButton{position:fixed;right:18px;bottom:18px;z-index:9998;border:0;background:#1a0533;color:#fff;border-radius:999px;padding:11px 16px;font:700 13px/1.2 'DM Sans',sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.22);cursor:pointer}
    #trvIssueBackdrop{position:fixed;inset:0;z-index:9999;background:rgba(15,6,32,.72);display:none;align-items:center;justify-content:center;padding:18px}
    #trvIssueBackdrop.open{display:flex}
    #trvIssueDialog{width:min(620px,100%);background:#fff;color:#2f2540;border-radius:20px;padding:24px;box-shadow:0 28px 80px rgba(0,0,0,.4)}
    #trvIssueDialog h2{margin:0 0 6px;color:#1a0533;font-size:24px}
    #trvIssueDialog p{color:#6d6377;font-size:13px;line-height:1.5}
    #trvIssueDialog label{display:block;font-weight:800;font-size:12px;color:#1a0533;margin:14px 0 6px}
    #trvIssueDialog input,#trvIssueDialog textarea{width:100%;border:1px solid #d9cfe2;border-radius:10px;padding:11px 12px;font:inherit;color:#2f2540;background:#fff}
    #trvIssueDialog textarea{min-height:135px;resize:vertical}
    #trvIssueActions{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}
    #trvIssueActions button{border:0;border-radius:999px;padding:10px 16px;font-weight:800;cursor:pointer}
    #trvIssueCancel{background:#eee8f3;color:#4a3a57}
    #trvIssueSubmit{background:#7c3aed;color:#fff}
    #trvIssueStatus{min-height:20px;margin-top:10px;font-size:13px;font-weight:700}
    @media(max-width:600px){#trvReportProblemButton{right:12px;bottom:12px}#trvIssueDialog{padding:20px}}
  `;
  document.head.appendChild(style);

  const button = document.createElement('button');
  button.id = 'trvReportProblemButton';
  button.type = 'button';
  button.textContent = 'Report a Problem';

  const backdrop = document.createElement('div');
  backdrop.id = 'trvIssueBackdrop';
  backdrop.innerHTML = `
    <div id="trvIssueDialog" role="dialog" aria-modal="true" aria-labelledby="trvIssueTitleText">
      <h2 id="trvIssueTitleText">Report a Problem</h2>
      <p>Tell TRV what you were trying to do and what happened. The current page and technical context are attached automatically.</p>
      <label for="trvIssueTitle">Short title</label>
      <input id="trvIssueTitle" maxlength="180" placeholder="Example: Publish & Email did not send">
      <label for="trvIssueDescription">What happened?</label>
      <textarea id="trvIssueDescription" maxlength="5000" placeholder="What did you click, what did you expect, and what happened instead?"></textarea>
      <div id="trvIssueStatus" aria-live="polite"></div>
      <div id="trvIssueActions">
        <button id="trvIssueCancel" type="button">Cancel</button>
        <button id="trvIssueSubmit" type="button">Submit Report</button>
      </div>
    </div>
  `;
  document.body.append(button, backdrop);

  const closeIssue = () => backdrop.classList.remove('open');
  button.addEventListener('click', () => {
    document.getElementById('trvIssueStatus').textContent = '';
    backdrop.classList.add('open');
    setTimeout(() => document.getElementById('trvIssueTitle')?.focus(), 30);
  });
  document.getElementById('trvIssueCancel')?.addEventListener('click', closeIssue);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) closeIssue(); });

  document.getElementById('trvIssueSubmit')?.addEventListener('click', async () => {
    const title = document.getElementById('trvIssueTitle').value.trim();
    const description = document.getElementById('trvIssueDescription').value.trim();
    const status = document.getElementById('trvIssueStatus');
    const submit = document.getElementById('trvIssueSubmit');
    if (title.length < 3 || description.length < 5) {
      status.textContent = 'Add a short title and describe what happened.';
      return;
    }

    const url = new URL(location.href);
    const allowedKeys = new Set(['quote','request','booking','trip','package','group','tab','option']);
    const related = {};
    for (const [key,value] of url.searchParams.entries()) {
      if (allowedKeys.has(key) && value.length <= 200) related[key] = value;
    }
    const pathParts = location.pathname.split('/').filter(Boolean);
    if (pathParts[0] === 'hosts' && pathParts[1]) related.host_slug = pathParts[1];

    submit.disabled = true;
    submit.textContent = 'Submitting…';
    status.textContent = '';
    const { data: { session: freshSession } } = await supabase.auth.getSession();
    try {
      const response = await fetch('/api/report-problem', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'authorization': 'Bearer ' + (freshSession?.access_token || '')
        },
        body: JSON.stringify({
          title,
          description,
          page_url: location.href,
          page_path: location.pathname,
          page_title: document.title,
          browser_context: {
            user_agent: navigator.userAgent,
            language: navigator.language,
            viewport: { width: innerWidth, height: innerHeight },
            last_client_error: lastClientError
          },
          related_context: related
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Report could not be saved.');
      status.textContent = 'Report saved ✓ Issue ' + String(data.issue_id).slice(0,8) + ' is in the TRV Issues queue.';
      document.getElementById('trvIssueTitle').value = '';
      document.getElementById('trvIssueDescription').value = '';
      setTimeout(closeIssue, 1700);
    } catch (error) {
      status.textContent = error.message || 'Report could not be saved.';
    } finally {
      submit.disabled = false;
      submit.textContent = 'Submit Report';
    }
  });
}
