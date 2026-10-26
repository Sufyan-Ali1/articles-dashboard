import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { ProtectedRoute } from '@/app/layout';
import LoginPage from '@/features/auth/login-page';
import EditorPage from './editor-page';
import ArticlesPage from './articles-page';
import { renderRoutes } from '@/test/render';
import { base, server } from '@/test/server';
import { admin, article, author, classification, page } from '@/test/fixtures';
import { localDateTime, scheduleTimestamp } from './scheduling';
import type { Article } from '@/types/api';
const localFuture = '2099-06-15T10:30';
const future = new Date(localFuture).toISOString();
const queued: Article = { ...article, status: 'scheduled', scheduled_publish_at: future };
function mount(element = <EditorPage />, path = `/articles/${article.id}/edit`) {
  return renderRoutes(
    [
      { path: '/login', element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          { path: '/articles/:id/edit', element },
          { path: '/articles', element },
          { path: '/articles/new', element },
        ],
      },
    ],
    path,
  );
}
async function signIn() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Email address'), admin.email);
  await user.type(screen.getByLabelText('Password', { exact: true }), 'a-secure-password');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  return user;
}
describe('publication scheduling', () => {
  it('converts local wall time to UTC and round-trips input display', () => {
    expect(scheduleTimestamp(localFuture)).toBe(future);
    expect(localDateTime(future)).toBe(localFuture);
    expect(() => scheduleTimestamp('2020-01-01T10:00')).toThrow(/future/);
    expect(() => scheduleTimestamp('2099-02-30T10:00')).toThrow(/does not exist/);
    expect(() => scheduleTimestamp('')).toThrow(/Choose/);
  });
  it('saves edits before scheduling and displays the planned time', async () => {
    const order: string[] = [];
    let current = article;
    server.use(
      http.patch(`${base}/articles/:id`, async ({ request }) => {
        order.push('save');
        const body = await request.json();
        expect(body).toEqual({ title: 'Scheduled story' });
        current = { ...current, ...(body as object) };
        return HttpResponse.json({ data: current });
      }),
      http.post(`${base}/articles/:id/schedule`, async ({ request }) => {
        order.push('schedule');
        expect(await request.json()).toEqual({ scheduled_publish_at: future });
        current = { ...current, status: 'scheduled', scheduled_publish_at: future };
        return HttpResponse.json({ data: current });
      }),
    );
    mount();
    const user = await signIn();
    const title = await screen.findByLabelText('Article title');
    await user.clear(title);
    await user.type(title, 'Scheduled story');
    await user.click(screen.getByRole('button', { name: 'Schedule' }));
    fireEvent.change(screen.getByLabelText('Publication date and time'), {
      target: { value: localFuture },
    });
    await user.click(screen.getByRole('button', { name: 'Save & schedule' }));
    expect(
      await screen.findByRole('heading', { name: 'Scheduled publication' }),
    ).toBeInTheDocument();
    expect(order).toEqual(['save', 'schedule']);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save & publish now' })).toBeInTheDocument();
  });
  it('prepopulates and changes an existing schedule', async () => {
    const later = '2099-07-15T11:45';
    server.use(
      http.get(`${base}/admin/articles/:id`, () => HttpResponse.json({ data: queued })),
      http.post(`${base}/articles/:id/schedule`, async ({ request }) => {
        const body = (await request.json()) as { scheduled_publish_at: string };
        expect(body.scheduled_publish_at).toBe(new Date(later).toISOString());
        return HttpResponse.json({
          data: { ...queued, scheduled_publish_at: body.scheduled_publish_at },
        });
      }),
    );
    mount();
    const user = await signIn();
    await user.click(await screen.findByRole('button', { name: 'Reschedule' }));
    expect(screen.getByLabelText('Publication date and time')).toHaveValue(localFuture);
    fireEvent.change(screen.getByLabelText('Publication date and time'), {
      target: { value: later },
    });
    await user.click(screen.getByRole('button', { name: 'Save & reschedule' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('cancels through the dedicated endpoint and returns to draft', async () => {
    const cancelled = vi.fn();
    server.use(
      http.get(`${base}/admin/articles/:id`, () => HttpResponse.json({ data: queued })),
      http.delete(`${base}/articles/:id/schedule`, () => {
        cancelled();
        return HttpResponse.json({ data: { ...article, scheduled_publish_at: null } });
      }),
    );
    mount();
    const user = await signIn();
    await user.click(await screen.findByRole('button', { name: 'Cancel schedule' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(cancelled).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Scheduled publication' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Schedule' })).toBeInTheDocument();
  });
  it('keeps failed scheduling open without pretending publication was queued', async () => {
    server.use(
      http.post(`${base}/articles/:id/schedule`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'publication_invalid',
              message: 'Publication requires an active author',
            },
          },
          { status: 422 },
        ),
      ),
    );
    mount();
    const user = await signIn();
    await user.click(await screen.findByRole('button', { name: 'Schedule' }));
    fireEvent.change(screen.getByLabelText('Publication date and time'), {
      target: { value: localFuture },
    });
    await user.click(screen.getByRole('button', { name: 'Save & schedule' }));
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('active author');
    expect(screen.getByLabelText('Publication date and time')).toHaveValue(localFuture);
  });
  it('rejects a past time without calling the schedule API', async () => {
    const sent = vi.fn();
    server.use(http.post(`${base}/articles/:id/schedule`, sent));
    mount();
    const user = await signIn();
    await user.click(await screen.findByRole('button', { name: 'Schedule' }));
    fireEvent.change(screen.getByLabelText('Publication date and time'), {
      target: { value: '2020-01-01T10:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Save & schedule' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('future');
    expect(sent).not.toHaveBeenCalled();
  });
  it('shows scheduled status and passes the Scheduled list filter', async () => {
    const filters: string[] = [];
    server.use(
      http.get(`${base}/admin/articles`, ({ request }) => {
        filters.push(new URL(request.url).searchParams.get('status') || '');
        return HttpResponse.json(page([queued]));
      }),
    );
    mount(<ArticlesPage />, '/articles');
    const user = await signIn();
    await user.click(await screen.findByRole('button', { name: 'Scheduled' }));
    await waitFor(() => expect(filters).toContain('scheduled'));
    expect(
      await screen.findByRole('link', { name: `Reschedule ${article.title}` }),
    ).toBeInTheDocument();
  });
  it('shows authors their schedule without granting scheduling controls', async () => {
    server.use(
      http.get(`${base}/auth/me`, () => HttpResponse.json({ data: author })),
      http.get(`${base}/admin/articles/:id`, () => HttpResponse.json({ data: queued })),
    );
    mount();
    await signIn();
    expect(
      await screen.findByRole('heading', { name: 'Scheduled publication' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reschedule' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel schedule' })).not.toBeInTheDocument();
  });
});

it('creates a draft before scheduling a new article', async () => {
  let current = article;
  const order: string[] = [];
  server.use(
    http.post(`${base}/articles`, async ({ request }) => {
      order.push('create');
      const body = (await request.json()) as Record<string, unknown>;
      expect(body).not.toHaveProperty('scheduled_publish_at');
      current = { ...article, title: String(body.title), content_html: String(body.content_html) };
      return HttpResponse.json({ data: current }, { status: 201 });
    }),
    http.get(`${base}/admin/articles/:id`, () => HttpResponse.json({ data: current })),
    http.post(`${base}/articles/:id/schedule`, async ({ request }) => {
      order.push('schedule');
      expect(await request.json()).toEqual({ scheduled_publish_at: future });
      current = { ...current, status: 'scheduled', scheduled_publish_at: future };
      return HttpResponse.json({ data: current });
    }),
  );
  mount(<EditorPage />, '/articles/new');
  const user = await signIn();
  await user.type(await screen.findByLabelText('Article title'), 'A new scheduled story');
  await user.selectOptions(screen.getByLabelText('Article type'), classification.id);
  await user.click(screen.getByRole('button', { name: 'HTML' }));
  fireEvent.change(screen.getByLabelText('Article content HTML'), {
    target: { value: '<p>A useful new story.</p>' },
  });
  await user.click(screen.getByRole('button', { name: 'Schedule' }));
  fireEvent.change(screen.getByLabelText('Publication date and time'), {
    target: { value: localFuture },
  });
  await user.click(screen.getByRole('button', { name: 'Save & schedule' }));
  expect(await screen.findByRole('heading', { name: 'Scheduled publication' })).toBeInTheDocument();
  expect(order).toEqual(['create', 'schedule']);
});

it('can publish a scheduled article immediately', async () => {
  server.use(
    http.get(`${base}/admin/articles/:id`, () => HttpResponse.json({ data: queued })),
    http.post(`${base}/articles/:id/publish`, () =>
      HttpResponse.json({
        data: {
          ...queued,
          status: 'published',
          published_at: new Date().toISOString(),
          scheduled_publish_at: null,
        },
      }),
    ),
  );
  mount();
  const user = await signIn();
  await user.click(await screen.findByRole('button', { name: 'Save & publish now' }));
  expect(await screen.findByRole('button', { name: 'Save & unpublish' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Scheduled publication' })).not.toBeInTheDocument();
});
