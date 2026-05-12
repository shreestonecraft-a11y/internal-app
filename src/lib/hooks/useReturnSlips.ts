import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createReturnSlip, deleteReturnSlip, getReturnSlips, nextReturnSlipNumber } from '@/lib/store';

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

export function useDeleteReturnSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteReturnSlip,
    onSuccess: () => qc.invalidateQueries({ queryKey: RETURN_SLIPS_KEY }),
  });
}
