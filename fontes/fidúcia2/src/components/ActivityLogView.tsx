import React, { useEffect, useState } from 'react';
import { ActivityLog } from '../types';
import { useFirebase } from '../context/FirebaseContext';
import { History, Plus, Minus, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const ActivityLogView: React.FC = () => {
  const { getActivityLogs } = useFirebase();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    setLoading(true);
    const data = await getActivityLogs();
    setLogs(data);
    setLoading(false);
  };

  const getLogIcon = (action: string) => {
    switch(action) {
      case 'create': return <Plus size={16} className="text-emerald-500" />;
      case 'update': return <Edit2 size={16} className="text-blue-500" />;
      case 'delete': return <Trash2 size={16} className="text-red-500" />;
      default: return <History size={16} className="text-slate-500" />;
    }
  };

  const groupLogsByDate = (logs: ActivityLog[]) => {
    const groups: { [key: string]: ActivityLog[] } = {};
    logs.forEach(log => {
      const dateStr = new Date(log.createdAt).toISOString().split('T')[0];
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(log);
    });
    return groups;
  };

  const formatCurrency = (val: any) => {
    if (typeof val === 'number') {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    }
    return val;
  };

  const formatDateValue = (val: any) => {
    try {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        return format(d, 'dd/MM/yyyy');
      }
    } catch (e) {
      // ignore
    }
    return val;
  };

  const renderDataChange = (before: any, after: any) => {
    if (!before && !after) return null;
    
    // For simpler view, only showing keys that changed or main properties of transaction
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    const displayKeys = ['description', 'amount', 'date', 'status', 'accountId', 'categoryId'].filter(k => keys.has(k));
    
    if (displayKeys.length === 0) return null;

    return (
      <div className="flex flex-col md:flex-row gap-4 mt-3 pl-4 md:pl-10 text-xs">
        {before && (
          <div className="flex-1 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 p-3 rounded-lg space-y-1 relative">
            <div className="absolute -top-2 left-6 bg-rose-200 text-rose-800 dark:bg-rose-900 dark:text-rose-200 text-[9px] font-bold px-2 py-0.5 rounded-sm shadow-sm uppercase tracking-wider">
              Antes da Alteração
            </div>
            {displayKeys.map(k => (
              <div key={k} className="flex gap-2 text-muted-foreground">
                <span className="w-20 font-medium capitalize truncate">{k === 'amount' ? 'Valor' : k === 'description' ? 'Descrição' : k === 'date' ? 'Data' : k === 'status' ? 'Status' : k === 'accountId' ? 'Conta' : k === 'categoryId' ? 'Categ.' : k}:</span>
                <span className="text-foreground truncate">
                  {k === 'amount' ? formatCurrency(before[k]) : k === 'date' ? formatDateValue(before[k]) : before[k]?.toString() || '-'}
                </span>
              </div>
            ))}
          </div>
        )}
        
        {before && after && (
          <div className="hidden md:flex items-center text-muted-foreground opacity-50">
            ▶
          </div>
        )}

        {after && (
          <div className="flex-1 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3 rounded-lg space-y-1 relative">
            <div className="absolute -top-2 left-6 bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[9px] font-bold px-2 py-0.5 rounded-sm shadow-sm uppercase tracking-wider">
              {before ? 'Depois da Alteração' : 'Detalhes'}
            </div>
            {displayKeys.map(k => (
              <div key={k} className="flex gap-2 text-muted-foreground">
                <span className="w-20 font-medium capitalize truncate">{k === 'amount' ? 'Valor' : k === 'description' ? 'Descrição' : k === 'date' ? 'Data' : k === 'status' ? 'Status' : k === 'accountId' ? 'Conta' : k === 'categoryId' ? 'Categ.' : k}:</span>
                <span className="text-foreground font-semibold truncate">
                  {k === 'amount' ? formatCurrency(after[k]) : k === 'date' ? formatDateValue(after[k]) : after[k]?.toString() || '-'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const grouped = groupLogsByDate(logs);
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-8 pb-10">
      {sortedDates.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <History size={48} className="mx-auto opacity-20 mb-4" />
          <p>Nenhuma atividade registrada nos últimos 90 dias.</p>
        </div>
      ) : (
        sortedDates.map(dateStr => (
          <div key={dateStr} className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground border-b border-border pb-2">
              {format(new Date(`${dateStr}T12:00:00`), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </h3>
            
            <div className="space-y-6">
              {grouped[dateStr].map(log => (
                <div key={log.id} className="relative group">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center shadow-sm z-10 shrink-0">
                      {getLogIcon(log.action)}
                    </div>
                    
                    <div className="flex-1 w-full overflow-hidden">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between sm:gap-4">
                        <p className="text-sm">
                          <span className="font-semibold text-foreground">Você</span>{' '}
                          <span className="text-muted-foreground">
                            {log.description}
                          </span>
                        </p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.createdAt), 'HH:mm')}
                        </span>
                      </div>
                      
                      {renderDataChange(log.dataBefore, log.dataAfter)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};
