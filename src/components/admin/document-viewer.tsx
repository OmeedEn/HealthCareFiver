'use client'

import { Button } from '@/components/ui/button'
import { ExternalLink, FileQuestion } from 'lucide-react'

interface DocumentViewerProps {
  documentUrl: string | null
  filename: string | null
}

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp']

function getExtension(url: string, filename: string | null): string {
  const source = filename || url
  const withoutQuery = source.split('?')[0]
  return withoutQuery.split('.').pop()?.toLowerCase() ?? ''
}

export function DocumentViewer({ documentUrl, filename }: DocumentViewerProps) {
  if (!documentUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <FileQuestion className="size-8" />
        <p className="text-sm">No document selected.</p>
      </div>
    )
  }

  const extension = getExtension(documentUrl, filename)
  const isImage = IMAGE_EXTENSIONS.includes(extension)
  const isPdf = extension === 'pdf'

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="truncate text-sm font-medium">{filename ?? 'Document'}</p>
        <Button
          variant="ghost"
          size="xs"
          render={<a href={documentUrl} target="_blank" rel="noopener noreferrer" />}
        >
          <ExternalLink className="size-3" data-icon="inline-start" />
          Open in new tab
        </Button>
      </div>
      <div className="min-h-100 flex-1 overflow-hidden rounded-md border bg-muted/30">
        {isPdf ? (
          <iframe src={documentUrl} title={filename ?? 'Document preview'} className="h-full w-full" />
        ) : isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={documentUrl}
            alt={filename ?? 'Document preview'}
            className="mx-auto h-full max-h-full w-auto object-contain"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
            <FileQuestion className="size-8" />
            <p className="text-sm">
              Preview isn&apos;t available for this file type. Use &quot;Open in new tab&quot; to view it.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
