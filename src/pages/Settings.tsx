import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Download, FileJson, Settings, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { logActivity } from '../services/activityLogService';
import { toast } from 'sonner';
import { PageHelp } from '../components/PageHelp';

const RESET_COLLECTIONS = [
  'transactions',
  'creditCards',
  'budgets',
  'goals',
  'invoices',
  'closedPeriods',
  'tags',
  'recurrenceRules',
  'reconciliationHistory',
  'activityLogs',
] as const;

export function SettingsPage() {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResettingAll, setIsResettingAll] = useState(false);

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

  const handleResetAll = async () => {
    if (!user) return;
    setIsResettingAll(true);
    const errors: string[] = [];

    try {
      for (const colName of RESET_COLLECTIONS) {
        try {
          const q = query(collection(db, colName), where('userId', '==', user.uid));
          const snapshot = await getDocs(q);
          const docs = snapshot.docs;

          for (let i = 0; i < docs.length; i += 450) {
            const batch = writeBatch(db);
            const chunk = docs.slice(i, i + 450);
            for (const d of chunk) {
              batch.delete(doc(db, colName, d.id));
            }
            await batch.commit();
          }
        } catch (err) {
          errors.push(colName);
        }
      }

      const accQuery = query(collection(db, 'accounts'), where('userId', '==', user.uid));
      const accSnapshot = await getDocs(accQuery);
      const accDocs = accSnapshot.docs;

      for (let i = 0; i < accDocs.length; i += 450) {
        const batch = writeBatch(db);
        const chunk = accDocs.slice(i, i + 450);
        for (const d of chunk) {
          batch.update(doc(db, 'accounts', d.id), { balance: 0 });
        }
        await batch.commit();
      }

      if (errors.length > 0) {
        toast.warning(`Reset concluído com avisos em: ${errors.join(', ')}`);
      } else {
        logActivity({ userId: user.uid, action: 'delete', entityType: 'account', entityId: 'all', description: 'Aplicação resetada' }).catch(() => {});
        toast.success('Aplicação resetada com sucesso! Seus dados estão como novos.');
      }

      setResetDialogOpen(false);
      setResetStep(1);
      setResetConfirmText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'reset');
      toast.error('Erro ao resetar aplicação');
    } finally {
      setIsResettingAll(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-primary/10">
          <Settings size={24} className="text-primary" />
        </div>
        <div>
          <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
          <PageHelp
            title="Configurações"
            description="Exporte seus dados financeiros ou redefina completamente o sistema."
            items={[
              { label: "Exportar Dados", desc: "Baixe todas as suas transações em formato CSV para análise externa." },
              { label: "Resetar Sistema", desc: "Remove todos os seus dados (transações, contas, cartões, etc.). Use com extrema cautela." },
            ]}
          />
        </div>
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

      <Card className="border-red-300 dark:border-red-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle size={20} />
            Zona de Perigo
          </CardTitle>
          <CardDescription>
            Ações destrutivas que não podem ser desfeitas. Mexa com cuidado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => { setResetDialogOpen(true); setResetStep(1); }}
            className="w-full"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Resetar Aplicação
          </Button>
        </CardContent>
      </Card>

      <Dialog open={resetDialogOpen} onOpenChange={(open) => {
        if (!open && !isResettingAll) {
          setResetDialogOpen(false);
          setResetStep(1);
          setResetConfirmText('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          {resetStep === 1 && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle size={20} />
                  Resetar Aplicação
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4 text-sm space-y-2">
                  <p className="font-semibold text-amber-800 dark:text-amber-300">
                    ⚠️ Faça o backup dos seus dados antes de continuar!
                  </p>
                  <p className="text-amber-700 dark:text-amber-400">
                    O reset vai apagar todos os lançamentos, cartões, orçamentos, metas, faturas, tags e períodos fechados.
                    As categorias padrão serão mantidas. Os saldos das contas serão zerados.
                  </p>
                  <p className="text-amber-700 dark:text-amber-400 font-medium">
                    Esta ação é irreversível.
                  </p>
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button variant="outline" onClick={() => { handleExportData(); }} disabled={exporting} className="sm:flex-1">
                  <Download className="w-4 h-4 mr-2" />
                  {exporting ? 'Exportando...' : 'Exportar Backup'}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setResetStep(2)}
                  className="sm:flex-1"
                >
                  Já fiz backup, continuar
                </Button>
              </DialogFooter>
            </>
          )}

          {resetStep === 2 && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <Trash2 size={20} />
                  Confirmação Final
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl p-4 text-sm space-y-2">
                  <p className="font-semibold text-red-800 dark:text-red-300">
                    Isso vai apagar TODOS os seus dados financeiros
                  </p>
                  <ul className="text-red-700 dark:text-red-400 list-disc list-inside space-y-1 text-xs">
                    <li>Todos os lançamentos (receitas e despesas)</li>
                    <li>Todos os cartões de crédito e faturas</li>
                    <li>Todos os orçamentos e metas</li>
                    <li>Todas as tags e regras de recorrência</li>
                    <li>Períodos fechados e conciliações</li>
                    <li>Saldos das contas zerados para R$ 0,00</li>
                  </ul>
                  <p className="text-red-700 dark:text-red-400 font-medium mt-2">
                    O aplicativo ficará como se estivesse sendo acessado pela primeira vez.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Digite <span className="font-bold text-foreground">RESET</span> para confirmar:
                  </label>
                  <Input
                    value={resetConfirmText}
                    onChange={(e) => setResetConfirmText(e.target.value)}
                    placeholder="Digite RESET"
                    className="mt-1 h-10 text-sm font-mono"
                    disabled={isResettingAll}
                  />
                </div>
              </div>
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setResetDialogOpen(false); setResetStep(1); setResetConfirmText(''); }}
                  disabled={isResettingAll}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleResetAll}
                  disabled={resetConfirmText !== 'RESET' || isResettingAll}
                  className="gap-2"
                >
                  {isResettingAll ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Resetando...</>
                  ) : (
                    <><Trash2 className="w-4 h-4" /> Resetar Aplicação</>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
