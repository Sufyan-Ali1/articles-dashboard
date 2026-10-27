import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { ProtectedRoute } from '@/app/layout';
import LoginPage from '@/features/auth/login-page';
import EditorPage from './editor-page';
import { renderRoutes } from '@/test/render';
import { base, server } from '@/test/server';
import { admin, article, classification, page } from '@/test/fixtures';

const tag = { ...classification, name: 'Artificial intelligence', slug: 'artificial-intelligence' };
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
  await screen.findByLabelText('Search tags');
  return user;
}
it('reuses an existing tag and hides creation for case-insensitive matches', async () => {
  server.use(http.get(`${base}/tags`, () => HttpResponse.json(page([tag]))));
  const user = await mount();
  await screen.findByLabelText(tag.name);
  await user.type(screen.getByLabelText('Search tags'), 'ARTIFICIAL INTELLIGENCE');
  expect(screen.queryByRole('button', { name: /Add tag/ })).not.toBeInTheDocument();
  await user.click(screen.getByLabelText(tag.name));
  expect(screen.getByLabelText(tag.name)).toBeChecked();
});
it('creates from the plus icon, selects the result, and saves it with the article', async () => {
  let tags: (typeof tag)[] = [];
  let saved = false;
  server.use(
    http.get(`${base}/tags`, () => HttpResponse.json(page(tags))),
    http.post(`${base}/tags`, async ({ request }) => {
      expect(await request.json()).toEqual({ name: tag.name, description: null, is_active: true });
      tags = [tag];
      return HttpResponse.json({ data: tag }, { status: 201 });
    }),
    http.patch(`${base}/articles/:id`, async ({ request }) => {
      expect(await request.json()).toEqual({ tag_ids: [tag.id] });
      saved = true;
      return HttpResponse.json({ data: { ...article, tags: [tag] } });
    }),
  );
  const user = await mount();
  await user.type(screen.getByLabelText('Search tags'), tag.name);
  await user.click(await screen.findByRole('button', { name: `Add tag "${tag.name}"` }));
  await waitFor(() => expect(screen.getByLabelText(tag.name)).toBeChecked());
  expect(screen.getByLabelText('Search tags')).toHaveValue('');
  await user.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(saved).toBe(true));
});
it('shows creation failures without selecting a nonexistent tag', async () => {
  server.use(
    http.post(`${base}/tags`, () =>
      HttpResponse.json(
        {
          error: {
            code: 'conflict',
            message: 'Tag already exists',
            request_id: 'test-conflict',
          },
        },
        { status: 409 },
      ),
    ),
  );
  const user = await mount();
  await user.type(screen.getByLabelText('Search tags'), 'New tag');
  await user.keyboard('{Enter}');
  expect(await screen.findByText('Tag already exists')).toBeInTheDocument();
  expect(screen.getByLabelText('Search tags')).toHaveValue('New tag');
  expect(screen.queryByLabelText('New tag')).not.toBeInTheDocument();
});
