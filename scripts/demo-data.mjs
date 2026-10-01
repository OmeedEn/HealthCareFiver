#!/usr/bin/env node
/**
 * Seed (or remove) demo data in a Supabase project, built from the same
 * sample content the app shows in demo mode (src/lib/demo/data.ts).
 *
 *   node scripts/demo-data.mjs seed     # create demo accounts + data
 *   node scripts/demo-data.mjs remove   # delete everything this script made
 *   node scripts/demo-data.mjs status   # count demo accounts
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the env.
 *
 * Every account is created with app_metadata.demo_seed = true and an
 * @demo.sanus.example email (reserved domain, so no email is ever sent or
 * delivered). All other rows hang off those accounts with ON DELETE CASCADE,
 * so `remove` deletes the accounts and Postgres cleans up the rest.
 *
 * Demo accounts get a random password nobody knows. Set DEMO_PASSWORD to give
 * them a known one if you want to sign in as a demo professional or facility.
 */
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import {
  DEMO_CONTRACTS,
  DEMO_CONVERSATIONS,
  DEMO_CREDENTIALS,
  DEMO_FACILITY,
  DEMO_JOBS,
  DEMO_MESSAGES,
  DEMO_NOTIFICATIONS,
  DEMO_PROVIDERS,
  DEMO_REVIEWS,
} from '../src/lib/demo/data.ts'

const DOMAIN = 'demo.sanus.example'
const AGREEMENT_VERSION = '2026-09-30' // src/lib/legal.ts CONTRACTOR_AGREEMENT_VERSION

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
  process.exit(1)
}
const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── helpers ──────────────────────────────────────────────────────────────

const DAY = 86_400_000
const now = Date.now()
const iso = (days) => new Date(now + days * DAY).toISOString()
const date = (days) => iso(days).slice(0, 10)
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '')

function must(label, { data, error }) {
  if (error) throw new Error(`${label}: ${error.message}`)
  return data
}

async function listDemoUsers() {
  const users = []
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`listUsers: ${error.message}`)
    users.push(...data.users.filter((u) => u.app_metadata?.demo_seed === true))
    if (data.users.length < 1000) return users
  }
}

async function createUser(email, metadata) {
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: process.env.DEMO_PASSWORD || randomBytes(24).toString('base64url'),
    email_confirm: true,
    user_metadata: metadata,
    app_metadata: { demo_seed: true },
  })
  if (error) throw new Error(`createUser ${email}: ${error.message}`)
  return data.user.id
}

// ── demo content → rows ──────────────────────────────────────────────────

const CATEGORY = { rn: 'clinical', md: 'clinical', cna: 'clinical', np: 'clinical', pt: 'allied', rt: 'allied', sw: 'allied', other: 'allied' }

const FACILITIES = [
  {
    key: 'demo-facility-1',
    facility_name: DEMO_FACILITY.facility_name,
    facility_type: DEMO_FACILITY.facility_type,
    description: DEMO_FACILITY.description,
    address_line_1: DEMO_FACILITY.address_line1,
    city: DEMO_FACILITY.city,
    state: DEMO_FACILITY.state,
    zip_code: DEMO_FACILITY.zip_code,
    phone: DEMO_FACILITY.phone,
    contact_name: DEMO_FACILITY.contact_name,
  },
  { key: 'demo-facility-2', facility_name: 'Valley Regional Medical Center', facility_type: 'hospital', city: 'Phoenix', state: 'AZ', zip_code: '85004', contact_name: 'Angela Reyes', description: 'Regional hospital with a busy Level I emergency department serving the Phoenix metro area.' },
  { key: 'demo-facility-3', facility_name: 'Greenway Skilled Nursing', facility_type: 'nursing_home', city: 'Austin', state: 'TX', zip_code: '78701', contact_name: 'Karen Williams', description: '120-bed skilled nursing and long-term care community.' },
  { key: 'demo-facility-4', facility_name: 'Peak Performance Rehab Center', facility_type: 'rehab_center', city: 'Denver', state: 'CO', zip_code: '80202', contact_name: 'Tom Becker', description: 'Outpatient orthopedic and sports rehabilitation clinic.' },
  { key: 'demo-facility-5', facility_name: 'Mountain View Community Clinic', facility_type: 'clinic', city: 'Boise', state: 'ID', zip_code: '83702', contact_name: 'Dr. Priya Nair', description: 'Community family-medicine clinic serving rural Idaho.' },
]

// Spread job dates relative to today so nothing looks stale.
const JOB_DATES = { 'job-1': [-3, 14, 105], 'job-2': [-6, 21, 111], 'job-3': [-1, 7, null], 'job-4': [-9, 30, 120], 'job-5': [-4, 18, 109], 'job-6': [-12, 45, 135] }

// Who applied to what (provider index into DEMO_PROVIDERS → status).
const APPLICATIONS = [
  ['job-1', 0, 'accepted'],
  ['job-1', 6, 'applied'],
  ['job-3', 3, 'shortlisted'],
  ['job-4', 2, 'interviewing'],
  ['job-5', 4, 'applied'],
  ['job-6', 1, 'offered'],
]

const OFFERINGS = {
  rn: [['service', 'In-home nursing visit', 'home_visit', 60, 12000]],
  md: [['consulting', 'Second-opinion consult', 'virtual', 45, 25000]],
  pt: [['service', 'Ortho rehab session', 'in_person', 60, 11000]],
  cna: [['service', 'Companion & personal care visit', 'home_visit', 120, 7000]],
  rt: [['consulting', 'Home ventilator & CPAP review', 'virtual', 45, 9000]],
  other: [['service', 'Nutrition plan consultation', 'virtual', 60, 9500]],
  sw: [['service', 'Individual counseling session', 'virtual', 50, 13000]],
}

// ── seed ─────────────────────────────────────────────────────────────────

async function seed() {
  const existing = await listDemoUsers()
  if (existing.length) {
    console.error(`${existing.length} demo accounts already exist. Run "remove" first to reseed.`)
    process.exit(1)
  }

  // Professionals (Sarah Johnson = DEMO_CONTRACTOR = 'demo-contractor-1').
  const proIds = []
  for (const p of DEMO_PROVIDERS) {
    const id = await createUser(`${slug(`${p.first_name} ${p.last_name}`)}@${DOMAIN}`, {
      role: 'contractor',
      first_name: p.first_name,
      last_name: p.last_name,
      contractor_type: p.contractor_type,
      professional_category: CATEGORY[p.contractor_type] ?? 'clinical',
      city: p.city,
      state: p.state,
    })
    proIds.push(id)
    must(`contractor_profiles ${p.last_name}`, await db.from('contractor_profiles').update({
      headline: p.headline,
      bio: `${p.credential} with ${p.years_of_experience} years of experience in ${p.specialty.toLowerCase()}. Based in ${p.city}, ${p.state}.`,
      specialties: p.specialties,
      years_of_experience: p.years_of_experience,
      hourly_rate_min: p.hourly_rate_min,
      hourly_rate_max: p.hourly_rate_max,
      city: p.city,
      state: p.state,
      license_state: p.state,
      license_states: [p.state],
      license_type: p.credential,
      professional_category: CATEGORY[p.contractor_type] ?? 'clinical',
      languages: ['English'],
      is_available: p.is_available,
      profile_completion_pct: 100,
      onboarding_step: 5,
      onboarding_completed_at: iso(-60),
      verification_status: 'approved',
      verification_reviewed_at: iso(-55),
      contractor_agreement_accepted_at: iso(-55),
      contractor_agreement_version: AGREEMENT_VERSION,
    }).eq('id', id))
    must(`profiles ${p.last_name}`, await db.from('profiles').update({ is_verified: true }).eq('id', id))
  }
  const pro = (key) => (key === 'demo-contractor-1' ? proIds[0] : null)

  // Credentials: a verified license + BLS for every pro, plus Sarah's full set.
  const creds = []
  DEMO_PROVIDERS.forEach((p, i) => {
    creds.push(
      { contractor_id: proIds[i], credential_type: 'license', name: `${p.credential} License — ${p.state}`, issuing_authority: `${p.state} State Board`, license_number: `${p.state}-${100000 + i * 7919}`, issued_date: date(-900), expiration_date: date(400), status: 'verified', verified_at: iso(-55) },
      { contractor_id: proIds[i], credential_type: 'cpr_bls', name: 'BLS Certification', issuing_authority: 'American Heart Association', issued_date: date(-300), expiration_date: date(430), status: 'verified', verified_at: iso(-55) },
    )
  })
  for (const c of DEMO_CREDENTIALS.filter((c) => !['license', 'cpr_bls'].includes(c.credential_type))) {
    creds.push({ contractor_id: proIds[0], credential_type: c.credential_type, name: c.name, issuing_authority: c.issuing_authority ?? null, license_number: c.license_number ?? null, issued_date: date(-400), expiration_date: c.status === 'expiring_soon' ? date(20) : date(300), status: c.status === 'pending_review' ? 'pending_review' : 'verified', verified_at: c.status === 'pending_review' ? null : iso(-50) })
  }
  must('credentials', await db.from('credentials').insert(creds))

  // Published offerings so profiles have something to book.
  const offerings = DEMO_PROVIDERS.flatMap((p, i) =>
    (OFFERINGS[p.contractor_type] ?? OFFERINGS.other).map(([kind, title, format, mins, cents]) => ({
      contractor_id: proIds[i], kind, title, format, duration_minutes: mins, price_cents: cents, status: 'published',
      description: `${title} with ${p.first_name} ${p.last_name}, ${p.credential}.`,
    }))
  )
  must('professional_offerings', await db.from('professional_offerings').insert(offerings))

  // Facilities.
  const facilityIds = {}
  for (const f of FACILITIES) {
    const { key, ...row } = f
    const id = await createUser(`${slug(f.facility_name)}@${DOMAIN}`, {
      role: 'facility',
      facility_name: f.facility_name,
      facility_type: f.facility_type,
      contact_name: f.contact_name,
      city: f.city,
      state: f.state,
      zip_code: f.zip_code,
    })
    facilityIds[key] = id
    must(`facility_profiles ${f.facility_name}`, await db.from('facility_profiles').update({ ...row, is_verified: true }).eq('id', id))
  }
  const fac = (key) => facilityIds[key] ?? facilityIds['demo-facility-1']

  // Jobs.
  const jobIds = {}
  for (const j of DEMO_JOBS) {
    const [published, start, end] = JOB_DATES[j.id] ?? [-2, 14, null]
    const row = must(`job ${j.id}`, await db.from('jobs').insert({
      facility_id: fac(j.facility_id),
      title: j.title,
      description: j.description,
      contractor_type: j.contractor_type,
      specialties_required: j.specialties_required ?? [],
      job_type: j.job_type,
      shift_type: j.shift_type,
      status: 'open',
      city: j.city,
      state: j.state,
      zip_code: j.zip_code,
      is_remote: j.is_remote ?? false,
      hourly_rate_min: j.pay_rate_min,
      hourly_rate_max: j.pay_rate_max,
      pay_rate_min: j.pay_rate_min,
      pay_rate_max: j.pay_rate_max,
      pay_rate_type: j.pay_rate_type ?? 'hourly',
      shifts_per_week: j.shifts_per_week ?? null,
      hours_per_shift: j.hours_per_shift ?? null,
      years_experience_min: j.years_experience_min ?? null,
      required_credentials: j.required_credentials ?? [],
      overtime_rate: j.overtime_rate ?? null,
      travel_reimbursement: j.travel_reimbursement ?? false,
      housing_provided: j.housing_provided ?? false,
      start_date: date(start),
      end_date: end == null ? null : date(end),
      hours_per_week: j.hours_per_shift && j.shifts_per_week ? j.hours_per_shift * j.shifts_per_week : null,
      years_experience_required: j.years_experience_min ?? null,
      required_certifications: j.required_credentials ?? [],
      additional_requirements: j.additional_requirements ?? null,
      positions_available: j.positions_available ?? 1,
      positions_filled: j.positions_filled ?? 0,
      urgency: j.urgency === 'normal' ? 'medium' : j.urgency ?? null,
      published_at: iso(published),
      expires_at: iso(published + 45),
    }).select('id').single())
    jobIds[j.id] = row.id
  }

  const appIds = {}
  for (const [job, proIdx, status] of APPLICATIONS) {
    const p = DEMO_PROVIDERS[proIdx]
    const row = must(`application ${job}`, await db.from('job_applications').insert({
      job_id: jobIds[job], contractor_id: proIds[proIdx], status,
      cover_letter: `Hi — I'm ${p.first_name}, a ${p.credential} with ${p.years_of_experience} years in ${p.specialty.toLowerCase()}. I'd love to be considered.`,
      proposed_rate: p.hourly_rate_max, available_start_date: date(10), status_changed_at: iso(-1),
    }).select('id').single())
    appIds[`${job}:${proIdx}`] = row.id
  }

  // Contracts: contract-1 active (job-1), contract-2 completed.
  const CONTRACT_DATES = { 'contract-1': [-25, 65, -30], 'contract-2': [-120, -90, -125] }
  const contractIds = {}
  for (const c of DEMO_CONTRACTS) {
    const [start, end, signed] = CONTRACT_DATES[c.id]
    const row = must(`contract ${c.id}`, await db.from('contracts').insert({
      job_id: c.job_id ? jobIds[c.job_id] : null,
      application_id: c.job_id ? appIds[`${c.job_id}:0`] ?? null : null,
      contractor_id: pro(c.contractor_id), facility_id: fac(c.facility_id),
      status: c.status, title: c.title, description: c.description,
      agreed_rate: c.agreed_rate, rate_type: c.rate_type, overtime_rate: c.overtime_rate,
      estimated_hours: c.estimated_hours, total_value: c.total_value, platform_fee_pct: c.platform_fee_pct,
      start_date: date(start), end_date: date(end),
      contractor_signed_at: iso(signed), facility_signed_at: iso(signed),
      completed_at: c.status === 'completed' ? iso(end) : null,
    }).select('id').single())
    contractIds[c.id] = row.id
  }

  // Timesheets + payments: three approved/paid shifts on the active contract,
  // one lump payment for the completed one.
  const c1 = DEMO_CONTRACTS[0]
  for (const d of [-21, -14, -7]) {
    const ts = must('timesheet', await db.from('timesheets').insert({
      contract_id: contractIds['contract-1'], contractor_id: proIds[0], facility_id: fac(c1.facility_id),
      status: 'approved', shift_date: date(d), clock_in: iso(d - 0.25), clock_out: iso(d + 0.25),
      break_minutes: 30, total_hours: 11.5, approved_at: iso(d + 1),
    }).select('id').single())
    const gross = 11.5 * c1.agreed_rate
    const fee = Math.round(gross * 0.1 * 100) / 100
    const stripe = Math.round((gross * 0.029 + 0.3) * 100) / 100
    must('payment', await db.from('payments').insert({
      contract_id: contractIds['contract-1'], timesheet_id: ts.id, payer_id: fac(c1.facility_id), payee_id: proIds[0],
      status: d === -7 ? 'in_escrow' : 'released', gross_amount: gross, platform_fee: fee, stripe_fee: stripe,
      net_amount: Math.round((gross - fee - stripe) * 100) / 100, currency: 'usd',
      escrowed_at: iso(d + 1), released_at: d === -7 ? null : iso(d + 3), invoice_number: `DEMO-${1000 + -d}`,
    }))
  }
  const c2 = DEMO_CONTRACTS[1]
  must('payment c2', await db.from('payments').insert({
    contract_id: contractIds['contract-2'], payer_id: fac(c2.facility_id), payee_id: proIds[0], status: 'released',
    gross_amount: c2.total_value, platform_fee: c2.total_value * 0.1, stripe_fee: 104.7, net_amount: c2.total_value * 0.9 - 104.7,
    currency: 'usd', escrowed_at: iso(-89), released_at: iso(-86), invoice_number: 'DEMO-0990',
  }))

  // Reviews of Sarah from the facilities she worked with.
  must('reviews', await db.from('reviews').insert(DEMO_REVIEWS.map((r, i) => ({
    contract_id: contractIds[r.contract_id] ?? contractIds['contract-2'],
    reviewer_id: fac(r.reviewer_id), reviewee_id: proIds[0],
    rating: r.rating, title: r.title, content: r.content,
    professionalism_rating: r.professionalism_rating, communication_rating: r.communication_rating,
    skill_rating: r.skill_rating, punctuality_rating: r.punctuality_rating,
    is_visible: true, created_at: iso(-80 + i * 3),
  }))))

  // Ratings shown on Find Care (set after reviews in case a trigger recomputed them).
  for (const [i, p] of DEMO_PROVIDERS.entries()) {
    must('ratings', await db.from('contractor_profiles').update({ average_rating: p.average_rating, total_reviews: p.total_reviews }).eq('id', proIds[i]))
  }

  // Conversations + messages (Sarah ↔ facilities), moved to the last two days.
  for (const [ci, c] of DEMO_CONVERSATIONS.entries()) {
    const msgs = DEMO_MESSAGES.filter((m) => m.conversation_id === c.id)
    const at = (k) => iso(-(ci + 1) + (k + 1) * 0.02)
    const conv = must('conversation', await db.from('conversations').insert({
      participant_1: proIds[0], participant_2: fac(c.participant_2),
      contract_id: ci === 0 ? contractIds['contract-1'] : contractIds['contract-2'],
      last_message_at: at(msgs.length - 1), last_message_preview: c.last_message_preview,
    }).select('id').single())
    if (msgs.length) {
      must('messages', await db.from('messages').insert(msgs.map((m, k) => ({
        conversation_id: conv.id, sender_id: m.sender_id === 'demo-contractor-1' ? proIds[0] : fac(m.sender_id),
        content: m.content, is_read: true, created_at: at(k),
      }))))
    }
  }

  // Notifications for Sarah.
  must('notifications', await db.from('notifications').insert(DEMO_NOTIFICATIONS.map((n, i) => ({
    user_id: proIds[0], type: n.type, title: n.title, body: n.body ?? n.message ?? null,
    is_read: i > 1, created_at: iso(-i * 0.7),
  }))))

  console.log(`Seeded ${proIds.length} professionals, ${Object.keys(facilityIds).length} facilities, ${Object.keys(jobIds).length} jobs, ${APPLICATIONS.length} applications, ${Object.keys(contractIds).length} contracts, ${DEMO_REVIEWS.length} reviews, ${DEMO_CONVERSATIONS.length} conversations.`)
}

// ── remove / status ──────────────────────────────────────────────────────

async function remove() {
  const users = await listDemoUsers()
  for (const u of users) {
    const { error } = await db.auth.admin.deleteUser(u.id)
    if (error) throw new Error(`deleteUser ${u.email}: ${error.message}`)
  }
  console.log(`Removed ${users.length} demo accounts (and their data, via cascade).`)
}

async function status() {
  const users = await listDemoUsers()
  console.log(`${users.length} demo accounts`)
  for (const u of users) console.log(`  ${u.email}`)
}

const cmd = process.argv[2]
const run = { seed, remove, status }[cmd]
if (!run) {
  console.error('Usage: node scripts/demo-data.mjs <seed|remove|status>')
  process.exit(1)
}
run().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
