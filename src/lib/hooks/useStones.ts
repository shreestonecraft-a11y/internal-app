import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addStone, bulkAddStones, bulkDeleteStones, deleteStone, getStones, updateStone,
  type StoneItem,
} from '@/lib/store';

const STONES_KEY = ['stones'] as const;

export function useStones() {
  return useQuery({ queryKey: STONES_KEY, queryFn: getStones, staleTime: 30_000 });
}

export function useAddStone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addStone,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STONES_KEY });
      qc.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}

export function useUpdateStone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<StoneItem> }) =>
      updateStone(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STONES_KEY });
      qc.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}

export function useDeleteStone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteStone,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STONES_KEY });
    },
  });
}

export function useBulkAddStones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bulkAddStones,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STONES_KEY });
      qc.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}

export function useBulkDeleteStones() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: bulkDeleteStones,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: STONES_KEY });
    },
  });
}
