import { useQuery } from '@tanstack/react-query';
import { getLogs } from '@/lib/store';

export function useLogs(limit = 200) {
  return useQuery({
    queryKey: ['logs', limit],
    queryFn: () => getLogs(limit),
    staleTime: 30_000,
  });
}
