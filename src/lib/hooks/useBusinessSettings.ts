import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getBusinessSettings, updateBusinessSettings } from '@/lib/store';

const KEY = ['business_settings'] as const;

export function useBusinessSettings() {
  return useQuery({ queryKey: KEY, queryFn: getBusinessSettings, staleTime: 5 * 60_000 });
}

export function useUpdateBusinessSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateBusinessSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
