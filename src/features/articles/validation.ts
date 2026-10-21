import { z } from 'zod';
import { nullable } from '@/lib/utils';
import type { Article, ArticleInput, Role } from '@/types/api';
export function safeUrl(value: string, relative = false): boolean {
  if ([...value].some((character) => character.charCodeAt(0) <= 32) || value.includes('\\'))
    return false;
  if (relative && ((value.startsWith('/') && !value.startsWith('//')) || value.startsWith('#')))
    return true;
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !url.username && !url.password
    );
  } catch {
    return false;
  }
}
export function validateSchema(source: string): string | null {
  if (!source.trim()) return null;
  try {
    const object: unknown = JSON.parse(source);
    if (!object || typeof object !== 'object' || Array.isArray(object))
      return 'JSON-LD must be an object.';
    const data = object as Record<string, unknown>;
    if (
      ![
        'https://schema.org',
        'https://schema.org/',
        'http://schema.org',
        'http://schema.org/',
      ].includes(String(data['@context']))
    )
      return 'Use a Schema.org @context.';
    if ('@graph' in data) {
      if (
        !Array.isArray(data['@graph']) ||
        !data['@graph'].length ||
        !data['@graph'].every((node) => node && typeof node === 'object' && '@type' in node)
      )
        return '@graph must contain typed objects.';
    } else if (!data['@type']) return 'Include @type or @graph.';
    const visit = (node: unknown, depth: number): void => {
      if (depth > 16) throw new Error('JSON-LD exceeds the maximum nesting depth of 16.');
      if (Array.isArray(node)) {
        node.forEach((child) => visit(child, depth + 1));
        return;
      }
      if (node && typeof node === 'object') {
        for (const [key, value] of Object.entries(node)) {
          if (
            key.startsWith('@') &&
            ![
              '@context',
              '@type',
              '@id',
              '@graph',
              '@value',
              '@language',
              '@list',
              '@set',
            ].includes(key)
          )
            throw new Error(`Unsupported JSON-LD keyword: ${key}`);
          if (
            key === '@type' &&
            !(Array.isArray(value) ? value : [value]).every(
              (type) =>
                typeof type === 'string' &&
                /^(?:https?:\/\/schema\.org\/)?[A-Za-z][A-Za-z0-9]*$/.test(type),
            )
          )
            throw new Error('Invalid Schema.org type.');
          if (
            [
              '@id',
              'url',
              'image',
              'contentUrl',
              'thumbnailUrl',
              'sameAs',
              'embedUrl',
              'mainEntityOfPage',
              'logo',
            ].includes(key) &&
            (Array.isArray(value) ? value : [value]).some(
              (url) => typeof url === 'string' && !safeUrl(url),
            )
          )
            throw new Error(`Invalid HTTP(S) URL in ${key}.`);
          visit(value, depth + 1);
        }
      } else if (
        typeof node === 'string' &&
        (/<\s*\/?[A-Za-z!]/.test(node) || /^(?:javascript|data|vbscript|file):/i.test(node.trim()))
      )
        throw new Error('JSON-LD cannot contain markup or executable values.');
    };
    visit(data, 0);
    if (new TextEncoder().encode(JSON.stringify(data)).length > 65536)
      return 'JSON-LD exceeds 64 KiB.';
    return null;
  } catch (error) {
    return error instanceof SyntaxError
      ? 'Enter valid JSON without comments or trailing commas.'
      : error instanceof Error
        ? error.message
        : 'Invalid JSON-LD.';
  }
}
export const articleSchema = z.object({
  title: z.string().trim().min(1, 'A title is required.').max(300),
  slug: z
    .string()
    .trim()
    .max(350)
    .refine(
      (value) => !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
      'Use lowercase letters, digits, and single hyphens.',
    ),
  content_html: z.string().min(1, 'Article content is required.').max(1000000),
  article_type_id: z.string().uuid('Choose an article type.'),
  category_ids: z
    .array(z.string().uuid())
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate categories.'),
  tag_ids: z
    .array(z.string().uuid())
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate tags.'),
  excerpt: z.string().trim().max(10000),
  featured_image: z
    .string()
    .trim()
    .max(2048)
    .refine(
      (value) => !value || safeUrl(value),
      'Enter an absolute HTTP(S) URL without credentials.',
    ),
  featured_image_alt: z.string().trim().max(300),
  meta_title: z.string().trim().max(300),
  meta_description: z.string().trim().max(10000),
  schema: z.string().superRefine((value, context) => {
    const error = validateSchema(value);
    if (error) context.addIssue({ code: 'custom', message: error });
  }),
  is_featured: z.boolean(),
});
export type ArticleFormValues = z.infer<typeof articleSchema>;
export function articleDefaults(article?: Article): ArticleFormValues {
  return {
    title: article?.title ?? '',
    slug: article?.slug ?? '',
    content_html: article?.content_html ?? '<p></p>',
    article_type_id: article?.article_type_id ?? '',
    category_ids: article?.categories.map((c) => c.id) ?? [],
    tag_ids: article?.tags.map((t) => t.id) ?? [],
    excerpt: article?.excerpt ?? '',
    featured_image: article?.featured_image ?? '',
    featured_image_alt: article?.featured_image_alt ?? '',
    meta_title: article?.meta_title ?? '',
    meta_description: article?.meta_description ?? '',
    schema: article?.schema ? JSON.stringify(article.schema, null, 2) : '',
    is_featured: article?.is_featured ?? false,
  };
}
export function articlePayload(values: ArticleFormValues, role: Role): ArticleInput {
  return {
    title: values.title,
    ...(values.slug ? { slug: values.slug } : {}),
    content_html: values.content_html,
    article_type_id: values.article_type_id,
    category_ids: [...new Set(values.category_ids)],
    tag_ids: [...new Set(values.tag_ids)],
    excerpt: nullable(values.excerpt),
    featured_image: nullable(values.featured_image),
    featured_image_alt: nullable(values.featured_image_alt),
    meta_title: nullable(values.meta_title),
    meta_description: nullable(values.meta_description),
    schema: values.schema.trim() ? (JSON.parse(values.schema) as Record<string, unknown>) : null,
    ...(role !== 'author' ? { is_featured: values.is_featured } : {}),
  };
}
export function changedPayload(next: ArticleInput, article: Article): Partial<ArticleInput> {
  const previous = articlePayload(articleDefaults(article), 'admin');
  return Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) =>
        JSON.stringify(value) !== JSON.stringify(previous[key as keyof ArticleInput]),
    ),
  ) as Partial<ArticleInput>;
}
