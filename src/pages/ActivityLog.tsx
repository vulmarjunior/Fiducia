import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { History, Plus, Minus, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageHelp } from '../components/PageHelp';

interface ActivityLogEntry {
  id?: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  dataBefore?: any;
  dataAfter?: any;
  createdAt: string;
}

const ENTITY_LABELS: Record<string, string> = {
  transaction: 'Lançamento',
  account: 'Conta',
  creditCard: 'Cartão de Crédito',
  category: 'Categoria',
  tag: 'Tag',
  budget: 'Orçamento',
  goal: 'Meta',
};

export function ActivityLog() {
  const { user, isAuthReady } = useAuth();
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(
      collection(db, 'activityLogs'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ActivityLogEntry)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activityLogs');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, isAuthReady]);

  const getLogIcon = (action: string) => {
    switch (action) {
      case 'create': return <Plus size={16} className="text-emerald-500" />;
      case 'update': return <Edit2 size={16} className="text-blue-500" />;
      case 'delete': return <Trash2 size={16} className="text-red-500" />;
      default: return <History size={16} className="text-muted-foreground" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'create': return 'Criou';
      case 'update': return 'Atualizou';
      case 'delete': return 'Removeu';
      default: return action;
    }
  };

  const groupLogsByDate = (logs: ActivityLogEntry[]) => {
    const groups: { [key: string]: ActivityLogEntry[] } = {};
    logs.forEach(log => {
      const dateStr = new Date(log.createdAt).toISOString().split('T')[0];
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(log);
    });
    return groups;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Carregando registros de atividade...
          </CardContent>
        </Card>
      </div>
    );
  }

  const groupedLogs = groupLogsByDate(logs);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <History size={24} className="text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Registro de Atividades</h1>
          <PageHelp
            title="Registro de Atividades"
            description="Histórico completo de todas as operações realizadas no sistema: criação, edição e exclusão de lançamentos, contas, categorias e mais."
          />
        </div>
          <p className="text-sm text-muted-foreground">Últimas {logs.length} operações realizadas</p>
        </div>
      </div>

      {Object.keys(groupedLogs).length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum registro de atividade encontrado.
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedLogs).map(([date, dayLogs]) => (
          <Card key={date} className="overflow-hidden">
            <CardHeader className="p-4 pb-2 bg-muted/30">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                {format(new Date(date + 'T12:00:00'), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {dayLogs.map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className="flex items-center gap-3 p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-muted/50 shrink-0">
                      {getLogIcon(log.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {getActionLabel(log.action)}{' '}
                        <span className="text-primary font-semibold">
                          {ENTITY_LABELS[log.entityType] || log.entityType}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{log.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground/70 shrink-0">
                      {format(new Date(log.createdAt), 'HH:mm')}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
