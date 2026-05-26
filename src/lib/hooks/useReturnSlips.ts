import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createReturnSlip, deleteReturnSlip, getReturnSlips, nextReturnSlipNumber, updateReturnSlip } from '@/lib/store';
import type { ReturnSlip } from '@/lib/store';

const RETURN_SLIPS_KEY = ['returnSlips'] as const;

export function useReturnSlips() {
  return useQuery({ queryKey: RETURN_SLIPS_KEY, queryFn: getReturnSlips, staleTime: 30_000 });
}

export function useNextReturnSlipNumber(enabled = true) {
  return useQuery({
    queryKey: ['nextReturnSlipNumber'],
    queryFn: nextReturnSlipNumber,
    enabled,
    staleTime: 0,
  });
}

export function useCreateReturnSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createReturnSlip,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RETURN_SLIPS_KEY });
      qc.invalidateQueries({ queryKey: ['stones'] });
      qc.invalidateQueries({ queryKey: ['logs'] });
      qc.invalidateQueries({ queryKey: ['nextReturnSlipNumber'] });
    },
  });
}

export function useUpdateReturnSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Omit<ReturnSlip, 'id' | 'createdAt' | 'number'> }) =>
      updateReturnSlip(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RETURN_SLIPS_KEY });
      qc.invalidateQueries({ queryKey: ['stones'] });
      qc.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}

export function useDeleteReturnSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteReturnSlip,
    // Delete now re-deducts stock via RPC — invalidate stones + logs too.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RETURN_SLIPS_KEY });
      qc.invalidateQueries({ queryKey: ['stones'] });
      qc.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}
