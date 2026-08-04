import { CheckCircle2, Circle, Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';

interface OnboardingChecklistProps {
  accountCount: number;
  transactionCount: number;
  cardCount: number;
  budgetCount: number;
  onCreateTransaction: () => void;
  onDismiss: () => void;
}

export function OnboardingChecklist({
  accountCount,
  transactionCount,
  cardCount,
  budgetCount,
  onCreateTransaction,
  onDismiss,
}: OnboardingChecklistProps) {
  const steps = [
    { label: 'Cadastre sua primeira conta', complete: accountCount > 0, to: '/accounts' },
    { label: 'Registre seu primeiro lançamento', complete: transactionCount > 0, action: onCreateTransaction },
    { label: 'Adicione um cartão, se você usa crédito', complete: cardCount > 0, to: '/cards', optional: true },
    { label: 'Defina um orçamento mensal', complete: budgetCount > 0, to: '/budgets', optional: true },
  ];
  const completed = steps.filter((step) => step.complete).length;

  return (
    <section aria-labelledby="onboarding-title" className="rounded-2xl border border-fiducia-blue/20 bg-gradient-to-br from-fiducia-blue/10 via-card to-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-fiducia-blue">Primeiros passos</p>
          <h2 id="onboarding-title" className="mt-1 text-lg font-bold">Prepare o Fiducia para mostrar sua situação real</h2>
          <p className="mt-1 text-sm text-muted-foreground">Concluído: {completed} de {steps.length}. Os itens opcionais podem ser feitos depois.</p>
        </div>
        <button type="button" aria-label="Ocultar primeiros passos" onClick={onDismiss} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        <div className="h-full rounded-full bg-fiducia-blue transition-all" style={{ width: `${completed / steps.length * 100}%` }} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((step) => {
          const content = (
            <>
              {step.complete ? <CheckCircle2 className="h-5 w-5 shrink-0 text-fiducia-green" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}
              <span className={step.complete ? 'text-muted-foreground line-through' : 'text-foreground'}>{step.label}</span>
              {step.optional && !step.complete && <span className="ml-auto text-[10px] uppercase text-muted-foreground">Opcional</span>}
            </>
          );
          const classes = 'flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left text-sm hover:bg-secondary/60';
          if (step.action && !step.complete) return <button key={step.label} type="button" onClick={step.action} className={classes}>{content}</button>;
          if (step.to && !step.complete) return <Link key={step.label} to={step.to} className={classes}>{content}</Link>;
          return <div key={step.label} className={classes}>{content}</div>;
        })}
      </div>
      {accountCount === 0 && (
        <Link to="/accounts" className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> Criar primeira conta
        </Link>
      )}
    </section>
  );
}
