import type { Breadcrumb, ErrorEvent } from '@sentry/nextjs'

/**
 * No-PHI boundary for Sentry (evaluation P0.3). Request bodies (server
 * actions, API posts carrying message text, booking notes, bug reports),
 * cookies and query strings never leave the app. Only the path is kept.
 */
function stripQuery(url: string | undefined): string | undefined {
  return url ? url.split(/[?#]/)[0] : url
}

export function scrubSentryEvent(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.data
    delete event.request.cookies
    delete event.request.query_string
    event.request.url = stripQuery(event.request.url)
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (/^(cookie|authorization)$/i.test(key)) delete event.request.headers[key]
      }
    }
  }
  if (event.breadcrumbs) event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb)
  return event
}

export function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  // UI breadcrumbs can carry the text of the clicked element or typed input.
  if (crumb.category === 'ui.input' || crumb.category === 'ui.click') {
    return { ...crumb, message: undefined }
  }
  if (!crumb.data) return crumb
  const data: Record<string, unknown> = { ...crumb.data }
  for (const key of ['url', 'from', 'to']) {
    if (typeof data[key] === 'string') data[key] = stripQuery(data[key] as string)
  }
  delete data.body
  delete data.request_body
  delete data.response_body
  return { ...crumb, data }
}
