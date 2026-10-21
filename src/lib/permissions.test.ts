import { admin, article, author, editor } from '@/test/fixtures';
import { allowedPage, canEditArticle, canReview } from './permissions';
describe('permissions', () => {
  it('limits authors to their own drafts', () => {
    expect(canEditArticle(author, article)).toBe(true);
    expect(canEditArticle(author, { ...article, author_id: admin.id })).toBe(false);
    expect(canEditArticle(author, { ...article, status: 'published' })).toBe(false);
    expect(canEditArticle(author, { ...article, status: 'archived' })).toBe(false);
  });
  it('allows editorial workflows but reserves administrative screens', () => {
    expect(canEditArticle(editor, { ...article, status: 'published' })).toBe(true);
    expect(canReview(editor.role)).toBe(true);
    expect(canReview(author.role)).toBe(false);
    expect(allowedPage(editor.role, 'users')).toBe(false);
    expect(allowedPage(editor.role, 'activity-logs')).toBe(false);
    expect(allowedPage(author.role, 'article-requests')).toBe(false);
    expect(allowedPage(admin.role, 'users')).toBe(true);
  });
});
