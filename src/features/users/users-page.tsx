import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Shield, UserRound, UserRoundX } from 'lucide-react';
import { toast } from 'sonner';
import { usersApi } from './api';
import { useAuth } from '@/features/auth/auth';
import { useScope } from '@/hooks/use-private-query';
import { useList } from '@/hooks/use-list';
import { date, initials } from '@/lib/utils';
import type { User } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog } from '@/components/ui/dialog';
import {
  Card,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  Field,
  FormActions,
  Loading,
  PageHeader,
  Pagination,
  SearchInput,
  Table,
} from '@/components/shared';
export const userSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(150),
  email: z.string().trim().email().max(255),
  password: z
    .string()
    .max(128)
    .refine((value) => !value || value.length >= 12, 'Use at least 12 characters.'),
  role: z.enum(['admin', 'editor', 'author']),
  is_active: z.boolean(),
});
function UserForm({ record, onClose }: { record?: User; onClose: () => void }) {
  const client = useQueryClient();
  const { user, refreshUser } = useAuth();
  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: record?.name ?? '',
      email: record?.email ?? '',
      password: '',
      role: record?.role ?? 'author',
      is_active: record?.is_active ?? true,
    },
  });
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof userSchema>) =>
      record
        ? usersApi.update(record.id, {
            name: values.name,
            email: values.email.toLowerCase(),
            role: values.role,
            is_active: values.is_active,
            ...(values.password ? { password: values.password } : {}),
          })
        : usersApi.create({
            ...values,
            email: values.email.toLowerCase(),
            password: values.password,
          }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['users'] }),
        client.invalidateQueries({ queryKey: ['articles'] }),
        client.invalidateQueries({ queryKey: ['logs'] }),
      ]);
      if (record?.id === user?.id) await refreshUser();
      form.reset();
      toast.success(record ? 'Account updated.' : 'Team member created.');
      onClose();
    },
  });
  return (
    <form
      className="space-y-4"
      onSubmit={form.handleSubmit((values) => {
        if (!record && !values.password) {
          form.setError('password', {
            message: 'A password of at least 12 characters is required.',
          });
          return;
        }
        mutation.mutate(values);
      })}
    >
      <Field label="Full name" htmlFor="staff-name" error={form.formState.errors.name?.message}>
        <Input autoFocus id="staff-name" autoComplete="name" {...form.register('name')} />
      </Field>
      <Field
        label="Email address"
        htmlFor="staff-email"
        error={form.formState.errors.email?.message}
      >
        <Input id="staff-email" type="email" autoComplete="off" {...form.register('email')} />
      </Field>
      <Field
        label={record ? 'New password (optional)' : 'Password'}
        htmlFor="staff-password"
        error={form.formState.errors.password?.message}
        hint={
          record ? 'Leave blank to keep the existing password.' : 'Between 12 and 128 characters.'
        }
      >
        <Input
          id="staff-password"
          type="password"
          autoComplete="new-password"
          {...form.register('password')}
        />
      </Field>
      <Field label="Role" htmlFor="staff-role">
        <Select id="staff-role" {...form.register('role')}>
          <option value="author">Author — own drafts</option>
          <option value="editor">Editor — content & requests</option>
          <option value="admin">Admin — full management</option>
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 accent-indigo-600"
          {...form.register('is_active')}
        />
        Active account
      </label>
      {record?.id === user?.id && (
        <p className="text-xs leading-5 text-muted-foreground">
          Changes to your role or active status affect your own access immediately.
        </p>
      )}
      {mutation.error && <ErrorState compact error={mutation.error} />}
      <FormActions
        pending={mutation.isPending}
        onCancel={onClose}
        label={record ? 'Save account' : 'Create account'}
      />
    </form>
  );
}
export default function UsersPage() {
  const { user, refreshUser } = useAuth();
  const scope = useScope();
  const list = useList();
  const client = useQueryClient();
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const query = useQuery({
    queryKey: ['users', ...scope, list.base],
    queryFn: ({ signal }) => usersApi.list(list.base, signal),
  });
  const activate = useMutation({
    mutationFn: (id: string) => usersApi.update(id, { is_active: true }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ['users'] }),
        client.invalidateQueries({ queryKey: ['logs'] }),
      ]);
      toast.success('Account activated.');
    },
  });
  return (
    <>
      <PageHeader
        title="Team members"
        description="The people behind your publication. Manage their access here."
        eyebrow="Administration"
      >
        <Button onClick={() => setEditing('new')}>
          <Plus />
          Add team member
        </Button>
      </PageHeader>
      <Card>
        <div className="flex flex-wrap gap-3 border-b p-4">
          <SearchInput
            placeholder="Search team member names…"
            value={list.search}
            onChange={(value) => list.set('search', value)}
          />
          <Select
            aria-label="Sort users"
            className="w-full sm:w-44"
            value={list.sort}
            onChange={(event) => list.set('sort', event.target.value)}
          >
            <option value="-created_at">Newest first</option>
            <option value="name">Name A–Z</option>
            <option value="email">Email A–Z</option>
            <option value="role">Role</option>
            <option value="-updated_at">Recently updated</option>
          </Select>
        </div>
        {activate.error && (
          <div className="p-4">
            <ErrorState compact error={activate.error} />
          </div>
        )}
        {query.isPending ? (
          <Loading />
        ) : query.error ? (
          <div className="p-5">
            <ErrorState error={query.error} retry={() => void query.refetch()} />
          </div>
        ) : !query.data.data.length ? (
          <EmptyState
            title="No team members found"
            description="Try another name or add a new staff account."
          />
        ) : (
          <>
            <Table
              label="Team members"
              headings={['Team member', 'Role', 'Status', 'Joined', 'Actions']}
            >
              {query.data.data.map((member) => (
                <tr key={member.id} className="hover:bg-muted/30">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/8 text-xs font-semibold text-primary">
                        {initials(member.name)}
                      </span>
                      <div>
                        <p className="font-medium">
                          {member.name}
                          {member.id === user?.id && (
                            <span className="ml-2 text-[10px] text-muted-foreground">You</span>
                          )}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge
                      tone={
                        member.role === 'admin'
                          ? 'purple'
                          : member.role === 'editor'
                            ? 'blue'
                            : 'neutral'
                      }
                    >
                      {member.role === 'admin' ? (
                        <Shield className="size-3" />
                      ) : (
                        <UserRound className="size-3" />
                      )}
                      <span className="capitalize">{member.role}</span>
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <Badge tone={member.is_active ? 'green' : 'neutral'}>
                      {member.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                    {date(member.created_at)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${member.name}`}
                        onClick={() => setEditing(member)}
                      >
                        <Pencil />
                      </Button>
                      {member.is_active ? (
                        <ConfirmDialog
                          title="Deactivate account?"
                          description={`“${member.name}” will lose access immediately. Their articles and audit history will be preserved. The last active admin cannot be deactivated.`}
                          onConfirm={async () => {
                            await usersApi.deactivate(member.id);
                            await client.invalidateQueries({ queryKey: ['users'] });
                            await client.invalidateQueries({ queryKey: ['logs'] });
                            if (member.id === user?.id) await refreshUser();
                            toast.success('Account deactivated.');
                          }}
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Deactivate ${member.name}`}
                          >
                            <UserRoundX className="text-destructive" />
                          </Button>
                        </ConfirmDialog>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={activate.isPending}
                          onClick={() => activate.mutate(member.id)}
                        >
                          Activate
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </>
        )}
        {query.data && !query.error && <Pagination meta={query.data.meta} set={list.set} />}
      </Card>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        title={editing === 'new' ? 'Add team member' : 'Edit team member'}
        description="Staff accounts are managed by administrators."
      >
        {editing !== null && (
          <UserForm
            key={editing === 'new' ? 'new' : editing.id}
            record={editing === 'new' ? undefined : editing}
            onClose={() => setEditing(null)}
          />
        )}
      </Dialog>
    </>
  );
}
