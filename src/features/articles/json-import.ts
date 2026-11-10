import { z } from 'zod';
import { collectPages, getApiEpoch } from '@/lib/api';
import { classificationsApi } from '@/features/categories/api';
import type { Classification } from '@/types/api';
import { articleSchema, type ArticleFormValues } from './validation';

export const editorialAuthor = 'Ask & Explore Editorial Team';
const name = z.string().trim().min(1).max(150);
const names = z.array(name).max(100);
const keywords = z
  .union([z.string(), z.array(z.string()).transform((values) => values.join('\n'))])
  .pipe(articleSchema.shape.primary_keywords);
export const articleJsonSchema = articleSchema
  .pick({ slug: true, excerpt: true, meta_title: true, meta_description: true })
  .extend({
    primary_keywords: keywords,
    secondary_keywords: keywords,
    article_type: name,
    categories: names,
    tags: names,
  })
  .partial();

const normalize = (value: string) => value.trim().toLowerCase();
function match<T extends { name: string; is_active: boolean }>(
  rows: T[],
  value: string,
  kind: string,
) {
  const found = rows.filter((row) => normalize(row.name) === normalize(value));
  if (found.length > 1)
    throw new Error(`Multiple ${kind} records match "${value}". Use a unique name.`);
  if (found.length && !found[0].is_active) throw new Error(`${kind} "${value}" is inactive.`);
  return found[0];
}

export async function resolveArticleJson(
  input: z.infer<typeof articleJsonSchema>,
  canCreateTags: boolean,
  onTagCreated: (tag: Classification) => void,
): Promise<Partial<ArticleFormValues>> {
  const epoch = getApiEpoch();
  const checkSession = () => {
    if (epoch !== getApiEpoch()) throw new Error('Your session changed. Please try again.');
  };
  const [authors, categories, types, tags] = await Promise.all([
    collectPages<{ id: string; name: string; is_active: boolean }>('/admin/authors', {
      sort: 'name',
    }),
    input.categories ? collectPages<Classification>('/categories', { sort: 'name' }) : [],
    input.article_type ? collectPages<Classification>('/article-types', { sort: 'name' }) : [],
    input.tags
      ? collectPages<Classification>('/tags', {
          sort: 'name',
          ...(canCreateTags ? { include_inactive: true } : {}),
        })
      : [],
  ]);
  checkSession();
  const author = match(authors, editorialAuthor, 'Author');
  if (!author) throw new Error(`Author "${editorialAuthor}" was not found. Add this author first.`);
  const { categories: categoryNames, article_type: typeName, tags: tagNames, ...fields } = input;
  const result: Partial<ArticleFormValues> = { ...fields, author_id: author.id };
  if (categoryNames) {
    result.category_ids = [
      ...new Set(
        categoryNames.map((value) => {
          const category = match(categories, value, 'Category');
          if (!category)
            throw new Error(`Category "${value}" was not found. Choose an existing category name.`);
          return category.id;
        }),
      ),
    ];
  }
  if (typeName) {
    const type = match(types, typeName, 'Article type');
    if (!type)
      throw new Error(
        `Article type "${typeName}" was not found. Choose an existing article type name.`,
      );
    result.article_type_id = type.id;
  }
  // Validate all names and permissions before creating any tags.
  const requestedTags = (tagNames ?? []).filter(
    (value, index, all) =>
      all.findIndex((other) => normalize(other) === normalize(value)) === index,
  );
  const resolvedTags = requestedTags.map((value) => ({
    name: value,
    tag: match(tags, value, 'Tag'),
  }));
  if (!canCreateTags && resolvedTags.some(({ tag }) => !tag))
    throw new Error(
      'Only admins can create missing tags. Use existing tag names or ask an admin to create them.',
    );
  if (tagNames) {
    result.tag_ids = [];
    for (const entry of resolvedTags) {
      checkSession();
      let tag = entry.tag;
      if (!tag) {
        tag = (
          await classificationsApi.save('tags', {
            name: entry.name,
            description: null,
            is_active: true,
          })
        ).data;
        checkSession();
        onTagCreated(tag);
      }
      result.tag_ids.push(tag.id);
    }
  }
  return result;
}
