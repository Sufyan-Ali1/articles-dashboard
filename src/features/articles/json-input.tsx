import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useQueryClient } from '@tanstack/react-query';
import { message } from '@/lib/api';
import type { Classification } from '@/types/api';
import { articleJsonSchema, editorialAuthor, resolveArticleJson } from './json-import';
import { Card, Field } from '@/components/shared';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { type ArticleFormValues } from './validation';

const placeholderValues = {
  slug: 'your-article-slug',
  excerpt: 'Your article summary',
  meta_title: 'Your SEO title',
  meta_description: 'Your SEO description',
  primary_keywords: ['Your primary keyword'],
  secondary_keywords: ['Your secondary keyword'],
  article_type: 'Your article type name',
  categories: ['Your category name'],
  tags: ['Your tag name'],
};
const placeholderStrings = new Set(Object.values(placeholderValues).flat());

export function ArticleJsonInput({
  form,
  canCreateTags,
  onPendingChange,
  disabled,
}: {
  form: UseFormReturn<ArticleFormValues>;
  canCreateTags: boolean;
  onPendingChange?: (pending: boolean) => void;
  disabled: boolean;
}) {
  const client = useQueryClient();
  const [pending, setPending] = useState(false);
  const busy = disabled || pending;
  const [source, setSource] = useState('');
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState('');
  const add = async () => {
    if (busy) return;
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
    const result = articleJsonSchema.safeParse(input);
    if (!result.success) {
      setError(
        result.error.issues
          .map((issue) => `${issue.path.join('.') || 'JSON'}: ${issue.message}`)
          .join(' '),
      );
      return;
    }
    if (!Object.keys(result.data).length) {
      setError(
        'No supported fields found. Title, content, images, IDs, and featured status are ignored.',
      );
      return;
    }
    setPending(true);
    onPendingChange?.(true);
    try {
      const values = await resolveArticleJson(result.data, canCreateTags, (tag) => {
        client.setQueriesData<Classification[]>(
          {
            predicate: (query) =>
              query.queryKey[0] === 'classifications' && query.queryKey.includes('tags'),
          },
          (previous) =>
            previous ? [...previous.filter((row) => row.id !== tag.id), tag] : previous,
        );
        void client.invalidateQueries({ queryKey: ['classifications'] });
      });
      for (const field of Object.keys(values) as (keyof ArticleFormValues)[]) {
        form.setValue(field, values[field]!, { shouldDirty: true, shouldValidate: true });
      }
      setStatus('JSON values added to the form. Review them before saving.');
    } catch (failure) {
      setError(message(failure));
    } finally {
      setPending(false);
      onPendingChange?.(false);
    }
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
          disabled={busy}
          aria-invalid={!!error}
          aria-describedby={error ? 'article-json-error' : undefined}
          placeholder={JSON.stringify(placeholderValues, null, 2)}
          onChange={(event) => {
            setSource(event.target.value);
            setError(undefined);
            setStatus('');
          }}
        />
      </Field>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Keys: slug, excerpt, meta_title, meta_description, primary_keywords, secondary_keywords,
        article_type, categories, tags. Use an article type name and arrays of category and tag
        names. Names match without regard to case. Missing categories or article types show an
        error; missing tags are created automatically. Author: {editorialAuthor}. Keywords accept
        arrays of strings or one phrase per line.
      </p>
      <Button type="button" disabled={busy || !source.trim()} onClick={add}>
        {pending ? 'Adding…' : 'Add'}
      </Button>
      {status && (
        <p role="status" className="text-xs text-muted-foreground">
          {status}
        </p>
      )}
    </Card>
  );
}
