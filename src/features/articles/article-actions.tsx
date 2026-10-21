import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Archive, ArchiveRestore, Eye, Pencil, Send, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/auth';
import { canEditArticle, canReview, isAdmin } from '@/lib/permissions';
import { articlesApi } from './api';
import type { ArticleSummary } from '@/types/api';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared';
export function useArticleInvalidation() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ['articles'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
      client.invalidateQueries({ queryKey: ['logs'] }),
    ]);
}
export function ArticleActions({ article }: { article: ArticleSummary }) {
  const { user } = useAuth();
  const invalidate = useArticleInvalidation();
  const mutation = useMutation({
    mutationFn: async (action: 'publish' | 'unpublish' | 'archive' | 'restore' | 'delete') => {
      if (action === 'archive' || action === 'restore')
        await articlesApi.status(article.id, action === 'archive' ? 'archived' : 'draft');
      else await articlesApi[action](article.id);
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Article updated.');
    },
  });
  if (!user) return null;
  const actions = canReview(user.role)
    ? ([
        {
          action: article.status === 'published' ? 'unpublish' : 'publish',
          label: article.status === 'published' ? 'Unpublish' : 'Publish',
          icon: article.status === 'published' ? Undo2 : Send,
        },
        {
          action: article.status === 'archived' ? 'restore' : 'archive',
          label: article.status === 'archived' ? 'Restore to draft' : 'Archive',
          icon: article.status === 'archived' ? ArchiveRestore : Archive,
        },
      ] as const)
    : [];
  return (
    <div className="flex items-center gap-0.5">
      <Button
        asChild
        variant="ghost"
        size="icon"
        title={canEditArticle(user, article) ? 'Edit article' : 'View article'}
      >
        <Link
          aria-label={`${canEditArticle(user, article) ? 'Edit' : 'View'} ${article.title}`}
          to={`/articles/${article.id}/edit`}
        >
          {canEditArticle(user, article) ? <Pencil /> : <Eye />}
        </Link>
      </Button>
      {actions.map(({ action, label, icon: Icon }) => (
        <ConfirmDialog
          key={action}
          title={`${label}?`}
          description={
            action === 'publish'
              ? `“${article.title}” will become publicly available if it meets publication requirements.`
              : action === 'unpublish' || action === 'archive'
                ? `“${article.title}” will no longer be publicly available.`
                : 'This article will become an editable draft.'
          }
          destructive={action === 'archive' || action === 'unpublish'}
          onConfirm={() => mutation.mutateAsync(action)}
        >
          <Button
            variant="ghost"
            size="icon"
            title={label}
            aria-label={`${label} ${article.title}`}
            disabled={mutation.isPending}
          >
            <Icon />
          </Button>
        </ConfirmDialog>
      ))}
      {isAdmin(user.role) && (
        <ConfirmDialog
          title="Delete article?"
          description={`“${article.title}” will be permanently deleted. This cannot be undone.`}
          onConfirm={() => mutation.mutateAsync('delete')}
        >
          <Button
            variant="ghost"
            size="icon"
            title="Delete article"
            aria-label={`Delete ${article.title}`}
            disabled={mutation.isPending}
          >
            <Trash2 className="text-destructive" />
          </Button>
        </ConfirmDialog>
      )}
    </div>
  );
}
