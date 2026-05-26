import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createInvoice, deleteInvoice, getInvoices, nextInvoiceNumber, updateInvoice } from '@/lib/store';
import type { Invoice } from '@/lib/store';

const INVOICES_KEY = ['invoices'] as const;

export function useInvoices() {
  return useQuery({ queryKey: INVOICES_KEY, queryFn: getInvoices, staleTime: 30_000 });
}

export function useNextInvoiceNumber(enabled = true) {
  return useQuery({
    queryKey: ['nextInvoiceNumber'],
    queryFn: nextInvoiceNumber,
    enabled,
    staleTime: 0,
  });
}

export function useCreateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createInvoice,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
      qc.invalidateQueries({ queryKey: ['stones'] });
      qc.invalidateQueries({ queryKey: ['logs'] });
      qc.invalidateQueries({ queryKey: ['nextInvoiceNumber'] });
    },
  });
}

export function useUpdateInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Omit<Invoice, 'id' | 'createdAt' | 'number'> }) =>
      updateInvoice(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
      qc.invalidateQueries({ queryKey: ['stones'] });
      qc.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}

export function useDeleteInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteInvoice,
    // Delete now restores stock via RPC — must invalidate stones + logs too.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVOICES_KEY });
      qc.invalidateQueries({ queryKey: ['stones'] });
      qc.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}
