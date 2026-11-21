import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';
import { base, server } from '@/test/server';
import { page } from '@/test/fixtures';
import { CopyArticlesButton } from './copy-articles-button';

it('copies every page with statuses and sequential IDs, excluding archived articles', async () => {
  const user = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  const requestedPages: number[] = [];
  const articles = Array.from({ length: 101 }, (_, index) => ({
    id: `article-${index + 10}`,
    title: `Article ${index + 1}: "Explore"`,
    slug: `article-${index + 1}`,
    status: ['published', 'scheduled', 'draft', 'archived'][index % 4],
  }));
  server.use(
    http.get(`${base}/admin/articles`, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const current = Number(params.get('page'));
      requestedPages.push(current);
      expect(params.get('page_size')).toBe('100');
      return HttpResponse.json(
        page(articles.slice((current - 1) * 100, current * 100), 101, current, 100),
      );
    }),
  );
  render(<CopyArticlesButton />);
  await user.click(screen.getByRole('button', { name: 'Copy articles' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
  expect(requestedPages).toEqual([1, 2]);
  expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(
    articles
      .filter((article) => article.status !== 'archived')
      .map((article, index) => ({
        id: index + 1,
        title: article.title,
        status: article.status,
        url: `https://askandexplore.com/articles/${article.slug}`,
      })),
  );
  expect(screen.getByRole('button', { name: 'Copy articles' })).toBeEnabled();
});

it('does not copy a partial list when a later page fails and allows retrying', async () => {
  const user = userEvent.setup();
  const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  const errorToast = vi.spyOn(toast, 'error');
  server.use(
    http.get(`${base}/admin/articles`, ({ request }) => {
      if (new URL(request.url).searchParams.get('page') === '2') {
        return HttpResponse.json({ error: { message: 'Please try again.' } }, { status: 500 });
      }
      return HttpResponse.json(page([{ id: 'a', title: 'Article', slug: 'article' }], 101, 1, 100));
    }),
  );
  render(<CopyArticlesButton />);
  await user.click(screen.getByRole('button', { name: 'Copy articles' }));
  await waitFor(() => expect(errorToast).toHaveBeenCalled());
  expect(writeText).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Copy articles' })).toBeEnabled();
});
