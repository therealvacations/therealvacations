import { supabase } from './supabase-client.js'

const { data: settings } = await supabase.from('site_settings')
  .select('contact_email,contact_phone,contact_heading,contact_intro,business_hours,home_content,about_content')
  .eq('id', 1).maybeSingle()

const setText = (selector, value) => {
  const element = document.querySelector(selector)
  if (element && value) element.textContent = value
}

if (settings) {
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
  const logo = document.querySelector('#homeLogo'); if (logo && home.logo_url) logo.src = home.logo_url
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
