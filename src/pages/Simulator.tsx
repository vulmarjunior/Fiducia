import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, addDoc } from 'firebase/firestore';
import { CreditCard, Account, Category, Transaction, Invoice } from '../types';
import { SimulatedItem, SimulationHorizon, SimulationIntervalType } from '../types/simulator';
import { CASH_SAFETY_RESERVE_KEY } from '../lib/cashCoverage';
import { runMonthlySimulationComparison, generateSimulatedTransactions, getHorizonDates } from '../lib/simulatorEngine';
import { SimulationItemForm } from '../components/simulator/SimulationItemForm';
import { SimulationCardComparison } from '../components/simulator/SimulationCardComparison';
import { SimulationChart } from '../components/simulator/SimulationChart';
import { SimulationMonthTable } from '../components/simulator/SimulationMonthTable';
import { SimulationItemList } from '../components/simulator/SimulationItemList';
import { PageHelp } from '../components/PageHelp';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog';
import {
  Sparkles,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = 'fiducia_simulated_items';

const HORIZON_OPTIONS: { id: SimulationHorizon; label: string }[] = [
  { id: 'current_month', label: 'Mês' },
  { id: '3_months', label: '3 Meses' },
  { id: '6_months', label: '6 Meses' },
  { id: 'current_year', label: 'Ano' },
];

const MONTH_NAMES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export function Simulator() {
  const { user, isAuthReady } = useAuth();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados da Simulação
  const [simulatedItems, setSimulatedItems] = useState<SimulatedItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [horizon, setHorizon] = useState<SimulationHorizon>('3_months');
  const [intervalType, setIntervalType] = useState<SimulationIntervalType>('month');
  const [referenceDate, setReferenceDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [includeSavings, setIncludeSavings] = useState<boolean>(false);
  const [isCommitModalOpen, setIsCommitModalOpen] = useState<boolean>(false);
  const [isCommitting, setIsCommitting] = useState<boolean>(false);

  const safetyReserve = Math.max(0, Number(localStorage.getItem(CASH_SAFETY_RESERVE_KEY)) || 0);

  // Sincroniza hipóteses no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(simulatedItems));
    } catch (e) {
      console.error('Falha ao salvar hipóteses no localStorage', e);
    }
  }, [simulatedItems]);

  // Carrega coleções do Firestore
  useEffect(() => {
    if (!user || !isAuthReady) return;

    setLoading(true);

    const qAccounts = query(collection(db, 'accounts'), where('userId', '==', user.uid));
    const unsubAccounts = onSnapshot(qAccounts, (s) => {
      setAccounts(s.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'accounts'));

    const qCards = query(collection(db, 'creditCards'), where('userId', '==', user.uid));
    const unsubCards = onSnapshot(qCards, (s) => {
      setCreditCards(s.docs.map(d => ({ id: d.id, ...d.data() } as CreditCard)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'creditCards'));

    const qTransactions = query(collection(db, 'transactions'), where('userId', '==', user.uid));
    const unsubTransactions = onSnapshot(qTransactions, (s) => {
      setTransactions(s.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'transactions'));

    const qInvoices = query(collection(db, 'invoices'), where('userId', '==', user.uid));
    const unsubInvoices = onSnapshot(qInvoices, (s) => {
      setInvoices(s.docs.map(d => ({ id: d.id, ...d.data() } as Invoice)));
    }, (err) => handleFirestoreError(err, OperationType.GET, 'invoices'));

    const qCategories = query(collection(db, 'categories'), where('userId', '==', user.uid));
    const unsubCategories = onSnapshot(qCategories, (s) => {
      setCategories(s.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.GET, 'categories'));

    return () => {
      unsubAccounts();
      unsubCards();
      unsubTransactions();
      unsubInvoices();
      unsubCategories();
    };
  }, [user, isAuthReady]);

  // Navegação temporal mês a mês / ano a ano
  const handlePrev = () => {
    setReferenceDate(prev => {
      if (horizon === 'current_year') {
        return new Date(prev.getFullYear() - 1, prev.getMonth(), 1);
      }
      return new Date(prev.getFullYear(), prev.getMonth() - 1, 1);
    });
  };

  const handleNext = () => {
    setReferenceDate(prev => {
      if (horizon === 'current_year') {
        return new Date(prev.getFullYear() + 1, prev.getMonth(), 1);
      }
      return new Date(prev.getFullYear(), prev.getMonth() + 1, 1);
    });
  };

  const handleResetToCurrent = () => {
    const now = new Date();
    setReferenceDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const isCurrentPeriod = useMemo(() => {
    const now = new Date();
    if (horizon === 'current_year') {
      return referenceDate.getFullYear() === now.getFullYear();
    }
    return (
      referenceDate.getFullYear() === now.getFullYear() &&
      referenceDate.getMonth() === now.getMonth()
    );
  }, [referenceDate, horizon]);

  const handleHorizonChange = (newHorizon: SimulationHorizon) => {
    setHorizon(newHorizon);
    if (newHorizon === 'current_year') {
      setIntervalType('month');
    }
  };

  const periodTitle = useMemo(() => {
    const { startDate, endDate } = getHorizonDates(horizon, referenceDate);
    const [startY, startM] = startDate.split('-').map(Number);
    const [endY, endM] = endDate.split('-').map(Number);

    if (horizon === 'current_month') {
      return `${MONTH_NAMES_FULL[startM - 1]} de ${startY}`;
    }
    if (horizon === 'current_year') {
      return `Ano ${startY}`;
    }
    if (startY === endY) {
      return `${MONTH_NAMES_SHORT[startM - 1]} a ${MONTH_NAMES_SHORT[endM - 1]} de ${startY}`;
    }
    return `${MONTH_NAMES_SHORT[startM - 1]}/${startY} a ${MONTH_NAMES_SHORT[endM - 1]}/${endY}`;
  }, [horizon, referenceDate]);

  // Motor Canônico de Simulação (Entradas × Saídas com suporte a Diário e Mensal)
  const monthlySimulation = useMemo(() => {
    return runMonthlySimulationComparison({
      accounts,
      transactions,
      creditCards,
      invoices,
      categories,
      simulatedItems,
      horizon,
      intervalType,
      includeSavings,
      referenceDate,
    });
  }, [accounts, transactions, creditCards, invoices, categories, simulatedItems, horizon, intervalType, includeSavings, referenceDate]);

  const handleAddItem = (item: SimulatedItem) => {
    setSimulatedItems(prev => [item, ...prev]);
  };

  const handleToggleItem = (id: string) => {
    setSimulatedItems(prev =>
      prev.map(i => (i.id === id ? { ...i, enabled: !i.enabled } : i))
    );
  };

  const handleDeleteItem = (id: string) => {
    setSimulatedItems(prev => prev.filter(i => i.id !== id));
    toast.info('Hipótese removida.');
  };

  const handleClearAll = () => {
    setSimulatedItems([]);
    toast.info('Todas as hipóteses foram limpas.');
  };

  const activeSimulatedCount = simulatedItems.filter(i => i.enabled).length;

  // Efetivação das hipóteses no banco de dados Firestore
  const handleCommitToFirestore = async () => {
    if (!user) return;
    const activeItems = simulatedItems.filter(i => i.enabled && i.amount > 0);
    if (activeItems.length === 0) {
      toast.error('Nenhuma hipótese ativa para efetivar.');
      return;
    }

    setIsCommitting(true);
    try {
      const syntheticTxs = generateSimulatedTransactions(activeItems, creditCards, 365);
      
      for (const st of syntheticTxs) {
        const payload: any = {
          userId: user.uid,
          type: st.type,
          amount: st.amount,
          date: st.date,
          description: st.description,
          status: 'pendente',
          createdAt: new Date().toISOString(),
        };

        if (st.creditCardId) {
          payload.creditCardId = st.creditCardId;
          payload.accountId = st.creditCardId;
        } else if (st.accountId) {
          payload.accountId = st.accountId;
        }

        if (st.invoicePeriod) payload.invoicePeriod = st.invoicePeriod;
        if (st.installmentNumber) payload.installmentNumber = st.installmentNumber;
        if (st.totalInstallments) payload.totalInstallments = st.totalInstallments;
        if (st.categoryId) payload.categoryId = st.categoryId;

        await addDoc(collection(db, 'transactions'), payload);
      }

      toast.success(`${syntheticTxs.length} lançamento(s) agendado(s) criado(s) com sucesso!`);
      setSimulatedItems(prev => prev.filter(i => !i.enabled));
      setIsCommitModalOpen(false);
    } catch (err) {
      console.error('Erro ao efetivar lançamentos', err);
      toast.error('Erro ao gravar lançamentos no Firestore.');
    } finally {
      setIsCommitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-fiducia-blue/10 text-fiducia-blue flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Simulador de Caixa
            </h2>
            <PageHelp
              title="Simulador de Cenários Financeiros"
              description="Um ambiente seguro de testes baseado no relatório de Entradas × Saídas para prever o impacto de decisões financeiras antes de assumir novos compromissos."
              items={[
                {
                  label: 'Navegação Mês a Mês e Ano a Ano',
                  desc: 'Navegue pelas setas para avaliar competências futuras (ex: próximos meses ou anos seguintes) com total clareza.',
                },
                {
                  label: 'Visão Diária ou Mensal',
                  desc: 'Alterne entre o detalhamento dia a dia ou o consolidado mensal para analisar exatamente quando o saldo oscila.',
                },
                {
                  label: 'Motor de Entradas × Saídas',
                  desc: 'Usa exatamente o mesmo cálculo canônico de fluxo da Fiducia, evitando distorções ou déficits artificiais por falta de receitas futuras cadastradas.',
                },
                {
                  label: 'Efetivação Opcional',
                  desc: 'Se você decidir realizar a compra ou compromisso simulado, pode transformá-lo em lançamentos pendentes com um único clique.',
                },
              ]}
            />
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Simule compras parceladas, despesas extras ou receitas e acompanhe o impacto dia a dia ou mês a mês no fluxo de caixa
          </p>
        </div>

        {/* Efetivar (se houver hipóteses ativas) */}
        {activeSimulatedCount > 0 && (
          <Button
            onClick={() => setIsCommitModalOpen(true)}
            className="self-start md:self-auto h-9 px-3.5 text-xs font-bold gap-1.5 bg-fiducia-blue text-white hover:bg-fiducia-blue/90 shadow-xs rounded-xl"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Efetivar ({activeSimulatedCount})</span>
          </Button>
        )}
      </div>

      {/* BARRA DE CONTROLES: NAVEGAÇÃO TEMPORAL, HORIZONTE E DIÁRIO/MENSAL */}
      <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
        {/* Navegador Temporal: Setas < > e Título do Período */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-secondary/60 rounded-xl border border-border p-0.5">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              className="h-8 w-8 rounded-lg hover:bg-background"
              title={horizon === 'current_year' ? 'Ano anterior' : 'Mês anterior'}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="h-8 w-8 rounded-lg hover:bg-background"
              title={horizon === 'current_year' ? 'Próximo ano' : 'Próximo mês'}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 font-bold text-sm sm:text-base text-foreground">
              <Calendar className="w-4 h-4 text-fiducia-blue" />
              <span>{periodTitle}</span>
            </div>

            {!isCurrentPeriod && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetToCurrent}
                className="h-7 px-2 text-[11px] gap-1 font-semibold text-muted-foreground hover:text-foreground"
                title="Voltar para a data atual"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{horizon === 'current_year' ? 'Ano atual' : 'Hoje'}</span>
              </Button>
            )}
          </div>
        </div>

        {/* Controles de Horizonte e Agrupamento (Diário / Mensal) */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Seletor de Horizonte */}
          <div className="inline-flex bg-secondary/60 p-1 rounded-xl border border-border">
            {HORIZON_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleHorizonChange(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  horizon === opt.id
                    ? 'bg-background text-foreground shadow-xs font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Toggle Diário | Mensal */}
          <div className="inline-flex bg-secondary/60 p-1 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setIntervalType('day')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                intervalType === 'day'
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Diário
            </button>
            <button
              type="button"
              onClick={() => setIntervalType('month')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                intervalType === 'month'
                  ? 'bg-background text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mensal
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin text-fiducia-blue mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Carregando dados financeiros para a simulação...</p>
        </div>
      ) : (
        <>
          {/* 1. CARDS DE KPIS COMPARATIVOS */}
          <SimulationCardComparison
            summary={monthlySimulation.summary}
            horizonLabel={periodTitle}
            safetyReserve={safetyReserve}
          />

          {/* 2. GRÁFICO COMPARATIVO (DIÁRIO OU MENSAL) */}
          <SimulationChart
            data={monthlySimulation.monthPoints}
            intervalType={intervalType}
            safetyReserve={safetyReserve}
          />

          {/* 3. TABELA COMPARATIVA (DIÁRIA OU MENSAL) */}
          <SimulationMonthTable
            monthPoints={monthlySimulation.monthPoints}
            intervalType={intervalType}
            safetyReserve={safetyReserve}
          />

          {/* 4. GRID: FORMULÁRIO + LISTA DE HIPÓTESES */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6">
            <div>
              <SimulationItemForm
                creditCards={creditCards}
                accounts={accounts}
                categories={categories}
                onAddItem={handleAddItem}
              />
            </div>

            <div>
              <SimulationItemList
                items={simulatedItems}
                creditCards={creditCards}
                accounts={accounts}
                categories={categories}
                onToggleItem={handleToggleItem}
                onDeleteItem={handleDeleteItem}
                onClearAll={handleClearAll}
              />
            </div>
          </div>
        </>
      )}

      {/* DIÁLOGO DE CONFIRMAÇÃO PARA EFETIVAR NO FIRESTORE */}
      <Dialog open={isCommitModalOpen} onOpenChange={setIsCommitModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-fiducia-blue" />
              Efetivar Hipóteses no Sistema
            </DialogTitle>
            <DialogDescription>
              Isso criará lançamentos agendados reais (com status <strong>Pendente</strong>) no seu extrato financeiro.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 text-xs space-y-2 border-y border-border">
            <p className="font-semibold text-foreground">
              Serão convertidas as {activeSimulatedCount} hipótese(s) ativa(s):
            </p>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              {simulatedItems.filter(i => i.enabled).map(i => (
                <li key={i.id}>
                  <strong>{i.name}</strong>: R$ {i.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  {i.type === 'card_expense' && ` (${i.installments || 1}x no cartão)`}
                </li>
              ))}
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsCommitModalOpen(false)}
              disabled={isCommitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCommitToFirestore}
              disabled={isCommitting}
              className="gap-1.5 font-bold"
            >
              {isCommitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Efetivando...
                </>
              ) : (
                'Confirmar e Criar Lançamentos'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
