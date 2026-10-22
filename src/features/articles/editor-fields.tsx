import { useState } from 'react';
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form';
import { Star } from 'lucide-react';
import type { Article, Classification } from '@/types/api';
import type { useClassifications } from '@/features/categories/api';
import { slugify } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { Card, ErrorState, Field } from '@/components/shared';
import type { ArticleFormValues } from './validation';
import { RichTextEditor } from './rich-text-editor';
import { ImageUpload } from './image-upload';
type PanelProps = { form: UseFormReturn<ArticleFormValues>; disabled: boolean };
type ClassificationQuery = ReturnType<typeof useClassifications>;
const merge = (available: Classification[] = [], selected: Classification[] = []) => [
  ...new Map(
    [
      ...available.filter(
        (option) => option.is_active || selected.some((row) => row.id === option.id),
      ),
      ...selected,
    ].map((row) => [row.id, row]),
  ).values(),
];
function MultiSelect({
  label,
  options,
  value,
  onChange,
  disabled,
  error,
}: {
  label: string;
  options: Classification[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled: boolean;
  error?: string;
}) {
  const [search, setSearch] = useState('');
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <Input
        aria-label={`Search ${label.toLowerCase()}`}
        placeholder={`Find ${label.toLowerCase()}…`}
        value={search}
        disabled={disabled}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="mt-2 max-h-40 space-y-1 overflow-auto rounded-md border p-2">
        {options
          .filter((option) => option.name.toLowerCase().includes(search.toLowerCase()))
          .map((option) => (
            <label key={option.id} className="flex items-start gap-2 rounded px-1 py-1 text-xs">
              <input
                type="checkbox"
                className="mt-0.5 accent-indigo-600"
                checked={value.includes(option.id)}
                disabled={disabled || (!option.is_active && !value.includes(option.id))}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...value, option.id]
                      : value.filter((id) => id !== option.id),
                  )
                }
              />
              <span>
                {option.name}
                {!option.is_active && <span className="ml-1 text-amber-600">(inactive)</span>}
              </span>
            </label>
          ))}
        {!options.length && (
          <p className="p-1 text-xs text-muted-foreground">No options available.</p>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function StoryPanel({ form, disabled }: PanelProps) {
  const fieldError = (key: keyof ArticleFormValues) => form.formState.errors[key]?.message;
  return (
    <Card className="overflow-hidden">
      <div className="border-b px-6 py-5 sm:px-8">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          The story
        </span>
      </div>
      <div className="space-y-5 p-6 sm:p-8">
        <Field label="Article title" htmlFor="article-title" error={fieldError('title')}>
          <Input
            id="article-title"
            className="h-auto border-0 px-0 py-1 text-2xl font-semibold tracking-tight shadow-none sm:text-3xl"
            placeholder="Your next great story…"
            aria-invalid={!!fieldError('title')}
            maxLength={300}
            {...form.register('title')}
          />
        </Field>
        <Field
          label="Slug"
          htmlFor="article-slug"
          error={fieldError('slug')}
          hint="Changing a published slug can break existing links."
        >
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">/</span>
            <Input
              id="article-slug"
              className="font-mono text-xs"
              placeholder="generated-from-title"
              {...form.register('slug')}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() =>
                form.setValue(
                  'slug',
                  slugify(form.getValues('title')).slice(0, 350).replace(/-$/, ''),
                  { shouldDirty: true, shouldValidate: true },
                )
              }
            >
              Generate
            </Button>
          </div>
        </Field>
        <Field
          label="Excerpt"
          htmlFor="article-excerpt"
          error={fieldError('excerpt')}
          hint="A short introduction for article cards and listings."
        >
          <Textarea
            id="article-excerpt"
            placeholder="A compelling summary of what readers will discover…"
            className="min-h-20"
            {...form.register('excerpt')}
          />
        </Field>
      </div>
      <div className="px-6 pb-6 sm:px-8">
        <Field label="Content" htmlFor="article-content" error={fieldError('content_html')}>
          <Controller
            control={form.control}
            name="content_html"
            render={({ field }) => (
              <RichTextEditor value={field.value} onChange={field.onChange} readOnly={disabled} />
            )}
          />
        </Field>
      </div>
    </Card>
  );
}
export function SeoPanel({ form }: Pick<PanelProps, 'form'>) {
  const fieldError = (key: keyof ArticleFormValues) => form.formState.errors[key]?.message;
  const [metaDescription, metaTitle, title, slug] = useWatch({
    control: form.control,
    name: ['meta_description', 'meta_title', 'title', 'slug'],
  });
  return (
    <Card className="p-6">
      <h2 className="mb-5 font-semibold">Search engine optimization</h2>
      <div className="space-y-5">
        <Field
          label="Meta title"
          htmlFor="meta-title"
          error={fieldError('meta_title')}
          hint={`${metaTitle.length}/300 characters. Around 50–60 is often readable in search results.`}
        >
          <Input
            id="meta-title"
            placeholder="Defaults to your article title on the public site"
            {...form.register('meta_title')}
          />
        </Field>
        <Field
          label="Meta description"
          htmlFor="meta-description"
          error={fieldError('meta_description')}
          hint={`${metaDescription.length}/10,000 characters. Aim for a concise summary.`}
        >
          <Textarea id="meta-description" {...form.register('meta_description')} />
        </Field>
        <div className="rounded-lg border bg-background p-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Search snippet preview
          </p>
          <p className="mt-3 truncate text-lg text-blue-700 dark:text-blue-400">
            {metaTitle || title || 'Your article title'}
          </p>
          <p className="mt-1 truncate text-xs text-emerald-700 dark:text-emerald-400">
            /{slug || 'article-slug'}
          </p>
          <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {metaDescription ||
              form.getValues('excerpt') ||
              'Your meta description will appear here. Search engines may choose a different snippet.'}
          </p>
        </div>
        <Field
          label="JSON-LD schema"
          htmlFor="jsonld"
          error={fieldError('schema')}
          hint="Optional Schema.org JSON object or @graph. Maximum 64 KiB and depth 16. Never include a script tag."
        >
          <Textarea
            id="jsonld"
            className="min-h-48 font-mono text-xs leading-6"
            placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "Article"\n}'}
            spellCheck={false}
            {...form.register('schema')}
          />
        </Field>
      </div>
    </Card>
  );
}
export function OrganizationPanel({
  form,
  disabled,
  article,
  reviewer,
  categories,
  tags,
  types,
}: PanelProps & {
  article?: Article;
  reviewer: boolean;
  categories: ClassificationQuery;
  tags: ClassificationQuery;
  types: ClassificationQuery;
}) {
  const fieldError = (key: keyof ArticleFormValues) => form.formState.errors[key]?.message;
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold">Organization</h2>
      <fieldset disabled={disabled} className="space-y-5">
        <Field label="Article type" htmlFor="article-type" error={fieldError('article_type_id')}>
          <Select id="article-type" {...form.register('article_type_id')}>
            <option value="">Choose a type</option>
            {merge(types.data, article?.article_type ? [article.article_type] : []).map((type) => (
              <option
                key={type.id}
                value={type.id}
                disabled={!type.is_active && type.id !== article?.article_type_id}
              >
                {type.name}
                {!type.is_active ? ' (inactive)' : ''}
              </option>
            ))}
          </Select>
        </Field>
        <Controller
          control={form.control}
          name="category_ids"
          render={({ field }) => (
            <MultiSelect
              label="Categories"
              options={merge(categories.data, article?.categories)}
              value={field.value}
              onChange={field.onChange}
              disabled={disabled}
              error={fieldError('category_ids')}
            />
          )}
        />
        <Controller
          control={form.control}
          name="tag_ids"
          render={({ field }) => (
            <MultiSelect
              label="Tags"
              options={merge(tags.data, article?.tags)}
              value={field.value}
              onChange={field.onChange}
              disabled={disabled}
              error={fieldError('tag_ids')}
            />
          )}
        />
        {reviewer && (
          <label className="flex items-start gap-2 border-t pt-4 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 size-4 accent-indigo-600"
              {...form.register('is_featured')}
            />
            <span className="flex-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Star className="size-3.5 text-amber-500" />
                Featured article
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                Highlight this story in featured content.
              </span>
            </span>
          </label>
        )}
      </fieldset>
      {[categories, tags, types].some((query) => query.isPending) && (
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          Loading classification options…
        </p>
      )}
      {[categories, tags, types].map((query, index) =>
        query.error ? (
          <div key={index} className="mt-3">
            <ErrorState compact error={query.error} retry={() => void query.refetch()} />
          </div>
        ) : null,
      )}
    </Card>
  );
}
export function FeaturedImagePanel({ form, disabled }: PanelProps) {
  const fieldError = (key: keyof ArticleFormValues) => form.formState.errors[key]?.message;
  const featuredImage = useWatch({ control: form.control, name: 'featured_image' });
  return (
    <Card className="p-5">
      <h2 className="mb-4 text-sm font-semibold">Featured image</h2>
      <fieldset disabled={disabled} className="space-y-4">
        <ImageUpload
          id="featured-image-upload"
          disabled={disabled}
          onUploaded={(url) =>
            form.setValue('featured_image', url, { shouldDirty: true, shouldValidate: true })
          }
        />
        <Field
          label="Image URL"
          htmlFor="featured-image"
          error={fieldError('featured_image')}
          hint="Upload a file or enter an absolute HTTP(S) URL."
        >
          <Input
            id="featured-image"
            type="url"
            placeholder="https://…"
            {...form.register('featured_image')}
          />
        </Field>
        <Field
          label="Alt text"
          htmlFor="featured-image-alt"
          error={fieldError('featured_image_alt')}
        >
          <Input
            id="featured-image-alt"
            placeholder="Describe this image"
            {...form.register('featured_image_alt')}
          />
        </Field>
        {featuredImage && (
          <Button
            variant="outline"
            onClick={() =>
              form.setValue('featured_image', '', { shouldDirty: true, shouldValidate: true })
            }
          >
            Remove featured image
          </Button>
        )}
        {featuredImage && !fieldError('featured_image') && (
          <img
            className="max-h-52 w-full rounded-md border object-cover"
            src={featuredImage}
            alt={form.getValues('featured_image_alt')}
            referrerPolicy="no-referrer"
          />
        )}
      </fieldset>
    </Card>
  );
}
