import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUser, UpdateUser, User } from '@tus-antojos/shared';
import { toast } from 'sonner';
import { ApiError } from '@/lib/api-client';
import { useApi } from '@/lib/api-context';

const usersKey = ['users'] as const;

/** 401 y 403 ya los avisa el cliente HTTP; el resto se muestra aquí. */
export function notifyError(error: unknown): void {
  if (
    error instanceof ApiError &&
    (error.code === 'UNAUTHENTICATED' || error.code === 'FORBIDDEN')
  ) {
    return;
  }
  toast.error(error instanceof Error ? error.message : 'Ocurrió un error inesperado');
}

export function useUsers() {
  const api = useApi();
  return useQuery({ queryKey: usersKey, queryFn: () => api.get<User[]>('/users') });
}

export function useCreateUser() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUser) => api.post<User>('/users', input),
    onSuccess: (created) => {
      queryClient.setQueryData<User[]>(usersKey, (users = []) => [...users, created]);
      toast.success('Usuario creado');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}

export function useUpdateUser() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateUser }) =>
      api.patch<User>(`/users/${id}`, changes),
    // Optimista: la fila cambia al instante y vuelve atrás si la API lo rechaza.
    onMutate: async ({ id, changes }) => {
      await queryClient.cancelQueries({ queryKey: usersKey });
      const previous = queryClient.getQueryData<User[]>(usersKey);
      queryClient.setQueryData<User[]>(usersKey, (users = []) =>
        users.map((u) => (u.id === id ? { ...u, ...changes } : u)),
      );
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(usersKey, context.previous);
      notifyError(error);
    },
    onSuccess: () => toast.success('Usuario actualizado'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: usersKey }),
  });
}
