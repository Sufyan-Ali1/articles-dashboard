import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, Mail, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/auth';
import { usersApi } from '@/features/users/api';
import { date, initials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, ErrorState, Field, Notice, PageHeader, Spinner } from '@/components/shared';
const profileSchema = z.object({
  name: z.string().trim().min(1).max(150),
  email: z.string().trim().email().max(255),
});
export default function ProfilePage() {
  const { user, refreshUser, expiresAt } = useAuth();
  const client = useQueryClient();
  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: user?.name ?? '', email: user?.email ?? '' },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof profileSchema>) =>
      usersApi.update(user!.id, { name: values.name, email: values.email.toLowerCase() }),
    onSuccess: async (result) => {
      await refreshUser();
      form.reset({ name: result.data.name, email: result.data.email });
      await Promise.all([
        client.invalidateQueries({ queryKey: ['users'] }),
        client.invalidateQueries({ queryKey: ['articles'] }),
        client.invalidateQueries({ queryKey: ['logs'] }),
      ]);
      toast.success('Profile updated.');
    },
  });
  if (!user) return null;
  return (
    <>
      <PageHeader
        title="My profile"
        description="Your account and the role you play in your publication."
        eyebrow="Your account"
      />
      <div className="grid max-w-5xl gap-6 lg:grid-cols-[300px_1fr]">
        <Card className="self-start p-6">
          <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-xl font-semibold text-primary">
            {initials(user.name)}
          </div>
          <h2 className="text-xl font-semibold">{user.name}</h2>
          <p className="mt-2 break-all text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-4">
            <Badge tone="purple">
              <ShieldCheck className="size-3" />
              <span className="capitalize">{user.role}</span>
            </Badge>
          </div>
          <div className="mt-6 space-y-4 border-t pt-5 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <CalendarDays className="size-4" />
              Joined {date(user.created_at)}
            </p>
            <p className="flex items-center gap-2">
              <Mail className="size-4" />
              {user.is_active ? 'Active staff account' : 'Inactive account'}
            </p>
          </div>
        </Card>
        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="mb-5 font-semibold">Account details</h2>
            <form
              className="space-y-5"
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            >
              <Field
                label="Full name"
                htmlFor="profile-name"
                error={form.formState.errors.name?.message}
              >
                <Input
                  id="profile-name"
                  readOnly={user.role !== 'admin'}
                  {...form.register('name')}
                />
              </Field>
              <Field
                label="Email address"
                htmlFor="profile-email"
                error={form.formState.errors.email?.message}
              >
                <Input
                  id="profile-email"
                  type="email"
                  readOnly={user.role !== 'admin'}
                  {...form.register('email')}
                />
              </Field>
              {mutation.error && <ErrorState compact error={mutation.error} />}
              {user.role === 'admin' ? (
                <div className="flex justify-end border-t pt-5">
                  <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
                    {mutation.isPending && <Spinner />}Save profile
                  </Button>
                </div>
              ) : (
                <Notice>
                  Your role has read-only account access. Contact an administrator to update your
                  profile.
                </Notice>
              )}
            </form>
          </Card>
          <Card className="p-6">
            <h2 className="mb-3 font-semibold">Session</h2>
            <p className="text-sm leading-6 text-muted-foreground">
              Your session is securely restored after a refresh. Access tokens renew automatically
              while your saved session remains valid. Sign out when you finish on a shared device.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Access token renews by {expiresAt ? new Date(expiresAt).toLocaleTimeString() : '—'}
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
