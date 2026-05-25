import React, { useState, useEffect } from 'react';
import { X, Building, ChevronDown, Check } from 'lucide-react';
import { Account } from '../types';

interface BankInfo {
  code: string;
  name: string;
  fullName: string;
  ispb: string;
}

interface AccountFormProps {
  isOpen: boolean;
  onClose: () => void;
  accountToEdit: Account | null;
  onSave: (accountData: Partial<Account>) => Promise<void>;
}

export function AccountForm({ 
  isOpen, 
  onClose, 
  accountToEdit, 
  onSave 
}: AccountFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'checking' | 'savings' | 'wallet' | 'investment'>('checking');
  const [balance, setBalance] = useState('');
  const [agency, setAgency] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [excludeFromCashFlow, setExcludeFromCashFlow] = useState(false);
  
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (accountToEdit) {
        setName(accountToEdit.name);
        setType(accountToEdit.type);
        setBalance(String(accountToEdit.balance));
        setAgency(accountToEdit.agency || '');
        setAccountNumber(accountToEdit.accountNumber || '');
        setBankCode(accountToEdit.bankCode || '');
        setExcludeFromCashFlow(accountToEdit.excludeFromCashFlow || false);
      } else {
        setName('');
        setType('checking');
        setBalance('');
        setAgency('');
        setAccountNumber('');
        setBankCode('');
        setExcludeFromCashFlow(false);
      }
    }
  }, [isOpen, accountToEdit]);

  useEffect(() => {
    if (isOpen) {
      const fetchBanks = async () => {
        setIsLoadingBanks(true);
        try {
          const res = await fetch('https://brasilapi.com.br/api/banks/v1');
          if (res.ok) {
            const data: BankInfo[] = await res.json();
            // Filter out banks without a code, sort by name
            const validBanks = data
              .filter(b => b.code != null)
              .sort((a, b) => a.name.localeCompare(b.name));
            setBanks(validBanks);
          }
        } catch (error) {
          console.error("Failed to fetch banks", error);
        } finally {
          setIsLoadingBanks(false);
        }
      };
      
      fetchBanks();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !balance) return;

    setIsSaving(true);
    try {
      let accountName = name.trim();
      
      const payload: Partial<Account> = {
        name: accountName,
        type,
        balance: Number(balance),
        excludeFromCashFlow,
      };

      if (agency.trim()) {
        payload.agency = agency.trim();
      }
      if (accountNumber.trim()) {
        payload.accountNumber = accountNumber.trim();
      }
      if (bankCode) {
        payload.bankCode = bankCode;
      }

      if (bankCode) {
        const selectedBank = banks.find(b => String(b.code) === String(bankCode));
        if (selectedBank) {
          payload.bankName = selectedBank.name;
          if (!accountName.toLowerCase().includes(selectedBank.name.toLowerCase())) {
            payload.name = `[${selectedBank.name}] ${accountName}`;
          }
        }
      }

      await onSave(payload);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;
  
  const showBankFields = ['checking', 'savings', 'investment'].includes(type);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <h3 className="text-base font-bold text-foreground">
            {accountToEdit ? 'Editar Configurações da Conta' : 'Abrir Nova Conta'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-md text-muted-foreground transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Nome Identificador
            </label>
            <input
              type="text"
              placeholder="Ex: Conta Nubank, Dinheiro Físico"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-sm outline-none focus:border-primary transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Tipo de Conta
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-xs outline-none focus:border-primary transition"
              >
                <option value="checking">Corrente</option>
                <option value="savings">Poupança</option>
                <option value="investment">Investimento</option>
                <option value="wallet">Dinheiro</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Saldo Inicial (R$)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0,00"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-xs outline-none focus:border-primary transition"
              />
            </div>
          </div>

          {showBankFields && (
            <div className="space-y-4 pt-2 border-t border-border mt-2">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Instituição Financeira
                </label>
                <div className="relative">
                  <div
                    className={`w-full px-3 py-2 pl-9 border ${showBankDropdown ? 'border-primary' : 'border-border'} bg-background text-foreground rounded-xl text-xs outline-none transition cursor-pointer flex justify-between items-center ${isLoadingBanks ? 'opacity-50 pointer-events-none' : ''}`}
                    onClick={() => {
                        if (!isLoadingBanks) {
                            setShowBankDropdown(!showBankDropdown);
                            setBankSearch('');
                        }
                    }}
                  >
                    <div className="truncate flex-1">
                      {bankCode 
                        ? (() => {
                            const found = banks.find(b => String(b.code) === String(bankCode));
                            return found ? `${found.code} - ${found.name}` : bankCode;
                          })()
                        : "Selecione Banco (Opcional)"}
                    </div>
                    <ChevronDown size={14} className={`text-muted-foreground transition-transform ${showBankDropdown ? 'rotate-180' : ''}`} />
                  </div>
                  <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  
                  {showBankDropdown && (
                    <>
                      <div 
                        className="fixed inset-0 z-10" 
                        onClick={() => setShowBankDropdown(false)} 
                      />
                      <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-lg max-h-60 flex flex-col overflow-hidden">
                        <div className="p-2 border-b border-border bg-card">
                          <input
                            type="text"
                            placeholder="Buscar banco por nome ou código..."
                            value={bankSearch}
                            onChange={(e) => setBankSearch(e.target.value)}
                            className="w-full px-2 py-1.5 bg-background border border-border rounded-lg text-xs outline-none focus:border-primary"
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        </div>
                        <div className="overflow-y-auto flex-1 h-[200px]">
                          <div 
                            className="px-3 py-2 text-xs hover:bg-muted cursor-pointer transition-colors flex items-center justify-between"
                            onClick={() => { setBankCode(''); setShowBankDropdown(false); }}
                          >
                            <span className="text-muted-foreground italic">Nenhum (Remover Vínculo)</span>
                            {!bankCode && <Check size={14} className="text-primary" />}
                          </div>
                          {banks
                            .filter(b => b.name.toLowerCase().includes(bankSearch.toLowerCase()) || String(b.code).includes(bankSearch))
                            .map(bank => (
                              <div
                                key={`${bank.code}-${bank.ispb}`}
                                className="px-3 py-2 text-xs hover:bg-muted cursor-pointer transition-colors flex items-center justify-between overflow-hidden"
                                onClick={() => { setBankCode(String(bank.code)); setShowBankDropdown(false); }}
                              >
                                <span className="truncate pr-2" title={`${bank.code} - ${bank.name}`}>{bank.code} - {bank.name}</span>
                                {String(bank.code) === String(bankCode) && <Check size={14} className="text-primary shrink-0" />}
                              </div>
                            ))
                          }
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Agência
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 0001"
                    value={agency}
                    onChange={(e) => setAgency(e.target.value)}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-xs outline-none focus:border-primary transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Número da Conta
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 12345-6"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-xs outline-none focus:border-primary transition"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-border flex items-start gap-2">
            <input
              type="checkbox"
              id="excludeFromCashFlow"
              checked={excludeFromCashFlow}
              onChange={(e) => setExcludeFromCashFlow(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="excludeFromCashFlow" className="text-xs text-muted-foreground leading-relaxed cursor-pointer select-none">
              <strong className="text-foreground block">Isolar saldo (Reserva/Investimento)</strong>
              Omitir o saldo desta conta do cálculo de Disponível Seguro (ideal para reservas de emergência ou investimentos).
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-muted border border-border text-muted-foreground rounded-xl text-xs font-bold transition hover:text-foreground cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-md cursor-pointer hover:opacity-95 disabled:opacity-50"
            >
              {isSaving ? "Salvando..." : (accountToEdit ? "Salvar" : "Criar Conta")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
