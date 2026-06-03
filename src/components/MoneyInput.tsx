import React, { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { cn } from '../lib/utils';
import { CalcPopover } from './CalcPopover';

interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  id?: string;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  showCalc?: boolean;
}

export function MoneyInput({ value, onChange, label, id, className, placeholder, disabled, required, showCalc = true }: MoneyInputProps) {
  // Internal state as string of digits to handle cash register behavior
  const [digits, setDigits] = useState('');

  useEffect(() => {
    // Sync internal state with external value
    // We only update if the external value (converted to cents) differs from our internal digits
    const cents = Math.round((value || 0) * 100);
    const digitsFromValue = cents === 0 ? '' : cents.toString();
    
    if (digitsFromValue !== digits) {
      setDigits(digitsFromValue);
    }
  }, [value]);

  const format = (val: string) => {
    const cents = parseInt(val || '0', 10);
    const floatValue = cents / 100;
    return floatValue.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Get only digits from the input
    const raw = e.target.value.replace(/\D/g, '');
    // Remove leading zeros
    const clean = raw.replace(/^0+/, '');
    
    setDigits(clean);
    const cents = parseInt(clean || '0', 10);
    onChange(cents / 100);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <div className="flex items-center gap-1">
          <Label htmlFor={id} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>
          {showCalc && !disabled && <CalcPopover onResult={onChange} />}
        </div>
      )}
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={format(digits)}
        onChange={handleChange}
        placeholder={placeholder || 'R$ 0,00'}
        disabled={disabled}
        className="font-mono font-bold text-lg h-12"
      />
    </div>
  );
}
