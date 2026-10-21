import { article, author } from '@/test/fixtures';
import {
  articleDefaults,
  articlePayload,
  articleSchema,
  changedPayload,
  safeUrl,
  validateSchema,
} from './validation';
import { sanitizePreview } from './preview';
import { unsupportedMarkup } from './rich-text-editor';
describe('article validation and serialization', () => {
  it('requires title, type, and content even for draft creation', () => {
    const result = articleSchema.safeParse(articleDefaults());
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(['title', 'article_type_id']),
      );
  });
  it('whitelists writes and excludes author featured edits and protected fields', () => {
    const payload = articlePayload({ ...articleDefaults(article), is_featured: true }, author.role);
    expect(payload).not.toHaveProperty('is_featured');
    for (const key of [
      'id',
      'author_id',
      'author',
      'status',
      'view_count',
      'created_at',
      'updated_at',
      'published_at',
    ])
      expect(payload).not.toHaveProperty(key);
  });
  it('sends explicit null to clear optional fields and omits unchanged HTML', () => {
    const existing = {
      ...article,
      excerpt: 'Old excerpt',
      content_html: '<figure><img src="/image.png"><figcaption>Caption</figcaption></figure>',
    };
    const values = { ...articleDefaults(existing), excerpt: '' };
    const patch = changedPayload(articlePayload(values, 'editor'), existing);
    expect(patch).toEqual({ excerpt: null });
  });
  it('rejects malformed JSON, executable schema content, and excessive nesting', () => {
    expect(validateSchema('{bad}')).toContain('valid JSON');
    expect(validateSchema('[]')).toContain('object');
    expect(validateSchema('{"@type":"Article"}')).toContain('@context');
    expect(
      validateSchema(
        JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Article',
          url: 'javascript:alert(1)',
        }),
      ),
    ).toContain('URL');
    let nested: unknown = 'text';
    for (let index = 0; index < 18; index++) nested = { child: nested };
    expect(
      validateSchema(
        JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', nested }),
      ),
    ).toContain('depth');
  });
  it('accepts Schema.org objects and typed graphs', () => {
    expect(
      validateSchema(JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article' })),
    ).toBeNull();
    expect(
      validateSchema(
        JSON.stringify({ '@context': 'https://schema.org', '@graph': [{ '@type': 'Article' }] }),
      ),
    ).toBeNull();
  });
  it('validates slugs and image URLs', () => {
    expect(articleSchema.safeParse({ ...articleDefaults(article), slug: 'Bad Slug' }).success).toBe(
      false,
    );
    expect(safeUrl('https://user:pass@example.com/image')).toBe(false);
    expect(safeUrl('//example.com/image', true)).toBe(false);
    expect(safeUrl('/images/article.jpg', true)).toBe(true);
    expect(safeUrl('javascript:alert(1)', true)).toBe(false);
  });
  it('detects backend HTML that needs lossless source editing', () => {
    expect(
      unsupportedMarkup('<figure><img src="/safe.jpg"><figcaption>Caption</figcaption></figure>'),
    ).toBe(true);
    expect(unsupportedMarkup('<p><strong>Hello</strong></p>')).toBe(false);
  });
  it('sanitizes unsaved preview HTML without executing it', () => {
    const output = sanitizePreview(
      '<p>Safe</p><script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">bad</a><svg onload="alert(1)"></svg>',
    );
    expect(output).toContain('<p>Safe</p>');
    expect(output).not.toMatch(/<script|onerror|javascript:|<svg/);
  });
});
