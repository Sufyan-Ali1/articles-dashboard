import { lazy, Suspense } from 'react';
import {
  createBrowserRouter,
  Link,
  Navigate,
  useRouteError,
  type RouteObject,
} from 'react-router-dom';
import Layout, { ProtectedRoute } from './layout';
import LoginPage from '@/features/auth/login-page';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Loading } from '@/components/shared';
const SourcesPage = lazy(() => import('@/features/traffic/sources-page'));
const DashboardPage = lazy(() => import('@/features/dashboard/dashboard-page'));
const ArticlesPage = lazy(() => import('@/features/articles/articles-page'));
const EditorPage = lazy(() => import('@/features/articles/editor-page'));
const ClassificationPage = lazy(() => import('@/features/categories/classification-page'));
const RequestsPage = lazy(() => import('@/features/article-requests/requests-page'));
const RequestDetailPage = lazy(() =>
  import('@/features/article-requests/requests-page').then((module) => ({
    default: module.RequestDetailPage,
  })),
);
const UsersPage = lazy(() => import('@/features/users/users-page'));
const LogsPage = lazy(() => import('@/features/activity-logs/logs-page'));
const ProfilePage = lazy(() => import('@/features/profile/profile-page'));
const SettingsPage = lazy(() => import('@/features/settings/settings-page'));
function RouteError() {
  const error = useRouteError();
  return (
    <main className="mx-auto max-w-xl p-8">
      <ErrorState error={error} />
      <Button asChild className="mt-4">
        <a href="/">Reload workspace</a>
      </Button>
    </main>
  );
}
const waiting = (element: React.ReactNode) => (
  <Suspense fallback={<Loading rows={7} />}>{element}</Suspense>
);
export const routes: RouteObject[] = [
  {
    errorElement: <RouteError />,
    children: [
      { path: '/login', element: <LoginPage /> },
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <Layout />,
            children: [
              { index: true, element: <Navigate to="/dashboard" replace /> },
              { path: '/dashboard', element: waiting(<DashboardPage />) },
              { path: '/articles', element: waiting(<ArticlesPage />) },
              { path: '/articles/new', element: waiting(<EditorPage />) },
              { path: '/articles/:id/edit', element: waiting(<EditorPage />) },
              { path: '/categories', element: waiting(<ClassificationPage kind="categories" />) },
              { path: '/tags', element: waiting(<ClassificationPage kind="tags" />) },
              {
                path: '/article-types',
                element: waiting(<ClassificationPage kind="article-types" />),
              },
              {
                element: <ProtectedRoute roles={['admin', 'editor']} />,
                children: [
                  { path: '/article-requests', element: waiting(<RequestsPage />) },
                  { path: '/traffic-sources', element: waiting(<SourcesPage />) },
                  { path: '/article-requests/:id', element: waiting(<RequestDetailPage />) },
                ],
              },
              {
                element: <ProtectedRoute roles={['admin']} />,
                children: [
                  { path: '/users', element: waiting(<UsersPage />) },
                  { path: '/activity-logs', element: waiting(<LogsPage />) },
                ],
              },
              { path: '/profile', element: waiting(<ProfilePage />) },
              { path: '/settings', element: waiting(<SettingsPage />) },
              {
                path: '*',
                element: (
                  <EmptyState
                    title="This page doesn’t exist"
                    description="The page may have moved, or the address might be incorrect."
                  >
                    <Button asChild>
                      <Link to="/dashboard">Back to overview</Link>
                    </Button>
                  </EmptyState>
                ),
              },
            ],
          },
        ],
      },
    ],
  },
];
export const router = createBrowserRouter(routes);
