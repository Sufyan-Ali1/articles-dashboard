import { api } from '@/lib/api';
import type { ListParams, Page, Resource, User, UserInput } from '@/types/api';
export const usersApi = {
  list: (params: ListParams, signal?: AbortSignal) => api<Page<User>>('/users', { params, signal }),
  create: (body: UserInput & { password: string }) =>
    api<Resource<User>>('/users', { method: 'POST', body }),
  update: (id: string, body: Partial<UserInput>) =>
    api<Resource<User>>(`/users/${id}`, { method: 'PATCH', body }),
  deactivate: (id: string) => api<void>(`/users/${id}`, { method: 'DELETE' }),
};
