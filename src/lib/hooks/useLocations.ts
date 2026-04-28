import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getLocations, saveLocations } from '@/lib/store';

const LOCATIONS_KEY = ['locations'] as const;

export function useLocations() {
  return useQuery({ queryKey: LOCATIONS_KEY, queryFn: getLocations, staleTime: 60_000 });
}

export function useSaveLocations() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: saveLocations,
    onSuccess: () => qc.invalidateQueries({ queryKey: LOCATIONS_KEY }),
  });
}
