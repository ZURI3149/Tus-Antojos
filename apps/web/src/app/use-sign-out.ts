import { useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { useOutbox } from './outbox-context';

/**
 * Cierra sesión y vuelve a /login. Si el usuario tiene pedidos sin sincronizar pide confirmación:
 * la cola se conserva, pero esos pedidos solo se envían con su sesión (OP-D8).
 */
export function useSignOutAndLeave() {
  const { signOut, session } = useAuth();
  const { entries } = useOutbox();
  const navigate = useNavigate();
  const userId = session?.user.id;
  const pending = entries.filter((e) => e.cashierId === userId).length;
  return async () => {
    if (pending > 0) {
      const what =
        pending === 1 ? '1 pedido sin sincronizar' : `${pending} pedidos sin sincronizar`;
      const ok = window.confirm(
        `Hay ${what}. Se enviarán cuando vuelvas a iniciar sesión en esta caja. ¿Cerrar sesión igual?`,
      );
      if (!ok) return;
    }
    await signOut();
    navigate('/login', { replace: true });
  };
}
