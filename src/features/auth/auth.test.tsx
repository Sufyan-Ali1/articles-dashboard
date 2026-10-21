import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Outlet } from 'react-router-dom';
import LoginPage from './login-page';
import { useAuth } from './auth';
import Layout, { ProtectedRoute } from '@/app/layout';
import { renderRoutes } from '@/test/render';
import { base, server } from '@/test/server';
import { author } from '@/test/fixtures';
function Account() {
  const { user, logout } = useAuth();
  return (
    <>
      <h1>Signed in: {user?.name}</h1>
      <button onClick={logout}>Log out</button>
      <Outlet />
    </>
  );
}
const routes = [
  { path: '/login', element: <LoginPage /> },
  { element: <ProtectedRoute />, children: [{ path: '/dashboard', element: <Account /> }] },
];
async function signIn() {
  const interaction = userEvent.setup();
  await interaction.type(screen.getByLabelText('Email address'), 'alex@example.test');
  await interaction.type(screen.getByLabelText('Password', { exact: true }), 'a-secure-password');
  await interaction.click(screen.getByRole('button', { name: 'Sign in' }));
  return interaction;
}
describe('staff authentication', () => {
  it('redirects unauthenticated protected routes to login', async () => {
    const { router } = renderRoutes(routes, '/dashboard');
    expect(
      await screen.findByRole('heading', { name: 'Sign in to your workspace' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });
  it('validates credentials before contacting the API', async () => {
    const login = vi.fn();
    server.use(http.post(`${base}/auth/login`, login));
    renderRoutes(routes, '/login');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter your password.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });
  it('logs in using JSON, loads identity, and never persists bearer tokens', async () => {
    server.use(
      http.post(`${base}/auth/login`, async ({ request }) => {
        expect(await request.json()).toEqual({
          email: 'alex@example.test',
          password: 'a-secure-password',
        });
        return HttpResponse.json({
          data: { access_token: 'test-token', token_type: 'bearer', expires_in: 1800 },
        });
      }),
    );
    renderRoutes(routes, '/login');
    const interaction = await signIn();
    expect(
      await screen.findByRole('heading', { name: 'Signed in: Alex Morgan' }),
    ).toBeInTheDocument();
    expect(JSON.stringify(localStorage)).not.toContain('test-token');
    expect(sessionStorage.length).toBe(0);
    await interaction.click(screen.getByRole('button', { name: 'Log out' }));
    expect(
      await screen.findByRole('heading', { name: 'Sign in to your workspace' }),
    ).toBeInTheDocument();
  });
  it('displays backend credential errors without leaving login', async () => {
    server.use(
      http.post(`${base}/auth/login`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'invalid_credentials',
              message: 'Invalid email or password',
              request_id: 'login-1',
            },
          },
          { status: 401 },
        ),
      ),
    );
    renderRoutes(routes, '/login');
    await signIn();
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
  });
  it('blocks direct admin-route navigation by authors', async () => {
    server.use(http.get(`${base}/auth/me`, () => HttpResponse.json({ data: author })));
    renderRoutes(
      [
        ...routes,
        {
          element: <ProtectedRoute roles={['admin']} />,
          children: [{ path: '/users', element: <h1>Private users</h1> }],
        },
      ],
      '/users',
    );
    await signIn();
    expect(await screen.findByText('Access restricted')).toBeInTheDocument();
    expect(screen.queryByText('Private users')).not.toBeInTheDocument();
  });
  it('does not restore the session after a full provider remount', async () => {
    const first = renderRoutes(routes, '/login');
    await signIn();
    await screen.findByRole('heading', { name: 'Signed in: Alex Morgan' });
    first.unmount();
    const second = renderRoutes(routes, '/dashboard');
    await waitFor(() => expect(second.router.state.location.pathname).toBe('/login'));
  });
  it('expires short-lived sessions automatically', async () => {
    server.use(
      http.post(`${base}/auth/login`, () =>
        HttpResponse.json({
          data: { access_token: 'brief-token', token_type: 'bearer', expires_in: 0.3 },
        }),
      ),
    );
    renderRoutes(routes, '/login');
    await signIn();
    await screen.findByRole('heading', { name: 'Signed in: Alex Morgan' });
    expect(
      await screen.findByRole('heading', { name: 'Sign in to your workspace' }),
    ).toBeInTheDocument();
  });
  it('hides review and administration navigation from authors', async () => {
    server.use(http.get(`${base}/auth/me`, () => HttpResponse.json({ data: author })));
    renderRoutes(
      [
        { path: '/login', element: <LoginPage /> },
        {
          element: <ProtectedRoute />,
          children: [
            {
              element: <Layout />,
              children: [{ path: '/dashboard', element: <h1>Author workspace</h1> }],
            },
          ],
        },
      ],
      '/dashboard',
    );
    await signIn();
    await screen.findByRole('heading', { name: 'Author workspace' });
    expect(screen.queryByRole('link', { name: 'Team members' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Activity logs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Article requests' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Create article/i })).toBeInTheDocument();
  });
});
