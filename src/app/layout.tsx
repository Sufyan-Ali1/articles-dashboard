import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  Globe,
  BookOpenText,
  LayoutDashboard,
  FileText,
  FolderTree,
  Tags,
  Shapes,
  Inbox,
  Users,
  History,
  Settings,
  UserRound,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  LogOut,
  ChevronRight,
  Plus,
  ArrowUpRight,
} from 'lucide-react';
import { useAuth } from '@/features/auth/auth';
import { usePreferences } from '@/features/settings/preferences';
import { allowedPage } from '@/lib/permissions';
import { cn, initials } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { hasUnsavedChanges } from '@/lib/unsaved';
import { EmptyState, Loading, Spinner } from '@/components/shared';
export const navigation = [
  { path: 'dashboard', label: 'Overview', icon: LayoutDashboard, group: 'Workspace' },
  { path: 'articles', label: 'Articles', icon: FileText, group: 'Workspace' },
  { path: 'traffic-sources', label: 'Traffic Sources', icon: Globe, group: 'Workspace' },
  { path: 'categories', label: 'Categories', icon: FolderTree, group: 'Content' },
  { path: 'tags', label: 'Tags', icon: Tags, group: 'Content' },
  { path: 'article-types', label: 'Article types', icon: Shapes, group: 'Content' },
  { path: 'article-requests', label: 'Article requests', icon: Inbox, group: 'Content' },
  { path: 'users', label: 'Team members', icon: Users, group: 'Administration' },
  { path: 'activity-logs', label: 'Activity logs', icon: History, group: 'Administration' },
  { path: 'profile', label: 'My profile', icon: UserRound, group: 'Account' },
  { path: 'settings', label: 'Settings', icon: Settings, group: 'Account' },
];
export function ProtectedRoute({ roles }: { roles?: string[] }) {
  const { user, initializing, sessionError, restoreSession } = useAuth();
  const location = useLocation();
  if (initializing) return <Layout restoring />;
  if (sessionError)
    return (
      <div className="p-8">
        <p>Unable to verify your session. Check your connection.</p>
        <Button onClick={() => void restoreSession().catch(() => undefined)}>Retry</Button>
      </div>
    );
  if (!user)
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role))
    return (
      <EmptyState
        title="Access restricted"
        description="Your account does not have permission to view this page."
      >
        <Button asChild>
          <Link to="/dashboard">Back to overview</Link>
        </Button>
      </EmptyState>
    );
  return <Outlet />;
}
export default function Layout({ restoring = false }: { restoring?: boolean }) {
  const { user, logout } = useAuth();
  const { preferences, update } = usePreferences();
  const [mobile, setMobile] = useState(false);
  const [logoutWarning, setLogoutWarning] = useState(false);
  const location = useLocation();
  const collapsed = preferences.collapsed;
  const tablePage = [
    '/articles',
    '/categories',
    '/tags',
    '/article-types',
    '/article-requests',
    '/users',
    '/activity-logs',
  ].includes(location.pathname.replace(/\/$/, ''));
  useEffect(() => {
    setMobile(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  const current = navigation.find((item) => location.pathname.split('/')[1] === item.path);
  useEffect(() => {
    document.title = `${current?.label ?? 'Workspace'} · Blog Admin`;
  }, [current]);
  if (!user && !restoring) return null;
  const accountName = user?.name ?? 'Your account';
  const accountRole = user?.role ?? 'author';
  const sidebar = (compact: boolean) => (
    <>
      <Link
        to="/dashboard"
        className={cn('flex h-[76px] items-center gap-2.5 px-5', compact && 'justify-center px-0')}
        aria-label="Blog Admin overview"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm">
          <BookOpenText className="size-5" />
        </span>
        {!compact && (
          <span className="text-base font-semibold tracking-tight">
            Blog Admin
            <span className="ml-2 rounded border px-1 py-0.5 align-middle text-[8px] font-medium uppercase tracking-wider text-muted-foreground">
              CMS
            </span>
          </span>
        )}
      </Link>
      <div className={cn('px-4 pb-5', compact && 'px-3')}>
        <Button
          asChild
          className="w-full"
          size={compact ? 'icon' : 'default'}
          title="Create article"
        >
          <Link to="/articles/new">
            <Plus />
            {!compact && (
              <>
                Create article<span className="ml-auto opacity-60">↗</span>
              </>
            )}
          </Link>
        </Button>
      </div>
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3">
        {['Workspace', 'Content', 'Administration', 'Account'].map((group) => {
          const items = navigation.filter(
            (item) => item.group === group && (restoring || allowedPage(accountRole, item.path)),
          );
          if (!items.length) return null;
          return (
            <div key={group} className="mb-5">
              {!compact && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/75">
                  {group}
                </p>
              )}
              <div className="space-y-1">
                {items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={`/${item.path}`}
                    title={compact ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                        compact && 'justify-center px-0',
                        isActive &&
                          'bg-primary/8 text-primary hover:bg-primary/10 hover:text-primary',
                      )
                    }
                  >
                    <item.icon className="size-[17px] shrink-0" />
                    {!compact && item.label}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
      {!compact && (
        <div className="mx-4 mb-4 rounded-lg border bg-background p-3.5">
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Editorial workspace
          </div>
          <p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">
            A little more focus.
            <br />A lot more possibility.
          </p>
        </div>
      )}
      <div className={cn('flex items-center gap-3 border-t p-4', compact && 'flex-col px-2')}>
        <Link
          to="/profile"
          aria-label="My profile"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
        >
          {initials(accountName)}
        </Link>
        {!compact && (
          <Link to="/profile" className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{accountName}</p>
            <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">
              {accountRole} account
            </p>
          </Link>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label="Log out"
          title="Log out"
          onClick={() => {
            if (hasUnsavedChanges()) setLogoutWarning(true);
            else logout();
          }}
        >
          <LogOut className="size-3.5" />
        </Button>
      </div>
    </>
  );
  return (
    <>
      <div
        inert={restoring}
        aria-hidden={restoring || undefined}
        className={cn(restoring && 'pointer-events-none select-none blur-[3px]')}
      >
        <Dialog
          open={logoutWarning}
          onOpenChange={setLogoutWarning}
          title="Log out without saving?"
          description="Your article has unsaved changes. Save your work first or discard it to log out."
        >
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setLogoutWarning(false)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setLogoutWarning(false);
                logout();
              }}
            >
              Discard & log out
            </Button>
          </div>
        </Dialog>
        <a
          href="#main-content"
          className="sr-only z-[100] rounded bg-primary p-3 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-sidebar md:flex',
            collapsed ? 'w-[76px]' : 'w-[240px]',
          )}
        >
          {sidebar(collapsed)}
        </aside>
        <Dialog
          open={mobile}
          onOpenChange={setMobile}
          title="Navigation"
          className="left-0 top-0 h-dvh max-h-dvh w-72 max-w-none translate-x-0 translate-y-0 rounded-none p-0 [&>h2]:sr-only [&>p]:sr-only [&>div:last-child]:mt-0"
        >
          <div className="flex h-dvh flex-col">{sidebar(false)}</div>
        </Dialog>
        <div
          className={cn(
            'min-h-dvh',
            tablePage && 'table-page',
            collapsed ? 'md:pl-[76px]' : 'md:pl-[240px]',
          )}
        >
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b bg-card/95 px-5 backdrop-blur-sm sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open navigation"
                onClick={() => setMobile(true)}
              >
                <Menu />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:inline-flex"
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                onClick={() => update({ collapsed: !collapsed })}
              >
                {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
              </Button>
              <nav aria-label="Breadcrumb" className="flex items-center gap-2 truncate text-xs">
                <Link className="text-muted-foreground" to="/dashboard">
                  Workspace
                </Link>
                <ChevronRight className="size-3 text-muted-foreground" />
                <span className="font-medium">{current?.label ?? 'Page'}</span>
                {location.pathname.split('/').length > 2 && (
                  <>
                    <ChevronRight className="size-3 text-muted-foreground" />
                    <span>{location.pathname.endsWith('/new') ? 'New article' : 'Details'}</span>
                  </>
                )}
              </nav>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="hidden text-xs text-muted-foreground sm:block">
                {new Intl.DateTimeFormat(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }).format(new Date())}
              </span>
              <span className="h-5 border-l" />
              <Link
                to="/profile"
                className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary"
                aria-label="My profile"
              >
                {initials(accountName)}
              </Link>
            </div>
          </header>
          <main
            id="main-content"
            tabIndex={-1}
            className={cn(
              'mx-auto w-full max-w-[1600px] px-5 py-7 outline-none sm:px-8 lg:px-10 lg:py-9',
              tablePage && 'table-page-main',
            )}
          >
            {restoring ? (
              <div
                className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden"
                aria-hidden="true"
              >
                <div className="space-y-3">
                  <div className="h-7 w-48 rounded bg-muted" />
                  <div className="h-4 w-72 max-w-full rounded bg-muted" />
                </div>
                <div className="min-h-0 flex-1 overflow-hidden rounded-xl border bg-card">
                  <div className="h-16 border-b" />
                  <Loading rows={7} />
                </div>
              </div>
            ) : (
              <Outlet />
            )}
          </main>
          <footer className="mx-5 mt-8 flex flex-wrap justify-between gap-2 border-t py-5 text-[10px] text-muted-foreground sm:mx-8 lg:mx-10">
            <span>Blog Admin · Editorial workspace</span>
            <Link to="/profile" className="inline-flex items-center gap-1">
              Signed in as {accountName}
              <ArrowUpRight className="size-3" />
            </Link>
          </footer>
        </div>
      </div>
      {restoring && (
        <div
          role="status"
          aria-label="Loading"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/20"
        >
          <div className="rounded-xl border bg-card p-4 text-primary shadow-lg [&>svg]:size-6">
            <Spinner />
          </div>
        </div>
      )}
    </>
  );
}
