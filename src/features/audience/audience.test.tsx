import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import Layout, { ProtectedRoute } from '@/app/layout';
import { allowedPage } from '@/lib/permissions';
import { renderRoutes } from '@/test/render';
import { base, server } from '@/test/server';
import { admin, author, editor } from '@/test/fixtures';
import AudiencePage, { ContactDetailPage } from './audience-page';
import { AudienceOverview } from './audience-overview';
import type { ContactMessage, Subscriber } from './api';

const subscriber: Subscriber = {
  id: 'subscriber-1',
  email: 'reader@example.test',
  created_at: '2026-10-01T10:00:00Z',
};
const message: ContactMessage = {
  ...subscriber,
  id: 'message-1',
  name: 'A reader',
  reason: 'correction',
  article_url: 'https://example.test/article',
  message: 'Please correct this passage.\nHere is the full context.',
};
function result<T>(data: T[], page = 1, total = data.length) {
  return { data, meta: { page, page_size: 20, total, pages: Math.ceil(total / 20) } };
}
function mount(initial: string) {
  return renderRoutes(
    [
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <Layout />,
            children: [
              {
                element: <ProtectedRoute roles={['admin']} />,
                children: [
                  { path: '/subscribers', element: <AudiencePage kind="subscribers" /> },
                  { path: '/contact-messages', element: <AudiencePage kind="messages" /> },
                  { path: '/contact-messages/:id', element: <ContactDetailPage /> },
                  { path: '/dashboard', element: <AudienceOverview /> },
                ],
              },
            ],
          },
        ],
      },
    ],
    initial,
  );
}
beforeEach(() => {
  server.use(
    http.post(`${base}/auth/refresh`, () =>
      HttpResponse.json({
        data: { access_token: 'test-token', token_type: 'bearer', expires_in: 1800 },
      }),
    ),
    http.get(`${base}/admin/subscriptions`, () => HttpResponse.json(result([subscriber]))),
    http.get(`${base}/admin/contact-messages`, () => HttpResponse.json(result([message]))),
    http.get(`${base}/admin/contact-messages/:id`, () => HttpResponse.json({ data: message })),
  );
});
describe('audience screens', () => {
  it('lists subscribers and sends supported search, sort, and pagination parameters', async () => {
    const requests: URL[] = [];
    server.use(
      http.get(`${base}/admin/subscriptions`, ({ request }) => {
        const url = new URL(request.url);
        requests.push(url);
        return HttpResponse.json(
          result([subscriber], Number(url.searchParams.get('page') || 1), 21),
        );
      }),
    );
    mount('/subscribers');
    const user = userEvent.setup();
    expect(await screen.findByRole('table', { name: 'Subscribers' })).toHaveTextContent(
      subscriber.email,
    );
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('page')).toBe('2'));
    await user.type(screen.getByLabelText('Search subscriber emails…'), 'reader');
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('search')).toBe('reader'));
    expect(requests.at(-1)?.searchParams.get('page')).toBe('1');
    await user.selectOptions(screen.getByLabelText('Sort subscribers'), 'email');
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('sort')).toBe('email'));
  });
  it('opens complete message details including sender, reason, and related article', async () => {
    mount('/contact-messages');
    const user = userEvent.setup();
    expect(await screen.findByRole('table', { name: 'Contact messages' })).toHaveTextContent(
      'Correction',
    );
    await user.click(screen.getByRole('link', { name: 'Read message' }));
    expect(await screen.findByText(message.article_url!)).toBeInTheDocument();
    expect(
      screen.getByText(message.message, { exact: true, normalizer: (value) => value }),
    ).toBeInTheDocument();
    expect(screen.getByText(message.email)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'All messages' }));
    expect(await screen.findByRole('table', { name: 'Contact messages' })).toBeInTheDocument();
  });
  it('shows an empty state for searches with no matches', async () => {
    server.use(http.get(`${base}/admin/contact-messages`, () => HttpResponse.json(result([]))));
    mount('/contact-messages?search=missing');
    expect(await screen.findByText('No contact messages found')).toBeInTheDocument();
    expect(screen.getByText('Try another search or clear your filters.')).toBeInTheDocument();
  });
  it('shows API errors and allows retry without presenting an empty list', async () => {
    server.use(
      http.get(`${base}/admin/subscriptions`, () =>
        HttpResponse.json({ error: { message: 'Subscribers unavailable' } }, { status: 503 }),
      ),
    );
    mount('/subscribers');
    expect(await screen.findByRole('alert')).toHaveTextContent('Subscribers unavailable');
    expect(screen.queryByText('No subscribers found')).not.toBeInTheDocument();
    server.use(
      http.get(`${base}/admin/subscriptions`, () => HttpResponse.json(result([subscriber]))),
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table', { name: 'Subscribers' })).toHaveTextContent(
      subscriber.email,
    );
  });
  it.each([editor, author])(
    'blocks $role from private reader data and navigation',
    async (account) => {
      let calls = 0;
      server.use(
        http.get(`${base}/auth/me`, () => HttpResponse.json({ data: account })),
        http.get(`${base}/admin/contact-messages`, () => {
          calls++;
          return HttpResponse.json(result([message]));
        }),
      );
      mount('/contact-messages');
      expect(
        await screen.findByText('Your account does not have permission to view this page.'),
      ).toBeInTheDocument();
      const nav = within(screen.getAllByRole('navigation', { name: 'Main navigation' })[0]);
      expect(nav.queryByRole('link', { name: 'Subscribers' })).not.toBeInTheDocument();
      expect(nav.queryByRole('link', { name: 'Contact messages' })).not.toBeInTheDocument();
      expect(calls).toBe(0);
      expect(allowedPage(account.role, 'subscribers')).toBe(false);
      expect(allowedPage(account.role, 'contact-messages')).toBe(false);
      expect(allowedPage(admin.role, 'subscribers')).toBe(true);
    },
  );
  it('shows totals and recent submissions on the overview', async () => {
    mount('/dashboard');
    expect(await screen.findByText(subscriber.email)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /A reader · Correction/ })).toHaveAttribute(
      'href',
      '/contact-messages/message-1',
    );
    expect(screen.getAllByText('1 total · Latest submissions')).toHaveLength(2);
  });
});
