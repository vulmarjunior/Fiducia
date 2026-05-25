import React from 'react';
import { Transaction } from '../types';
import { AlertCircle, Clock, CheckCircle2, ChevronRight, Bell } from 'lucide-react';

interface AlertsManagerProps {
  transactions: Transaction[];
  onNavigate: (tab: string) => void;
}

export const AlertsManager: React.FC<AlertsManagerProps> = ({ transactions, onNavigate }) => {
  const now = new Date();
  
  // Atrasadas (Overdue Expenses): type expense, status pending, date < now, not credit card
  const overdueExpenses = transactions.filter(tx => 
    (tx.type === 'expense' || tx.type === 'despesa') && 
    (tx.status === 'pending' || tx.status === 'pendente') && 
    !tx.creditCardId &&
    new Date(tx.date) < now
  );

  // A Vencer (Upcoming Expenses within 7 days): type expense, status pending, now <= date <= now + 7 days, not credit card
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);
  
  const upcomingExpenses = transactions.filter(tx => 
    (tx.type === 'expense' || tx.type === 'despesa') && 
    (tx.status === 'pending' || tx.status === 'pendente') && 
    !tx.creditCardId &&
    new Date(tx.date) >= now && new Date(tx.date) <= sevenDaysFromNow
  );

  // A Receber (Upcoming/Overdue Income): type income, status pending, date <= now + 7 days
  const pendingIncomes = transactions.filter(tx => 
    (tx.type === 'income' || tx.type === 'receita') && 
    (tx.status === 'pending' || tx.status === 'pendente') && 
    !tx.creditCardId &&
    new Date(tx.date) <= sevenDaysFromNow
  );

  // All alerts in chronological order
  const allAlerts = [
    ...overdueExpenses.map(tx => ({ ...tx, alertType: 'overdue_expense' as const })),
    ...upcomingExpenses.map(tx => ({ ...tx, alertType: 'upcoming_expense' as const })),
    ...pendingIncomes.map(tx => ({ ...tx, alertType: 'pending_income' as const }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const getAlertStyle = (type: 'overdue_expense' | 'upcoming_expense' | 'pending_income') => {
    switch (type) {
      case 'overdue_expense': return 'bg-red-500/10 border-red-500/20 text-red-500';
      case 'upcoming_expense': return 'bg-orange-500/10 border-orange-500/20 text-orange-500';
      case 'pending_income': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500';
    }
  };

  const getAlertIcon = (type: 'overdue_expense' | 'upcoming_expense' | 'pending_income') => {
    switch (type) {
      case 'overdue_expense': return <AlertCircle size={18} className="text-red-500" />;
      case 'upcoming_expense': return <Clock size={18} className="text-orange-500" />;
      case 'pending_income': return <CheckCircle2 size={18} className="text-emerald-500" />;
    }
  };

  const getAlertText = (type: 'overdue_expense' | 'upcoming_expense' | 'pending_income') => {
    switch (type) {
      case 'overdue_expense': return 'Conta Atrasada';
      case 'upcoming_expense': return 'Conta a Vencer (7 dias)';
      case 'pending_income': return 'A Receber';
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden flex flex-col">
      <div className="p-6 border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 text-primary rounded-xl">
            <Bell size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Central de Alertas</h2>
            <p className="text-xs text-muted-foreground">Antecedência padrão: 7 dias</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="bg-background border border-red-500/20 rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Contas Atrasadas</p>
              <p className="text-2xl font-bold text-red-500">{overdueExpenses.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle size={20} className="text-red-500" />
            </div>
          </div>
          <div className="bg-background border border-orange-500/20 rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Contas a Vencer</p>
              <p className="text-2xl font-bold text-orange-500">{upcomingExpenses.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
              <Clock size={20} className="text-orange-500" />
            </div>
          </div>
          <div className="bg-background border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">A Receber</p>
              <p className="text-2xl font-bold text-emerald-500">{pendingIncomes.length}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 size={20} className="text-emerald-500" />
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-sm font-bold text-foreground mb-4">Próximos Alertas (Ordem Cronológica)</h3>
        
        {allAlerts.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
            <CheckCircle2 size={40} className="text-muted-foreground opacity-30 mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">Tudo em dia!</p>
            <p className="text-xs text-muted-foreground">Não há contas a vencer ou recebimentos pendentes.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {allAlerts.map(alert => {
              const daysDiff = Math.ceil((new Date(alert.date).getTime() - now.getTime()) / (1000 * 3600 * 24));
              let timeLabel = '';
              if (daysDiff < 0) {
                timeLabel = `(Há ${Math.abs(daysDiff)} dias)`;
              } else if (daysDiff === 0) {
                timeLabel = '(Hoje)';
              } else {
                timeLabel = `(Em ${daysDiff} dias)`;
              }

              return (
                <div key={alert.id} className="flex items-center gap-4 bg-background border border-border rounded-xl p-4 shadow-sm hover:border-primary/50 transition relative overflow-hidden group">
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${getAlertStyle(alert.alertType)}`} />
                  
                  <div className="w-10 h-10 flex shrink-0 items-center justify-center rounded-full bg-muted/50 border border-border group-hover:bg-background transition">
                    {getAlertIcon(alert.alertType)}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${getAlertStyle(alert.alertType)}`}>
                        {getAlertText(alert.alertType)}
                      </span>
                      <span className="text-xs font-semibold text-muted-foreground">
                        {new Date(alert.date).toLocaleDateString('pt-BR')} {timeLabel}
                      </span>
                    </div>
                    <p className="text-sm font-bold text-foreground mt-1">{alert.description}</p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">R$ {alert.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <button 
                      onClick={() => onNavigate('transactions')}
                      className="text-xs mt-1 text-primary hover:underline flex items-center justify-end font-semibold"
                    >
                      Acessar <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
