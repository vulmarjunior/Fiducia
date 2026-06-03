import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger, PopoverClose } from './ui/popover';
import { Calculator, Equal, X } from 'lucide-react';

interface CalcPopoverProps {
  onResult: (value: number) => void;
}

function evaluate(expr: string): number | null {
  const sanitized = expr.replace(/[^0-9+\-*/().\s]/g, '').trim();
  if (!sanitized) return null;
  try {
    const result = parseExpression(sanitized);
    if (!isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

function parseExpression(s: string): number {
  let pos = 0;
  function skipSpaces() { while (pos < s.length && s[pos] === ' ') pos++; }
  function peek(): string { skipSpaces(); return s[pos] || ''; }

  function parseNumber(): number {
    skipSpaces();
    let start = pos;
    if (s[pos] === '-') pos++;
    while (pos < s.length && (s[pos] >= '0' && s[pos] <= '9' || s[pos] === '.')) pos++;
    const num = parseFloat(s.slice(start, pos));
    if (isNaN(num)) throw new Error('Invalid number');
    return num;
  }

  function parseFactor(): number {
    skipSpaces();
    if (s[pos] === '(') {
      pos++;
      const result = parseExpression(s);
      skipSpaces();
      if (s[pos] === ')') pos++;
      return result;
    }
    if (s[pos] === '-') {
      pos++;
      return -parseFactor();
    }
    return parseNumber();
  }

  function parseTerm(): number {
    let result = parseFactor();
    skipSpaces();
    while (pos < s.length && (s[pos] === '*' || s[pos] === '/')) {
      const op = s[pos++];
      const right = parseFactor();
      if (op === '*') result *= right;
      else { if (right === 0) throw new Error('Division by zero'); result /= right; }
      skipSpaces();
    }
    return result;
  }

  let result = parseTerm();
  skipSpaces();
  while (pos < s.length && (s[pos] === '+' || s[pos] === '-')) {
    const op = s[pos++];
    const right = parseTerm();
    if (op === '+') result += right;
    else result -= right;
    skipSpaces();
  }
  return result;
}

function formatBR(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CalcPopover({ onResult }: CalcPopoverProps) {
  const [expression, setExpression] = useState('');
  const [open, setOpen] = useState(false);

  const result = evaluate(expression);

  const handleApply = () => {
    if (result !== null) {
      onResult(result);
      setExpression('');
      setOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleApply();
    }
    if (e.key === 'Escape') {
      setExpression('');
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setExpression(''); }}>
      <PopoverTrigger
        render={(props: any) => (
          <button
            {...props}
            type="button"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Calculadora rápida"
          >
            <Calculator className="w-4 h-4" />
          </button>
        )}
      />
      <PopoverContent
        side="bottom"
        align="end"
        className="w-[260px] p-4 rounded-xl shadow-xl border-none bg-popover"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Calculadora</span>
            <PopoverClose
              render={(props: any) => (
                <button
                  {...props}
                  type="button"
                  className="p-1 rounded-md hover:bg-muted transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            />
          </div>

          <input
            type="text"
            inputMode="none"
            autoFocus
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ex: 150+75"
            className="w-full bg-muted border-none rounded-xl px-4 py-3 text-base font-mono font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
          />

          <div className="flex items-center justify-between px-1">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Resultado</span>
              <span className={`text-lg font-mono font-black ${result !== null ? 'text-primary' : 'text-muted-foreground/40'}`}>
                {result !== null ? formatBR(result) : '—'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleApply}
              disabled={result === null}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              <Equal className="w-3.5 h-3.5" />
              Aplicar
            </button>
          </div>

          <p className="text-[10px] text-muted-foreground leading-relaxed text-center">
            + − × ÷ parênteses ( )  ·  Enter p/ aplicar
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
