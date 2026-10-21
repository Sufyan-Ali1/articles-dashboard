import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate, useLocation } from 'react-router-dom';
import { ArrowRight, BookOpenText, Eye, EyeOff, Feather } from 'lucide-react';
import { useAuth } from './auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ErrorState, Field, Spinner } from '@/components/shared';
export const loginSchema = z.object({
  email: z.string().trim().email('Enter a valid email address.').max(255),
  password: z.string().min(1, 'Enter your password.').max(128),
});
export default function LoginPage() {
  const { user, login } = useAuth();
  const location = useLocation();
  const [error, setError] = useState<unknown>(null);
  const [visible, setVisible] = useState(false);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const candidate = (location.state as { from?: string } | null)?.from;
  const destination =
    candidate?.startsWith('/') && !candidate.startsWith('//') && !candidate.startsWith('/login')
      ? candidate
      : '/dashboard';
  if (user) return <Navigate to={destination} replace />;
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#11132a] p-12 text-white lg:flex">
        <div className="relative z-10 flex items-center gap-3 text-xl font-semibold">
          <div className="rounded-xl bg-indigo-500 p-2.5">
            <BookOpenText className="size-6" />
          </div>
          Blog Admin
        </div>
        <div className="relative z-10 max-w-lg">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-indigo-200">
            <Feather className="size-3.5" />
            Your editorial workspace
          </div>
          <h1 className="text-5xl font-medium leading-[1.18] tracking-tight">
            Great stories
            <br />
            start here.
          </h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-slate-400">
            A thoughtful space to write, organize, and publish content that matters.
          </p>
          <div className="mt-12 flex gap-3">
            <span className="h-1 w-12 rounded bg-indigo-400" />
            <span className="h-1 w-5 rounded bg-white/15" />
            <span className="h-1 w-5 rounded bg-white/15" />
          </div>
        </div>
        <p className="relative z-10 text-xs text-slate-500">
          Write with purpose. Publish with confidence.
        </p>
        <div className="pointer-events-none absolute -right-60 top-1/4 size-[650px] rounded-full border border-indigo-400/10" />
        <div className="pointer-events-none absolute -right-44 top-[28%] size-[520px] rounded-full border border-indigo-400/10" />
      </aside>
      <main className="flex items-center justify-center bg-background p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 flex items-center gap-2 font-semibold lg:hidden">
            <BookOpenText className="size-6 text-primary" />
            Blog Admin
          </div>
          <div className="mb-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Welcome back
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">Sign in to your workspace</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Enter your staff credentials to continue.
            </p>
          </div>
          <form
            className="space-y-5"
            onSubmit={form.handleSubmit(async (values) => {
              setError(null);
              try {
                await login(values.email.toLowerCase(), values.password);
              } catch (e) {
                setError(e);
              }
            })}
          >
            <Field
              label="Email address"
              htmlFor="email"
              error={form.formState.errors.email?.message}
            >
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                aria-invalid={!!form.formState.errors.email}
                {...form.register('email')}
              />
            </Field>
            <Field
              label="Password"
              htmlFor="password"
              error={form.formState.errors.password?.message}
            >
              <div className="relative">
                <Input
                  id="password"
                  type={visible ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="pr-10"
                  placeholder="Enter your password"
                  aria-invalid={!!form.formState.errors.password}
                  {...form.register('password')}
                />
                <button
                  type="button"
                  aria-label={visible ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-3 text-muted-foreground"
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </Field>
            {error != null && <ErrorState compact error={error} />}
            <Button
              size="lg"
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <Spinner />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="ml-auto" />
                </>
              )}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
            Staff access only. Contact your administrator
            <br />
            if you need an account or password assistance.
          </p>
          <div className="mt-12 border-t pt-5 text-center text-[11px] text-muted-foreground">
            Sessions end on refresh to keep your account secure.
          </div>
        </div>
      </main>
    </div>
  );
}
