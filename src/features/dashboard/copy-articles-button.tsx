import { useState } from 'react';
import { Copy, LoaderCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { collectPages, message } from '@/lib/api';
import type { ArticleSummary } from '@/types/api';

export function CopyArticlesButton() {
  const [copying, setCopying] = useState(false);

  async function copyArticles() {
    setCopying(true);
    try {
      const loadJson = async () => {
        const articles = await collectPages<ArticleSummary>('/admin/articles', {
          sort: '-created_at',
        });
        return JSON.stringify(
          articles
            .filter((article) => article.status !== 'archived')
            .map((article, index) => ({
              id: index + 1,
              title: article.title,
              status: article.status,
              url: `https://askandexplore.com/articles/${encodeURIComponent(article.slug)}`,
            })),
          null,
          2,
        );
      };

      // Start the clipboard write during the click so Safari retains user activation
      // while the paginated article list loads.
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': loadJson().then((json) => new Blob([json], { type: 'text/plain' })),
          }),
        ]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(await loadJson());
      } else {
        throw new Error('Clipboard access is unavailable. Open the dashboard over HTTPS.');
      }
      toast.success('Articles copied as JSON.');
    } catch (error) {
      toast.error(`Could not copy articles. ${message(error)}`);
    } finally {
      setCopying(false);
    }
  }

  return (
    <Button
      variant="outline"
      disabled={copying}
      onClick={() => void copyArticles()}
      title="Copy published, scheduled, and draft articles as JSON"
    >
      {copying ? <LoaderCircle className="animate-spin" /> : <Copy />}
      {copying ? 'Copying articles…' : 'Copy articles'}
    </Button>
  );
}
