import { useMutation, useQueryClient } from '@tanstack/react-query';

import { selectUserId } from '@/features/auth/authSlice';
import { supabase } from '@/services/supabase/client';
import { useAppSelector } from '@/store';

import { deleteMyAccount, deleteMyFiles } from './api';

function logInDev(error: unknown) {
  if (__DEV__) console.warn('[account]', error);
}

/**
 * Deleting the account: files, then rows, then sign out.
 *
 * The cache is cleared rather than invalidated. Invalidating would send every
 * screen off to refetch data that no longer exists, against an account that no
 * longer exists, and each one would fail on its way out.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const userId = useAppSelector(selectUserId);

  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('Not signed in');

      await deleteMyFiles(userId);
      await deleteMyAccount();

      // The account is gone, so the server has nothing left to sign out of and
      // the usual call can fail with a 401. A local sign-out clears the session
      // on this phone without asking the server, which is all that's left to do.
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (error) {
        logInDev(error);
      }
      queryClient.clear();
    },
    onError: logInDev,
  });
}
