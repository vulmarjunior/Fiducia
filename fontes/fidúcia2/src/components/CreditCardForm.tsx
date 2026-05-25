import React, { useState, useEffect } from 'react';
import { X, CreditCard as CardIcon, Building } from 'lucide-react';
import { CreditCard } from '../types';

interface BankInfo {
  code: string;
  name: string;
  fullName: string;
  ispb: string;
}

const CREDIT_CARD_BRANDS = [
  'Visa',
  'Mastercard',
  'Elo',
  'American Express',
  'Hipercard',
  'Diners Club',
  'Outro'
];

interface CreditCardFormProps {
  isOpen: boolean;
  onClose: () => void;
  cardToEdit: CreditCard | null;
  onSave: (cardData: Partial<CreditCard>) => Promise<void>;
  userId: string;
}

export function CreditCardForm({ 
  isOpen, 
  onClose, 
  cardToEdit, 
  onSave,
  userId
}: CreditCardFormProps) {
  const [name, setName] = useState('');
  const [limit, setLimit] = useState('');
  const [closingDay, setClosingDay] = useState<number>(5);
  const [dueDay, setDueDay] = useState<number>(12);
  
  const [brand, setBrand] = useState('Mastercard');
  const [customBrand, setCustomBrand] = useState('');
  
  const [bankCode, setBankCode] = useState('');
  const [banks, setBanks] = useState<BankInfo[]>([]);
  const [isLoadingBanks, setIsLoadingBanks] = useState(false);

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (cardToEdit) {
        // Trying to extract brand from name roughly, by default keep as is
        const cName = cardToEdit.name;
        let foundBrand = 'Outro';
        let foundCustomBrand = '';
        
        for (const b of CREDIT_CARD_BRANDS) {
           if (b !== 'Outro' && cName.toLowerCase().includes(b.toLowerCase())) {
               foundBrand = b;
               break;
           }
        }
        
        setName(cName);
        setLimit(String(cardToEdit.limit));
        setClosingDay(cardToEdit.closingDay);
        setDueDay(cardToEdit.dueDay);
        setBrand(foundBrand);
        setBankCode(''); // Can't map cleanly backwards without adding it to the interface, so we just let it be updated textually
      } else {
        setName('');
        setLimit('');
        setClosingDay(5);
        setDueDay(12);
        setBrand('Mastercard');
        setCustomBrand('');
        setBankCode('');
      }
    }
  }, [isOpen, cardToEdit]);

  useEffect(() => {
    if (isOpen) {
      const fetchBanks = async () => {
        setIsLoadingBanks(true);
        try {
          const res = await fetch('https://brasilapi.com.br/api/banks/v1');
          if (res.ok) {
            const data: BankInfo[] = await res.json();
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
    if (!name.trim() || !limit) return;
    
    setIsSaving(true);
    let cardName = name.trim();
    
    const selectedBrand = brand === 'Outro' ? customBrand.trim() : brand;
    if (selectedBrand && !cardName.toLowerCase().includes(selectedBrand.toLowerCase())) {
        cardName = `${cardName} ${selectedBrand}`;
    }

    if (bankCode) {
        const selectedBank = banks.find(b => String(b.code) === String(bankCode));
        if (selectedBank && !cardName.toLowerCase().includes(selectedBank.name.toLowerCase())) {
             // In future, ideally we have a dedicated bank field. But keeping string parsing based on user's schema
             cardName = `[${selectedBank.name}] ${cardName}`;
        }
    }

    try {
      await onSave({
        name: cardName,
        limit: Number(limit),
        closingDay,
        dueDay,
      });
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200 mt-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <CardIcon size={18} className="text-primary" />
            <h3 className="text-base font-bold text-foreground">
              {cardToEdit ? "Editar Cartão" : "Novo Cartão de Crédito"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-md text-muted-foreground transition"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="space-y-4 p-4 rounded-xl border border-border bg-muted/20">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Bandeira do Cartão
                </label>
                <div className="flex flex-wrap gap-2">
                  {CREDIT_CARD_BRANDS.map(b => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBrand(b)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                            brand === b 
                            ? 'bg-primary border-primary text-primary-foreground' 
                            : 'bg-background border-border text-foreground hover:bg-muted'
                        }`}
                      >
                          {b}
                      </button>
                  ))}
                </div>
                {brand === 'Outro' && (
                    <input
                       type="text"
                       placeholder="Digite a bandeira. Ex: Sorocred"
                       value={customBrand}
                       onChange={(e) => setCustomBrand(e.target.value)}
                       className="w-full mt-2 px-3 py-2 border border-border bg-background text-foreground rounded-lg text-xs outline-none focus:border-primary transition"
                    />
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Banco Emissor (Opcional)
                </label>
                <div className="relative">
                  <select
                    value={bankCode}
                    onChange={(e) => setBankCode(e.target.value)}
                    className="w-full px-3 py-2 pl-9 border border-border bg-background text-foreground rounded-xl text-xs outline-none focus:border-primary transition appearance-none"
                    disabled={isLoadingBanks}
                  >
                    <option value="">Selecione Instituição Financeira</option>
                    {banks.map((bank) => (
                      <option key={`${bank.code}-${bank.ispb}`} value={String(bank.code)}>
                        {bank.code} - {bank.name}
                      </option>
                    ))}
                  </select>
                  <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Nome do Cartão (Apelido)
            </label>
            <input
              type="text"
              placeholder="Ex: Cartão de Casa, Nu, Pessoal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-sm outline-none focus:border-primary transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              Limite Total (R$)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0,00"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-xs outline-none focus:border-primary transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Dia de Fechamento <span className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-1 py-0.5 rounded ml-1">Fatura</span>
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={closingDay}
                onChange={(e) => setClosingDay(Number(e.target.value))}
                required
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-xs outline-none focus:border-primary transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">
                Dia de Vencimento
              </label>
              <input
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(Number(e.target.value))}
                required
                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-xs outline-none focus:border-primary transition"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
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
              {isSaving ? "Salvando..." : (cardToEdit ? "Salvar Alterações" : "Criar Cartão")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
