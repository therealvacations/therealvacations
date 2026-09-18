import { supabase } from './supabase-client.js'

const safeUrl = (value, fallback = '#') => {
  if (!value) return fallback
  try {
    const url = new URL(value, window.location.origin)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : fallback
  } catch {
    return fallback
  }
}

const node = (tag, className, text) => {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text !== undefined && text !== null) element.textContent = text
  return element
}

const formatDate = (value) => value
  ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
  : ''

const dateRange = (start, end) => {
  if (!start) return 'Dates coming soon'
  if (!end || start === end) return formatDate(start)
  return `${formatDate(start)} – ${formatDate(end)}`
}

const dollars = (cents) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format((Number(cents) || 0) / 100)

const showState = (container, message, kind = '') => {
  container.replaceChildren(node('p', `content-state ${kind}`.trim(), message))
}

async function loadTrips() {
  const container = document.querySelector('#dynamicTrips')
  if (!container) return
  showState(container, 'Loading upcoming trips…')

  const [{ data: trips, error }, { data: packages }] = await Promise.all([
    supabase.from('trips').select('trip_id,title,slug,dates_start,dates_end,location,description_short,cover_image_url,is_featured,sort_order').eq('status', 'active').order('sort_order').order('dates_start'),
    supabase.from('trip_packages').select('trip_id,name,total_amount,deposit_amount,sort_order').eq('is_active', true).order('sort_order'),
  ])

  if (error) return showState(container, 'Trips could not be loaded. Please try again shortly.', 'error')
  if (!trips?.length) return showState(container, 'New group trips are being prepared. Check back soon.')

  const packagesByTrip = new Map()
  for (const item of packages || []) {
    const list = packagesByTrip.get(item.trip_id) || []
    list.push(item)
    packagesByTrip.set(item.trip_id, list)
  }

  container.replaceChildren(...trips.map((trip) => {
    const card = node('article', `trip-card${trip.is_featured ? ' featured-card' : ''}`)
    const header = node('div', 'trip-card-header')
    const imageUrl = safeUrl(trip.cover_image_url, '')
    if (imageUrl) {
      header.style.backgroundImage = `linear-gradient(135deg,rgba(26,5,51,.35),rgba(59,16,102,.75)),url("${imageUrl.replaceAll('"', '%22')}")`
      header.style.backgroundSize = 'cover'
      header.style.backgroundPosition = 'center'
    }
    header.append(node('h2', '', trip.title), node('div', 'meta', `${dateRange(trip.dates_start, trip.dates_end)} · ${trip.location}`))

    const body = node('div', 'trip-card-body')
    body.append(node('p', '', trip.description_short || 'A curated group experience from The Real Vacations.'))
    const tripPackages = packagesByTrip.get(trip.trip_id) || []
    if (tripPackages.length) {
      const minimum = Math.min(...tripPackages.map((item) => Number(item.total_amount)))
      body.append(node('div', 'price-tag', `Packages from ${dollars(minimum)} per person`))
    }
    const link = node('a', 'trip-link', 'View Details →')
    link.href = `/trip?slug=${encodeURIComponent(trip.slug)}`
    body.append(link)
    card.append(header, body)
    return card
  }))
}

async function loadResources() {
  const container = document.querySelector('#dynamicResources')
  if (!container) return
  showState(container, 'Loading travel resources…')
  const { data, error } = await supabase.from('resources')
    .select('resource_id,title,description,category,icon,link_url,link_label,sort_order,is_featured')
    .eq('is_active', true).order('is_featured', { ascending: false }).order('category').order('sort_order')

  if (error) return showState(container, 'Resources could not be loaded. Please try again shortly.', 'error')
  if (!data?.length) return showState(container, 'Travel resources are being updated.')

  const names = { flight: 'Flights', hotel: 'Hotels & Stays', cruise: 'Cruises', activity: 'Activities', service: 'Travel Services', guide: 'Travel Guides', protection: 'Travel Protection', transportation: 'Transportation', experience: 'Experiences' }
  const makeLink = (item, className) => {
    const link = node('a', className, item.link_label || 'Learn More →')
    link.href = safeUrl(item.link_url, '#')
    if (link.href.startsWith('http') && new URL(link.href).origin !== window.location.origin) {
      link.target = '_blank'; link.rel = 'noopener sponsored'
    }
    return link
  }
  const render = (query = '') => {
    const term = query.trim().toLowerCase()
    const visible = data.filter((item) => !term || [item.title, item.description, item.category].some((value) => String(value || '').toLowerCase().includes(term)))
    if (!visible.length) return showState(container, 'No resources match that search.')
    const featured = visible.filter((item) => item.is_featured)
    const regular = visible.filter((item) => !item.is_featured)
    const grouped = regular.reduce((result, item) => {
      const category = item.category || 'other'
      ;(result[category] ||= []).push(item)
      return result
    }, {})
    const blocks = []
    if (featured.length) {
      const grid = node('section', 'featured-grid')
      grid.append(...featured.map((item) => {
        const card = node('article', 'featured-resource')
        card.append(node('div', 'icon', item.icon || '🧭'), node('h2', '', item.title), node('p', '', item.description || ''), makeLink(item, ''))
        return card
      }))
      blocks.push(grid)
    }
    blocks.push(...Object.entries(grouped).map(([category, items]) => {
    const section = node('section', 'resource-section')
    section.append(node('h2', '', names[category] || category.replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())))
    const grid = node('div', 'card-grid')
    grid.append(...items.map((item) => {
      const card = node('article', 'card')
      card.append(node('div', 'icon', item.icon || '🧭'), node('h3', '', item.title), node('p', '', item.description || ''))
      card.append(makeLink(item, 'card-link'))
      return card
    }))
    section.append(grid)
    return section
    }))
    container.replaceChildren(...blocks)
  }
  render()
  document.querySelector('#resourceSearch')?.addEventListener('input', (event) => render(event.target.value))
}

async function loadBlog() {
  const container = document.querySelector('#dynamicBlog')
  if (!container) return
  showState(container, 'Loading articles…')
  const { data, error } = await supabase.from('blog_posts')
    .select('id,title,slug,category,excerpt,featured_image_url,link_url,published_at,created_at')
    .eq('is_published', true).order('published_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false })

  if (error) return showState(container, 'Articles could not be loaded. Please try again shortly.', 'error')
  if (!data?.length) return showState(container, 'New travel stories are coming soon.')

  container.replaceChildren(...data.map((post, index) => {
    const card = node('article', `blog-card${index === 0 ? ' featured-card' : ''}`)
    const imageUrl = safeUrl(post.featured_image_url, '')
    if (imageUrl) {
      const image = node('img', 'blog-image')
      image.src = imageUrl; image.alt = ''; image.loading = 'lazy'
      card.append(image)
    }
    const body = node('div', 'blog-card-body')
    body.append(node('div', 'blog-tag', post.category || 'Travel'), node('div', 'meta', formatDate((post.published_at || post.created_at || '').slice(0, 10))), node('h2', '', post.title), node('p', '', post.excerpt || 'Read the latest from The Real Vacations.'))
    const link = node('a', 'read-btn', 'Read More →')
    link.href = safeUrl(post.link_url, `/blog-post?slug=${encodeURIComponent(post.slug)}`)
    body.append(link); card.append(body)
    return card
  }))
}

const renderItinerary = (value) => {
  if (!Array.isArray(value)) return []
  return value.map((item, index) => {
    const card = node('article', 'itinerary-item')
    if (typeof item === 'string') card.append(node('h3', '', `Day ${index + 1}`), node('p', '', item))
    else card.append(node('h3', '', item.title || item.day || `Day ${index + 1}`), node('p', '', item.description || item.details || ''))
    return card
  })
}

async function loadTripDetail() {
  const container = document.querySelector('#tripDetail')
  if (!container) return
  const slug = new URLSearchParams(location.search).get('slug') || ''
  if (!slug) return showState(container, 'This trip link is incomplete.', 'error')

  const { data: trip, error } = await supabase.from('trips')
    .select('trip_id,title,slug,hero_kicker,dates_start,dates_end,location,description_short,description_full,cover_image_url,itinerary,booking_deadline,max_spots')
    .eq('slug', slug).eq('status', 'active').maybeSingle()
  if (error || !trip) return showState(container, 'This trip is not currently available.', 'error')

  const { data: packages } = await supabase.from('trip_packages')
    .select('code,name,description,total_amount,deposit_amount,currency,sort_order')
    .eq('trip_id', trip.trip_id).eq('is_active', true).order('sort_order')

  document.title = `${trip.title} | The Real Vacations`
  const hero = node('header', 'detail-hero')
  const heroImage = safeUrl(trip.cover_image_url, '')
  if (heroImage) hero.style.backgroundImage = `linear-gradient(135deg,rgba(26,5,51,.65),rgba(59,16,102,.85)),url("${heroImage.replaceAll('"', '%22')}")`
  hero.append(node('div', 'eyebrow', trip.hero_kicker || 'The Real Vacations Group Trip'), node('h1', '', trip.title), node('p', 'detail-meta', `${dateRange(trip.dates_start, trip.dates_end)} · ${trip.location}`))

  const overview = node('section', 'detail-section')
  overview.append(node('h2', '', 'The Experience'), node('p', 'lead', trip.description_full || trip.description_short || 'A thoughtfully curated group travel experience.'))

  const itineraryItems = renderItinerary(trip.itinerary)
  if (itineraryItems.length) {
    const itinerary = node('section', 'detail-section')
    itinerary.append(node('h2', '', 'Itinerary'))
    const grid = node('div', 'itinerary-grid'); grid.append(...itineraryItems); itinerary.append(grid)
    overview.append(itinerary)
  }

  const pricing = node('section', 'detail-section')
  pricing.append(node('h2', '', 'Choose Your Package'))
  const packageGrid = node('div', 'package-grid')
  packageGrid.append(...(packages || []).map((item) => {
    const card = node('article', 'package-card')
    card.append(node('h3', '', item.name), node('div', 'package-price', dollars(item.total_amount)), node('p', '', item.description || `Reserve with a ${dollars(item.deposit_amount)} deposit.`))
    const link = node('a', 'book-btn', 'Book This Package')
    link.href = `/book-trip?trip=${encodeURIComponent(trip.slug)}&package=${encodeURIComponent(item.code)}`
    card.append(link); return card
  }))
  if (!packages?.length) packageGrid.append(node('p', 'content-state', 'Package details are being finalized.'))
  pricing.append(packageGrid)
  container.replaceChildren(hero, overview, pricing)
}

async function loadBlogDetail() {
  const container = document.querySelector('#blogDetail')
  if (!container) return
  const slug = new URLSearchParams(location.search).get('slug') || ''
  if (!slug) return showState(container, 'This article link is incomplete.', 'error')
  const { data: post, error } = await supabase.from('blog_posts')
    .select('title,category,content,excerpt,featured_image_url,published_at,created_at')
    .eq('slug', slug).eq('is_published', true).maybeSingle()
  if (error || !post) return showState(container, 'This article is not currently available.', 'error')

  document.title = `${post.title} | The Real Vacations`
  const article = node('article', 'article-detail')
  article.append(node('div', 'blog-tag', post.category || 'Travel'), node('h1', '', post.title), node('div', 'article-date', formatDate((post.published_at || post.created_at || '').slice(0, 10))))
  const imageUrl = safeUrl(post.featured_image_url, '')
  if (imageUrl) { const image = node('img', 'article-image'); image.src = imageUrl; image.alt = ''; article.append(image) }
  if (post.excerpt) article.append(node('p', 'article-lead', post.excerpt))
  for (const paragraph of String(post.content || '').split(/\n{2,}/).filter(Boolean)) article.append(node('p', 'article-paragraph', paragraph))
  container.replaceChildren(article)
}

loadTrips()
loadResources()
loadBlog()
loadTripDetail()
loadBlogDetail()
