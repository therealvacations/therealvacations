import { supabase } from './supabase-client.js'

const state = { user: null, permissions: null, trips: [], resources: [], posts: [], packages: [], settings: null }
const HOME_DEFAULTS = {
  logo_url: '/newtrv180x180no bckgrd logo favi.jpg', announcement: '✨ New group experiences are added throughout the year.', announcement_url: '/trips',
  hero_tag: '✨ GROUP TRAVEL REIMAGINED', hero_title: 'You Bring Your People.\nWe Handle Everything Else.', hero_text: 'All-inclusive group trips to concerts, wine country, and cultural celebrations. No planning stress. No logistics headaches. Just unforgettable experiences.',
  trust_items: ['20+ Years of Group Travel', 'Flexible Payment Plans', '24/7 Trip Support'], cta_label: 'Explore Our Trips →', cta_url: '/trips',
  perks_heading: 'Real Vacationers Get It First', perks_subheading: "We don't just plan your trip — we make sure you get the best deals on everything around it.",
  perks: [
    { icon: '✈️', title: 'Flight Deals', description: 'Book your flight for less — compare hundreds of airlines and find the best fares to any destination.', label: 'Find My Flight →', url: '/flights' },
    { icon: '🏨', title: 'Hotels & Stays', description: 'Extend your trip? Compare prices and book the perfect spot near every experience.', label: 'Browse Hotels →', url: 'https://www.hotels.com' },
    { icon: '🎒', title: 'Travel Essentials', description: 'Luggage, travel pillows, packing cubes — gear we actually use, handpicked to make your journey smoother.', label: 'Shop Gear →', url: '/resources' },
    { icon: '🎟️', title: 'Add-On Experiences', description: 'Museums, food tours, wine tastings — extend your adventure with curated local experiences.', label: 'Explore More →', url: 'https://www.klook.com' },
  ],
  trips_heading: 'Choose Your Next Unforgettable Adventure', trips_subheading: 'Curated trips for families, friend groups, and anyone ready to travel together',
  process_heading: 'Group Travel Without the Group Headache',
  steps: [
    { title: 'Pick Your Trip', description: 'Browse our curated experiences. Each one designed for groups who want quality, connection, and zero stress.' },
    { title: 'Spin & Save', description: 'Spin the wheel before you book for a chance to request a promotional discount. Our team confirms eligibility before it is applied.' },
    { title: 'Lock In Your Spot', description: 'Secure your spot with a deposit and make flexible payments on your own schedule before the balance due date.' },
    { title: 'Show Up & Enjoy', description: 'We handle everything. You just bring your people and make memories.' },
  ],
  faq_heading: "Questions? We've Got Answers",
  faqs: [
    { question: 'How do deposits and payment plans work?', answer: "Secure your spot with a deposit, then make flexible payments on your own schedule. When you get to the booking page, it will show you exactly what's required based on when you book and the balance due date for your trip. No credit checks, no interest." },
    { question: 'How does the spin wheel discount work?', answer: 'Click “Spin for My Discount” anywhere on the site. After spinning, enter your name and email to submit the result. Our team confirms eligibility and redemption details before any discount is applied.' },
    { question: 'Can I travel solo or do I need a group?', answer: 'You can absolutely travel solo. Our group experiences are a great way to meet new people while enjoying the comfort of a fully planned trip.' },
    { question: "What's included in the trip price?", answer: 'Each trip page clearly lists its inclusions. Packages may include accommodations, transportation, activities, event tickets, and on-trip support.' },
    { question: 'Can you plan a private trip for my group?', answer: 'Yes. We create custom trips for families, friends, companies, celebrations, and other groups.' },
  ],
  bottom_heading: 'Ready to Make Memories?', bottom_text: "Your next unforgettable group experience is waiting.",
}

const ABOUT_DEFAULTS = {
  hero_title: 'Why We Do What We Do', hero_subtitle: 'Creating unforgettable group travel experiences for over 20 years', story_heading: 'Our Story',
  story: [
    'At The Real Vacations, we believe that the best memories are made when we step away from the chaos of life and come together to experience something extraordinary. Whether it is a solo adventure, a couple’s getaway, or a gathering of friends and family, travel is about more than a destination—it is about meaningful connections, shared laughter, and memories that last a lifetime.',
    'But we also know how stressful it can be to plan the perfect trip. Life is hectic, and coordinating flights, hotels, transportation, meals, and activities for a group can become more of a chore than a vacation.',
    '[highlight]For us, the desire to make travel easier was born from a family tradition that has been with us for over 20 years. Every December 26th, regardless of the circumstances, we gather as a family to create new memories, explore new places, and escape the stresses of daily life. We call it “Cates 26.”',
    'It reminds us that, no matter how busy life gets, we must make time for what matters most. As our family grew, coordinating the perfect trip became a never-ending puzzle, and the joy of being together was overshadowed by the stress of making everything come together.',
    'And that is when The Real Vacations was born.',
    'We created a better, stress-free way to plan group trips without endless searches, price comparisons, or anxiety about whether everything will go smoothly.',
    'We specialize in curated, all-inclusive group trips that make travel simple, affordable, and stress-free. From family reunions and company retreats to friend getaways and destination music events, we handle the details so you can enjoy the moment.',
    'We also create customized group trips tailored to your needs, interests, culture, celebration, and budget.',
    '[highlight]You will not have to spend hours, days, or weeks planning. We take care of the details so you can focus on what really matters—the experience.',
    'The Real Vacations is about more than a trip. It is about comfort, relief, and confidence. We give you the freedom to create the memories you have been waiting for—without the stress, frustration, or confusion.',
    'Welcome to The Real Vacations, where your dream trip becomes a reality—effortlessly.',
  ],
  values_heading: 'What We Stand For', values: [
    { icon: '🤝', title: 'Connection First', description: 'Every trip we design prioritizes connection and community.' },
    { icon: '💎', title: 'Quality Matters', description: 'From hotels to curated experiences, we do not cut corners.' },
    { icon: '🎯', title: 'Intentional Experiences', description: 'Every detail is chosen with purpose and respect for your time.' },
    { icon: '💪', title: 'Accessibility & Flexibility', description: 'Flexible payment plans make unforgettable experiences more accessible.' },
    { icon: '🌍', title: 'Cultural Celebration', description: 'We honor traditions, explore new perspectives, and bring people together.' },
    { icon: '❤️', title: 'Peace of Mind', description: 'We handle the details and support you from booking through departure.' },
  ],
  stats_heading: 'By the Numbers', stats: [{ number: '20+', label: 'Years of Experience' }, { number: '1,500+', label: 'Happy Travelers' }, { number: '50+', label: 'Trips Organized' }, { number: '100%', label: 'Commitment to Excellence' }],
  cta_heading: 'Ready to Travel with Us?', cta_text: "Let's create your next unforgettable experience together.", cta_label: "See Where We're Going →", cta_url: '/trips',
}
const $ = (selector) => document.querySelector(selector)
const $$ = (selector) => [...document.querySelectorAll(selector)]
const textNode = (tag, className, text) => {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text !== undefined && text !== null) element.textContent = text
  return element
}

const showMessage = (message, type = 'success') => {
  const toast = $('#adminMessage')
  toast.textContent = message
  toast.className = `admin-message ${type}`
  clearTimeout(showMessage.timer)
  showMessage.timer = setTimeout(() => { toast.className = 'admin-message' }, 5000)
}

const slugify = (value) => String(value || '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const cents = (value) => Math.round((Number(value) || 0) * 100)
const dollars = (value) => ((Number(value) || 0) / 100).toFixed(2)

function setTab(name) {
  $$('.admin-tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === name))
  $$('.admin-panel').forEach((panel) => panel.hidden = panel.id !== `${name}Panel`)
}

function resetTripForm() {
  $('#tripForm').reset()
  $('#tripId').value = ''
  $('#tripStatus').value = 'draft'
  $('#tripSortOrder').value = '0'
  $('#tripFormTitle').textContent = 'Add Group Trip'
}

function parsePackages(value) {
  return String(value || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [code, name, total, deposit, description = ''] = line.split('|').map((part) => part.trim())
    if (!code || !name || cents(total) <= 0 || cents(deposit) <= 0 || cents(deposit) > cents(total)) {
      throw new Error(`Package line ${index + 1} must be: code | name | total dollars | deposit dollars | description`)
    }
    return { code: slugify(code), name, total_amount: cents(total), deposit_amount: cents(deposit), description: description || null, currency: 'usd', is_active: true, sort_order: index + 1 }
  })
}

function packagesForTrip(tripId) {
  return state.packages.filter((item) => item.trip_id === tripId && item.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((item) => `${item.code} | ${item.name} | ${dollars(item.total_amount)} | ${dollars(item.deposit_amount)} | ${item.description || ''}`)
    .join('\n')
}

function renderTrips() {
  const list = $('#tripList')
  list.replaceChildren(...state.trips.map((trip) => {
    const card = textNode('article', 'admin-record')
    const heading = textNode('div', 'record-heading')
    const info = textNode('div')
    info.append(textNode('h3', '', trip.title), textNode('p', '', `${trip.dates_start} – ${trip.dates_end} · ${trip.location}`))
    const badge = textNode('span', `status-badge ${trip.status}`, trip.status)
    heading.append(info, badge)
    const actions = textNode('div', 'record-actions')
    const edit = textNode('button', 'secondary-button', 'Edit')
    edit.type = 'button'; edit.addEventListener('click', () => editTrip(trip.trip_id))
    const remove = textNode('button', 'danger-button', 'Remove from site')
    remove.type = 'button'; remove.disabled = trip.status === 'archived'
    remove.addEventListener('click', () => archiveTrip(trip.trip_id, trip.title))
    actions.append(edit, remove); card.append(heading, textNode('p', 'record-summary', trip.description_short || 'No summary yet.'), actions)
    return card
  }))
  if (!state.trips.length) list.append(textNode('p', 'empty-state', 'No trips yet.'))
}

function editTrip(id) {
  const trip = state.trips.find((item) => item.trip_id === id)
  if (!trip) return
  setTab('trips'); $('#tripFormTitle').textContent = 'Edit Group Trip'
  $('#tripId').value = trip.trip_id
  $('#tripTitle').value = trip.title || ''
  $('#tripSlug').value = trip.slug || ''
  $('#tripKicker').value = trip.hero_kicker || ''
  $('#tripStart').value = trip.dates_start || ''
  $('#tripEnd').value = trip.dates_end || ''
  $('#tripLocation').value = trip.location || ''
  $('#tripDeadline').value = trip.booking_deadline || ''
  $('#tripShort').value = trip.description_short || ''
  $('#tripFull').value = trip.description_full || ''
  $('#tripImage').value = trip.cover_image_url || ''
  $('#tripSpots').value = trip.max_spots || ''
  $('#tripStatus').value = trip.status || 'draft'
  $('#tripFeatured').checked = Boolean(trip.is_featured)
  $('#tripSortOrder').value = trip.sort_order || 0
  $('#tripItinerary').value = Array.isArray(trip.itinerary)
    ? trip.itinerary.map((item) => typeof item === 'string' ? item : `${item.title || item.day || ''}: ${item.description || item.details || ''}`.trim()).join('\n')
    : ''
  $('#tripPackages').value = packagesForTrip(trip.trip_id)
  $('#tripForm').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function archiveTrip(id, title) {
  if (!confirm(`Remove “${title}” from the public site? Existing booking and payment history will be preserved.`)) return
  const { error } = await supabase.from('trips').update({ status: 'archived' }).eq('trip_id', id)
  if (error) return showMessage(error.message, 'error')
  showMessage('Trip removed from the public site.'); await loadAll()
}

async function saveTrip(event) {
  event.preventDefault()
  const button = $('#saveTripButton'); button.disabled = true
  try {
    const packageRows = parsePackages($('#tripPackages').value)
    if (!packageRows.length) throw new Error('Add at least one package.')
    const itinerary = $('#tripItinerary').value.split('\n').map((line) => line.trim()).filter(Boolean)
    const payload = {
      title: $('#tripTitle').value.trim(),
      slug: slugify($('#tripSlug').value || $('#tripTitle').value),
      hero_kicker: $('#tripKicker').value.trim() || null,
      dates_start: $('#tripStart').value,
      dates_end: $('#tripEnd').value,
      location: $('#tripLocation').value.trim(),
      booking_deadline: $('#tripDeadline').value || null,
      description_short: $('#tripShort').value.trim() || null,
      description_full: $('#tripFull').value.trim() || null,
      cover_image_url: $('#tripImage').value.trim() || null,
      itinerary: itinerary.length ? itinerary : null,
      max_spots: Number($('#tripSpots').value) || null,
      status: $('#tripStatus').value,
      is_featured: $('#tripFeatured').checked,
      sort_order: Number($('#tripSortOrder').value) || 0,
      total_cost: Math.min(...packageRows.map((item) => item.total_amount)),
      deposit_amount: Math.min(...packageRows.map((item) => item.deposit_amount)),
    }
    if (!payload.title || !payload.slug || !payload.dates_start || !payload.dates_end || !payload.location) throw new Error('Title, dates, and location are required.')
    if (payload.dates_end < payload.dates_start) throw new Error('End date cannot be before start date.')

    const id = $('#tripId').value
    let trip
    if (id) {
      const result = await supabase.from('trips').update(payload).eq('trip_id', id).select('trip_id').single()
      if (result.error) throw result.error
      trip = result.data
    } else {
      const result = await supabase.from('trips').insert(payload).select('trip_id').single()
      if (result.error) throw result.error
      trip = result.data
    }

    const existing = state.packages.filter((item) => item.trip_id === trip.trip_id)
    const incomingCodes = new Set(packageRows.map((item) => item.code))
    const removedPackageIds = existing.filter((item) => !incomingCodes.has(item.code)).map((item) => item.package_id)
    if (removedPackageIds.length) {
      const { error } = await supabase.from('trip_packages').update({ is_active: false }).in('package_id', removedPackageIds)
      if (error) throw error
    }
    const { error: packageError } = await supabase.from('trip_packages').upsert(packageRows.map((item) => ({ ...item, trip_id: trip.trip_id })), { onConflict: 'trip_id,code' })
    if (packageError) throw packageError
    showMessage(id ? 'Trip updated.' : 'Trip added.'); resetTripForm(); await loadAll()
  } catch (error) { showMessage(error.message || 'Trip could not be saved.', 'error') }
  finally { button.disabled = false }
}

function resetResourceForm() {
  $('#resourceForm').reset(); $('#resourceId').value = ''; $('#resourceActive').checked = true; $('#resourceFeatured').checked = false; $('#resourceSort').value = '0'; $('#resourceFormTitle').textContent = 'Add Resource'
}

function renderResources() {
  const list = $('#resourceList')
  list.replaceChildren(...state.resources.map((item) => {
    const card = textNode('article', 'admin-record compact')
    card.append(textNode('h3', '', `${item.icon || '🧭'} ${item.title}`), textNode('p', '', `${item.category || 'other'} · ${item.is_active ? 'Published' : 'Hidden'}${item.is_featured ? ' · Featured' : ''}`))
    const actions = textNode('div', 'record-actions')
    const edit = textNode('button', 'secondary-button', 'Edit'); edit.type = 'button'; edit.onclick = () => editResource(item.resource_id)
    const remove = textNode('button', 'danger-button', 'Delete'); remove.type = 'button'; remove.onclick = () => deleteRecord('resources', 'resource_id', item.resource_id, item.title)
    actions.append(edit, remove); card.append(actions); return card
  }))
}

function editResource(id) {
  const item = state.resources.find((record) => record.resource_id === id); if (!item) return
  $('#resourceFormTitle').textContent = 'Edit Resource'; $('#resourceId').value = id; $('#resourceTitle').value = item.title || ''; $('#resourceDescription').value = item.description || ''; $('#resourceCategory').value = item.category || 'guide'; $('#resourceIcon').value = item.icon || ''; $('#resourceUrl').value = item.link_url || ''; $('#resourceLabel').value = item.link_label || ''; $('#resourceSort').value = item.sort_order || 0; $('#resourceFeatured').checked = Boolean(item.is_featured); $('#resourceActive').checked = Boolean(item.is_active)
  $('#resourceForm').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function saveResource(event) {
  event.preventDefault(); const id = $('#resourceId').value
  const payload = { title: $('#resourceTitle').value.trim(), description: $('#resourceDescription').value.trim() || null, category: slugify($('#resourceCategory').value) || 'guide', icon: $('#resourceIcon').value.trim() || '🧭', link_url: $('#resourceUrl').value.trim() || null, link_label: $('#resourceLabel').value.trim() || 'Learn More →', sort_order: Number($('#resourceSort').value) || 0, is_featured: $('#resourceFeatured').checked, is_active: $('#resourceActive').checked, updated_by: state.user.id }
  if (!payload.title) return showMessage('Resource title is required.', 'error')
  const query = id ? supabase.from('resources').update(payload).eq('resource_id', id) : supabase.from('resources').insert({ ...payload, created_by: state.user.id })
  const { error } = await query
  if (error) return showMessage(error.message, 'error')
  showMessage(id ? 'Resource updated.' : 'Resource added.'); resetResourceForm(); await loadAll()
}

function resetBlogForm() {
  $('#blogForm').reset(); $('#blogId').value = ''; $('#blogPublished').checked = false; $('#blogFormTitle').textContent = 'Add Blog Post'
}

function renderPosts() {
  const list = $('#blogList')
  list.replaceChildren(...state.posts.map((post) => {
    const card = textNode('article', 'admin-record compact')
    card.append(textNode('h3', '', post.title), textNode('p', '', `${post.category || 'Travel'} · ${post.is_published ? 'Published' : 'Draft'}`))
    const actions = textNode('div', 'record-actions')
    const edit = textNode('button', 'secondary-button', 'Edit'); edit.type = 'button'; edit.onclick = () => editPost(post.id)
    const remove = textNode('button', 'danger-button', 'Delete'); remove.type = 'button'; remove.onclick = () => deleteRecord('blog_posts', 'id', post.id, post.title)
    actions.append(edit, remove); card.append(actions); return card
  }))
}

function editPost(id) {
  const post = state.posts.find((item) => String(item.id) === String(id)); if (!post) return
  $('#blogFormTitle').textContent = 'Edit Blog Post'; $('#blogId').value = post.id; $('#blogTitle').value = post.title || ''; $('#blogSlug').value = post.slug || ''; $('#blogCategory').value = post.category || ''; $('#blogExcerpt').value = post.excerpt || ''; $('#blogContent').value = post.content || ''; $('#blogImage').value = post.featured_image_url || ''; $('#blogLink').value = post.link_url || ''; $('#blogPublished').checked = Boolean(post.is_published)
  $('#blogForm').scrollIntoView({ behavior: 'smooth', block: 'start' })
}

async function savePost(event) {
  event.preventDefault(); const id = $('#blogId').value; const published = $('#blogPublished').checked
  const payload = { title: $('#blogTitle').value.trim(), slug: slugify($('#blogSlug').value || $('#blogTitle').value), category: $('#blogCategory').value.trim() || 'Travel', excerpt: $('#blogExcerpt').value.trim() || null, content: $('#blogContent').value.trim(), featured_image_url: $('#blogImage').value.trim() || null, link_url: $('#blogLink').value.trim() || null, is_published: published, published_at: published ? new Date().toISOString() : null, updated_by: state.user.id }
  if (!payload.title || !payload.slug || !payload.content) return showMessage('Blog title and content are required.', 'error')
  const query = id ? supabase.from('blog_posts').update(payload).eq('id', id) : supabase.from('blog_posts').insert({ ...payload, created_by: state.user.id })
  const { error } = await query
  if (error) return showMessage(error.message, 'error')
  showMessage(id ? 'Blog post updated.' : 'Blog post added.'); resetBlogForm(); await loadAll()
}

async function deleteRecord(table, key, id, title) {
  if (!confirm(`Permanently delete “${title}”?`)) return
  const { error } = await supabase.from(table).delete().eq(key, id)
  if (error) return showMessage(error.message, 'error')
  showMessage('Record deleted.'); await loadAll()
}

async function uploadImage(input, targetSelector, folder) {
  const file = input.files?.[0]; if (!file) return
  if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) return showMessage('Choose a JPG, PNG, WebP, or GIF under 10 MB.', 'error')
  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${folder}/${Date.now()}-${crypto.randomUUID()}.${extension}`
  showMessage('Uploading image…')
  const { error } = await supabase.storage.from('content-media').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
  if (error) return showMessage(error.message, 'error')
  const { data } = supabase.storage.from('content-media').getPublicUrl(path)
  $(targetSelector).value = data.publicUrl
  showMessage('Image uploaded. Save the record to use it.')
}

const lines = (items, keys) => items.map((item) => keys.map((key) => item[key] || '').join(' | ')).join('\n')
const parseLines = (value, keys) => String(value || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line, index) => {
  const parts = line.split('|').map((part) => part.trim())
  if (parts.length < keys.length || keys.some((key, position) => !parts[position])) throw new Error(`Line ${index + 1} must be: ${keys.join(' | ')}`)
  return Object.fromEntries(keys.map((key, position) => [key, parts[position]]))
})

function renderHomeSettings() {
  const home = { ...HOME_DEFAULTS, ...(state.settings?.home_content || {}) }
  $('#homeLogoUrl').value = home.logo_url
  $('#homeAnnouncement').value = home.announcement
  $('#homeAnnouncementUrl').value = home.announcement_url
  $('#homeHeroTag').value = home.hero_tag
  $('#homeHeroTitle').value = home.hero_title
  $('#homeHeroText').value = home.hero_text
  $('#homeTrustItems').value = home.trust_items.join('\n')
  $('#homeCtaLabel').value = home.cta_label
  $('#homeCtaUrl').value = home.cta_url
  $('#homePerksHeading').value = home.perks_heading
  $('#homePerksSubheading').value = home.perks_subheading
  $('#homePerks').value = lines(home.perks, ['icon', 'title', 'description', 'label', 'url'])
  $('#homeTripsHeading').value = home.trips_heading
  $('#homeTripsSubheading').value = home.trips_subheading
  $('#homeProcessHeading').value = home.process_heading
  $('#homeSteps').value = lines(home.steps, ['title', 'description'])
  $('#homeFaqHeading').value = home.faq_heading
  $('#homeFaqs').value = lines(home.faqs, ['question', 'answer'])
  $('#homeBottomHeading').value = home.bottom_heading
  $('#homeBottomText').value = home.bottom_text
}

async function saveHomeSettings(event) {
  event.preventDefault()
  try {
    const home_content = {
      logo_url: $('#homeLogoUrl').value.trim(), announcement: $('#homeAnnouncement').value.trim(), announcement_url: $('#homeAnnouncementUrl').value.trim(),
      hero_tag: $('#homeHeroTag').value.trim(), hero_title: $('#homeHeroTitle').value.trim(), hero_text: $('#homeHeroText').value.trim(),
      trust_items: $('#homeTrustItems').value.split('\n').map((item) => item.trim()).filter(Boolean), cta_label: $('#homeCtaLabel').value.trim(), cta_url: $('#homeCtaUrl').value.trim(),
      perks_heading: $('#homePerksHeading').value.trim(), perks_subheading: $('#homePerksSubheading').value.trim(), perks: parseLines($('#homePerks').value, ['icon', 'title', 'description', 'label', 'url']),
      trips_heading: $('#homeTripsHeading').value.trim(), trips_subheading: $('#homeTripsSubheading').value.trim(), process_heading: $('#homeProcessHeading').value.trim(),
      steps: parseLines($('#homeSteps').value, ['title', 'description']), faq_heading: $('#homeFaqHeading').value.trim(), faqs: parseLines($('#homeFaqs').value, ['question', 'answer']),
      bottom_heading: $('#homeBottomHeading').value.trim(), bottom_text: $('#homeBottomText').value.trim(),
    }
    const { error } = await supabase.from('site_settings').upsert({ id: 1, home_content, updated_by: state.user.id, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) throw error
    state.settings = { ...state.settings, home_content }; renderHomeSettings(); showMessage('Home page updated.')
  } catch (error) { showMessage(error.message || 'Home page could not be saved.', 'error') }
}

function renderAboutSettings() {
  const about = { ...ABOUT_DEFAULTS, ...(state.settings?.about_content || {}) }
  $('#aboutHeroTitle').value = about.hero_title
  $('#aboutHeroSubtitle').value = about.hero_subtitle
  $('#aboutStoryHeading').value = about.story_heading
  $('#aboutStory').value = about.story.join('\n\n')
  $('#aboutValuesHeading').value = about.values_heading
  $('#aboutValues').value = lines(about.values, ['icon', 'title', 'description'])
  $('#aboutStatsHeading').value = about.stats_heading
  $('#aboutStats').value = lines(about.stats, ['number', 'label'])
  $('#aboutCtaHeading').value = about.cta_heading
  $('#aboutCtaText').value = about.cta_text
  $('#aboutCtaLabel').value = about.cta_label
  $('#aboutCtaUrl').value = about.cta_url
}

async function saveAboutSettings(event) {
  event.preventDefault()
  try {
    const about_content = {
      hero_title: $('#aboutHeroTitle').value.trim(), hero_subtitle: $('#aboutHeroSubtitle').value.trim(), story_heading: $('#aboutStoryHeading').value.trim(),
      story: $('#aboutStory').value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean), values_heading: $('#aboutValuesHeading').value.trim(),
      values: parseLines($('#aboutValues').value, ['icon', 'title', 'description']), stats_heading: $('#aboutStatsHeading').value.trim(), stats: parseLines($('#aboutStats').value, ['number', 'label']),
      cta_heading: $('#aboutCtaHeading').value.trim(), cta_text: $('#aboutCtaText').value.trim(), cta_label: $('#aboutCtaLabel').value.trim(), cta_url: $('#aboutCtaUrl').value.trim(),
    }
    const { error } = await supabase.from('site_settings').upsert({ id: 1, about_content, updated_by: state.user.id, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (error) throw error
    state.settings = { ...state.settings, about_content }; renderAboutSettings(); showMessage('About page updated.')
  } catch (error) { showMessage(error.message || 'About page could not be saved.', 'error') }
}

function renderContactSettings() {
  const settings = state.settings || {}
  $('#contactEmail').value = settings.contact_email || 'kc@therealvacations.com'
  $('#contactPhone').value = settings.contact_phone || ''
  $('#contactHeading').value = settings.contact_heading || 'Get In Touch'
  $('#contactIntro').value = settings.contact_intro || ''
  $('#contactHours').value = settings.business_hours || ''
  $('#contactPreview').replaceChildren(
    textNode('h3', '', settings.contact_heading || 'Get In Touch'),
    textNode('p', '', settings.contact_email || 'kc@therealvacations.com'),
    textNode('p', '', settings.contact_phone || 'Phone hidden')
  )
}

async function saveContactSettings(event) {
  event.preventDefault()
  const payload = {
    id: 1,
    contact_email: $('#contactEmail').value.trim(),
    contact_phone: $('#contactPhone').value.trim() || null,
    contact_heading: $('#contactHeading').value.trim(),
    contact_intro: $('#contactIntro').value.trim(),
    business_hours: $('#contactHours').value.trim() || null,
    updated_by: state.user.id,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('site_settings').upsert(payload, { onConflict: 'id' })
  if (error) return showMessage(error.message, 'error')
  state.settings = payload; renderContactSettings(); showMessage('Contact page updated.')
}

async function loadAll() {
  const [tripsResult, packagesResult, resourcesResult, postsResult, settingsResult] = await Promise.all([
    supabase.from('trips').select('*').order('dates_start', { ascending: false }),
    supabase.from('trip_packages').select('*').order('sort_order'),
    supabase.from('resources').select('*').order('category').order('sort_order'),
    supabase.from('blog_posts').select('*').order('created_at', { ascending: false }),
    supabase.from('site_settings').select('*').eq('id', 1).maybeSingle(),
  ])
  const failed = [tripsResult, packagesResult, resourcesResult, postsResult, settingsResult].find((result) => result.error)
  if (failed) return showMessage(failed.error.message, 'error')
  state.trips = tripsResult.data || []; state.packages = packagesResult.data || []; state.resources = resourcesResult.data || []; state.posts = postsResult.data || []; state.settings = settingsResult.data
  renderTrips(); renderResources(); renderPosts(); renderHomeSettings(); renderAboutSettings(); renderContactSettings()
}

async function initialize() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return location.replace('/admin-login')
  const { data: permissions, error } = await supabase.from('admin_users').select('role,can_edit_trips,can_edit_blog,can_edit_resources').eq('id', session.user.id).maybeSingle()
  if (error || !permissions) { await supabase.auth.signOut(); return location.replace('/admin-login?denied=1') }
  state.user = session.user; state.permissions = permissions
  $('#adminIdentity').textContent = session.user.email || 'Authorized administrator'
  if (!permissions.can_edit_trips) $('[data-tab="trips"]').hidden = true
  if (!permissions.can_edit_resources) $('[data-tab="resources"]').hidden = true
  if (!permissions.can_edit_blog) $('[data-tab="blog"]').hidden = true
  const firstTab = $$('.admin-tab').find((button) => !button.hidden)
  if (!firstTab) return showMessage('This admin account has no content permissions.', 'error')
  setTab(firstTab.dataset.tab); await loadAll(); $('#adminLoading').hidden = true; $('#adminApp').hidden = false
}

$$('.admin-tab').forEach((button) => button.addEventListener('click', () => setTab(button.dataset.tab)))
$('#tripForm').addEventListener('submit', saveTrip); $('#tripReset').addEventListener('click', resetTripForm)
$('#resourceForm').addEventListener('submit', saveResource); $('#resourceReset').addEventListener('click', resetResourceForm)
$('#blogForm').addEventListener('submit', savePost); $('#blogReset').addEventListener('click', resetBlogForm)
$('#homeForm').addEventListener('submit', saveHomeSettings)
$('#aboutForm').addEventListener('submit', saveAboutSettings)
$('#contactForm').addEventListener('submit', saveContactSettings)
$('#tripUpload').addEventListener('change', (event) => uploadImage(event.target, '#tripImage', 'trips'))
$('#blogUpload').addEventListener('change', (event) => uploadImage(event.target, '#blogImage', 'blog'))
$('#logoutButton').addEventListener('click', async () => { await supabase.auth.signOut(); location.replace('/admin-login') })
$('#tripTitle').addEventListener('blur', () => { if (!$('#tripSlug').value) $('#tripSlug').value = slugify($('#tripTitle').value) })
$('#blogTitle').addEventListener('blur', () => { if (!$('#blogSlug').value) $('#blogSlug').value = slugify($('#blogTitle').value) })

initialize()
