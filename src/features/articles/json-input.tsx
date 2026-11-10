import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import { Card, Field } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { articleSchema, type ArticleFormValues } from './validation';

const keywords = z
  .union([z.string(), z.array(z.string()).transform((values) => values.join('\n'))])
  .pipe(articleSchema.shape.primary_keywords);
const importSchema = articleSchema
  .omit({ title: true, content_html: true, featured_image: true, featured_image_alt: true })
  .extend({ primary_keywords: keywords, secondary_keywords: keywords })
  .partial();

const placeholderValues = {
  slug: 'your-article-slug',
  excerpt: 'Your article summary',
  meta_title: 'Your SEO title',
  meta_description: 'Your SEO description',
  primary_keywords: ['Your primary keyword'],
  secondary_keywords: ['Your secondary keyword'],
  author_id: 'YOUR_AUTHOR_UUID',
  article_type_id: 'YOUR_ARTICLE_TYPE_UUID',
  category_ids: ['YOUR_CATEGORY_UUID'],
  tag_ids: ['YOUR_TAG_UUID'],
};
const placeholderStrings = new Set(Object.values(placeholderValues).flat());

export function ArticleJsonInput({
  form,
  reviewer,
  disabled,
}: {
  form: UseFormReturn<ArticleFormValues>;
  reviewer: boolean;
  disabled: boolean;
}) {
  const [source, setSource] = useState('');
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState('');
  const add = () => {
    setError(undefined);
    setStatus('');
    let input: unknown;
    try {
      input = JSON.parse(source);
    } catch {
      setError('Enter valid JSON without comments or trailing commas.');
      return;
    }
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      const unchanged = Object.entries(input).filter(
        ([key, value]) =>
          Object.hasOwn(placeholderValues, key) &&
          (Array.isArray(value)
            ? value
            : typeof value === 'string'
              ? value.split(/\r?\n/)
              : []
          ).some(
            (item: unknown) => typeof item === 'string' && placeholderStrings.has(item.trim()),
          ),
      );
      if (unchanged.length) {
        setError(
          `Add your own values for: ${unchanged.map(([key]) => key).join(', ')}. Replace the placeholder values or remove fields you do not want to update.`,
        );
        return;
      }
    }
    const result = importSchema.safeParse(input);
    if (!result.success) {
      setError(
        result.error.issues
          .map((issue) => `${issue.path.join('.') || 'JSON'}: ${issue.message}`)
          .join(' '),
      );
      return;
    }
    const values = result.data;
    if (!reviewer) delete values.is_featured;
    const fields = Object.keys(values) as (keyof typeof values)[];
    if (!fields.length) {
      setError('No supported fields found. Title, content, and image fields are ignored.');
      return;
    }
    for (const field of fields) {
      form.setValue(field, values[field]!, { shouldDirty: true, shouldValidate: true });
    }
    setStatus('JSON values added to the form. Review them before saving.');
  };
  return (
    <Card className="space-y-4 p-6">
      <Field
        label="Article data (JSON)"
        htmlFor="article-json"
        error={error}
        hint="Replace the example values with your own, or omit fields you do not want to update. Omitted fields stay unchanged. Title, content, and image fields are ignored."
      >
        <Textarea
          id="article-json"
          className="min-h-36 font-mono text-xs"
          rows={22}
          value={source}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? 'article-json-error' : undefined}
          placeholder={JSON.stringify(
            { ...placeholderValues, ...(reviewer ? { is_featured: false } : {}) },
            null,
            2,
          )}
          onChange={(event) => {
            setSource(event.target.value);
            setError(undefined);
            setStatus('');
          }}
        />
      </Field>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Keys: slug, excerpt, meta_title, meta_description, primary_keywords, secondary_keywords,
        author_id, article_type_id, category_ids, tag_ids{reviewer ? ', is_featured' : ''}. Use
        UUIDs for IDs and arrays of UUIDs for category_ids and tag_ids. Keywords accept arrays of
        strings or one phrase per line. is_featured accepts true or false.
      </p>
      <Button type="button" disabled={disabled || !source.trim()} onClick={add}>
        Add
      </Button>
      {status && (
        <p role="status" className="text-xs text-muted-foreground">
          {status}
        </p>
      )}
    </Card>
  );
}
