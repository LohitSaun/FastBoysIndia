import { skipToken, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { selectUserId } from '@/features/auth/authSlice';
import { useAppSelector } from '@/store';

import {
  createCrew,
  deleteCrew,
  fetchCrew,
  fetchCrewMembers,
  fetchMyCrews,
  joinCrewByCode,
  leaveCrew,
  removeMember,
  renameCrew,
} from './api';

export const crewKeys = {
  mine: ['crews'] as const,
  crew: (crewId: string) => ['crew', crewId] as const,
  members: (crewId: string) => ['crew-members', crewId] as const,
};

function logInDev(error: unknown) {
  if (__DEV__) console.warn('[crews]', error);
}

export function useMyCrews() {
  return useQuery({ queryKey: crewKeys.mine, queryFn: fetchMyCrews });
}

export function useCrew(crewId: string | undefined) {
  return useQuery({
    queryKey: crewKeys.crew(crewId ?? 'none'),
    queryFn: crewId ? () => fetchCrew(crewId) : skipToken,
  });
}

export function useCrewMembers(crewId: string | undefined) {
  return useQuery({
    queryKey: crewKeys.members(crewId ?? 'none'),
    queryFn: crewId ? () => fetchCrewMembers(crewId) : skipToken,
  });
}

export function useCreateCrew() {
  const queryClient = useQueryClient();
  const userId = useAppSelector(selectUserId);

  return useMutation({
    mutationFn: (input: { name: string; city_id: string }) => {
      if (!userId) throw new Error('Not signed in');
      return createCrew(userId, input);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: crewKeys.mine }),
    onError: logInDev,
  });
}

export function useJoinCrew() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => joinCrewByCode(code.trim().toUpperCase()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: crewKeys.mine }),
    onError: logInDev,
  });
}

export function useRenameCrew(crewId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => renameCrew(crewId, name),
    onSuccess: (crew) => {
      queryClient.setQueryData(crewKeys.crew(crewId), crew);
      queryClient.invalidateQueries({ queryKey: crewKeys.mine });
    },
    onError: logInDev,
  });
}

export function useLeaveCrew() {
  const queryClient = useQueryClient();
  const userId = useAppSelector(selectUserId);

  return useMutation({
    mutationFn: (crewId: string) => {
      if (!userId) throw new Error('Not signed in');
      return leaveCrew(crewId, userId);
    },
    onSuccess: (_result, crewId) => {
      queryClient.removeQueries({ queryKey: crewKeys.crew(crewId) });
      queryClient.invalidateQueries({ queryKey: crewKeys.mine });
    },
    onError: logInDev,
  });
}

export function useDeleteCrew() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (crewId: string) => deleteCrew(crewId),
    onSuccess: (_result, crewId) => {
      queryClient.removeQueries({ queryKey: crewKeys.crew(crewId) });
      queryClient.invalidateQueries({ queryKey: crewKeys.mine });
    },
    onError: logInDev,
  });
}

export function useRemoveMember(crewId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userId: string) => removeMember(crewId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: crewKeys.members(crewId) }),
    onError: logInDev,
  });
}
