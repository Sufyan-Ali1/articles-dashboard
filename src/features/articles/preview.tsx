import DOMPurify from 'dompurify';
import { Dialog } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { date } from '@/lib/utils';
import type { ArticleFormValues } from './validation';
import { safeUrl } from './validation';
export function sanitizePreview(html: string) {
  const fragment = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button', 'video', 'audio'],
    FORBID_ATTR: ['style', 'srcset'],
    ADD_ATTR: ['target', 'rel'],
    RETURN_DOM_FRAGMENT: true,
  });
  fragment.querySelectorAll('a').forEach((anchor) => {
    if (!safeUrl(anchor.getAttribute('href') ?? '', true)) anchor.removeAttribute('href');
    anchor.setAttribute('rel', 'noopener noreferrer');
  });
  fragment.querySelectorAll('img').forEach((image) => {
    const src = image.getAttribute('src') ?? '';
    if (!safeUrl(src, true) || src.startsWith('#')) image.removeAttribute('src');
    image.setAttribute('referrerpolicy', 'no-referrer');
  });
  const container = document.createElement('div');
  container.appendChild(fragment);
  return container.innerHTML;
}
export function ArticlePreview({
  open,
  onOpenChange,
  values,
  author,
  publishedAt,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  values: ArticleFormValues;
  author: string;
  publishedAt?: string | null;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Article preview"
      description="Preview of your current content. Unsaved edits are included; no views are recorded."
      className="max-w-4xl"
    >
      <div className="mb-6">
        <Badge tone="purple">Editorial preview</Badge>
      </div>
      <article className="mx-auto max-w-[680px] pb-8">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {values.title || 'Untitled article'}
        </h1>
        {values.excerpt && (
          <p className="mt-4 text-lg leading-7 text-muted-foreground">{values.excerpt}</p>
        )}
        <p className="my-6 text-xs text-muted-foreground">
          By {author}
          {publishedAt ? ` · ${date(publishedAt)}` : ' · Unpublished'}
        </p>
        {values.featured_image && (
          <img
            className="mb-8 max-h-96 w-full rounded-xl object-cover"
            src={values.featured_image}
            alt={values.featured_image_alt}
            referrerPolicy="no-referrer"
          />
        )}
        <div
          className="prose prose-slate dark:prose-invert max-w-none break-words prose-img:rounded-lg"
          dangerouslySetInnerHTML={{ __html: sanitizePreview(values.content_html) }}
        />
      </article>
    </Dialog>
  );
}
