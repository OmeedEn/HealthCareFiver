import type { ServiceDraft } from '../shared'

/** Blank service listing. The questions live in ../listing-questions. */
export const EMPTY_SERVICE: ServiceDraft = {
  title: '', description: '', audiences: [], format: '', locations: '', price: '',
  contact_for_pricing: false, reach_via: '',
}
