import type { EventDraft } from '../shared'

/** Blank event listing. The questions live in ../listing-questions. */
export const EMPTY_EVENT: EventDraft = {
  event_type: '', title: '', description: '', date_later: false, starts_at: '', format: '',
  locations: '', capacity: '', is_free: false, price: '', offers_ceu: '', audiences: [],
}
