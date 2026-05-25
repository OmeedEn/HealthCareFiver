/**
 * Document OCR — Credential Extraction
 * Supports Google Cloud Document AI and AWS Textract.
 *
 * Extracts text from uploaded credential documents (PDFs, images) and
 * attempts to parse structured data like license numbers, names, and
 * expiration dates. Falls back to a regex-based parser when no cloud
 * OCR service is configured.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OcrResult {
  /** Full extracted text from the document */
  rawText: string
  /** Structured fields parsed from the extracted text */
  parsed: ParsedCredential
  /** Which OCR provider was used, or "regex-fallback" / "none" */
  provider: 'google-document-ai' | 'aws-textract' | 'regex-fallback' | 'none'
  /** Confidence score (0-1) from the OCR provider, if available */
  confidence: number | null
}

export interface ParsedCredential {
  /** Full name of the credential holder */
  name: string | null
  /** License or certificate number */
  licenseNumber: string | null
  /** Expiration date in ISO format (YYYY-MM-DD) if detected */
  expirationDate: string | null
  /** Issuing authority (e.g., "California Board of Registered Nursing") */
  issuingAuthority: string | null
  /** License type if detected (e.g., "RN", "LPN") */
  licenseType: string | null
}

export interface ExtractRequest {
  /** Document content as a base64-encoded string */
  documentBase64: string
  /** MIME type of the document (e.g., "application/pdf", "image/jpeg") */
  mimeType: string
  /** Optional filename for logging */
  filename?: string
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function getGoogleConfig() {
  return {
    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || null,
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us',
    processorId: process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID || null,
  }
}

function getAwsConfig() {
  return {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || null,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || null,
    region: process.env.AWS_REGION || 'us-east-1',
  }
}

function isGoogleConfigured(): boolean {
  const c = getGoogleConfig()
  return !!(c.projectId && c.processorId)
}

function isAwsConfigured(): boolean {
  const c = getAwsConfig()
  return !!(c.accessKeyId && c.secretAccessKey)
}

// ---------------------------------------------------------------------------
// Google Cloud Document AI
// ---------------------------------------------------------------------------

async function extractWithGoogle(request: ExtractRequest): Promise<string> {
  const config = getGoogleConfig()
  const endpoint =
    `https://${config.location}-documentai.googleapis.com/v1/` +
    `projects/${config.projectId}/locations/${config.location}/` +
    `processors/${config.processorId}:process`

  // Uses Application Default Credentials (ADC) or service account
  // In production, use the Google Auth library for proper token management
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // In production, add: Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      rawDocument: {
        content: request.documentBase64,
        mimeType: request.mimeType,
      },
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Document AI error (${response.status}): ${body}`)
  }

  const result = await response.json() as { document?: { text?: string } }
  return result.document?.text || ''
}

// ---------------------------------------------------------------------------
// AWS Textract
// ---------------------------------------------------------------------------

async function extractWithTextract(request: ExtractRequest): Promise<string> {
  const config = getAwsConfig()

  // Simplified Textract call — in production use the AWS SDK v3
  // (@aws-sdk/client-textract) for proper request signing
  const { TextractClient, DetectDocumentTextCommand } = await import(
    '@aws-sdk/client-textract'
  )

  const client = new TextractClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId!,
      secretAccessKey: config.secretAccessKey!,
    },
  })

  const documentBytes = Buffer.from(request.documentBase64, 'base64')
  const command = new DetectDocumentTextCommand({
    Document: { Bytes: documentBytes },
  })

  const result = await client.send(command)
  const lines = (result.Blocks || [])
    .filter((b: { BlockType?: string }) => b.BlockType === 'LINE')
    .map((b: { Text?: string }) => b.Text || '')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Regex-based fallback parser
// ---------------------------------------------------------------------------

/**
 * Attempt to parse structured credential data from raw text using regex.
 * This is a best-effort parser for common US nursing credential formats.
 */
export function parseCredentialText(text: string): ParsedCredential {
  const result: ParsedCredential = {
    name: null,
    licenseNumber: null,
    expirationDate: null,
    issuingAuthority: null,
    licenseType: null,
  }

  if (!text) return result

  // License number patterns (common formats)
  const licensePatterns = [
    /(?:license|lic|cert)[\s.#:]*(?:no|number|num|#)?[\s.#:]*([A-Z]{0,3}\d{4,10})/i,
    /\b([A-Z]{2}\d{6,8})\b/,  // e.g., RN1234567
    /\b(\d{6,10})\b/,          // plain numeric
  ]
  for (const pattern of licensePatterns) {
    const match = text.match(pattern)
    if (match) {
      result.licenseNumber = match[1]
      break
    }
  }

  // Expiration date patterns
  const datePatterns = [
    /(?:exp(?:ir(?:ation|es))?|valid\s*(?:through|until|thru))[\s:]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/i,
    /(?:exp(?:ir(?:ation|es))?|valid\s*(?:through|until|thru))[\s:]*(\w+\s+\d{1,2},?\s+\d{4})/i,
  ]
  for (const pattern of datePatterns) {
    const match = text.match(pattern)
    if (match) {
      const parsed = new Date(match[1])
      if (!isNaN(parsed.getTime())) {
        result.expirationDate = parsed.toISOString().slice(0, 10)
      }
      break
    }
  }

  // Name patterns — look for common label prefixes
  const namePatterns = [
    /(?:name|holder|licensee|issued\s*to)[\s:]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/i,
  ]
  for (const pattern of namePatterns) {
    const match = text.match(pattern)
    if (match) {
      result.name = match[1].trim()
      break
    }
  }

  // License type
  const typePatterns = [
    /\b(RN|LPN|LVN|APRN|CNA|NP)\b/,
    /\b(Registered\s+Nurse|Licensed\s+Practical\s+Nurse|Licensed\s+Vocational\s+Nurse)\b/i,
  ]
  for (const pattern of typePatterns) {
    const match = text.match(pattern)
    if (match) {
      result.licenseType = match[1]
      break
    }
  }

  // Issuing authority — look for "Board of" or state names
  const authorityPatterns = [
    /((?:State\s+)?Board\s+of\s+(?:Registered\s+)?Nurs(?:ing|es?)(?:\s+of\s+\w+)?)/i,
    /(?:issued\s*by|authority)[\s:]*(.+?)(?:\n|$)/i,
  ]
  for (const pattern of authorityPatterns) {
    const match = text.match(pattern)
    if (match) {
      result.issuingAuthority = match[1].trim()
      break
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract text and structured credential data from an uploaded document.
 *
 * Provider priority:
 * 1. Google Cloud Document AI (if configured)
 * 2. AWS Textract (if configured)
 * 3. Returns null (manual entry required)
 *
 * When a cloud provider is used, the regex-based parser runs on the
 * extracted text to pull structured fields.
 */
export async function extractCredential(
  request: ExtractRequest
): Promise<OcrResult | null> {
  // Try Google Document AI
  if (isGoogleConfigured()) {
    try {
      const rawText = await extractWithGoogle(request)
      return {
        rawText,
        parsed: parseCredentialText(rawText),
        provider: 'google-document-ai',
        confidence: null,
      }
    } catch (error) {
      console.error('[Document OCR] Google Document AI failed:', error)
      // Fall through to next provider
    }
  }

  // Try AWS Textract
  if (isAwsConfigured()) {
    try {
      const rawText = await extractWithTextract(request)
      return {
        rawText,
        parsed: parseCredentialText(rawText),
        provider: 'aws-textract',
        confidence: null,
      }
    } catch (error) {
      console.error('[Document OCR] AWS Textract failed:', error)
      // Fall through
    }
  }

  // No OCR provider available
  console.warn(
    '[Document OCR] No OCR provider configured — manual credential entry required'
  )
  return null
}
