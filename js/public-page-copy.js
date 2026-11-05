import { supabase } from './supabase-client.js'

const OMIT = 'script,style,noscript,svg,nav,[data-no-page-copy],#dynamicTrips,#dynamicResources,#dynamicBlog,#tripDetail,#blogDetail,#dealsGrid,#requestQuoteList,#customInvoiceList,#quoteItemList,#hostAdminList,#hostProposalList,#hostReferralList,#hostEarningList,#contactInboxList,#vipOfferList,#campaignList,#wheelPrizeFields,#triviaEntryList,#promoList,#supplierList,#supplierAssignmentList,#recordLogList,#issueAdminList,#trvHostUrgencyBanner'

export function pageRoute(path = location.pathname) {
  return (path.replace(/\.html$/i, '').replace(/\/$/, '') || '/')
}

function ignored(el) {
  return !el || el.closest(OMIT) || ['SCRIPT','STYLE','NOSCRIPT','SVG','PATH','TEMPLATE'].includes(el.tagName)
}

// A CSS path made from stable IDs and tag-local positions is resilient to
// text changes and to unrelated elements being inserted elsewhere in the DOM.
function selectorFor(element) {
  const parts = []
  let current = element
  while (current && current !== document.body) {
    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`)
      break
    }
    const tag = current.tagName.toLowerCase()
    const siblings = current.parentElement ? [...current.parentElement.children].filter((sibling) => sibling.tagName === current.tagName) : []
    parts.unshift(`${tag}:nth-of-type(${siblings.indexOf(current) + 1})`)
    current = current.parentElement
  }
  return parts.length ? `body > ${parts.join(' > ')}` : null
}

export function collectEditableText(root = document.body) {
  const result = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT)
  let element
  while ((element = walker.nextNode())) {
    if (ignored(element)) continue
    for (let index = 0; index < element.childNodes.length; index += 1) {
      const child = element.childNodes[index]
      if (child.nodeType !== Node.TEXT_NODE || !child.nodeValue.trim()) continue
      const selector = selectorFor(element)
      if (!selector) continue
      result.push({ key: `${selector}::${index}`, text: child.nodeValue.trim(), tag: element.tagName.toLowerCase() })
    }
  }
  return result
}

export function applyPageCopy(pageContent, root = document.body) {
  const copy = pageContent?.[`${pageRoute()}#copy`]
  if (!copy || typeof copy !== 'object') return
  for (const [key, text] of Object.entries(copy)) {
    if (typeof text !== 'string') continue
    const split = key.lastIndexOf('::')
    if (split < 0) continue
    const element = document.querySelector(key.slice(0, split))
    const index = Number(key.slice(split + 2))
    const target = element?.childNodes?.[index]
    if (target?.nodeType === Node.TEXT_NODE && !ignored(element)) target.nodeValue = text
  }
}

if (typeof window !== 'undefined' && !location.pathname.startsWith('/admin')) {
  try {
    const { data, error } = await supabase.from('site_settings').select('page_content').eq('id', 1).maybeSingle()
    if (error) console.error('Editable page text could not be loaded:', error)
    else applyPageCopy(data?.page_content)
  } catch (error) {
    console.error('Editable page text could not be loaded:', error)
  }
}
