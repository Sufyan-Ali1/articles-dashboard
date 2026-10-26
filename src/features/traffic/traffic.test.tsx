import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { ProtectedRoute } from '@/app/layout';
import { allowedPage } from '@/lib/permissions';
import LoginPage from '@/features/auth/login-page';
import SourcesPage from './sources-page';
import { TrafficPanel } from './traffic-panel';
import { ArticleLinks } from './article-links';
import { renderRoutes } from '@/test/render';
import { base, server } from '@/test/server';
import { admin, article, editor, page } from '@/test/fixtures';
import type { TrafficSource } from './api';
const linkedin: TrafficSource = {
  id: '40000000-0000-4000-8000-000000000001',
  name: 'LinkedIn',
  slug: 'linkedin',
  referrer_domains: ['linkedin.com'],
  is_active: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};
const instagram = {
  ...linkedin,
  id: '40000000-0000-4000-8000-000000000002',
  name: 'Instagram',
  slug: 'instagram',
  referrer_domains: ['instagram.com'],
};
function report(sources = [linkedin, instagram]) {
  return {
    views: 7,
    sessions: 5,
    lifetime_views: 10,
    legacy_views: 3,
    unassigned_views: 0,
    unassigned_sessions: 0,
    sources: sources.map((source) => ({
      ...source,
      views: source.slug === 'linkedin' ? 7 : 0,
      sessions: source.slug === 'linkedin' ? 5 : 0,
    })),
  };
}
function mount(element: React.ReactNode) {
  return renderRoutes(
    [
      { path: '/login', element: <LoginPage /> },
      {
        element: <ProtectedRoute roles={['admin', 'editor']} />,
        children: [{ path: '/traffic-sources', element }],
      },
    ],
    '/traffic-sources',
  );
}
async function signIn() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email address'), admin.email);
  await user.type(screen.getByLabelText('Password', { exact: true }), 'a-secure-password');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}
beforeEach(() => {
  server.use(
    http.get(`${base}/admin/analytics/sources`, () => HttpResponse.json({ data: report() })),
  );
});
describe('traffic sources', () => {
  it('shows configured zero-count cards and respects private page permissions', async () => {
    mount(<SourcesPage />);
    await signIn();
    const cards = await screen.findByLabelText('Traffic source cards');
    const instagramCard = within(cards)
      .getByRole('heading', { name: 'Instagram' })
      .closest('section')!;
    expect(within(instagramCard).getAllByText('0')).toHaveLength(2);
    expect(within(cards).getByRole('heading', { name: 'LinkedIn' })).toBeInTheDocument();
    expect(await screen.findByRole('table', { name: 'Traffic sources' })).toBeInTheDocument();
    expect(allowedPage('author', 'traffic-sources')).toBe(false);
    expect(allowedPage('editor', 'traffic-sources')).toBe(true);
  });
  it('creates a source and immediately displays its directory row and card', async () => {
    const records = [linkedin];
    server.use(
      http.get(`${base}/admin/analytics/sources`, () =>
        HttpResponse.json({ data: report(records) }),
      ),
      http.post(`${base}/admin/traffic-sources`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toEqual({ name: 'Reddit', slug: 'reddit', referrer_domains: ['reddit.com'] });
        const record = {
          ...instagram,
          name: 'Reddit',
          slug: 'reddit',
          referrer_domains: ['reddit.com'],
        };
        records.push(record);
        return HttpResponse.json({ data: record }, { status: 201 });
      }),
    );
    mount(<SourcesPage />);
    const user = await signIn();
    await user.click(await screen.findByRole('button', { name: 'New source' }));
    await user.type(screen.getByLabelText('Source name'), 'Reddit');
    await user.type(screen.getByLabelText('Referrer domains'), 'reddit.com');
    await user.click(screen.getByRole('button', { name: 'Create source' }));
    const table = await screen.findByRole('table', { name: 'Traffic sources' });
    expect(await within(table).findByText('Reddit')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('keeps failed deletion visible and explains how to preserve history', async () => {
    server.use(
      http.delete(`${base}/admin/traffic-sources/:id`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'source_in_use',
              message: 'This source has recorded visits. Deactivate it to preserve attribution.',
            },
          },
          { status: 409 },
        ),
      ),
    );
    mount(<SourcesPage />);
    const user = await signIn();
    await user.click(await screen.findByRole('button', { name: 'Delete LinkedIn' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Deactivate it to preserve attribution',
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });
  it('allows editors to inspect source metrics without management controls', async () => {
    server.use(http.get(`${base}/auth/me`, () => HttpResponse.json({ data: editor })));
    mount(<SourcesPage />);
    await signIn();
    expect(await screen.findByRole('table', { name: 'Traffic sources' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New source' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete LinkedIn' })).not.toBeInTheDocument();
  });
  it('passes the exact article filter and range for article-level counts', async () => {
    const requests: URL[] = [];
    server.use(
      http.get(`${base}/admin/analytics/sources`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({ data: report() });
      }),
    );
    mount(<TrafficPanel articleId={article.id} />);
    const user = await signIn();
    await screen.findByLabelText('Traffic source cards');
    expect(requests[0].searchParams.get('article_id')).toBe(article.id);
    await user.selectOptions(screen.getByLabelText('Period'), '7');
    await waitFor(() => expect(requests.at(-1)?.searchParams.has('start')).toBe(true));
    expect(requests.at(-1)?.searchParams.get('article_id')).toBe(article.id);
  });
  it('shows unavailable instead of zero counts after an API failure', async () => {
    server.use(
      http.get(`${base}/admin/analytics/sources`, () =>
        HttpResponse.json({ error: { message: 'Analytics unavailable' } }, { status: 503 }),
      ),
    );
    mount(<TrafficPanel />);
    await signIn();
    expect(await screen.findByRole('alert')).toHaveTextContent('Analytics unavailable');
    expect(screen.queryByLabelText('Traffic source cards')).not.toBeInTheDocument();
  });
  it('creates an article tracking link with the selected managed source', async () => {
    let links: object[] = [];
    server.use(
      http.get(`${base}/admin/traffic-sources`, () => HttpResponse.json(page([linkedin]))),
      http.get(`${base}/admin/tracking-links`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('article_id')).toBe(article.id);
        return HttpResponse.json(page(links));
      }),
      http.post(`${base}/admin/tracking-links`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body.article_id).toBe(article.id);
        expect(body.source_id).toBe(linkedin.id);
        links = [
          {
            ...body,
            id: 'link-01',
            source: 'linkedin',
            is_active: true,
            campaign: null,
            content: null,
            created_at: linkedin.created_at,
          },
        ];
        return HttpResponse.json({ data: links[0] }, { status: 201 });
      }),
    );
    mount(<ArticleLinks articleId={article.id} slug={article.slug} published />);
    const user = await signIn();
    await user.click(await screen.findByRole('button', { name: 'New tracking link' }));
    await user.selectOptions(screen.getByLabelText('Traffic source'), linkedin.id);
    await user.clear(screen.getByLabelText('Link code'));
    await user.type(screen.getByLabelText('Link code'), 'linkedin-comment-01');
    await user.click(screen.getByRole('button', { name: 'Create tracking link' }));
    expect(
      await screen.findByText('https://askandexplore.com/r/linkedin-comment-01'),
    ).toBeInTheDocument();
  });
});
