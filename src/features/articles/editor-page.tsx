import { TrafficPanel } from '@/features/traffic/traffic-panel';
import { ArticleLinks } from '@/features/traffic/article-links';
import { ScheduleDialog } from './schedule-dialog';
import { scheduledDate } from './scheduling';
import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  CalendarClock,
  Check,
  Eye,
  RefreshCw,
  Save,
  Send,
  Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/auth';
import { useScope } from '@/hooks/use-private-query';
import { useUnsaved } from '@/hooks/use-unsaved';
import { useClassifications } from '@/features/categories/api';
import { canEditArticle, canReview } from '@/lib/permissions';
import { ApiError, getApiEpoch, message } from '@/lib/api';
import { dateTime } from '@/lib/utils';
import { articlesApi } from './api';
import { ImageUploadProvider } from './image-upload';
import {
  articleDefaults,
  articlePayload,
  articleSchema,
  changedPayload,
  type ArticleFormValues,
} from './validation';
import { useArticleInvalidation } from './article-actions';
import { StoryPanel, SeoPanel, OrganizationPanel, FeaturedImagePanel } from './editor-fields';
import { ArticlePreview } from './preview';
import type { Article } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Badge, StatusBadge } from '@/components/ui/badge';
import { Card, ConfirmDialog, ErrorState, Loading, Notice, Spinner } from '@/components/shared';

function EditorForm({ initial }: { initial?: Article }) {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const invalidate = useArticleInvalidation();
  const [article, setArticle] = useState(initial);
  const articleRef = useRef(initial);
  const [pending, setPending] = useState(false);
  const [uploads, setUploads] = useState(0);
  const uploadsRef = useRef(0);
  const changeUploads = (change: number) => {
    uploadsRef.current += change;
    setUploads(uploadsRef.current);
  };
  const pendingRef = useRef(false);
  const [error, setError] = useState<unknown>(() => {
    const savedError = (location.state as { saveError?: string } | null)?.saveError;
    return savedError ? new Error(savedError) : null;
  });
  const [preview, setPreview] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(() =>
    Boolean(
      (location.state as { openSchedule?: boolean; scheduleDate?: string } | null)?.openSchedule ||
      (location.state as { scheduleDate?: string } | null)?.scheduleDate,
    ),
  );
  const [scheduleDraft, setScheduleDraft] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(initial?.updated_at);
  const categories = useClassifications('categories');
  const tags = useClassifications('tags');
  const types = useClassifications('article-types');
  const form = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
    defaultValues: articleDefaults(initial),
    mode: 'onBlur',
  });
  const { warning, allowNavigation } = useUnsaved(form.formState.isDirty || uploads > 0);
  if (!user) return null;
  const writable = !article || canEditArticle(user, article);
  const reviewer = canReview(user.role);
  const disabled = !writable || pending;
  const apply = (saved: Article) => {
    articleRef.current = saved;
    setArticle(saved);
    form.reset(articleDefaults(saved));
    setSavedAt(saved.updated_at);
  };
  const save = async (
    values: ArticleFormValues,
    action: 'save' | 'publish' | 'unpublish' | 'schedule',
    when?: string,
  ) => {
    if (pendingRef.current || !writable) return;
    if (uploadsRef.current > 0) {
      toast.error('Wait for image uploads to finish before saving.');
      return;
    }
    if (articleRef.current && !values.slug) {
      form.setError('slug', { message: 'An existing slug cannot be cleared.' });
      return;
    }
    const epoch = getApiEpoch();
    pendingRef.current = true;
    setPending(true);
    setError(null);
    let saved: Article | undefined;
    try {
      const current = articleRef.current;
      const payload = articlePayload(values, user.role);
      const result = current
        ? Object.keys(changedPayload(payload, current)).length
          ? await articlesApi.update(current.id, changedPayload(payload, current))
          : { data: current }
        : await articlesApi.create(payload);
      saved = result.data;
      if (epoch !== getApiEpoch()) return;
      apply(saved);
      toast.success('Article saved.');
      if (action !== 'save') {
        const publication =
          action === 'schedule'
            ? await articlesApi.schedule(saved.id, when!)
            : action === 'publish'
              ? await articlesApi.publish(saved.id)
              : await articlesApi.unpublish(saved.id);
        saved = publication.data;
        if (epoch !== getApiEpoch()) return;
        apply(saved);
        toast.success(
          action === 'schedule'
            ? 'Publication scheduled.'
            : action === 'publish'
              ? 'Article published.'
              : 'Article unpublished.',
        );
        if (action === 'schedule') setScheduleOpen(false);
      }
      await invalidate();
      if (!current) {
        allowNavigation();
        void navigate(`/articles/${saved.id}/edit`, { replace: true });
      }
      return true;
    } catch (failure) {
      if (epoch !== getApiEpoch()) return;
      if (saved) {
        toast.error('Your changes were saved, but the publication action failed.');
        await invalidate();
      }
      setError(failure);
      if (saved && !initial) {
        allowNavigation();
        void navigate(`/articles/${saved.id}/edit`, {
          replace: true,
          state: {
            saveError: message(failure),
            ...(action === 'schedule' ? { scheduleDate: when } : {}),
          },
        });
      }
      if (failure instanceof ApiError && failure.status === 422 && Array.isArray(failure.details))
        for (const detail of failure.details as { location?: string[] }[]) {
          const field = detail.location?.[1] as keyof ArticleFormValues | undefined;
          if (field && field in values)
            form.setError(field, {
              message: 'The backend rejected this value. Check its format and allowed limits.',
            });
        }
      if (failure instanceof ApiError && failure.status === 403)
        void refreshUser().catch(() => undefined);
      return false;
    } finally {
      setPending(false);
      pendingRef.current = false;
    }
  };
  const submit = (action: 'save' | 'publish' | 'unpublish') =>
    void form.handleSubmit(
      (values) => save(values, action),
      () => toast.error('Check the highlighted fields before saving.'),
    )();
  const schedule = async (timestamp: string) => {
    setScheduleDraft(timestamp);
    let success = false;
    await form.handleSubmit(
      async (values) => {
        success = (await save(values, 'schedule', timestamp)) === true;
      },
      () => {
        setScheduleOpen(false);
        toast.error('Check the highlighted article fields before scheduling.');
      },
    )();
    return success;
  };
  const updatePublication = async (cancel: boolean) => {
    if (
      pendingRef.current ||
      form.formState.isDirty ||
      uploadsRef.current > 0 ||
      !articleRef.current
    )
      return;
    const epoch = getApiEpoch();
    pendingRef.current = true;
    setPending(true);
    setError(null);
    try {
      const result = cancel
        ? await articlesApi.cancelSchedule(articleRef.current.id)
        : await articlesApi.detail(articleRef.current.id);
      if (epoch !== getApiEpoch()) return;
      apply(result.data);
      await invalidate();
      if (cancel) toast.success('Schedule cancelled. Article returned to draft.');
    } catch (failure) {
      if (epoch === getApiEpoch()) setError(failure);
      throw failure;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  const canSchedule =
    reviewer && (!article || article.status === 'draft' || article.status === 'scheduled');
  return (
    <ImageUploadProvider onPendingChange={changeUploads}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" asChild>
            <Link to="/articles" aria-label="Back to articles">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              {initial ? (writable ? 'Edit article' : 'Article details') : 'Create article'}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
              {article ? <StatusBadge status={article.status} /> : <Badge>New draft</Badge>}
              <span>
                {form.formState.isDirty
                  ? 'Unsaved changes'
                  : savedAt
                    ? `Saved ${dateTime(savedAt)}`
                    : 'Make something worth reading'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setPreview(true)}>
            <Eye />
            Preview
          </Button>
          {writable && (
            <>
              <Button
                variant="outline"
                disabled={pending || uploads > 0}
                onClick={() => submit('save')}
              >
                {pending ? <Spinner /> : <Save />}
                {article?.status === 'published' || article?.status === 'scheduled'
                  ? 'Save changes'
                  : 'Save draft'}
              </Button>
              {canSchedule && (
                <Button
                  variant="outline"
                  disabled={pending || uploads > 0}
                  onClick={() => {
                    setError(null);
                    setScheduleOpen(true);
                  }}
                >
                  <CalendarClock />
                  {article?.status === 'scheduled' ? 'Reschedule' : 'Schedule'}
                </Button>
              )}
              {reviewer && (
                <Button
                  disabled={pending || uploads > 0}
                  onClick={() => submit(article?.status === 'published' ? 'unpublish' : 'publish')}
                >
                  {article?.status === 'published' ? <Undo2 /> : <Send />}
                  {article?.status === 'published'
                    ? 'Save & unpublish'
                    : article?.status === 'scheduled'
                      ? 'Save & publish now'
                      : 'Save & publish'}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {!writable && (
        <div className="mb-5">
          <Notice>
            Authors can edit only their own drafts. This article is available for viewing and
            preview.
          </Notice>
        </div>
      )}
      {article?.status === 'published' && writable && (
        <div className="mb-5">
          <Notice>
            This article is live. Saving changes updates the published article immediately.
          </Notice>
        </div>
      )}
      {article?.status === 'scheduled' && (
        <Card className="mb-5 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="size-4 text-primary" />
            Scheduled publication
          </h2>
          <p className="mt-2 text-sm">
            {article.scheduled_publish_at
              ? scheduledDate(article.scheduled_publish_at)
              : 'Publication time unavailable'}
          </p>
          {article.scheduled_publish_at && (
            <p className="mt-1 text-xs text-muted-foreground">
              UTC: {article.scheduled_publish_at}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            The article stays private until the server publishes it. Refresh status to check whether
            it has gone live.
          </p>
          {reviewer && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pending || form.formState.isDirty || uploads > 0}
                onClick={() => void updatePublication(false).catch(() => undefined)}
              >
                <RefreshCw />
                Refresh status
              </Button>
              <ConfirmDialog
                title="Cancel scheduled publication?"
                description="Remove the planned publication time and return the saved article to draft. It will remain private."
                destructive={false}
                onConfirm={() => updatePublication(true)}
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pending || form.formState.isDirty || uploads > 0}
                >
                  Cancel schedule
                </Button>
              </ConfirmDialog>
              {(form.formState.isDirty || uploads > 0) && (
                <p className="w-full text-xs text-muted-foreground">
                  Save or discard your changes before cancelling or refreshing the schedule.
                </p>
              )}
            </div>
          )}
        </Card>
      )}
      {error != null && (
        <div className="mb-5">
          <ErrorState error={error} />
        </div>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit('save');
        }}
        className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]"
      >
        <fieldset disabled={disabled} className="min-w-0 space-y-6">
          <StoryPanel form={form} disabled={disabled} />
          <SeoPanel form={form} />
        </fieldset>
        <aside className="space-y-5">
          <OrganizationPanel
            form={form}
            disabled={disabled}
            article={article}
            reviewer={reviewer}
            categories={categories}
            tags={tags}
            types={types}
          />
          <FeaturedImagePanel form={form} disabled={disabled} />
          {article && (
            <Card className="p-5">
              <h2 className="mb-4 text-sm font-semibold">Article information</h2>
              <dl className="space-y-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Author</dt>
                  <dd className="mt-1">{article.author?.name ?? 'Unknown author'}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="mt-1">{dateTime(article.created_at)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Published</dt>
                  <dd className="mt-1">
                    {article.published_at ? dateTime(article.published_at) : 'Not published'}
                  </dd>
                </div>
              </dl>
              {reviewer && (
                <div className="mt-5 border-t pt-4">
                  <ConfirmDialog
                    title={article.status === 'archived' ? 'Restore to draft?' : 'Archive article?'}
                    description={
                      form.formState.isDirty
                        ? 'This action affects the saved article. Save your current changes first or discard them before continuing.'
                        : article.status === 'archived'
                          ? 'This article will become an editable draft.'
                          : 'The saved article will be archived and removed from public visibility.'
                    }
                    onConfirm={async () => {
                      const result = await articlesApi.status(
                        article.id,
                        article.status === 'archived' ? 'draft' : 'archived',
                      );
                      apply(result.data);
                      await invalidate();
                      toast.success('Article status updated.');
                    }}
                  >
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={pending || form.formState.isDirty}
                    >
                      <Archive />
                      {article.status === 'archived' ? 'Restore to draft' : 'Archive article'}
                    </Button>
                  </ConfirmDialog>
                </div>
              )}
            </Card>
          )}
          <p className="flex items-start gap-2 px-1 text-[11px] leading-5 text-muted-foreground">
            <Check className="mt-0.5 size-3.5 shrink-0" />
            {form.formState.isDirty
              ? 'Your changes are only saved when you choose Save or Publish.'
              : 'You’re up to date. Keep the good ideas coming.'}
          </p>
        </aside>
      </form>
      {article && reviewer && (
        <>
          <TrafficPanel articleId={article.id} />
          <ArticleLinks
            articleId={article.id}
            slug={article.slug}
            published={article.status === 'published'}
          />
        </>
      )}
      {canSchedule && (
        <ScheduleDialog
          open={scheduleOpen}
          close={() => setScheduleOpen(false)}
          initialDate={
            scheduleDraft ||
            article?.scheduled_publish_at ||
            (location.state as { scheduleDate?: string } | null)?.scheduleDate
          }
          reschedule={article?.status === 'scheduled'}
          pending={pending}
          error={error}
          onSchedule={schedule}
        />
      )}
      <ArticlePreview
        open={preview}
        onOpenChange={setPreview}
        values={form.getValues()}
        author={article?.author?.name ?? user.name}
        publishedAt={article?.published_at}
      />
      {warning}
    </ImageUploadProvider>
  );
}
export default function EditorPage() {
  const { id } = useParams();
  const scope = useScope();
  const query = useQuery({
    queryKey: ['articles', ...scope, 'detail', id],
    queryFn: ({ signal }) => articlesApi.detail(id!, signal),
    enabled: !!id,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
  if (id && query.isPending)
    return (
      <Card>
        <Loading rows={8} />
      </Card>
    );
  if (id && query.error)
    return <ErrorState error={query.error} retry={() => void query.refetch()} />;
  return <EditorForm key={id ?? 'new'} initial={query.data?.data} />;
}
