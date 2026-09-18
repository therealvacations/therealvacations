import { supabase } from './supabase-client.js'

const { data: settings } = await supabase.from('site_settings')
  .select('contact_email,contact_phone,contact_heading,contact_intro,business_hours')
  .eq('id', 1).maybeSingle()

if (settings) {
  const email = settings.contact_email?.trim()
  const phone = settings.contact_phone?.trim()

  document.querySelectorAll('[data-site-email]').forEach((link) => {
    link.textContent = email || ''
    link.href = email ? `mailto:${email}` : '#'
    link.hidden = !email
  })
  document.querySelectorAll('[data-site-phone]').forEach((link) => {
    link.textContent = phone || ''
    link.href = phone ? `tel:${phone.replace(/[^+\d]/g, '')}` : '#'
  })
  document.querySelectorAll('[data-site-phone-section]').forEach((section) => { section.hidden = !phone })
  const heading = document.querySelector('[data-contact-heading]')
  const intro = document.querySelector('[data-contact-intro]')
  const hours = document.querySelector('[data-business-hours]')
  if (heading) heading.textContent = settings.contact_heading || 'Get In Touch'
  if (intro) intro.textContent = settings.contact_intro || ''
  if (hours && settings.business_hours) {
    hours.replaceChildren(...settings.business_hours.split('\n').filter(Boolean).map((line) => {
      const paragraph = document.createElement('p'); paragraph.textContent = line; return paragraph
    }))
  }
}
