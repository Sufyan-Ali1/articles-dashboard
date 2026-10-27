import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { ProtectedRoute } from '@/app/layout';
import LoginPage from '@/features/auth/login-page';
import EditorPage from './editor-page';
import { renderRoutes } from '@/test/render';
import { base, server } from '@/test/server';
import { admin, article, classification, page } from '@/test/fixtures';

const parent = { ...classification, name: 'Technology', slug: 'technology' };
const category = {
  ...classification,
  id: '20000000-0000-4000-8000-000000000002',
  name: 'AI',
  slug: 'ai',
  parent_id: parent.id,
};
async function mount() {
  renderRoutes(
    [
      { path: '/login', element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [{ path: '/articles/:id/edit', element: <EditorPage /> }],
      },
    ],
    `/articles/${article.id}/edit`,
  );
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email address'), admin.email);
  await user.type(screen.getByLabelText('Password', { exact: true }), 'a-secure-password');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByLabelText('Search categories');
  return user;
}
it('selects an existing category without offering duplicate creation', async () => {
  server.use(http.get(`${base}/categories`, () => HttpResponse.json(page([parent]))));
  const user = await mount();
  await user.type(screen.getByLabelText('Search categories'), 'TECHNOLOGY');
  expect(screen.queryByRole('button', { name: /Add category/ })).not.toBeInTheDocument();
  await user.click(screen.getByLabelText(parent.name));
  expect(screen.getByLabelText(parent.name)).toBeChecked();
});
it('opens a prefilled dialog, creates a child category, and saves its article association', async () => {
  let records = [parent];
  let saved = false;
  server.use(
    http.get(`${base}/categories`, () => HttpResponse.json(page(records))),
    http.post(`${base}/categories`, async ({ request }) => {
      expect(await request.json()).toEqual({
        name: 'AI',
        slug: 'ai',
        description: 'AI guides',
        is_active: true,
        parent_id: parent.id,
      });
      records = [parent, category];
      return HttpResponse.json({ data: category }, { status: 201 });
    }),
    http.patch(`${base}/articles/:id`, async ({ request }) => {
      expect(await request.json()).toEqual({ category_ids: [category.id] });
      saved = true;
      return HttpResponse.json({ data: { ...article, categories: [category] } });
    }),
  );
  const user = await mount();
  await user.type(screen.getByLabelText('Search categories'), 'AI');
  await user.click(await screen.findByRole('button', { name: 'Add category "AI"' }));
  const dialog = within(screen.getByRole('dialog', { name: 'Create category' }));
  expect(dialog.getByLabelText('Name')).toHaveValue('AI');
  await user.type(dialog.getByLabelText('Slug'), 'ai');
  await user.type(dialog.getByLabelText('Description'), 'AI guides');
  await user.selectOptions(dialog.getByLabelText('Parent category'), parent.id);
  await user.click(dialog.getByRole('button', { name: 'Create category' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByLabelText(category.name)).toBeChecked();
  expect(screen.getByLabelText('Search categories')).toHaveValue('');
  expect(saved).toBe(false);
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(saved).toBe(true));
});
it('allows cancelling without creating or selecting a category', async () => {
  const user = await mount();
  await user.type(screen.getByLabelText('Search categories'), 'New category');
  await user.keyboard('{Enter}');
  const dialog = within(await screen.findByRole('dialog', { name: 'Create category' }));
  await user.click(dialog.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Search categories')).toHaveValue('New category');
  expect(screen.queryByLabelText('New category')).not.toBeInTheDocument();
});
it('preserves entered details and shows the error when creation fails', async () => {
  server.use(
    http.post(`${base}/categories`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'conflict',
            message: 'Category already exists',
            request_id: 'category-conflict',
          },
        },
        { status: 409 },
      ),
    ),
  );
  const user = await mount();
  await user.type(screen.getByLabelText('Search categories'), 'New category');
  await user.click(await screen.findByRole('button', { name: 'Add category "New category"' }));
  const dialog = within(screen.getByRole('dialog'));
  await user.click(dialog.getByRole('button', { name: 'Create category' }));
  expect(await dialog.findByText('Category already exists')).toBeInTheDocument();
  expect(dialog.getByLabelText('Name')).toHaveValue('New category');
});
