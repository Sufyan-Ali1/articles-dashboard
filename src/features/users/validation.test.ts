import { userSchema } from './users-page';
import { requestReviewSchema } from '@/features/article-requests/requests-page';
import { safeLogDetails } from '@/features/activity-logs/logs-page';
describe('staff, review, and audit safeguards', () => {
  it('requires a strong password when a password is supplied', () => {
    expect(
      userSchema.safeParse({
        name: 'Staff',
        email: 'staff@example.test',
        password: 'short',
        role: 'author',
        is_active: true,
      }).success,
    ).toBe(false);
    expect(
      userSchema.safeParse({
        name: 'Staff',
        email: 'staff@example.test',
        password: '',
        role: 'editor',
        is_active: true,
      }).success,
    ).toBe(true);
  });
  it('restricts review statuses and rejects HTML notes', () => {
    expect(requestReviewSchema.safeParse({ status: 'published', admin_notes: '' }).success).toBe(
      false,
    );
    expect(
      requestReviewSchema.safeParse({
        status: 'accepted',
        admin_notes: '<script>alert(1)</script>',
      }).success,
    ).toBe(false);
  });
  it('allowlists audit details and never displays secret-bearing keys', () => {
    expect(
      safeLogDetails({
        token: 'secret',
        password_hash: 'hash',
        changed_fields: ['title', 'password_hash'],
        old_status: 'draft',
        new_status: 'published',
        admin_notes: 'private',
      }),
    ).toEqual({ changed_fields: ['title'], old_status: 'draft', new_status: 'published' });
  });
});
