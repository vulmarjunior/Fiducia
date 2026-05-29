import React, { createContext, useContext, useState, useCallback } from 'react';

export interface DialogOptions {
  editId?: string;
  presetAccountId?: string;
  presetMonth?: string;
  presetType?: string;
}

interface TransactionDialogContextType {
  isOpen: boolean;
  options: DialogOptions | null;
  open: (opts?: DialogOptions) => void;
  close: () => void;
}

const TransactionDialogContext = createContext<TransactionDialogContextType | null>(null);

export function TransactionDialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions | null>(null);

  const open = useCallback((opts?: DialogOptions) => {
    setOptions(opts || null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setOptions(null);
  }, []);

  return (
    <TransactionDialogContext.Provider value={{ isOpen, options, open, close }}>
      {children}
    </TransactionDialogContext.Provider>
  );
}

export function useTransactionDialog() {
  const ctx = useContext(TransactionDialogContext);
  if (!ctx) throw new Error('useTransactionDialog must be used within TransactionDialogProvider');
  return ctx;
}
