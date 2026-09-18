import { supabase } from './supabase-client.js'

const state = { user: null, permissions: null, trips: [], resources: [], posts: [], packages: [], settings: null }
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
  renderTrips(); renderResources(); renderPosts(); renderContactSettings()
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
$('#contactForm').addEventListener('submit', saveContactSettings)
$('#tripUpload').addEventListener('change', (event) => uploadImage(event.target, '#tripImage', 'trips'))
$('#blogUpload').addEventListener('change', (event) => uploadImage(event.target, '#blogImage', 'blog'))
$('#logoutButton').addEventListener('click', async () => { await supabase.auth.signOut(); location.replace('/admin-login') })
$('#tripTitle').addEventListener('blur', () => { if (!$('#tripSlug').value) $('#tripSlug').value = slugify($('#tripTitle').value) })
$('#blogTitle').addEventListener('blur', () => { if (!$('#blogSlug').value) $('#blogSlug').value = slugify($('#blogTitle').value) })

initialize()
