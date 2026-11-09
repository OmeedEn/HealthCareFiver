'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { PublicPhoto } from '@/lib/find-care/profile'

/** Photo grid with a simple lightbox. */
export function PhotoGallery({ photos, name }: { photos: PublicPhoto[]; name: string }) {
  const [index, setIndex] = useState<number | null>(null)
  const current = index == null ? null : photos[index]
  const step = (d: number) =>
    setIndex((i) => (i == null ? i : (i + d + photos.length) % photos.length))

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="group block aspect-[4/3] w-full overflow-hidden rounded-xl bg-[#eeebe4] focus-visible:ring-3 focus-visible:ring-[#2f3cf5]/40 focus-visible:outline-none"
              aria-label={p.caption ? `View photo: ${p.caption}` : `View photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Supabase storage host */}
              <img
                src={p.url}
                alt={p.caption ?? `Photo from ${name}`}
                loading="lazy"
                className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
              />
            </button>
          </li>
        ))}
      </ul>
      <Dialog open={current != null} onOpenChange={(o) => !o && setIndex(null)}>
        <DialogContent className="p-3 sm:max-w-3xl">
          <DialogTitle className="sr-only">
            {current?.caption ?? `Photo from ${name}`}
          </DialogTitle>
          {current && (
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element -- Supabase storage host */}
              <img
                src={current.url}
                alt={current.caption ?? `Photo from ${name}`}
                className="max-h-[75vh] w-full rounded-lg object-contain"
              />
              <figcaption className="mt-2 flex items-center justify-between gap-3 text-sm text-[#3a3934]">
                <span className="min-w-0 truncate">{current.caption}</span>
                {photos.length > 1 && (
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => step(-1)}
                      className="rounded-md p-1.5 hover:bg-[#eeebe4]"
                      aria-label="Previous photo"
                    >
                      <ChevronLeft className="size-5" />
                    </button>
                    <span className="text-xs text-[#5f5d57]">
                      {(index ?? 0) + 1} / {photos.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => step(1)}
                      className="rounded-md p-1.5 hover:bg-[#eeebe4]"
                      aria-label="Next photo"
                    >
                      <ChevronRight className="size-5" />
                    </button>
                  </span>
                )}
              </figcaption>
            </figure>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
