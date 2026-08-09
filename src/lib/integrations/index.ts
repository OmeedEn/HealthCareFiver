/**
 * Integration barrel file
 *
 * Re-exports all third-party service integrations for convenient access:
 *
 *   import { persona, docusign, nursys, fcm, ocr } from '@/lib/integrations'
 */

export * as persona from './persona'
export * as docusign from './docusign'
export * as nursys from './nursys'
export * as fcm from './firebase-messaging'
export * as ocr from './document-ocr'

// Also re-export existing integrations
export * as backgroundCheck from './background-check'
export * as licenseVerify from './license-verify'
export * as npiRegistry from './npi-registry'
export * as medallion from './medallion'
export * as stripeIdentity from './stripe-identity'
