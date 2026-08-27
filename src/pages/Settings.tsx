import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDoc, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Download, FileJson, Settings, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { logActivity } from '../services/activityLogService';
import { toast } from 'sonner';
import { PageHelp } from '../components/PageHelp';
import { useNavigate } from 'react-router-dom';
import { APP_VERSION } from '../lib/utils';

const RESET_COLLECTIONS = [
  'transactions',
  'creditCards',
  'budgets',
  'goals',
  'invoices',
  'closedPeriods',
  'tags',
  'recurrenceRules',
  'installments',
  'importCandidates',
  'reconciliationHistory',
  'activityLogs',
] as const;

export function SettingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2>(1);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResettingAll, setIsResettingAll] = useState(false);
  const [limitThreshold, setLimitThreshold] = useState(() => {
    const stored = localStorage.getItem('fiducia_limitAlertThreshold');
    return stored ? parseInt(stored) : 80;
  });

  const [budgetParadigm, setBudgetParadigm] = useState(() => {
    return localStorage.getItem('fiducia_budgetParadigm') || 'fracionado';
  });

  useEffect(() => {
    localStorage.setItem('fiducia_limitAlertThreshold', limitThreshold.toString());
  }, [limitThreshold]);

  useEffect(() => {
    localStorage.setItem('fiducia_budgetParadigm', budgetParadigm);
  }, [budgetParadigm]);

  const handleExportData = async () => {
    if (!user) return;
    setExporting(true);

    try {
      const collectionNames = [
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
        'installments',
        'importCandidates',
        'reconciliationHistory',
        'activityLogs',
      ];

      const [collectionEntries, userSnapshot] = await Promise.all([
        Promise.all(collectionNames.map(async colName => {
          const q = query(collection(db, colName), where('userId', '==', user.uid));
          const snapshot = await getDocs(q);
          return [colName, snapshot.docs.map(item => ({ id: item.id, ...item.data() }))] as const;
        })),
        getDoc(doc(db, 'users', user.uid)),
      ]);
      const collections = Object.fromEntries(collectionEntries);
      const preferences = Object.fromEntries(
        Object.keys(localStorage)
          .filter(key => key.startsWith('fiducia_'))
          .map(key => [key, localStorage.getItem(key)]),
      );
      const backupData = {
        schemaVersion: 1,
        appVersion: APP_VERSION,
        exportedAt: new Date().toISOString(),
        user: userSnapshot.exists() ? { id: userSnapshot.id, ...userSnapshot.data() } : null,
        preferences,
        collections,
      };

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
      toast.error('Erro ao exportar backup');
      handleFirestoreError(error, OperationType.LIST, 'backup');
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

      if (errors.length > 0) {
        toast.error(`O reset foi interrompido por falhas em: ${errors.join(', ')}. Os saldos das contas não foram alterados.`);
        return;
      }

      const accQuery = query(collection(db, 'accounts'), where('userId', '==', user.uid));
      const accSnapshot = await getDocs(accQuery);
      const accDocs = accSnapshot.docs;

      for (let i = 0; i < accDocs.length; i += 450) {
        const batch = writeBatch(db);
        const chunk = accDocs.slice(i, i + 450);
        for (const d of chunk) {
          batch.update(doc(db, 'accounts', d.id), { balance: 0, initialBalance: 0 });
        }
        await batch.commit();
      }

      Object.keys(localStorage).filter(key => key.startsWith('fiducia_')).forEach(key => localStorage.removeItem(key));
      logActivity({ userId: user.uid, action: 'delete', entityType: 'account', entityId: 'all', description: 'Aplicação resetada' }).catch(() => {});
      toast.success('Aplicação resetada com sucesso! Seus dados estão como novos.');

      setResetDialogOpen(false);
      setResetStep(1);
      setResetConfirmText('');
    } catch (error) {
      toast.error('Erro ao resetar aplicação');
      handleFirestoreError(error, OperationType.DELETE, 'reset');
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
              { label: "Exportar Dados", desc: "Baixe um backup JSON com os dados, perfil e preferências do Fiducia." },
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
            Exporte todos os dados cadastrados para backup em formato JSON, incluindo perfil, preferências, importações, parcelamentos e histórico de auditoria.
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-fiducia-amber" />
            Preferências
          </CardTitle>
          <CardDescription>
            Ajuste o comportamento do sistema conforme sua preferência.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 pb-3 border-b border-border">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Primeiros passos</Label>
            <p className="text-xs text-muted-foreground">
              Abra novamente o checklist de configuração usando seus dados atuais. Nenhum lançamento será alterado.
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                localStorage.removeItem('fiducia_onboardingDismissed');
                navigate('/?onboarding=1');
              }}
            >
              Rever primeiros passos
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Alerta de Limite do Cartão</Label>
              <span className="text-xs font-bold text-fiducia-amber">{limitThreshold}%</span>
            </div>
            <input
              type="range"
              min="50"
              max="95"
              step="5"
              value={limitThreshold}
              onChange={(e) => setLimitThreshold(parseInt(e.target.value))}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-fiducia-amber"
            />
            <p className="text-[10px] text-muted-foreground">
              Alerta quando o gasto da fatura aberta atingir o percentual configurado do limite do cartão.
            </p>
          </div>
          <div className="space-y-2 pt-3 border-t border-border">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Paradigma de Orçamento</Label>
            <div className="flex gap-3">
              <label className={`flex-1 p-3 rounded-lg border-2 cursor-pointer text-center text-sm font-semibold ${budgetParadigm === 'fracionado' ? 'border-fiducia-blue bg-fiducia-blue/5 text-fiducia-blue' : 'border-border text-muted-foreground'}`}>
                <input type="radio" className="sr-only" name="budgetParadigm" value="fracionado" checked={budgetParadigm === 'fracionado'} onChange={(e) => setBudgetParadigm(e.target.value)} />
                Fracionado
              </label>
              <label className={`flex-1 p-3 rounded-lg border-2 cursor-pointer text-center text-sm font-semibold ${budgetParadigm === 'integral' ? 'border-fiducia-blue bg-fiducia-blue/5 text-fiducia-blue' : 'border-border text-muted-foreground'}`}>
                <input type="radio" className="sr-only" name="budgetParadigm" value="integral" checked={budgetParadigm === 'integral'} onChange={(e) => setBudgetParadigm(e.target.value)} />
                Integral
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground">
              <strong>Fracionado:</strong> cada parcela conta no mês em que vence.<br />
              <strong>Integral:</strong> o valor total da compra conta na primeira parcela; parcelas seguintes não impactam.
            </p>
          </div>
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
