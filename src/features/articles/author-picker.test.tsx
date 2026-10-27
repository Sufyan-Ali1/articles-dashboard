import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, useWatch } from 'react-hook-form';
import { http, HttpResponse } from 'msw';
import { renderRoutes } from '@/test/render';
import { base, server } from '@/test/server';
import { page } from '@/test/fixtures';
import { AuthorPicker } from './author-picker';
import { articleDefaults, type ArticleFormValues } from './validation';

const profile = {
  id: 'e0be38aa-152a-41fc-97d1-83c953bb6b4e',
  name: 'Jane Doe',
  specialization: 'AI',
  is_active: true,
};
function Harness({ canCreate = true }: { canCreate?: boolean }) {
  const form = useForm<ArticleFormValues>({ defaultValues: articleDefaults() });
  const chosen = useWatch({ control: form.control, name: 'author_id' });
  return (
    <>
      <AuthorPicker form={form} disabled={false} canCreate={canCreate} />
      <output aria-label="Selected author">{chosen}</output>
    </>
  );
}
it('loads independent profiles and selects a public author', async () => {
  server.use(http.get(`${base}/admin/authors`, () => HttpResponse.json(page([profile]))));
  renderRoutes([{ path: '/', element: <Harness /> }]);
  const user = userEvent.setup();
  await screen.findByRole('option', { name: 'Jane Doe — AI' });
  await user.selectOptions(screen.getByLabelText('Author', { exact: true }), profile.id);
  expect(screen.getByLabelText('Selected author')).toHaveTextContent(profile.id);
});
it('creates a profile with free-text specialization and selects it', async () => {
  let records: (typeof profile)[] = [];
  server.use(
    http.get(`${base}/admin/authors`, () => HttpResponse.json(page(records))),
    http.post(`${base}/admin/authors`, async ({ request }) => {
      expect(await request.json()).toEqual({ name: 'Jane Doe', specialization: 'AI' });
      records = [profile];
      return HttpResponse.json({ data: profile }, { status: 201 });
    }),
  );
  renderRoutes([{ path: '/', element: <Harness /> }]);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'New author' }));
  await user.type(screen.getByLabelText('Author name'), 'Jane Doe');
  await user.type(screen.getByLabelText('Specialization'), 'AI');
  await user.click(screen.getByRole('button', { name: 'Save author' }));
  await waitFor(() =>
    expect(screen.getByLabelText('Selected author')).toHaveTextContent(profile.id),
  );
  expect(screen.queryByLabelText('Author name')).not.toBeInTheDocument();
});
it('hides profile creation for accounts without management permission', async () => {
  renderRoutes([{ path: '/', element: <Harness canCreate={false} /> }]);
  await screen.findByRole('option', { name: 'Choose an author' });
  expect(screen.queryByRole('button', { name: 'New author' })).not.toBeInTheDocument();
});
