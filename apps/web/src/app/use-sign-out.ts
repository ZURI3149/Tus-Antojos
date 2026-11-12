import { useNavigate } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';

/** Cierra sesión y vuelve a /login. */
export function useSignOutAndLeave() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return async () => {
    await signOut();
    navigate('/login', { replace: true });
  };
}
