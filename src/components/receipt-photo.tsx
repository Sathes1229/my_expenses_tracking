import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/locale';
import { messages } from '@/i18n/messages';

/**
 * A receipt photo in a frame of fixed size, so nothing moves while it loads: 288px tall on phones,
 * 3:4 (the shape of most receipt photos) from lg up. The whole photo always shows, letterboxed.
 * `locale` words the link to the full-size photo; the page passes its own.
 */
export function ReceiptPhoto({
  src,
  alt,
  locale,
  fullSizeLink = true,
}: {
  src: string;
  alt: string;
  locale: Locale;
  fullSizeLink?: boolean;
}) {
  return (
    <figure className="flex flex-col gap-1">
      <div className="h-72 overflow-hidden rounded-surface border border-line bg-sunken lg:aspect-[3/4] lg:h-auto">
        {/* A plain img: the image optimiser would fetch the photo without the viewer's session cookie. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={1200} height={1600} className="size-full object-contain" />
      </div>
      {fullSizeLink && (
        <a href={src} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center self-start">
          {messages[locale].transactions.openPhoto}
        </a>
      )}
    </figure>
  );
}

/** The photo beside the content from lg up (kept in view while the form scrolls), above it on phones. */
export function BesidePhoto({ photo, children }: { photo: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-10">
      <div className="flex flex-col gap-2 lg:sticky lg:top-6">{photo}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
