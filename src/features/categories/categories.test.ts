import { categoryRows, descendants } from './api';
import { classificationSchema } from './classification-page';
import { classification } from '@/test/fixtures';
describe('category hierarchy', () => {
  const parent = { ...classification, id: 'parent', name: 'Parent', parent_id: null };
  const child = { ...classification, id: 'child', name: 'Child', parent_id: 'parent' };
  const grandchild = {
    ...classification,
    id: 'grandchild',
    name: 'Grandchild',
    parent_id: 'child',
  };
  it('retains ancestors when a child matches search', () => {
    expect(
      categoryRows([parent, child, grandchild], 'Grandchild').map((row) => [
        row.record.id,
        row.depth,
      ]),
    ).toEqual([
      ['parent', 0],
      ['child', 1],
      ['grandchild', 2],
    ]);
  });
  it('excludes self and all descendants from parent choices', () => {
    expect([...descendants([parent, child, grandchild], 'parent')]).toEqual([
      'parent',
      'child',
      'grandchild',
    ]);
  });
  it('does not loop forever if supplied a malformed hierarchy', () => {
    const rows = categoryRows([{ ...parent, parent_id: 'child' }, child]);
    expect(rows).toHaveLength(2);
  });
  it('rejects empty names and invalid slugs', () => {
    expect(
      classificationSchema.safeParse({
        name: '',
        slug: 'Invalid slug',
        description: '',
        is_active: true,
        parent_id: '',
      }).success,
    ).toBe(false);
  });
});
