import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { ProtectedRoute } from '@/app/layout';
import LoginPage from '@/features/auth/login-page';
import ClassificationPage from '@/features/categories/classification-page';
import EditorPage from '@/features/articles/editor-page';
import UsersPage from '@/features/users/users-page';
import { RequestDetailPage } from '@/features/article-requests/requests-page';
import { renderRoutes } from './render';
import { base, server } from './server';
import { admin, article, classification, page } from './fixtures';
import type { ArticleRequest, Classification, User } from '@/types/api';

async function authenticate() {
  const interaction = userEvent.setup();
  await interaction.type(await screen.findByLabelText('Email address'), admin.email);
  await interaction.type(screen.getByLabelText('Password', { exact: true }), 'a-secure-password');
  await interaction.click(screen.getByRole('button', { name: 'Sign in' }));
  return interaction;
}
function mount(path: string, element: React.ReactNode) {
  return renderRoutes(
    [
      { path: '/login', element: <LoginPage /> },
      { element: <ProtectedRoute />, children: [{ path, element }] },
    ],
    path.replace(':id', article.id),
  );
}
describe('contract-based CRUD workflows', () => {
  it('does not rewrite unsupported backend HTML when saving title-only edits', async () => {
    const existing = {
      ...article,
      content_html:
        '<figure><img src="/image.jpg"><figcaption>Original caption</figcaption></figure>',
    };
    let body: unknown;
    server.use(
      http.get(`${base}/admin/articles/:id`, () => HttpResponse.json({ data: existing })),
      http.patch(`${base}/articles/:id`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ data: { ...existing, title: 'A new title' } });
      }),
    );
    mount('/articles/:id/edit', <EditorPage />);
    const interaction = await authenticate();
    const title = await screen.findByLabelText('Article title');
    expect(screen.getByLabelText('Article content HTML')).toHaveValue(existing.content_html);
    await interaction.clear(title);
    await interaction.type(title, 'A new title');
    await interaction.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(body).toEqual({ title: 'A new title' }));
  });
  it('creates and deletes a tag using real screen controls and confirmations', async () => {
    let records: Classification[] = [];
    server.use(
      http.get(`${base}/tags`, () => HttpResponse.json(page(records))),
      http.post(`${base}/tags`, async ({ request }) => {
        const input = (await request.json()) as Record<string, unknown>;
        expect(input).toEqual({ name: 'Hardware', description: null, is_active: true });
        records = [{ ...classification, name: 'Hardware', slug: 'hardware' }];
        return HttpResponse.json({ data: records[0] }, { status: 201 });
      }),
      http.delete(`${base}/tags/:id`, () => {
        records = [];
        return new HttpResponse(null, { status: 204 });
      }),
    );
    mount('/tags', <ClassificationPage kind="tags" />);
    const interaction = await authenticate();
    await interaction.click((await screen.findAllByRole('button', { name: 'New tag' }))[0]);
    await interaction.type(screen.getByLabelText('Name', { exact: true }), 'Hardware');
    await interaction.click(screen.getByRole('button', { name: 'Create tag' }));
    expect(await screen.findByText('Hardware')).toBeInTheDocument();
    await interaction.click(screen.getByRole('button', { name: 'Delete Hardware' }));
    expect(records).toHaveLength(1);
    await interaction.click(screen.getByRole('button', { name: /^Confirm$/ }));
    await waitFor(() => expect(screen.queryByText('Hardware')).not.toBeInTheDocument());
    expect(records).toHaveLength(0);
  });
  it('keeps a category edit open when the backend detects a cycle', async () => {
    server.use(
      http.get(`${base}/categories`, () =>
        HttpResponse.json(page([{ ...classification, name: 'Hardware' }])),
      ),
      http.patch(`${base}/categories/:id`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'category_cycle',
              message: 'Category hierarchy cannot contain cycles',
              request_id: 'cycle-1',
            },
          },
          { status: 409 },
        ),
      ),
    );
    mount('/categories', <ClassificationPage kind="categories" />);
    const interaction = await authenticate();
    await interaction.click(await screen.findByRole('button', { name: 'Edit Hardware' }));
    await interaction.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Category hierarchy cannot contain cycles')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('saves the article before publishing and retains a successful draft if publication fails', async () => {
    const actions: string[] = [];
    server.use(
      http.patch(`${base}/articles/:id`, async ({ request }) => {
        actions.push('save');
        const input = await request.json();
        expect(input).toEqual({ title: 'Updated article title' });
        return HttpResponse.json({ data: { ...article, title: 'Updated article title' } });
      }),
      http.post(`${base}/articles/:id/publish`, () => {
        actions.push('publish');
        return HttpResponse.json(
          {
            error: {
              code: 'publication_invalid',
              message: 'Publication requires an active article type',
              request_id: 'publish-1',
            },
          },
          { status: 422 },
        );
      }),
    );
    mount('/articles/:id/edit', <EditorPage />);
    const interaction = await authenticate();
    const title = await screen.findByLabelText('Article title');
    await interaction.clear(title);
    await interaction.type(title, 'Updated article title');
    await interaction.click(screen.getByRole('button', { name: 'Save & publish' }));
    expect(
      await screen.findByText('Publication requires an active article type'),
    ).toBeInTheDocument();
    expect(actions).toEqual(['save', 'publish']);
    expect(screen.getByLabelText('Article title')).toHaveValue('Updated article title');
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });
  it('creates staff accounts without leaking password fields into the list', async () => {
    let records: User[] = [admin];
    server.use(
      http.get(`${base}/users`, () => HttpResponse.json(page(records))),
      http.post(`${base}/users`, async ({ request }) => {
        const input = (await request.json()) as {
          name: string;
          email: string;
          role: User['role'];
          password: string;
        };
        expect(input.password).toBe('strong-password-123');
        records = [
          ...records,
          {
            ...admin,
            id: '10000000-0000-4000-8000-000000000009',
            name: input.name,
            email: input.email,
            role: input.role,
          },
        ];
        return HttpResponse.json({ data: records[1] }, { status: 201 });
      }),
    );
    mount('/users', <UsersPage />);
    const interaction = await authenticate();
    await interaction.click(await screen.findByRole('button', { name: 'Add team member' }));
    const dialog = screen.getByRole('dialog');
    await interaction.type(within(dialog).getByLabelText('Full name'), 'Sam Writer');
    await interaction.type(within(dialog).getByLabelText('Email address'), 'sam@example.test');
    await interaction.type(
      within(dialog).getByLabelText('Password', { exact: true }),
      'strong-password-123',
    );
    await interaction.click(within(dialog).getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Sam Writer')).toBeInTheDocument();
    expect(screen.queryByText('strong-password-123')).not.toBeInTheDocument();
  });
  it('updates request review fields without mutating submission or reviewer identity', async () => {
    let request: ArticleRequest = {
      id: article.id,
      topic: 'A reader topic',
      description: 'Original submission',
      name: 'Reader',
      email: null,
      status: 'pending',
      admin_notes: null,
      reviewed_by: null,
      created_at: article.created_at,
      updated_at: article.updated_at,
    };
    server.use(
      http.get(`${base}/admin/article-requests/:id`, () => HttpResponse.json({ data: request })),
      http.patch(`${base}/admin/article-requests/:id`, async ({ request: incoming }) => {
        const body = await incoming.json();
        expect(body).toEqual({ status: 'accepted', admin_notes: 'Useful suggestion' });
        request = { ...request, ...(body as object), reviewed_by: admin.id };
        return HttpResponse.json({ data: request });
      }),
    );
    mount('/article-requests/:id', <RequestDetailPage />);
    const interaction = await authenticate();
    await screen.findByText('A reader topic');
    await interaction.selectOptions(screen.getByLabelText('Status', { exact: true }), 'accepted');
    await interaction.type(screen.getByLabelText('Admin notes'), 'Useful suggestion');
    await interaction.click(screen.getByRole('button', { name: 'Save review' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Status', { exact: true })).toHaveValue('accepted'),
    );
    expect(screen.getByText('Original submission')).toBeInTheDocument();
  });
});
