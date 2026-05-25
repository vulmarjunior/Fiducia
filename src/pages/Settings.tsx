import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Download, FileJson, Settings } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsPage() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);

  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);

    try {
      const collections = [
        'accounts',
        'creditCards',
        'categories',
        'tags',
        'transactions',
        'budgets',
        'goals',
        'invoices',
        'closedPeriods',
        'recurrenceRules',
        'reconciliationHistory',
        'activityLogs',
      ];

      const backupData: Record<string, any> = {};

      for (const colName of collections) {
        const q = query(collection(db, colName), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        backupData[colName] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fiducia_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Backup exportado com sucesso');
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'backup');
      toast.error('Erro ao exportar backup');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <Settings size={24} className="text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">Gerencie seus dados e preferências</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson size={20} className="text-primary" />
            Exportação de Dados
          </CardTitle>
          <CardDescription>
            Exporte todos os seus dados cadastrados para backup em formato JSON. Inclui contas, cartões, lançamentos, categorias, tags, orçamentos, metas e histórico de auditoria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleExportData}
            disabled={exporting}
            className="w-full"
          >
            <Download className="w-4 h-4 mr-2" />
            {exporting ? 'Exportando...' : 'Baixar Backup JSON'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
