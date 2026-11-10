import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, useWatch } from 'react-hook-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { base, server } from '@/test/server';
import { classification, page } from '@/test/fixtures';
import { ArticleJsonInput } from './json-input';
import { editorialAuthor } from './json-import';
import { articleDefaults, type ArticleFormValues } from './validation';

const authorId = '20000000-0000-4000-8000-000000000001';
const existingTag = {
  ...classification,
  name: 'Existing tag',
  id: '20000000-0000-4000-8000-000000000002',
};
const newTag = { ...classification, name: 'New tag', id: '20000000-0000-4000-8000-000000000003' };
beforeEach(() => {
  server.use(
    http.get(`${base}/admin/authors`, () =>
      HttpResponse.json(page([{ id: authorId, name: editorialAuthor, is_active: true }])),
    ),
    http.get(`${base}/categories`, () =>
      HttpResponse.json(page([{ ...classification, name: 'Technology' }])),
    ),
    http.get(`${base}/article-types`, () =>
      HttpResponse.json(page([{ ...classification, name: 'Guide' }])),
    ),
    http.get(`${base}/tags`, () => HttpResponse.json(page([existingTag]))),
  );
});
function Harness({ canCreateTags = true, disabled = false }) {
  const form = useForm<ArticleFormValues>({
    defaultValues: {
      ...articleDefaults(),
      title: 'Original title',
      excerpt: 'Original excerpt',
      meta_title: 'Original meta title',
      featured_image: 'https://example.com/image.jpg',
      featured_image_alt: 'Original alt text',
      is_featured: true,
    },
  });
  const values = useWatch({ control: form.control });
  return (
    <form
      onSubmit={() => {
        throw new Error('Add must not submit');
      }}
    >
      <ArticleJsonInput form={form} canCreateTags={canCreateTags} disabled={disabled} />
      <div data-testid="values">{JSON.stringify(values)}</div>
    </form>
  );
}
function mount(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(['classifications', 'test-user', 'admin', 'tags', 'all'], [existingTag]);
  render(
    <QueryClientProvider client={client}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
  return client;
}
const values = () => JSON.parse(screen.getByTestId('values').textContent!);
async function add(source: string) {
  fireEvent.change(screen.getByLabelText('Article data (JSON)'), { target: { value: source } });
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
}
async function success() {
  await screen.findByText('JSON values added to the form. Review them before saving.');
}

it('resolves names, fixes the author, ignores IDs and featured status, and preserves omitted and excluded values', async () => {
  mount();
  const initial = values();
  await add(
    JSON.stringify({
      excerpt: 'New excerpt',
      article_type: ' guide ',
      categories: ['TECHNOLOGY'],
      tags: ['existing TAG', 'Existing tag'],
      primary_keywords: ['first', 'second'],
      is_featured: false,
      author_id: 'ignored',
      category_ids: ['ignored'],
      article_type_id: 'ignored',
      tag_ids: ['ignored'],
      title: 'Ignored',
      content_html: 'Ignored',
      featured_image: 'Ignored',
      featured_image_alt: 'Ignored',
    }),
  );
  await success();
  expect(values()).toEqual({
    ...initial,
    excerpt: 'New excerpt',
    article_type_id: classification.id,
    author_id: authorId,
    category_ids: [classification.id],
    tag_ids: [existingTag.id],
    primary_keywords: 'first\nsecond',
  });
  await add('{"excerpt":"Updated again","tags":[],"meta_title":""}');
  await success();
  expect(values()).toMatchObject({
    excerpt: 'Updated again',
    tag_ids: [],
    meta_title: '',
    category_ids: [classification.id],
  });
});

it('creates only missing tags once and updates the picker cache', async () => {
  let creates = 0;
  server.use(
    http.post(`${base}/tags`, async ({ request }) => {
      creates++;
      expect(await request.json()).toEqual({ name: 'New tag', description: null, is_active: true });
      return HttpResponse.json({ data: newTag }, { status: 201 });
    }),
  );
  const client = mount();
  await add('{"tags":["Existing tag","New tag","NEW TAG"]}');
  await success();
  expect(creates).toBe(1);
  expect(values().tag_ids).toEqual([existingTag.id, newTag.id]);
  expect(
    client.getQueryData(['classifications', 'test-user', 'admin', 'tags', 'all']),
  ).toContainEqual(newTag);
});

it.each([
  ['{broken', 'Enter valid JSON'],
  ['null', 'JSON:'],
  ['[]', 'JSON:'],
  ['{"categories":"Technology"}', 'categories:'],
  ['{"tags":[123]}', 'tags'],
  ['{"categories":["Unknown"],"tags":["New tag"]}', 'Category "Unknown" was not found'],
  ['{"article_type":"Unknown","tags":["New tag"]}', 'Article type "Unknown" was not found'],
  ['{"title":"Ignored","is_featured":false,"author_id":"ignored"}', 'No supported fields'],
])('does not change the form or create tags for invalid input: %s', async (source, error) => {
  let creates = 0;
  server.use(
    http.post(`${base}/tags`, () => {
      creates++;
      return HttpResponse.json({ data: newTag });
    }),
  );
  mount();
  const initial = values();
  await add(source);
  expect(await screen.findByRole('alert')).toHaveTextContent(error);
  expect(values()).toEqual(initial);
  expect(creates).toBe(0);
});

it('requires an existing editorial author', async () => {
  server.use(http.get(`${base}/admin/authors`, () => HttpResponse.json(page([]))));
  mount();
  const initial = values();
  await add('{"excerpt":"New summary","tags":["New tag"]}');
  expect(await screen.findByRole('alert')).toHaveTextContent(
    `Author "${editorialAuthor}" was not found`,
  );
  expect(values()).toEqual(initial);
});

it('keeps the form unchanged if tag creation fails', async () => {
  server.use(
    http.post(`${base}/tags`, () =>
      HttpResponse.json(
        { error: { code: 'failed', message: 'Cannot create tag' } },
        { status: 500 },
      ),
    ),
  );
  mount();
  const initial = values();
  await add('{"excerpt":"New summary","tags":["New tag"]}');
  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot create tag');
  expect(values()).toEqual(initial);
});

it('respects tag creation permissions', async () => {
  mount({ canCreateTags: false });
  await add('{"tags":["New tag"]}');
  expect(await screen.findByRole('alert')).toHaveTextContent('Only admins can create missing tags');
  await add('{"tags":["Existing tag"]}');
  await success();
  expect(values().tag_ids).toEqual([existingTag.id]);
});

it('shows name examples without IDs or featured status and rejects unchanged examples', async () => {
  mount();
  const initial = values();
  const example = screen.getByLabelText('Article data (JSON)').getAttribute('placeholder')!;
  expect(Object.keys(JSON.parse(example))).toEqual([
    'slug',
    'excerpt',
    'meta_title',
    'meta_description',
    'primary_keywords',
    'secondary_keywords',
    'article_type',
    'categories',
    'tags',
  ]);
  await add(example);
  expect(await screen.findByRole('alert')).toHaveTextContent('Add your own values');
  expect(values()).toEqual(initial);
  await add('{"excerpt":"Real summary","tags":["Your tag name"]}');
  expect(await screen.findByRole('alert')).toHaveTextContent('Add your own values for: tags');
  expect(values()).toEqual(initial);
});

it('disables the input and button while the form is disabled', () => {
  mount({ disabled: true });
  expect(screen.getByLabelText('Article data (JSON)')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
});
