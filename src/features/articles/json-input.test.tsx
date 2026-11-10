import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, useWatch } from 'react-hook-form';
import { ArticleJsonInput } from './json-input';
import { articleDefaults, type ArticleFormValues } from './validation';

function Harness({ reviewer = true, disabled = false }) {
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
        throw new Error('Add must not submit the article');
      }}
    >
      <ArticleJsonInput form={form} reviewer={reviewer} disabled={disabled} />
      <div data-testid="values">{JSON.stringify(values)}</div>
      <div data-testid="dirty">{String(form.formState.isDirty)}</div>
    </form>
  );
}
const values = () => JSON.parse(screen.getByTestId('values').textContent!);
async function add(source: string) {
  fireEvent.change(screen.getByLabelText('Article data (JSON)'), { target: { value: source } });
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
}

it('updates supplied fields, preserves omitted and excluded fields, and supports repeated imports', async () => {
  render(<Harness />);
  const initial = values();
  const id = '20000000-0000-4000-8000-000000000001';
  const patch = {
    slug: 'imported-slug',
    excerpt: 'New excerpt',
    meta_description: 'Description',
    author_id: id,
    article_type_id: id,
    category_ids: [id],
    tag_ids: [id],
    primary_keywords: ['first', 'second'],
    secondary_keywords: 'third\nfourth',
    is_featured: false,
  };
  await add(
    JSON.stringify({
      ...patch,
      title: 'Ignored title',
      content_html: 'Ignored content',
      featured_image: 'https://example.com/ignored.jpg',
      featured_image_alt: 'Ignored alt',
      unknown: 'ignored',
    }),
  );
  expect(values()).toEqual({ ...initial, ...patch, primary_keywords: 'first\nsecond' });
  expect(screen.getByTestId('dirty')).toHaveTextContent('true');
  expect(screen.getByRole('status')).toHaveTextContent('JSON values added');
  await add('{"excerpt":"Updated again","tag_ids":[],"meta_title":""}');
  expect(values()).toEqual({
    ...initial,
    ...patch,
    primary_keywords: 'first\nsecond',
    excerpt: 'Updated again',
    tag_ids: [],
    meta_title: '',
  });
});

it.each([
  ['{broken', 'Enter valid JSON'],
  ['null', 'JSON:'],
  ['[]', 'JSON:'],
  ['{"excerpt":"Would change","tag_ids":"invalid"}', 'tag_ids:'],
  ['{"excerpt":"Would change","is_featured":"false"}', 'is_featured:'],
  ['{"primary_keywords":[123]}', 'primary_keywords'],
  ['{"title":"Ignored"}', 'No supported fields'],
])('leaves the form unchanged for invalid or unsupported input: %s', async (source, message) => {
  render(<Harness />);
  const initial = values();
  await add(source);
  expect(screen.getByRole('alert')).toHaveTextContent(message);
  expect(values()).toEqual(initial);
  expect(screen.getByTestId('dirty')).toHaveTextContent('false');
});

it('respects reviewer permissions', async () => {
  render(<Harness reviewer={false} />);
  await add('{"excerpt":"Updated","is_featured":false}');
  expect(values()).toMatchObject({ excerpt: 'Updated', is_featured: true });
});

it('shows all supported keys in the placeholder and rejects the unchanged example', async () => {
  render(<Harness />);
  const initial = values();
  const example = screen.getByLabelText('Article data (JSON)').getAttribute('placeholder')!;
  expect(Object.keys(JSON.parse(example))).toEqual([
    'slug',
    'excerpt',
    'meta_title',
    'meta_description',
    'primary_keywords',
    'secondary_keywords',
    'author_id',
    'article_type_id',
    'category_ids',
    'tag_ids',
    'is_featured',
  ]);
  await add(example);
  expect(screen.getByRole('alert')).toHaveTextContent('Add your own values');
  expect(values()).toEqual(initial);
});

it('rejects remaining example values even after some fields have been replaced', async () => {
  render(<Harness />);
  const initial = values();
  await add(
    JSON.stringify({ excerpt: 'My real summary', primary_keywords: ['Your primary keyword'] }),
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Add your own values for: primary_keywords');
  expect(values()).toEqual(initial);
});

it('disables the input and button while the form is disabled', () => {
  render(<Harness disabled />);
  expect(screen.getByLabelText('Article data (JSON)')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
});
