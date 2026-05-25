import React, { useEffect, useState } from "react";
import { useFirebase } from "./context/FirebaseContext";
import { DashboardCharts } from "./components/DashboardCharts";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { FiduciaLogo } from "./components/FiduciaLogo";
import { TransactionForm } from "./components/TransactionForm";
import { OFXImporter } from "./components/OFXImporter";
import { StatementPage } from "./components/StatementPage";
import { CategoryManager } from "./components/CategoryManager";
import { TagManager } from "./components/TagManager";
import { AlertsManager } from "./components/AlertsManager";
import { ActivityLogView } from "./components/ActivityLogView";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { AccountForm } from "./components/AccountForm";
import { CreditCardForm } from "./components/CreditCardForm";
import {
  Account,
  CreditCard,
  Category,
  Transaction,
  Budget,
  Goal,
  ClosedPeriod,
  Invoice,
  Tag,
} from "./types";
import {
  Landmark,
  CreditCard as CardIcon,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  SlidersHorizontal,
  Wallet,
  User as UserIcon,
  LogOut,
  Target,
  PiggyBank,
  Sun,
  Moon,
  ArrowUpRight,
  Bell,
  ArrowDownLeft,
  ArrowLeftRight,
  Sparkles,
  Search,
  Settings,
  X,
  History,
  Menu,
  Download,
  Info,
  CheckCircle2,
  CircleDashed,
  FileText,
  ChevronDown,
} from "lucide-react";

// Helper to determine credit card brand color palette and styling based on name text
const getCardBrandDetails = (cardName: string) => {
  const nameLower = cardName.toLowerCase();
  if (nameLower.includes("visa")) {
    return {
      label: "Visa",
      bgClass: "bg-blue-500/10 dark:bg-blue-500/20",
      textClass: "text-blue-600 dark:text-blue-400",
      borderClass: "border-blue-200/50 dark:border-blue-900/40",
      barClass: "bg-blue-600 dark:bg-blue-500",
    };
  }
  if (nameLower.includes("mastercard") || nameLower.includes("master")) {
    return {
      label: "Mastercard",
      bgClass: "bg-orange-500/10 dark:bg-orange-500/20",
      textClass: "text-orange-600 dark:text-orange-400",
      borderClass: "border-orange-200/50 dark:border-orange-900/40",
      barClass: "bg-orange-500",
    };
  }
  if (nameLower.includes("elo")) {
    return {
      label: "Elo",
      bgClass: "bg-amber-500/10 dark:bg-amber-500/20",
      textClass: "text-amber-600 dark:text-amber-400",
      borderClass: "border-amber-200/50 dark:border-amber-900/40",
      barClass: "bg-amber-500",
    };
  }
  if (nameLower.includes("american express") || nameLower.includes("amex")) {
    return {
      label: "Amex",
      bgClass: "bg-teal-500/10 dark:bg-teal-500/20",
      textClass: "text-teal-600 dark:text-teal-400",
      borderClass: "border-teal-200/50 dark:border-teal-900/40",
      barClass: "bg-teal-500",
    };
  }
  if (nameLower.includes("hipercard") || nameLower.includes("hiper")) {
    return {
      label: "Hipercard",
      bgClass: "bg-rose-500/10 dark:bg-rose-500/20",
      textClass: "text-rose-600 dark:text-rose-400",
      borderClass: "border-rose-200/50 dark:border-rose-900/40",
      barClass: "bg-rose-500",
    };
  }
  if (nameLower.includes("diners")) {
    return {
      label: "Diners",
      bgClass: "bg-sky-500/10 dark:bg-sky-500/20",
      textClass: "text-sky-600 dark:text-sky-400",
      borderClass: "border-sky-200/50 dark:border-sky-900/40",
      barClass: "bg-sky-500",
    };
  }
  return {
    label: "Cartão",
    bgClass: "bg-indigo-50 dark:bg-indigo-950/20",
    textClass: "text-[#8b5cf6]",
    borderClass: "border-indigo-100 dark:border-indigo-900/20",
    barClass: "bg-[#8b5cf6]",
  };
};

export default function App() {
  const {
    authUser,
    currentUser,
    loading,
    signInWithGoogle,
    logOut,
    updateUserName,
    getAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    getCreditCards,
    createCreditCard,
    updateCreditCard,
    deleteCreditCard,
    getCategories,
    getTags,
    createTag,
    updateTag,
    deleteTag,
    getTransactions,
    deleteTransaction,
    getBudgets,
    saveBudget,
    getGoals,
    createGoal,
    updateGoal,
    deleteGoal,
    getClosedPeriods,
    createClosedPeriod,
    deleteClosedPeriod,
    getInvoices,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    getInvoiceByPeriod,
    createTransaction,
    updateTransaction,
  } = useFirebase();

  // Navigation state
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [activeSubTab, setActiveSubTab] = useState<string>("extrato"); // default subtab for movimentacoes
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstallable, setIsAppInstallable] = useState<boolean>(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsAppInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsAppInstallable(false);
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsAppInstallable(false);
      setDeferredPrompt(null);
    }
  };

  const handleSignIn = async () => {
    try {
      setLoginError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Login component caught error:", err);
      if (err?.code === "auth/unauthorized-domain") {
        const hostname = window.location.hostname;
        setLoginError(
          `Domínio não autorizado pelo Firebase. Você precisa adicionar este domínio (${hostname}) na lista de "Domínios Autorizados" na aba Metadados/Configurações do painel do Firebase Authentication no Console do Firebase.`,
        );
      } else if (err?.code === "auth/popup-blocked") {
        setLoginError(
          "O navegador bloqueou o pop-up de login do Google. Por favor, permita pop-ups e redirecionamentos no seu navegador para efetuar o login.",
        );
      } else {
        setLoginError(
          err?.message ||
            "Erro inesperado ao tentar realizar login com o Google.",
        );
      }
    }
  };

  // Lists state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [closedPeriods, setClosedPeriods] = useState<ClosedPeriod[]>([]);
  const [savedInvoices, setSavedInvoices] = useState<Invoice[]>([]);

  // Modals state
  const [showTxModal, setShowTxModal] = useState<boolean>(false);
  const [txInitialPrefill, setTxInitialPrefill] = useState<
    | { accountId?: string; creditCardId?: string; invoicePeriod?: string }
    | undefined
  >();
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [showCardModal, setShowCardModal] = useState<boolean>(false);
  const [showGoalModal, setShowGoalModal] = useState<boolean>(false);
  const [showBudgetModal, setShowBudgetModal] = useState<boolean>(false);
  const [showSafeBalanceModal, setShowSafeBalanceModal] =
    useState<boolean>(false);
  const [showPWAInstructionModal, setShowPWAInstructionModal] =
    useState<boolean>(false);
  const [showPwaBanner, setShowPwaBanner] = useState<boolean>(
    !window.matchMedia("(display-mode: standalone)").matches && 
    localStorage.getItem('pwa_banner_dismissed') !== 'true'
  );

  const navigateToStatement = (type: "account" | "creditCard", id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.delete("account");
    url.searchParams.delete("card");
    url.searchParams.set(type === "account" ? "account" : "card", id);
    window.history.pushState({}, "", url);
    setActiveTab("statement");
    setIsMobileMenuOpen(false);
  };

  const [globalConfirm, setGlobalConfirm] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  // Editing state for full CRUD
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);

  // Forms state
  const [newAccName, setNewAccName] = useState<string>("");
  const [newAccType, setNewAccType] = useState<
    "checking" | "savings" | "wallet"
  >("checking");
  const [newAccBalance, setNewAccBalance] = useState<string>("");

  const [newCardName, setNewCardName] = useState<string>("");
  const [newCardLimit, setNewCardLimit] = useState<string>("");
  const [newCardClosing, setNewCardClosing] = useState<number>(5);
  const [newCardDue, setNewCardDue] = useState<number>(12);

  const [newGoalName, setNewGoalName] = useState<string>("");
  const [newGoalTarget, setNewGoalTarget] = useState<string>("");
  const [newGoalDeadline, setNewGoalDeadline] = useState<string>("");

  const [selectedBgtCategory, setSelectedBgtCategory] = useState<string>("");
  const [newBgtAmount, setNewBgtAmount] = useState<string>("");

  // Reconciliation Subviews & Closing state controls
  const [reconciliationSubTab, setReconciliationSubTab] = useState<
    "import" | "invoices" | "locks"
  >("invoices");
  const [selectedCardId, setSelectedCardId] = useState<string>("");
  const [selectedInvoicePeriod, setSelectedInvoicePeriod] =
    useState<string>("");
  const [paymentBankAccountId, setPaymentBankAccountId] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [newLockPeriod, setNewLockPeriod] = useState<string>(
    new Date().toISOString().substring(0, 7),
  );

  // Filtering slate for Transactions
  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterTag, setFilterTag] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Dark / Light Theme & Preferences
  const [darkMode, setDarkMode] = useState<boolean>(
    () => localStorage.getItem("fiducia_theme") === "dark" || false,
  );
  const [transactionOrder, setTransactionOrder] = useState<"asc" | "desc">(
    () => (localStorage.getItem("fiducia_tx_order") as "asc" | "desc") || "asc",
  );
  const [defaultPeriod, setDefaultPeriod] = useState<
    "daily" | "weekly" | "monthly"
  >(
    () =>
      (localStorage.getItem("fiducia_default_period") as
        | "daily"
        | "weekly"
        | "monthly") || "monthly",
  );
  const [showDailyBalance, setShowDailyBalance] = useState<boolean>(() => {
    const saved = localStorage.getItem("fiducia_show_daily_balance");
    return saved !== null ? saved === "true" : true;
  });

  // Profile Edit State
  const [displayName, setDisplayName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState<boolean>(false);

  useEffect(() => {
    // Sync html dark class & preferences
    localStorage.setItem("fiducia_theme", darkMode ? "dark" : "light");
    localStorage.setItem("fiducia_tx_order", transactionOrder);
    localStorage.setItem("fiducia_default_period", defaultPeriod);
    localStorage.setItem(
      "fiducia_show_daily_balance",
      String(showDailyBalance),
    );

    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode, transactionOrder, defaultPeriod, showDailyBalance]);

  // Load backend data when authenticated
  const loadData = async () => {
    if (!authUser) return;
    try {
      const [accs, cards, cats, tgs, txs, bdgts, gls, cps] = await Promise.all([
        getAccounts(),
        getCreditCards(),
        getCategories(),
        getTags(),
        getTransactions(),
        getBudgets(),
        getGoals(),
        getClosedPeriods(),
      ]);
      setAccounts(accs);
      setCreditCards(cards);
      setCategories(cats);
      setTags(tgs);
      setTransactions(txs);
      setBudgets(bdgts);
      setGoals(gls);
      setClosedPeriods(cps);

      // PWA Notification logic
      if ("Notification" in window) {
        // Calculate alerts
        const now = new Date();
        const overdueExpenses = txs.filter(
          (tx) =>
            (tx.type === "expense" || tx.type === "despesa") &&
            (tx.status === "pending" || tx.status === "pendente") &&
            new Date(tx.date) < now,
        );
        const sevenDays = new Date();
        sevenDays.setDate(now.getDate() + 7);
        const upcomingExpenses = txs.filter(
          (tx) =>
            (tx.type === "expense" || tx.type === "despesa") &&
            (tx.status === "pending" || tx.status === "pendente") &&
            new Date(tx.date) >= now &&
            new Date(tx.date) <= sevenDays,
        );
        const pendingIncomes = txs.filter(
          (tx) =>
            (tx.type === "income" || tx.type === "receita") &&
            (tx.status === "pending" || tx.status === "pendente") &&
            new Date(tx.date) <= sevenDays,
        );

        if (
          overdueExpenses.length > 0 ||
          upcomingExpenses.length > 0 ||
          pendingIncomes.length > 0
        ) {
          const alertBody = `Você tem ${overdueExpenses.length} contas atrasadas, ${pendingIncomes.length} a receber, ${upcomingExpenses.length} a pagar.`;

          if (Notification.permission === "granted") {
            // Check if we already notified recently to prevent spam
            const lastNotified = localStorage.getItem("fiducia_last_notified");
            const todayStr = now.toISOString().split("T")[0];
            if (lastNotified !== todayStr) {
              new Notification("Fidúcia Alertas", {
                body: alertBody,
                icon: "/icon.png",
              });
              localStorage.setItem("fiducia_last_notified", todayStr);
            }
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((permission) => {
              if (permission === "granted") {
                new Notification("Fidúcia Alertas", {
                  body: alertBody,
                  icon: "/icon.png",
                });
                localStorage.setItem(
                  "fiducia_last_notified",
                  now.toISOString().split("T")[0],
                );
              }
            });
          }
        }
      }

      // Fetch invoices for each credit card
      const cardInvoicesLists = await Promise.all(
        cards.map((card) =>
          card.id ? getInvoices(card.id) : Promise.resolve([]),
        ),
      );
      setSavedInvoices(cardInvoicesLists.flat());

      if (cats.length > 0) {
        setSelectedBgtCategory(cats[0].id || "");
      }
    } catch (err) {
      console.error("Error loading collections: ", err);
    }
  };

  useEffect(() => {
    if (authUser) {
      loadData();
    }
  }, [authUser]);

  useEffect(() => {
    if (creditCards.length > 0 && !selectedCardId) {
      setSelectedCardId(creditCards[0].id || "");
    }
  }, [creditCards, selectedCardId]);

  useEffect(() => {
    if (selectedCardId) {
      const cardTxs = transactions.filter(
        (t) => t.creditCardId === selectedCardId,
      );
      const periods = Array.from(
        new Set(cardTxs.map((t) => t.invoicePeriod).filter(Boolean)),
      ) as string[];
      periods.sort((a, b) => b.localeCompare(a));

      const currentPeriod = new Date().toISOString().substring(0, 7);
      if (!periods.includes(currentPeriod)) {
        periods.unshift(currentPeriod);
      }
      if (
        periods.length > 0 &&
        (!selectedInvoicePeriod || !periods.includes(selectedInvoicePeriod))
      ) {
        setSelectedInvoicePeriod(periods[0]);
      }
    }
  }, [selectedCardId, transactions, selectedInvoicePeriod]);

  useEffect(() => {
    if (accounts.length > 0 && !paymentBankAccountId) {
      const defaultAcc =
        accounts.find((a) => a.type === "checking" || a.type === "wallet") ||
        accounts[0];
      setPaymentBankAccountId(defaultAcc.id || "");
    }
  }, [accounts, paymentBankAccountId]);

  // Financial calculations
  const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0); // Patrimony
  const totalLiquidBalance = accounts
    .filter((a) => !a.excludeFromCashFlow)
    .reduce((acc, curr) => acc + curr.balance, 0); // Cash flow available

  const totalIncomes = transactions
    .filter(
      (tx) =>
        (tx.type === "income" || tx.type === "receita") && tx.status === "paid",
    )
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalExpenses = transactions
    .filter(
      (tx) =>
        (tx.type === "expense" || tx.type === "despesa") &&
        tx.status === "paid" &&
        !tx.creditCardId,
    )
    .reduce((acc, curr) => acc + curr.amount, 0);

  const creditSpends = transactions
    .filter(
      (tx) =>
        (tx.type === "expense" || tx.type === "despesa") && tx.creditCardId,
    )
    .reduce((acc, curr) => acc + curr.amount, 0);

  // New Safe Balance (operational cash flow projection)
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const currentMonthPendingExpenses = transactions
    .filter((tx) => {
      const isExpense = tx.type === "expense" || tx.type === "despesa";
      const isPending = tx.status === "pending" || tx.status === "pendente";
      const isNotCreditCard = !tx.creditCardId;
      const txMonth = tx.date.substring(0, 7);
      return (
        isExpense && isPending && isNotCreditCard && txMonth <= currentMonthStr
      );
    })
    .reduce((acc, curr) => acc + curr.amount, 0);

  const safeBalanceValue =
    totalLiquidBalance - creditSpends - currentMonthPendingExpenses;

  // Start editing accounts and credit cards helpers
  const handleStartEditAccount = (acc: Account) => {
    setEditingAccount(acc);
    setShowAccountModal(true);
  };

  const handleSaveAccount = async (accountData: Partial<Account>) => {
    try {
      if (editingAccount && editingAccount.id) {
        await updateAccount(editingAccount.id, accountData);
      } else {
        const payload: any = {
          userId: authUser?.uid || "",
          name: accountData.name!,
          type: accountData.type as any,
          balance: accountData.balance!,
        };
        if (accountData.agency !== undefined)
          payload.agency = accountData.agency;
        if (accountData.accountNumber !== undefined)
          payload.accountNumber = accountData.accountNumber;
        if (accountData.bankCode !== undefined)
          payload.bankCode = accountData.bankCode;
        if (accountData.bankName !== undefined)
          payload.bankName = accountData.bankName;

        await createAccount(payload);
      }
      handleCloseAccountModal();
      loadData();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar conta");
    }
  };

  const handleStartEditCard = (card: CreditCard) => {
    setEditingCard(card);
    setNewCardName(card.name);
    setNewCardLimit(String(card.limit));
    setNewCardClosing(card.closingDay);
    setNewCardDue(card.dueDay);
    setShowCardModal(true);
  };

  const handleCloseAccountModal = () => {
    setShowAccountModal(false);
    setEditingAccount(null);
    setNewAccName("");
    setNewAccType("checking");
    setNewAccBalance("");
  };

  const handleCloseCardModal = () => {
    setShowCardModal(false);
    setEditingCard(null);
    setNewCardName("");
    setNewCardLimit("");
    setNewCardClosing(5);
    setNewCardDue(12);
  };

  // Core Actions creators
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim() || !newAccBalance) return;

    try {
      if (editingAccount && editingAccount.id) {
        await updateAccount(editingAccount.id, {
          name: newAccName,
          type: newAccType,
          balance: Number(newAccBalance),
        });
        setEditingAccount(null);
      } else {
        await createAccount({
          userId: authUser?.uid || "",
          name: newAccName,
          type: newAccType,
          balance: Number(newAccBalance),
        });
      }
      setNewAccName("");
      setNewAccBalance("");
      setShowAccountModal(false);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCreditCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardName.trim() || !newCardLimit) return;

    try {
      if (editingCard && editingCard.id) {
        await updateCreditCard(editingCard.id, {
          name: newCardName,
          limit: Number(newCardLimit),
          closingDay: newCardClosing,
          dueDay: newCardDue,
        });
        setEditingCard(null);
      } else {
        await createCreditCard({
          userId: authUser?.uid || "",
          name: newCardName,
          limit: Number(newCardLimit),
          closingDay: newCardClosing,
          dueDay: newCardDue,
        });
      }
      setNewCardName("");
      setNewCardLimit("");
      setShowCardModal(false);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleTransactionStatus = async (tx: Transaction) => {
    if (!tx.id) return;
    const newStatus = tx.status === "paid" ? "pending" : "paid";
    try {
      await updateTransaction(tx.id, { status: newStatus });
      loadData();
    } catch (err) {
      console.error("Erro ao alterar status:", err);
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName.trim() || !newGoalTarget || !newGoalDeadline) return;

    try {
      await createGoal({
        userId: authUser?.uid || "",
        name: newGoalName,
        targetAmount: Number(newGoalTarget),
        currentAmount: 0,
        deadline: newGoalDeadline,
      });
      setNewGoalName("");
      setNewGoalTarget("");
      setNewGoalDeadline("");
      setShowGoalModal(false);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBgtCategory || !newBgtAmount) return;

    try {
      await saveBudget({
        userId: authUser?.uid || "",
        categoryId: selectedBgtCategory,
        amount: Number(newBgtAmount),
        period: "monthly",
      });
      setNewBgtAmount("");
      setShowBudgetModal(false);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAccount = async (id: string) => {
    setGlobalConfirm({
      isOpen: true,
      title: "Remover Conta",
      message:
        "Deseja realmente remover esta conta? Todas as transações associadas perdem o recalculo.",
      confirmText: "Remover",
      isDestructive: true,
      onConfirm: async () => {
        setGlobalConfirm((prev) => ({ ...prev, isOpen: false }));
        await deleteAccount(id);
        loadData();
      },
    });
  };

  const handleDeleteCard = async (id: string) => {
    setGlobalConfirm({
      isOpen: true,
      title: "Remover Cartão",
      message: "Deseja realmente remover este cartão?",
      confirmText: "Remover",
      isDestructive: true,
      onConfirm: async () => {
        setGlobalConfirm((prev) => ({ ...prev, isOpen: false }));
        await deleteCreditCard(id);
        loadData();
      },
    });
  };

  const handleDeleteGoal = async (id: string) => {
    setGlobalConfirm({
      isOpen: true,
      title: "Remover Meta",
      message: "Deseja realmente remover esta meta?",
      confirmText: "Remover",
      isDestructive: true,
      onConfirm: async () => {
        setGlobalConfirm((prev) => ({ ...prev, isOpen: false }));
        await deleteGoal(id);
        loadData();
      },
    });
  };

  const handleDeleteTransaction = async (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    if (tx) {
      const isTxCC = !!tx.creditCardId;
      const targetPeriod = isTxCC ? tx.invoicePeriod : tx.date.substring(0, 7);

      if (
        targetPeriod &&
        closedPeriods.some((cp) => cp.period === targetPeriod)
      ) {
        alert(
          `Não é possível remover este lançamento. O período correspondente (${targetPeriod}) está fechado pela trava de segurança contábil!`,
        );
        return;
      }
    }

    setGlobalConfirm({
      isOpen: true,
      title: "Remover Lançamento",
      message:
        "Deseja realmente remover este lançamento? O saldo associado será ajustado.",
      confirmText: "Remover",
      isDestructive: true,
      onConfirm: async () => {
        setGlobalConfirm((prev) => ({ ...prev, isOpen: false }));
        await deleteTransaction(id);
        loadData();
      },
    });
  };

  const handleCloseInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCardId || !selectedInvoicePeriod) {
      alert("Por favor, selecione o cartão e o período.");
      return;
    }
    const card = creditCards.find((c) => c.id === selectedCardId);
    if (!card) return;

    // Filter card transactions
    const cardTxs = transactions.filter(
      (t) =>
        t.creditCardId === selectedCardId &&
        t.invoicePeriod === selectedInvoicePeriod,
    );
    const totalAmount = cardTxs.reduce((sum, curr) => sum + curr.amount, 0);

    if (totalAmount <= 0) {
      alert("Nenhum lançamento foi encontrado neste período para fechamento.");
      return;
    }

    if (!paymentBankAccountId) {
      alert(
        "Selecione uma conta bancária para agendar a despesa de pagamento.",
      );
      return;
    }

    const payDate =
      paymentDate ||
      `${selectedInvoicePeriod}-${String(card.dueDay).padStart(2, "0")}`;

    try {
      // 1. Create scheduled transaction
      const paymentTxId = await createTransaction({
        userId: authUser?.uid || "",
        type: "expense",
        amount: totalAmount,
        date: new Date(payDate).toISOString(),
        description: `Ref: Pagamento Fatura ${card.name} (${selectedInvoicePeriod})`,
        accountId: paymentBankAccountId,
        status: "pending",
        observation: `Fechamento de faturamento automática`,
      });

      // 2. Save Invoice state
      await createInvoice({
        userId: authUser?.uid || "",
        cardId: selectedCardId,
        period: selectedInvoicePeriod,
        status: "fechada",
        totalAmount,
        paymentTransactionId: paymentTxId,
      });

      alert(
        `Fatura de ${selectedInvoicePeriod} fechada com sucesso! Um agendamento de R$ ${totalAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} foi inserido na conta escolhida.`,
      );
      loadData();
    } catch (err) {
      console.error(err);
      alert("Erro ao fechar fatura.");
    }
  };

  const handleReopenInvoice = async (invoice: Invoice) => {
    setGlobalConfirm({
      isOpen: true,
      title: "Reabrir Fatura",
      message:
        "Ao reabrir esta fatura, o lançamento de pagamento agendado correspondente também será cancelado. Deseja continuar?",
      confirmText: "Reabrir Fatura",
      isDestructive: false,
      onConfirm: async () => {
        setGlobalConfirm((prev) => ({ ...prev, isOpen: false }));
        try {
          if (closedPeriods.some((cp) => cp.period === invoice.period)) {
            alert(
              `Operação bloqueada! O período (${invoice.period}) está fechado na trava contábil global de segurança. Você precisa reabrir o período contábil antes de reabrir esta fatura.`,
            );
            return;
          }

          if (invoice.paymentTransactionId) {
            // Find if this transaction exists to prevent crashing if already deleted
            await deleteTransaction(invoice.paymentTransactionId);
          }

          if (invoice.id) {
            await deleteInvoice(invoice.id);
          }

          loadData();
        } catch (err) {
          console.error(err);
          alert("Erro ao reabrir fatura.");
        }
      },
    });
  };

  const handleAddLockPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLockPeriod) return;

    if (closedPeriods.some((cp) => cp.period === newLockPeriod)) {
      alert("Este período já está travado na contabilidade!");
      return;
    }

    try {
      await createClosedPeriod({
        userId: authUser?.uid || "",
        accountId: "all",
        period: newLockPeriod,
        closedAt: new Date().toISOString(),
      });
      alert(
        `O período contábil de ${newLockPeriod} foi travado com sucesso! Alterações e criações retroativas foram bloqueadas neste período.`,
      );
      loadData();
    } catch (err) {
      console.error(err);
      alert("Erro ao travar o período.");
    }
  };

  const handleRemoveLockPeriod = async (id: string, periodStr: string) => {
    setGlobalConfirm({
      isOpen: true,
      title: "Reabrir Período Contábil",
      message: `Deseja realmente reabrir o período contábil de ${periodStr}? Isso liberará alterações retroativas.`,
      confirmText: "Reabrir",
      isDestructive: false,
      onConfirm: async () => {
        setGlobalConfirm((prev) => ({ ...prev, isOpen: false }));
        try {
          await deleteClosedPeriod(id);
          loadData();
        } catch (err) {
          console.error(err);
          alert("Erro ao reabrir período.");
        }
      },
    });
  };

  const handleContributeGoal = async (
    goalId: string,
    current: number,
    target: number,
  ) => {
    const value = prompt("Quanto você deseja guardar para esta meta? (R$)");
    if (!value || isNaN(Number(value))) return;
    const amount = Number(value);

    // Add transaction matching goal savings
    // We can update the goal instantly
    try {
      await updateGoal(goalId, {
        currentAmount: Math.min(target, current + amount),
      });
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Filtered transactions computed list
  const filteredTransactions = transactions
    .filter((tx) => {
      const matchAccount =
        filterAccount === "all" ||
        tx.accountId === filterAccount ||
        tx.creditCardId === filterAccount;
      const matchCategory =
        filterCategory === "all" || tx.categoryId === filterCategory;
      const matchType = filterType === "all" || tx.type === filterType;
      const matchTag =
        filterTag === "all" || (tx.tags && tx.tags.includes(filterTag));
      const matchSearch =
        !searchQuery.trim() ||
        tx.description.toLowerCase().includes(searchQuery.toLowerCase());
      return (
        matchAccount && matchCategory && matchType && matchTag && matchSearch
      );
    })
    .sort((a, b) => {
      return transactionOrder === "asc"
        ? new Date(a.date).getTime() - new Date(b.date).getTime()
        : new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-neutral-900 dark:border-white border-t-transparent dark:border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Carregando Fidúcia...
          </p>
        </div>
      </div>
    );
  }

  // Auth Guard
  if (!authUser) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-20 px-4 sm:px-6 lg:px-8 transition-colors duration-500 relative overflow-hidden">
        {/* Ambient abstract gradient blurs in background */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500/10 dark:bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10">
          <div className="flex justify-center select-none">
            <FiduciaLogo size={56} />
          </div>
          <h2 className="mt-8 text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-slate-800 to-slate-950 dark:from-white dark:via-slate-100 dark:to-slate-300">
            Fidúcia
          </h2>
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
            Seu assistente financeiro pessoal inteligente, descomplicado e
            totalmente sob o seu controle.
          </p>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-md z-10">
          <div className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-xl py-10 px-6 border border-slate-200/80 dark:border-slate-800/80 shadow-2xl rounded-3xl sm:px-10 transition-all duration-300">
            <p className="text-center font-medium text-slate-600 dark:text-slate-300 text-sm mb-8 leading-relaxed">
              Acesse sua conta com segurança via Google Sign-In para organizar
              despesas, contas, faturas e investimentos.
            </p>

            {loginError && (
              <div className="mb-6 p-4 rounded-2xl border border-red-250 bg-red-500/10 text-red-600 dark:text-red-400 text-xs sm:text-sm font-medium leading-relaxed">
                <p className="font-bold mb-1">Atenção ao realizar login:</p>
                <p>{loginError}</p>
                {loginError.includes("Domínio não autorizado") && (
                  <div className="mt-3 pt-2 border-t border-red-500/10 text-xs text-slate-500 dark:text-slate-400 space-y-2">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">
                      Como resolver no Firebase Console:
                    </p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>
                        Acesse o{" "}
                        <a
                          href="https://console.firebase.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline text-indigo-600 dark:text-indigo-400 font-bold"
                        >
                          Console do Firebase
                        </a>{" "}
                        e selecione seu projeto.
                      </li>
                      <li>
                        Vá no menu lateral em <strong>Build</strong> &gt;{" "}
                        <strong>Authentication</strong>.
                      </li>
                      <li>
                        Clique na aba <strong>Settings</strong> (Configurações)
                        na parte superior.
                      </li>
                      <li>
                        Role até encontrar a seção{" "}
                        <strong>Authorized domains</strong> (Domínios
                        Autorizados).
                      </li>
                      <li>
                        Clique em <strong>Add domain</strong> (Adicionar
                        domínio) e adicione o domínio do Vercel (ex:{" "}
                        <code>
                          {window?.location?.hostname || "seu-app.vercel.app"}
                        </code>
                        ).
                      </li>
                      <li>
                        Recarregue a página no Vercel e tente conectar
                        novamente!
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleSignIn}
              className="w-full flex items-center justify-center gap-3.5 px-5 py-3.5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700/80 shadow-sm active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.62 0 3.08.56 4.22 1.65l3.15-3.15C17.45 1.68 14.9 1 12 1 7.35 1 3.33 3.68 1.41 7.59l3.77 2.93c.9-2.69 3.43-4.48 6.82-4.48z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.43h6.43c-.28 1.47-1.12 2.71-2.37 3.55l3.74 2.9c2.19-2.02 3.47-5 3.47-8.54z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.18 10.52a6.59 6.59 0 0 1 0 2.96l-3.77 2.93A11.96 11.96 0 0 1 1 12c0-1.63.32-3.18.9-4.59l3.77 2.93z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.24 0 5.97-1.08 7.96-2.91l-3.74-2.9c-1.1.74-2.52 1.18-4.22 1.18-3.39 0-5.92-1.79-6.82-4.48l-3.77 2.93C3.33 20.32 7.35 23 12 23z"
                />
              </svg>
              Conectar com o Google
            </button>

            <div className="mt-10 text-center border-t border-slate-100 dark:border-slate-800/55 pt-6">
              <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest block font-bold mb-2">
                Arquitetura Segura
              </span>
              <span className="text-slate-400 dark:text-slate-500 text-xs font-semibold">
                React 18 &bull; Tailwind &bull; Google Cloud Firestore
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleExportData = () => {
    const backupData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      user: {
        email: authUser?.email,
        name: currentUser?.name,
      },
      data: {
        accounts,
        creditCards,
        categories,
        transactions,
        budgets,
        goals,
        closedPeriods,
        savedInvoices,
      },
    };

    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(backupData, null, 2));
    const downloadAnchorNode = document.createElement("a");
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute(
      "download",
      `fiducia_backup_${new Date().toISOString().split("T")[0]}.json`,
    );
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // Calculate total alerts for the notification badge
  const now = new Date();
  const overdueExpensesCount = transactions.filter(
    (tx) =>
      (tx.type === "expense" || tx.type === "despesa") &&
      (tx.status === "pending" || tx.status === "pendente") &&
      !tx.creditCardId &&
      new Date(tx.date) < now,
  ).length;

  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);

  const upcomingExpensesCount = transactions.filter(
    (tx) =>
      (tx.type === "expense" || tx.type === "despesa") &&
      (tx.status === "pending" || tx.status === "pendente") &&
      !tx.creditCardId &&
      new Date(tx.date) >= now &&
      new Date(tx.date) <= sevenDaysFromNow,
  ).length;

  const pendingIncomesCount = transactions.filter(
    (tx) =>
      (tx.type === "income" || tx.type === "receita") &&
      (tx.status === "pending" || tx.status === "pendente") &&
      !tx.creditCardId &&
      new Date(tx.date) <= sevenDaysFromNow,
  ).length;

  const totalAlertsCount =
    overdueExpensesCount + upcomingExpensesCount + pendingIncomesCount;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col transition-colors duration-300">
      {/* Top Header */}
      <header className="sticky top-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-border z-40 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="lg:hidden p-2 -ml-2 mr-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition"
              >
                <Menu size={24} />
              </button>
              {/* Logo */}
              <FiduciaLogo size={36} withText={true} />
            </div>

            {/* Main Tabs Navigation */}
            <nav className="hidden lg:flex space-x-1 lg:space-x-2">
              {[
                { id: "dashboard", label: "Painel" },
                { id: "movimentacoes", label: "Movimentações" },
                { id: "analytics", label: "Relatórios" },
                { id: "budgets", label: "Metas" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    // Ensure activeSubTab gets a correct default when clicking the top tab
                    if (
                      tab.id === "movimentacoes" &&
                      !["extrato", "fatura", "ofx", "reconciliation"].includes(
                        activeSubTab,
                      )
                    ) {
                      setActiveSubTab("extrato");
                    } else if (
                      tab.id === "analytics" &&
                      ![
                        "analytics-category",
                        "analytics-period",
                        "analytics-cashflow",
                      ].includes(activeSubTab)
                    ) {
                      setActiveSubTab("analytics-category");
                    }
                  }}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 shadow-xs"
                      : "text-muted-foreground hover:bg-neutral-100 hover:text-foreground dark:hover:bg-slate-800"
                  }`}
                >
                  {tab.label}
                  {["movimentacoes", "analytics"].includes(tab.id) && (
                    <ChevronDown size={12} className="opacity-50" />
                  )}
                </button>
              ))}
            </nav>

            {/* Profile Dropdown & Actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* New Transaction Button */}
              <button
                onClick={() => {
                  setTxInitialPrefill(undefined);
                  setEditingTransaction(null);
                  setShowTxModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-md transition-all duration-200 cursor-pointer"
                title="Novo lançamento"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Novo lançamento</span>
              </button>

              {/* Alerts Button */}
              <button
                onClick={() => setActiveTab("settings-alerts")}
                className="relative p-2 border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition duration-200"
                title="Alertas e Notificações"
              >
                <Bell size={16} />
                {totalAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-slate-900 shadow-sm animate-pulse">
                    {totalAlertsCount > 99 ? "99+" : totalAlertsCount}
                  </span>
                )}
              </button>

              {/* Dark mode button */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="hidden sm:block p-2 border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition duration-200"
                title="Alternar Tema"
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>

              <button
                onClick={() => setActiveTab("settings")}
                className={`hidden sm:block p-2 border border-border rounded-xl transition duration-200 ${
                  activeTab === "settings"
                    ? "text-foreground bg-muted"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                title="Configurações da Conta"
              >
                <Settings size={16} />
              </button>

              <div className="hidden lg:flex items-center gap-3 pl-3 border-l border-border">
                <div className="text-right">
                  <p className="text-xs font-bold text-foreground truncate max-w-[120px]">
                    {currentUser ? currentUser.name : "Convidado"}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                    {authUser.email}
                  </p>
                </div>

                <button
                  onClick={logOut}
                  className="p-2 border border-red-200 dark:border-red-900 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition duration-200"
                  title="Sair"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sub-navigation bar under main header */}
      {(activeTab === "movimentacoes" || activeTab === "analytics") && (
        <div className="bg-white dark:bg-slate-900 border-b border-border shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex flex-wrap gap-2 py-2">
              {activeTab === "movimentacoes" &&
                [
                  { id: "extrato", label: "Extrato da conta" },
                  { id: "fatura", label: "Fatura do cartão" },
                  { id: "ofx", label: "Importar OFX" },
                  { id: "reconciliation", label: "Conciliação" },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setActiveSubTab(sub.id)}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      activeSubTab === sub.id
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        : "text-muted-foreground hover:bg-neutral-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              {activeTab === "analytics" &&
                [
                  { id: "analytics-category", label: "Por categoria" },
                  { id: "analytics-period", label: "Por período" },
                  { id: "analytics-cashflow", label: "Fluxo de caixa" },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setActiveSubTab(sub.id)}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      activeSubTab === sub.id
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        : "text-muted-foreground hover:bg-neutral-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
            </nav>
          </div>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Drawer */}
          <div className="relative flex-1 flex flex-col max-w-[280px] w-full bg-white dark:bg-slate-900 border-r border-border shadow-2xl animate-fade-in">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <FiduciaLogo size={32} withText={true} />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition duration-200"
                  title="Alternar Tema"
                >
                  {darkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {[
                { id: "dashboard", label: "Painel" },
                { id: "movimentacoes", label: "Movimentações" },
                { id: "analytics", label: "Relatórios" },
                { id: "budgets", label: "Metas" },
                { id: "settings", label: "Configurações" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    if (
                      tab.id === "movimentacoes" &&
                      !["extrato", "fatura", "ofx", "reconciliation"].includes(
                        activeSubTab,
                      )
                    ) {
                      setActiveSubTab("extrato");
                    } else if (
                      tab.id === "analytics" &&
                      ![
                        "analytics-category",
                        "analytics-period",
                        "analytics-cashflow",
                      ].includes(activeSubTab)
                    ) {
                      setActiveSubTab("analytics-category");
                    }
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center px-4 py-3 text-sm font-semibold rounded-xl transition-all ${
                    activeTab === tab.id
                      ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 shadow-xs"
                      : "text-muted-foreground hover:bg-neutral-100 hover:text-foreground dark:hover:bg-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
            <div className="p-4 border-t border-border bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between">
              <div className="flex flex-col">
                <p className="text-sm font-bold text-foreground truncate max-w-[200px]">
                  {currentUser ? currentUser.name : "Convidado"}
                </p>
                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {authUser.email}
                </p>
              </div>
              <button
                onClick={logOut}
                className="p-2 border border-red-200 dark:border-red-900 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition duration-200"
                title="Sair"
              >
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Global metrics ribbon with a subtle grid-pattern background feel */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          {/* Total balance card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden flex flex-col justify-between h-[115px] transition-all hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] duration-300 group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              Patrimônio Total
            </span>
            <div>
              <span className="text-xl sm:text-2xl font-black text-foreground mt-1.5 tracking-tight font-mono block">
                R${" "}
                {totalBalance.toLocaleString("pt-BR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              {totalBalance - totalLiquidBalance > 0 && (
                <div className="flex gap-1.5 mt-1 text-[9px] text-muted-foreground font-medium">
                  <span title="Capital Circulante (Livre de Isolações)">
                    Circulante: R${" "}
                    {totalLiquidBalance.toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                  <span className="opacity-50">|</span>
                  <span title="Capital Isolado (Reservas/Investimentos)">
                    Reservas: R${" "}
                    {(totalBalance - totalLiquidBalance).toLocaleString(
                      "pt-BR",
                      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                    )}
                  </span>
                </div>
              )}
            </div>
            <div className="absolute right-4 top-4 text-emerald-500 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/10 duration-300 group-hover:bg-emerald-500/20">
              <Wallet size={16} />
            </div>
          </div>

          {/* Total Income card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden flex flex-col justify-between h-[115px] transition-all hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] duration-300 group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-teal-500/10 to-transparent rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              Receitas{" "}
              {new Date().toLocaleDateString("pt-BR", { month: "long" })}
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-500 mt-1.5 tracking-tight font-mono">
              + R${" "}
              {totalIncomes.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </span>
            <div className="absolute right-5 bottom-5 text-teal-500 bg-teal-500/10 p-2.5 rounded-xl border border-teal-500/10 duration-300 group-hover:bg-teal-500/20">
              <TrendingUp size={18} />
            </div>
          </div>

          {/* Total Expense card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden flex flex-col justify-between h-[115px] transition-all hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(0,0,0,0.1)] duration-300 group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-rose-500/10 to-transparent rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
              Despesas{" "}
              {new Date().toLocaleDateString("pt-BR", { month: "long" })}
            </span>
            <span className="text-xl sm:text-2xl font-black text-rose-500 mt-1.5 tracking-tight font-mono">
              - R${" "}
              {totalExpenses.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </span>
            <div className="absolute right-5 bottom-5 text-rose-500 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/10 duration-300 group-hover:bg-rose-500/20">
              <TrendingDown size={18} />
            </div>
          </div>

          {/* Credit card invoice total replaced with interactive Disponível Seguro */}
          <div
            onClick={() => setShowSafeBalanceModal(true)}
            className="cursor-pointer bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden flex flex-col justify-between min-h-[115px] h-auto transition-all hover:translate-y-[-2px] hover:shadow-[0_10px_30px_-10px_rgba(139,92,246,0.15)] hover:border-purple-300 dark:hover:border-purple-900 duration-350 group active:scale-95"
            title="Clique para ver o detalhamento do Saldo Seguro"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-purple-500/10 to-transparent rounded-full blur-2xl group-hover:scale-125 transition-transform duration-500 pointer-events-none" />
            <div className="space-y-1 mb-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
                  Disponível Seguro
                </span>
                <span className="text-[9px] text-purple-600 dark:text-purple-400 font-bold tracking-tight bg-purple-500/10 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 group-hover:bg-purple-500/20 transition">
                  Detalhar <Info size={10} />
                </span>
              </div>
              <span className="text-[9.5px] leading-normal text-muted-foreground/80 block font-medium">
                Desconta faturas e despesas fixas pendentes no mês
              </span>
            </div>
            <span
              className={`text-xl sm:text-2xl font-black mt-1 tracking-tight font-mono ${
                safeBalanceValue >= 0
                  ? "text-purple-600 dark:text-purple-400"
                  : "text-rose-500"
              }`}
            >
              R${" "}
              {safeBalanceValue.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
              })}
            </span>
            <div className="absolute right-5 bottom-5 text-purple-600 bg-purple-500/10 p-2.5 rounded-xl border border-purple-500/10 duration-300 group-hover:bg-purple-500/20">
              <PiggyBank size={18} />
            </div>
          </div>
        </section>

        {/* Dynamic Views rendering */}

        {/* ID: Dashboard */}
        {activeTab === "dashboard" && (
          <div className="space-y-6 animate-fade-in">
            {/* PWA App Install Callout */}
            {showPwaBanner && (
              <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 gap-4 bg-gradient-to-r from-emerald-500/5 via-cyan-500/5 to-blue-500/5 dark:from-emerald-950/10 dark:via-cyan-950/10 dark:to-blue-950/10 border border-emerald-500/10 dark:border-emerald-500/5 rounded-3xl mb-8 overflow-hidden group">
                {/* Animated visual accent bar */}
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-400 via-cyan-500 to-blue-500" />
                
                <div className="absolute -right-4 -top-8 text-emerald-500/5 rotate-12 scale-150 pointer-events-none hidden sm:block">
                  <Download size={120} />
                </div>

                <div className="flex items-center gap-3.5 z-10">
                  <div className="p-2 sm:p-2.5 bg-emerald-500/10 rounded-2xl border border-emerald-500/10 text-emerald-500">
                    <Download size={20} className="animate-bounce" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                      Instalar app no celular
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Acesse o Fidúncia direto da tela inicial, sem abrir o navegador.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto z-10 shrink-0">
                  <button
                    onClick={() => {
                      if (isAppInstallable) {
                        handleInstallApp();
                      } else {
                        setShowPWAInstructionModal(true);
                      }
                      setShowPwaBanner(false);
                      localStorage.setItem('pwa_banner_dismissed', 'true');
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-2xl transition duration-200 shadow-md hover:shadow-emerald-500/10 active:scale-[0.98] cursor-pointer"
                  >
                     Instalar Agora
                  </button>
                  <button
                    onClick={() => {
                      setShowPwaBanner(false);
                      localStorage.setItem('pwa_banner_dismissed', 'true');
                    }}
                    className="p-3 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/5 rounded-2xl transition cursor-pointer"
                    title="Não mostrar novamente"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Embedded Charts Components */}
            <DashboardCharts
              transactions={transactions}
              categories={categories}
            />

            {/* Bottom Row Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* List of Recent Transactions */}
              <div className="lg:col-span-2 bg-card border border-border rounded-2xl shadow-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-foreground">
                    Últimos Lançamentos
                  </h3>
                  <button
                    onClick={() => setActiveTab("transactions")}
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    Ver Todos
                  </button>
                </div>

                <div className="divide-y divide-border overflow-hidden">
                  {transactions.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Nenhuma transação lançada ainda nesta conta.
                    </div>
                  ) : (
                    transactions.slice(0, 5).map((tx) => {
                      const isIncome =
                        tx.type === "income" || tx.type === "receita";
                      const category = categories.find(
                        (c) => c.id === tx.categoryId,
                      );
                      return (
                        <div
                          key={tx.id}
                          className="py-3 flex items-center justify-between text-xs font-medium"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-xl ${
                                isIncome
                                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500"
                                  : tx.creditCardId
                                    ? "bg-violet-50 dark:bg-violet-950/20 text-[#8b5cf6]"
                                    : "bg-rose-50 dark:bg-rose-950/20 text-rose-500"
                              }`}
                            >
                              {isIncome ? (
                                <ArrowUpRight size={16} />
                              ) : tx.creditCardId ? (
                                <CardIcon size={16} />
                              ) : (
                                <ArrowDownLeft size={16} />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground max-w-[150px] sm:max-w-xs truncate">
                                {tx.description}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                <span>
                                  {new Date(tx.date).toLocaleDateString(
                                    "pt-BR",
                                  )}
                                </span>
                                <span>&bull;</span>
                                <span className="bg-muted px-1.5 py-0.5 rounded-sm">
                                  {category ? category.name : "Outros"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex items-center gap-2">
                            <button
                              onClick={() => handleToggleTransactionStatus(tx)}
                              className="p-1 rounded hover:bg-muted transition-colors mr-2"
                              title={
                                tx.status === "paid"
                                  ? "Marcar como pendente"
                                  : "Marcar como pago"
                              }
                            >
                              {tx.status === "paid" ? (
                                <CheckCircle2
                                  size={16}
                                  className="text-emerald-500"
                                />
                              ) : (
                                <CircleDashed
                                  size={16}
                                  className="text-amber-500"
                                />
                              )}
                            </button>
                            <span
                              className={`font-bold ${isIncome ? "text-emerald-500" : "text-foreground"} mr-2`}
                            >
                              {isIncome ? "+" : "-"} R${" "}
                              {tx.amount.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </span>

                            <button
                              onClick={() => {
                                setEditingTransaction(tx);
                                setShowTxModal(true);
                              }}
                              className="text-muted-foreground hover:text-blue-500 p-1 rounded-md transition"
                              title="Editar transação"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() =>
                                tx.id && handleDeleteTransaction(tx.id)
                              }
                              className="text-muted-foreground hover:text-red-500 p-1 rounded-md transition"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Mini Account/Card status sidebar */}
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-2xl shadow-card p-5">
                  <h3 className="text-sm font-bold text-foreground mb-4">
                    Minhas Contas
                  </h3>

                  <div className="space-y-3">
                    {accounts.map((acc) => {
                      const bankMatch = acc.name.match(/^\[(.*?)\]\s*(.*)$/);
                      const displayName = bankMatch ? bankMatch[2] : acc.name;
                      const bankPrefix = bankMatch ? bankMatch[1] : null;

                      return (
                        <button
                          key={acc.id}
                          onClick={() => {
                            window.history.pushState({}, "", "?account=" + acc.id);
                            window.dispatchEvent(new PopStateEvent("popstate"));
                            setActiveTab("movimentacoes");
                            setActiveSubTab("extrato");
                          }}
                          className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border gap-2 hover:bg-muted transition-colors text-left cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="shrink-0 p-1.5 rounded bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                              <Wallet size={16} />
                            </div>
                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 w-full pb-0.5">
                                <p className="text-xs font-bold text-foreground truncate max-w-full">
                                  {displayName}
                                </p>
                                {bankPrefix && (
                                  <span className="shrink-0 text-[10px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 truncate max-w-[100px]">
                                    {bankPrefix}
                                  </span>
                                )}
                                {acc.excludeFromCashFlow && (
                                  <span
                                    className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    title="Saldo isolado do Disponível Seguro"
                                  >
                                    Reserva
                                  </span>
                                )}
                              </div>
                              <p className="text-[9px] sm:text-[10px] text-muted-foreground truncate w-full">
                                {acc.type === "checking"
                                  ? "Corrente"
                                  : acc.type === "savings"
                                    ? "Poupança"
                                    : acc.type === "investment"
                                      ? "Investimento"
                                      : "Dinheiro"}
                                {acc.bankName &&
                                  !bankPrefix &&
                                  ` • ${acc.bankName}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-foreground">
                              R${" "}
                              {acc.balance.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                            <div className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                              <ArrowUpRight size={14} />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setShowAccountModal(true)}
                      className="w-full text-center py-2 border border-dashed border-border hover:bg-muted text-xs font-semibold text-muted-foreground hover:text-foreground rounded-xl transition"
                    >
                      + Nova Conta
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ID: Movimentações - Views */}
        {activeTab === "movimentacoes" && activeSubTab === "extrato" && (
          <StatementPage
            accounts={accounts}
            creditCards={creditCards}
            transactions={transactions}
            categories={categories}
            typeFilter="account"
            onNewTransaction={(prefill) => {
              setTxInitialPrefill(prefill);
              setShowTxModal(true);
            }}
            onEditTransaction={(tx) => {
              setEditingTransaction(tx);
              setShowTxModal(true);
            }}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}
        {activeTab === "movimentacoes" && activeSubTab === "fatura" && (
          <StatementPage
            accounts={accounts}
            creditCards={creditCards}
            transactions={transactions}
            categories={categories}
            typeFilter="creditCard"
            onNewTransaction={(prefill) => {
              setTxInitialPrefill(prefill);
              setShowTxModal(true);
            }}
            onEditTransaction={(tx) => {
              setEditingTransaction(tx);
              setShowTxModal(true);
            }}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}
        {activeTab === "movimentacoes" && activeSubTab === "ofx" && (
          <div className="space-y-6 animate-fade-in">
            <OFXImporter
              accounts={accounts}
              categories={categories}
              creditCards={creditCards}
              closedPeriods={closedPeriods}
              onRefresh={loadData}
            />
          </div>
        )}

        {/* ID: Banks and credit cards management */}
        {activeTab === "banks" && (
          <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-2">
              <button
                onClick={() => setActiveTab("settings")}
                className="p-2 px-4 border border-border bg-card text-foreground rounded-xl hover:bg-muted transition text-xs font-bold shadow-sm"
              >
                ← Voltar para Configurações
              </button>
              <h2 className="text-xl font-bold text-foreground">
                Contas e Cartões
              </h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bank Accounts Grid */}
              <div className="bg-card border border-border p-6 rounded-2xl shadow-card space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">
                    Contas & Carteiras
                  </h3>
                  <button
                    onClick={() => setShowAccountModal(true)}
                    className="flex items-center gap-1 bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-90"
                  >
                    <Plus size={14} /> Nova Conta
                  </button>
                </div>

                <div className="space-y-4">
                  {accounts.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">
                      Nenhuma conta ou carteira cadastrada.
                    </p>
                  ) : (
                    accounts.map((acc) => {
                      const bankMatch = acc.name.match(/^\[(.*?)\]\s*(.*)$/);
                      const displayName = bankMatch ? bankMatch[2] : acc.name;
                      const bankPrefix = bankMatch ? bankMatch[1] : null;

                      return (
                        <div
                          key={acc.id}
                          className="p-4 rounded-xl border border-border bg-muted/25 flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3 w-full min-w-0">
                            <div className="p-2.5 rounded-lg bg-primary/10 text-primary shrink-0">
                              <Wallet size={18} />
                            </div>
                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 w-full">
                                <p className="text-sm font-bold text-foreground truncate max-w-full">
                                  {displayName}
                                </p>
                                {bankPrefix && (
                                  <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 truncate max-w-[120px]">
                                    {bankPrefix}
                                  </span>
                                )}
                                {acc.excludeFromCashFlow && (
                                  <span
                                    className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    title="Saldo isolado do Disponível Seguro"
                                  >
                                    <Target size={10} />
                                    Reserva / Isolado
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1 text-xs text-muted-foreground w-full">
                                <span className="whitespace-nowrap font-medium text-foreground/80">
                                  {acc.type === "checking"
                                    ? "Conta Corrente"
                                    : acc.type === "savings"
                                      ? "Poupança"
                                      : acc.type === "investment"
                                        ? "Investimento"
                                        : "Dinheiro Físico"}
                                </span>
                                {acc.bankName && !bankPrefix && (
                                  <span className="whitespace-nowrap truncate max-w-[200px] opacity-80">
                                    • {acc.bankName}
                                  </span>
                                )}
                                {(acc.agency || acc.accountNumber) && (
                                  <span className="whitespace-nowrap font-mono text-[10px] tracking-tight opacity-80">
                                    • {acc.agency && `Ag: ${acc.agency} `}
                                    {acc.accountNumber &&
                                      `Cc: ${acc.accountNumber}`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 shrink-0 pl-4 border-l border-border/50">
                            <span className="text-sm font-extrabold text-foreground">
                              R${" "}
                              {acc.balance.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                            <div className="flex flex-col items-end gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleStartEditAccount(acc)}
                                  className="text-muted-foreground hover:text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 p-1.5 rounded-lg transition duration-200 cursor-pointer"
                                  title="Editar Conta"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() =>
                                    acc.id && handleDeleteAccount(acc.id)
                                  }
                                  className="text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1.5 rounded-lg transition duration-200 cursor-pointer"
                                  title="Excluir Conta"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              <button
                                onClick={() =>
                                  navigateToStatement("account", acc.id || "")
                                }
                                className="text-[10px] text-blue-500 hover:underline font-medium flex items-center"
                              >
                                → Ver extrato
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Credit cards list */}
              <div className="bg-card border border-border p-6 rounded-2xl shadow-card space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">
                    Cartões de Crédito
                  </h3>
                  <button
                    onClick={() => setShowCardModal(true)}
                    className="flex items-center gap-1 bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-90"
                  >
                    <Plus size={14} /> Novo Cartão
                  </button>
                </div>

                <div className="space-y-4">
                  {creditCards.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">
                      Nenhum cartão cadastrado.
                    </p>
                  ) : (
                    creditCards.map((card) => {
                      // Total spends on this card
                      const totalCardSpends = transactions
                        .filter(
                          (tx) =>
                            tx.creditCardId === card.id &&
                            tx.status !== "cancelled",
                        )
                        .reduce((sum, tx) => sum + tx.amount, 0);

                      const limitPercentage = Math.min(
                        100,
                        (totalCardSpends / card.limit) * 100,
                      );

                      const bankMatch = card.name.match(/^\[(.*?)\]\s*(.*)$/);
                      const displayName = bankMatch ? bankMatch[2] : card.name;
                      const bankPrefix = bankMatch ? bankMatch[1] : null;

                      const brandDetails = getCardBrandDetails(displayName);

                      return (
                        <div
                          key={card.id}
                          className="p-4 rounded-xl border border-border bg-muted/25 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`p-2.5 rounded-lg shrink-0 ${brandDetails.bgClass} ${brandDetails.textClass}`}
                              >
                                <CardIcon size={18} />
                              </div>
                              <div className="min-w-0 flex-1 flex flex-col justify-center">
                                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 w-full">
                                  <p className="text-sm font-bold text-foreground truncate max-w-full">
                                    {displayName}
                                  </p>
                                  {bankPrefix && (
                                    <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 truncate max-w-[120px]">
                                      {bankPrefix}
                                    </span>
                                  )}
                                  <span
                                    className={`shrink-0 text-[9px] font-extrabold tracking-wide px-1.5 py-0.5 rounded-md uppercase border ${brandDetails.bgClass} ${brandDetails.textClass} ${brandDetails.borderClass}`}
                                  >
                                    {brandDetails.label}
                                  </span>
                                </div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                                  Melhor dia compra: {card.closingDay} &bull;
                                  Vence dia {card.dueDay}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => handleStartEditCard(card)}
                                  className="text-muted-foreground hover:text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 p-1.5 rounded-lg transition duration-200 cursor-pointer"
                                  title="Editar Cartão"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() =>
                                    card.id && handleDeleteCard(card.id)
                                  }
                                  className="text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 p-1.5 rounded-lg transition duration-200 cursor-pointer"
                                  title="Excluir Cartão"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              <button
                                onClick={() =>
                                  navigateToStatement(
                                    "creditCard",
                                    card.id || "",
                                  )
                                }
                                className="text-[10px] text-blue-500 hover:underline font-medium flex items-center"
                              >
                                → Ver fatura
                              </button>
                            </div>
                          </div>

                          {/* Limit bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-muted-foreground">
                                Limite Utilizado: R${" "}
                                {totalCardSpends.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                              <span className="text-foreground font-bold">
                                R${" "}
                                {card.limit.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div
                                className={`${brandDetails.barClass} h-full transition-all duration-500`}
                                style={{ width: `${limitPercentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ID: Budgets & Goals page */}
        {activeTab === "budgets" && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Goals list */}
              <div className="bg-card border border-border p-6 rounded-2xl shadow-card space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">
                    Metas Financeiras (Cofrinho)
                  </h3>
                  <button
                    onClick={() => setShowGoalModal(true)}
                    className="flex items-center gap-1 bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-90"
                  >
                    <Plus size={14} /> Nova Meta
                  </button>
                </div>

                <div className="space-y-4">
                  {goals.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">
                      Nenhuma meta cadastrada.
                    </p>
                  ) : (
                    goals.map((goal) => {
                      const pct = Math.min(
                        100,
                        (goal.currentAmount / goal.targetAmount) * 100,
                      );
                      return (
                        <div
                          key={goal.id}
                          className="p-4 rounded-xl border border-border bg-muted/25 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-amber-500">
                                <Target size={18} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-foreground">
                                  {goal.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Prazo final:{" "}
                                  {new Date(goal.deadline).toLocaleDateString(
                                    "pt-BR",
                                  )}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {pct < 100 && (
                                <button
                                  onClick={() =>
                                    goal.id &&
                                    handleContributeGoal(
                                      goal.id,
                                      goal.currentAmount,
                                      goal.targetAmount,
                                    )
                                  }
                                  className="bg-primary hover:opacity-90 text-primary-foreground font-bold px-2 py-1 rounded-sm text-[10px]"
                                >
                                  Papar
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  goal.id && handleDeleteGoal(goal.id)
                                }
                                className="text-muted-foreground hover:text-red-500 p-1 rounded-lg"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">
                                Progresso: R${" "}
                                {goal.currentAmount.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                                ({pct.toFixed(0)}%)
                              </span>
                              <span className="font-bold text-foreground">
                                Meta: R${" "}
                                {goal.targetAmount.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-amber-500 h-full"
                                style={{ width: `${pct}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Monthly category budgets */}
              <div className="bg-card border border-border p-6 rounded-2xl shadow-card space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-base font-bold text-foreground">
                    Orçamentos Mensais
                  </h3>
                  <button
                    onClick={() => setShowBudgetModal(true)}
                    className="flex items-center gap-1 bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 text-xs font-bold px-3 py-1.5 rounded-lg hover:opacity-90"
                  >
                    <Plus size={14} /> Atribuir Teto
                  </button>
                </div>

                <div className="space-y-4">
                  {budgets.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">
                      Nenhum orçamento planejado.
                    </p>
                  ) : (
                    budgets.map((bgt) => {
                      const matchedCategory = categories.find(
                        (c) => c.id === bgt.categoryId,
                      );

                      // Calculate actual spends this month in this category
                      const spent = transactions
                        .filter(
                          (tx) =>
                            tx.categoryId === bgt.categoryId &&
                            tx.type === "expense" &&
                            tx.status === "paid",
                        )
                        .reduce((sum, tx) => sum + tx.amount, 0);

                      const pct = Math.min(100, (spent / bgt.amount) * 100);
                      const isDanger = pct > 100;
                      const isWarning = pct > 80;

                      return (
                        <div
                          key={bgt.id}
                          className="p-4 rounded-xl border border-border bg-muted/25 space-y-2"
                        >
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-bold text-foreground flex items-center gap-1.5">
                              <PiggyBank
                                size={14}
                                className="text-muted-foreground"
                              />{" "}
                              {matchedCategory ? matchedCategory.name : "Geral"}
                            </span>
                            <span className="text-muted-foreground">
                              R${" "}
                              {spent.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              de{" "}
                              <b>
                                R${" "}
                                {bgt.amount.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </b>
                            </span>
                          </div>

                          <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${isDanger ? "bg-red-500" : isWarning ? "bg-yellow-500" : "bg-green-500"}`}
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ID: Reconciliation tab */}
        {activeTab === "movimentacoes" && activeSubTab === "reconciliation" && (
          <div className="space-y-6 animate-fade-in">
            {/* Tab header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 gap-4">
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Fechamentos & Conciliação
                </h1>
                <p className="text-xs text-muted-foreground">
                  Gerencie o encerramento de faturas de cartões, trave períodos
                  contábeis de segurança e importações.
                </p>
              </div>

              {/* Sub-Tabs Selector */}
              <div className="flex bg-muted p-1 rounded-xl gap-1 self-start">
                <button
                  onClick={() => setReconciliationSubTab("invoices")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition duration-200 ${
                    reconciliationSubTab === "invoices"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Fechamento de Faturas
                </button>
                <button
                  onClick={() => setReconciliationSubTab("locks")}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition duration-200 ${
                    reconciliationSubTab === "locks"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Trava de Segurança (Contábil)
                </button>
              </div>
            </div>

            {/* Render 2: Credit Card Invoices Close */}
            {reconciliationSubTab === "invoices" &&
              (() => {
                const activeCard = creditCards.find(
                  (c) => c.id === selectedCardId,
                );
                const cardTxs = transactions.filter(
                  (t) =>
                    t.creditCardId === selectedCardId &&
                    t.invoicePeriod === selectedInvoicePeriod,
                );
                const totalAmount = cardTxs.reduce(
                  (sum, curr) => sum + curr.amount,
                  0,
                );

                const savedInvoice = savedInvoices.find(
                  (inv) =>
                    inv.cardId === selectedCardId &&
                    inv.period === selectedInvoicePeriod,
                );
                const invoiceStatus: "aberta" | "fechada" | "paga" =
                  savedInvoice ? savedInvoice.status : "aberta";

                // Unique periods of card transactions
                const cardTotalTxs = transactions.filter(
                  (t) => t.creditCardId === selectedCardId,
                );
                const availablePeriods = Array.from(
                  new Set(
                    cardTotalTxs.map((t) => t.invoicePeriod).filter(Boolean),
                  ),
                ) as string[];
                availablePeriods.sort((a, b) => b.localeCompare(a));
                const currentMonth = new Date().toISOString().substring(0, 7);
                if (!availablePeriods.includes(currentMonth)) {
                  availablePeriods.unshift(currentMonth);
                }

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Controls Card */}
                    <div className="lg:col-span-1 space-y-4">
                      <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-4">
                        <h2 className="text-sm font-bold text-foreground">
                          Filtro de Fatura
                        </h2>

                        <div>
                          <label className="block text-xs font-medium text-muted-foreground mb-1">
                            Selecione o Cartão de Crédito
                          </label>
                          <select
                            value={selectedCardId}
                            onChange={(e) => {
                              setSelectedCardId(e.target.value);
                              setPaymentDate("");
                            }}
                            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-sm focus:outline-none"
                          >
                            <option value="">Selecione um cartão...</option>
                            {creditCards.map((card) => (
                              <option key={card.id} value={card.id}>
                                {card.name} (Dia fechamento: {card.closingDay})
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedCardId && (
                          <div>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                              Mês de Referência (Fatura)
                            </label>
                            <select
                              value={selectedInvoicePeriod}
                              onChange={(e) =>
                                setSelectedInvoicePeriod(e.target.value)
                              }
                              className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-sm focus:outline-none"
                            >
                              {availablePeriods.map((p) => (
                                <option key={p} value={p}>
                                  {new Date(p + "-02").toLocaleDateString(
                                    "pt-BR",
                                    { month: "long", year: "numeric" },
                                  )}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Closing Panel Actions */}
                      {activeCard && selectedInvoicePeriod && (
                        <div className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-4">
                          <div className="flex items-center justify-between">
                            <h2 className="text-sm font-bold text-foreground">
                              Status da Fatura
                            </h2>
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider ${
                                invoiceStatus === "aberta"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                              }`}
                            >
                              {invoiceStatus === "aberta"
                                ? "Aberta"
                                : "Fechada & Agendada"}
                            </span>
                          </div>

                          <div className="p-3 bg-muted/30 rounded-xl space-y-1">
                            <p className="text-xs text-muted-foreground">
                              Volume de Compras
                            </p>
                            <p className="text-lg font-bold text-foreground">
                              R${" "}
                              {totalAmount.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Totalizando {cardTxs.length} lançamentos de gasto
                            </p>
                          </div>

                          {invoiceStatus === "aberta" ? (
                            <form
                              onSubmit={handleCloseInvoice}
                              className="space-y-3"
                            >
                              <div>
                                <p className="text-xs text-foreground font-semibold mb-2">
                                  Instruções de Fechamento:
                                </p>
                                <p className="text-[10px] text-muted-foreground leading-relaxed leading-4">
                                  Ao fechar a fatura, o sistema irá agendar um
                                  pagamento previsto de
                                  <strong className="text-foreground">
                                    {" "}
                                    R${" "}
                                    {totalAmount.toLocaleString("pt-BR", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}{" "}
                                  </strong>
                                  na conta bancária definida na data de
                                  vencimento.
                                </p>
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                                  Debitar Conta Bancária
                                </label>
                                <select
                                  value={paymentBankAccountId}
                                  onChange={(e) =>
                                    setPaymentBankAccountId(e.target.value)
                                  }
                                  className="w-full px-2.5 py-1.5 border border-border bg-background text-foreground rounded-xl text-xs focus:outline-none"
                                >
                                  <option value="">
                                    Selecione uma conta...
                                  </option>
                                  {accounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                      {acc.name} (Saldo: R${" "}
                                      {acc.balance.toLocaleString("pt-BR", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                      )
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                                  Data do Pagamento / Vencimento
                                </label>
                                <input
                                  type="date"
                                  value={
                                    paymentDate ||
                                    `${selectedInvoicePeriod}-${String(activeCard.dueDay).padStart(2, "0")}`
                                  }
                                  onChange={(e) =>
                                    setPaymentDate(e.target.value)
                                  }
                                  className="w-full px-2.5 py-1.5 border border-border bg-background text-foreground rounded-xl text-xs focus:outline-none"
                                />
                              </div>

                              <button
                                type="submit"
                                className="w-full bg-neutral-900 border border-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 font-semibold py-2 px-3 rounded-xl text-xs transition duration-200"
                              >
                                Fechar Fatura e Agendar Pagamento
                              </button>
                            </form>
                          ) : (
                            <div className="space-y-4">
                              <div className="p-3 border border-dashed border-rose-200 dark:border-rose-900 bg-rose-50/30 dark:bg-rose-950/10 rounded-xl">
                                <p className="text-xs font-semibold text-rose-800 dark:text-rose-400">
                                  Fatura Fechada
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  Esta fatura já encontra-se selada de forma
                                  definitiva. Um lançamento previsto foi gerado
                                  no seu fluxo de caixa para liquidação
                                  contábil.
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() =>
                                  savedInvoice &&
                                  handleReopenInvoice(savedInvoice)
                                }
                                className="w-full bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-semibold py-2 px-3 rounded-xl text-xs transition duration-200"
                              >
                                Reabrir Fatura & Desfazer Agendam.
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right Transactions List Card */}
                    <div className="lg:col-span-2 bg-card border border-border p-5 rounded-2xl shadow-sm text-left">
                      <h2 className="text-sm font-bold text-foreground mb-1">
                        Compras da Fatura Selecionada
                      </h2>
                      <p className="text-xs text-muted-foreground mb-4">
                        Lançamentos pertencentes à competência d faturamento d{" "}
                        {selectedInvoicePeriod}.
                      </p>

                      {cardTxs.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-border rounded-xl">
                          <p className="text-xs text-muted-foreground">
                            Nenhuma compra registrada pertencente a esse mês de
                            faturamento.
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="border-b border-border text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                                <th className="pb-2">Data Lançamento</th>
                                <th className="pb-2">Descrição</th>
                                <th className="pb-2">Categoria</th>
                                <th className="pb-2 text-right">
                                  Valor do Gasto
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {cardTxs.map((tx) => {
                                const cat = categories.find(
                                  (c) => c.id === tx.categoryId,
                                );
                                return (
                                  <tr
                                    key={tx.id}
                                    className="border-b border-border/40 hover:bg-muted/15 transition-colors"
                                  >
                                    <td className="py-3 text-muted-foreground">
                                      {new Date(tx.date).toLocaleDateString(
                                        "pt-BR",
                                      )}
                                    </td>
                                    <td className="py-3 font-semibold text-foreground">
                                      {tx.description}
                                    </td>
                                    <td className="py-3">
                                      <span className="px-2 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground">
                                        {cat?.name || "Sem Categoria"}
                                      </span>
                                    </td>
                                    <td className="py-3 text-right font-semibold text-foreground">
                                      R${" "}
                                      {tx.amount.toLocaleString("pt-BR", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            {/* Render 3: Trava Contábil / Closed Period */}
            {reconciliationSubTab === "locks" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Add new monthly lock panel */}
                <div className="lg:col-span-1">
                  <form
                    onSubmit={handleAddLockPeriod}
                    className="bg-card border border-border p-5 rounded-2xl shadow-sm space-y-4"
                  >
                    <h2 className="text-sm font-bold text-foreground">
                      Travar Novo Período
                    </h2>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Definir uma trava de fechamento contábil impede que
                      qualquer transação retroativa desse mês seja criada,
                      editada, movida ou excluída. Esta trava atua de forma
                      global.
                    </p>

                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">
                        Mês Contábil para Fechar
                      </label>
                      <input
                        type="month"
                        value={newLockPeriod}
                        onChange={(e) => setNewLockPeriod(e.target.value)}
                        className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-sm focus:outline-none"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-neutral-900 border border-neutral-950 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 font-semibold py-2 px-3 rounded-xl text-xs transition duration-200"
                    >
                      Confirmar Trava Contábil
                    </button>
                  </form>
                </div>

                {/* Lock list panel */}
                <div className="lg:col-span-2 bg-card border border-border p-5 rounded-2xl shadow-sm space-y-4 text-left">
                  <h2 className="text-sm font-bold text-foreground">
                    Meses com Auditoria Bloqueada (Fechados)
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Relação de travas operacionais de segurança ativas na
                    contabilidade da sua empresa.
                  </p>

                  {closedPeriods.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-border rounded-xl">
                      <p className="text-xs text-muted-foreground">
                        Sem travas contábeis ativas. Todos os períodos passados
                        estão liberados para movimentação.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                            <th className="pb-2">Período Contábil</th>
                            <th className="pb-2">Fechado em</th>
                            <th className="pb-2 text-center">
                              Status Operacional
                            </th>
                            <th className="pb-2 text-right">Ação</th>
                          </tr>
                        </thead>
                        <tbody>
                          {closedPeriods.map((cp) => (
                            <tr
                              key={cp.id}
                              className="border-b border-border/40 hover:bg-muted/15 transition-colors"
                            >
                              <td className="py-3 font-semibold text-foreground">
                                {new Date(cp.period + "-02").toLocaleDateString(
                                  "pt-BR",
                                  { month: "long", year: "numeric" },
                                )}
                              </td>
                              <td className="py-3 text-muted-foreground">
                                {new Date(cp.closedAt).toLocaleDateString(
                                  "pt-BR",
                                )}{" "}
                                às{" "}
                                {new Date(cp.closedAt).toLocaleTimeString(
                                  "pt-BR",
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </td>
                              <td className="py-3 text-center">
                                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 text-[10px] font-bold uppercase tracking-wider">
                                  ● Bloqueado
                                </span>
                              </td>
                              <td className="py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    cp.id &&
                                    handleRemoveLockPeriod(cp.id, cp.period)
                                  }
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 p-1.5 rounded-lg transition"
                                  title="Destravar Período Contábil"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ID: Analytics */}
        {activeTab === "analytics" && (
          <div className="space-y-6 animate-fade-in">
            <AnalyticsDashboard
              transactions={transactions}
              categories={categories}
              view={activeSubTab}
            />
          </div>
        )}

        {/* ID: Plano de Contas */}
        {activeTab === "categories" && (
          <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-2">
              <button
                onClick={() => setActiveTab("settings")}
                className="p-2 px-4 border border-border bg-card text-foreground rounded-xl hover:bg-muted transition text-xs font-bold shadow-sm"
              >
                ← Voltar para Configurações
              </button>
            </div>
            <CategoryManager categories={categories} onRefresh={loadData} />
          </div>
        )}

        {/* ID: Configurações Hub */}
        {activeTab === "settings" && (
          <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
            <h2 className="text-xl font-bold text-foreground">Configurações</h2>
            <p className="text-sm text-muted-foreground">
              Gerencie suas preferências, contas, categorias e outras opções do
              sistema.
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveTab("categories")}
                className="flex flex-col items-center justify-center p-6 bg-card border border-border rounded-2xl shadow-xs hover:bg-muted transition gap-3 text-center"
              >
                <div className="p-3 bg-primary/10 text-primary rounded-full">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Categorias
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gerenciar categorias de lançamentos
                  </p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("banks")}
                className="flex flex-col items-center justify-center p-6 bg-card border border-border rounded-2xl shadow-xs hover:bg-muted transition gap-3 text-center"
              >
                <div className="p-3 bg-primary/10 text-primary rounded-full">
                  <Landmark size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Contas e Cartões
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gerenciar contas bancárias e cartões
                  </p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("settings-preferences")}
                className="flex flex-col items-center justify-center p-6 bg-card border border-border rounded-2xl shadow-xs hover:bg-muted transition gap-3 text-center"
              >
                <div className="p-3 bg-primary/10 text-primary rounded-full">
                  <UserIcon size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Preferências
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Perfil, Tema e Backup de Dados
                  </p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("settings-alerts")}
                className="flex flex-col items-center justify-center p-6 bg-card border border-border rounded-2xl shadow-xs hover:bg-muted transition gap-3 text-center"
              >
                <div className="p-3 bg-primary/10 text-primary rounded-full">
                  <Bell size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Alertas</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Central de notificações
                  </p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("settings-tags")}
                className="flex flex-col items-center justify-center p-6 bg-card border border-border rounded-2xl shadow-xs hover:bg-muted transition gap-3 text-center"
              >
                <div className="p-3 bg-primary/10 text-primary rounded-full">
                  <Target size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Tags</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gerenciar marcadores
                  </p>
                </div>
              </button>

              <button
                onClick={() => setActiveTab("settings-activity")}
                className="flex flex-col items-center justify-center p-6 bg-card border border-border rounded-2xl shadow-xs hover:bg-muted transition gap-3 text-center"
              >
                <div className="p-3 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-full">
                  <History size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Atividades
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Auditoria e logs
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ID: Tags */}
        {activeTab === "settings-tags" && (
          <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-2">
              <button
                onClick={() => setActiveTab("settings")}
                className="p-2 px-4 border border-border bg-card text-foreground rounded-xl hover:bg-muted transition text-xs font-bold shadow-sm"
              >
                ← Voltar para Configurações
              </button>
              <h2 className="text-xl font-bold text-foreground">Tags</h2>
            </div>
            <TagManager tags={tags} onRefresh={loadData} />
          </div>
        )}

        {/* ID: Alertas */}
        {activeTab === "settings-alerts" && (
          <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-2">
              <button
                onClick={() => setActiveTab("settings")}
                className="p-2 px-4 border border-border bg-card text-foreground rounded-xl hover:bg-muted transition text-xs font-bold shadow-sm"
              >
                ← Voltar para Configurações
              </button>
              <h2 className="text-xl font-bold text-foreground">Alertas</h2>
            </div>
            <AlertsManager
              transactions={transactions}
              onNavigate={(tab) => setActiveTab(tab as any)}
            />
          </div>
        )}

        {/* ID: Activity */}
        {activeTab === "settings-activity" && (
          <div className="space-y-6 animate-fade-in max-w-7xl mx-auto">
            <div className="flex items-center gap-4 mb-2">
              <button
                onClick={() => setActiveTab("settings")}
                className="p-2 px-4 border border-border bg-card text-foreground rounded-xl hover:bg-muted transition text-xs font-bold shadow-sm"
              >
                ← Voltar para Configurações
              </button>
              <h2 className="text-xl font-bold text-foreground">
                Registro de Atividades
              </h2>
            </div>
            <ActivityLogView />
          </div>
        )}

        {/* ID: Preferências */}
        {activeTab === "settings-preferences" && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setActiveTab("settings")}
                className="p-2 px-4 border border-border bg-card text-foreground rounded-xl hover:bg-muted transition text-xs font-bold shadow-sm"
              >
                ← Voltar para Configurações
              </button>
              <h2 className="text-xl font-bold text-foreground">
                Preferências
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Profile Settings */}
              <div className="bg-card border border-border p-6 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <div className="p-3 bg-primary/10 text-primary rounded-xl">
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Perfil
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Informações de exibição
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-muted-foreground">
                        Nome de Exibição
                      </label>
                      {!isEditingName && (
                        <button
                          onClick={() => {
                            setDisplayName(currentUser?.name || "");
                            setIsEditingName(true);
                          }}
                          className="text-xs text-primary font-bold hover:underline"
                        >
                          Editar
                        </button>
                      )}
                    </div>
                    {!isEditingName ? (
                      <input
                        type="text"
                        className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-sm opacity-70 cursor-not-allowed"
                        value={currentUser?.name || ""}
                        disabled
                      />
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="flex-1 px-3 py-2 border border-border bg-background text-foreground rounded-xl text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-hidden"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          autoFocus
                        />
                        <button
                          onClick={async () => {
                            if (displayName.trim()) {
                              await updateUserName(displayName.trim());
                              setIsEditingName(false);
                            }
                          }}
                          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition shadow-xs"
                        >
                          Salvar
                        </button>
                        <button
                          onClick={() => setIsEditingName(false)}
                          className="px-4 py-2 border border-border bg-background text-foreground text-sm font-bold rounded-xl hover:bg-muted transition"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Este nome será exibido nos relatórios e interface do
                      sistema.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-sm opacity-70 cursor-not-allowed"
                      value={authUser.email || ""}
                      disabled
                    />
                  </div>
                </div>
              </div>

              {/* Security Setup */}
              <div className="bg-card border border-border p-6 rounded-2xl shadow-xs space-y-4">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <div className="p-3 bg-primary/10 text-primary rounded-xl">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Segurança
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Gestão de acesso
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Como você está conectado via <strong>Google Sign-In</strong>
                    , a gestão de senhas e a recuperação de acesso devem ser
                    feitas diretamente nas configurações de Segurança da sua
                    Conta Google.
                  </p>
                  <a
                    href="https://myaccount.google.com/security"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center w-full px-4 py-2 mt-2 border border-border bg-muted text-foreground hover:bg-neutral-200 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition duration-200"
                  >
                    Gerenciar Conta do Google
                  </a>
                </div>
              </div>

              {/* Preferences */}
              <div className="bg-card border border-border p-6 rounded-2xl shadow-xs space-y-4 md:col-span-2">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <div className="p-3 bg-primary/10 text-primary rounded-xl">
                    <SlidersHorizontal size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Preferências
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Personalize a exibição e navegação do sistema
                    </p>
                  </div>
                </div>

                <div className="space-y-6 pt-2">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-foreground">
                        Modo Escuro
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Alternar visualização clara/escura do aplicativo
                      </p>
                    </div>
                    <button
                      onClick={() => setDarkMode(!darkMode)}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:opacity-90 transition shadow-md shrink-0"
                    >
                      {darkMode
                        ? "Desativar Modo Escuro"
                        : "Ativar Modo Escuro"}
                    </button>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-foreground">
                        Ordenação dos seus Lançamentos
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ordem (baseada na data) que suas transações serão
                        listadas na tela de Lançamentos
                      </p>
                    </div>
                    <div className="flex gap-4 shrink-0">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="txOrder"
                          value="asc"
                          checked={transactionOrder === "asc"}
                          onChange={() => setTransactionOrder("asc")}
                          className="accent-primary"
                        />
                        <span className="text-sm text-foreground">
                          Crescente
                        </span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="txOrder"
                          value="desc"
                          checked={transactionOrder === "desc"}
                          onChange={() => setTransactionOrder("desc")}
                          className="accent-primary"
                        />
                        <span className="text-sm text-foreground">
                          Decrescente
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-foreground">
                        Período de navegação padrão
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Para quem faz muitos lançamentos durante o mês, o ideal
                        é escolher semanal ou diário
                      </p>
                    </div>
                    <div className="flex flex-col md:flex-row gap-2 md:gap-4 shrink-0">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="navPeriod"
                          value="daily"
                          checked={defaultPeriod === "daily"}
                          onChange={() => setDefaultPeriod("daily")}
                          className="accent-primary"
                        />
                        <span className="text-sm text-foreground">Diário</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="navPeriod"
                          value="weekly"
                          checked={defaultPeriod === "weekly"}
                          onChange={() => setDefaultPeriod("weekly")}
                          className="accent-primary"
                        />
                        <span className="text-sm text-foreground">Semanal</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="navPeriod"
                          value="monthly"
                          checked={defaultPeriod === "monthly"}
                          onChange={() => setDefaultPeriod("monthly")}
                          className="accent-primary"
                        />
                        <span className="text-sm text-foreground">Mensal</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="text-sm font-semibold text-foreground">
                        Saldo diário
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        Exibir o saldo do dia na tela de Lançamentos
                      </p>
                    </div>
                    <div className="flex gap-4 shrink-0">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="dailyBalance"
                          checked={showDailyBalance === true}
                          onChange={() => setShowDailyBalance(true)}
                          className="accent-primary"
                        />
                        <span className="text-sm text-foreground">Sim</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="dailyBalance"
                          checked={showDailyBalance === false}
                          onChange={() => setShowDailyBalance(false)}
                          className="accent-primary"
                        />
                        <span className="text-sm text-foreground">Não</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Backup Data */}
              <div className="bg-card border border-border p-6 rounded-2xl shadow-xs space-y-4 md:col-span-2">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <div className="p-3 bg-primary/10 text-primary rounded-xl">
                    <Download size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Backup e Exportação
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Exporte seus dados cadastrados para backup
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Exportação de Configurações e Dados
                    </h4>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Você pode baixar um arquivo contendo todas as suas contas,
                      faturas, categorias bancárias, metas e lançamentos
                      consolidados em um formato portador (JSON).
                    </p>
                  </div>
                  <button
                    onClick={handleExportData}
                    className="px-4 py-2 flex items-center gap-2 border border-border bg-background text-foreground rounded-xl text-xs font-bold hover:bg-muted transition shadow-sm"
                  >
                    <Download size={16} />
                    Fazer Backup Completo
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-slate-100 dark:bg-slate-900 border-t border-border py-6 mt-12 text-center text-slate-500 dark:text-slate-400 text-xs tracking-tight transition-colors">
        <p className="font-semibold text-slate-800 dark:text-slate-200">
          &copy; {new Date().getFullYear()} Fidúcia Financial Assistent.
        </p>
        <p className="mt-1 text-slate-400">
          Todos os dados salvos com precisão e segurança no Google Cloud
          Firestore corporativo.
        </p>
      </footer>

      {/* Form Modals */}
      <AccountForm
        isOpen={showAccountModal}
        onClose={handleCloseAccountModal}
        accountToEdit={editingAccount}
        onSave={handleSaveAccount}
      />

      {/* 1. Transaction Form Modal */}
      {showTxModal && (
        <TransactionForm
          accounts={accounts}
          categories={categories}
          creditCards={creditCards}
          closedPeriods={closedPeriods}
          tags={tags}
          editingTransaction={editingTransaction}
          initialPrefill={txInitialPrefill}
          onClose={() => {
            setShowTxModal(false);
            setEditingTransaction(null);
            setTxInitialPrefill(undefined);
          }}
          onRefresh={loadData}
        />
      )}

      {/* 2. Account Creation Modal - Removed since we use AccountForm component */}

      {/* 3. Credit Card Creation Modal */}
      <CreditCardForm
        isOpen={showCardModal}
        onClose={handleCloseCardModal}
        cardToEdit={editingCard}
        userId={authUser.uid}
        onSave={async (cardData) => {
          if (editingCard && editingCard.id) {
            await updateCreditCard(editingCard.id, cardData);
          } else {
            await createCreditCard({
              userId: authUser.uid,
              name: cardData.name!,
              limit: cardData.limit!,
              closingDay: cardData.closingDay!,
              dueDay: cardData.dueDay!,
            });
          }
          handleCloseCardModal();
          loadData();
        }}
      />

      {/* 4. Goal Creation Modal */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">
                Registrar Meta de Economia
              </h3>
              <button
                onClick={() => setShowGoalModal(false)}
                className="p-1 hover:bg-muted rounded-md text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  O que você deseja comprar / atingir?
                </label>
                <input
                  type="text"
                  placeholder="Ex: Viagem de Férias, Carro Novo"
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Valor Almejado (R$)
                  </label>
                  <input
                    type="number"
                    value={newGoalTarget}
                    onChange={(e) => setNewGoalTarget(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Prazo Final
                  </label>
                  <input
                    type="date"
                    value={newGoalDeadline}
                    onChange={(e) => setNewGoalDeadline(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-md"
              >
                Criar Meta
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. Budget Creation Modal */}
      {showBudgetModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">
                Definir Teto de Gastos
              </h3>
              <button
                onClick={() => setShowBudgetModal(false)}
                className="p-1 hover:bg-muted rounded-md text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Categoria Alvo
                </label>
                <select
                  value={selectedBgtCategory}
                  onChange={(e) => setSelectedBgtCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-sm"
                >
                  {categories
                    .filter((c) => c.type === "expense")
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  Valor Máximo Mensal (R$)
                </label>
                <input
                  type="number"
                  placeholder="Ex: 500"
                  value={newBgtAmount}
                  onChange={(e) => setNewBgtAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-xl text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold shadow-md"
              >
                Salvar Limite
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 6. Safe Balance Detail Modal */}
      {showSafeBalanceModal && (
        <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl p-6 my-8 space-y-6 relative max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3 shrink-0 text-left">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-500/10 text-purple-600 rounded-xl">
                  <PiggyBank size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Detalhamento do Disponível Seguro
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Entenda a provisão do seu caixa para o mês atual
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSafeBalanceModal(false)}
                className="p-1 hover:bg-muted rounded-md text-muted-foreground cursor-pointer transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="overflow-y-auto pr-1 flex-1 space-y-6 text-left">
              {/* Formula Steps Card */}
              <div className="bg-stone-50 dark:bg-stone-900/50 border border-stone-200/60 dark:border-stone-800/60 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Cálculo do Saldo
                </h4>

                <div className="space-y-2 text-sm">
                  {/* Step 1: Liquidity */}
                  <div className="flex justify-between items-center text-foreground font-medium">
                    <span
                      className="flex items-center gap-1.5 text-xs text-muted-foreground"
                      title={`Saldo Geral: R$ ${totalBalance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      (+) Saldo Disponível (Exclui investimentos/reservas):
                    </span>
                    <span className="font-mono">
                      R${" "}
                      {totalLiquidBalance.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  {/* Step 2: Credit Card Spends */}
                  <div className="flex justify-between items-center text-foreground font-medium">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                      (&minus;) Gastos Acumulados no Cartão:
                    </span>
                    <span className="font-mono text-rose-600 dark:text-rose-400">
                      R$ &minus;
                      {creditSpends.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  {/* Step 3: Pending scheduled bills */}
                  <div className="flex justify-between items-center text-foreground font-medium">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                      (&minus;) Despesas Fixas e Contas Pendentes:
                    </span>
                    <span className="font-mono text-rose-600 dark:text-rose-400">
                      R$ &minus;
                      {currentMonthPendingExpenses.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <div className="h-[1px] bg-stone-200 dark:bg-stone-800 my-2" />

                  {/* Operational Net Safe Balance */}
                  <div className="flex justify-between items-center font-bold text-base">
                    <span className="text-xs uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1">
                      (=) Disponível Seguro Real:
                    </span>
                    <span
                      className={`font-mono ${safeBalanceValue >= 0 ? "text-purple-600 dark:text-purple-400" : "text-rose-500"}`}
                    >
                      R${" "}
                      {safeBalanceValue.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Suggestion Alert */}
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  safeBalanceValue > 0
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-400"
                }`}
              >
                <div className="mt-0.5">
                  <Sparkles size={16} />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider">
                    {safeBalanceValue > 0
                      ? "Zona de Segurança"
                      : "Atenção: Saldo Frágil"}
                  </p>
                  <p className="text-xs leading-relaxed opacity-90">
                    {safeBalanceValue > 0
                      ? "Seu saldo livre está no verde! Você pode assumir novos compromissos à vista ou parcelados de até R$ " +
                        safeBalanceValue.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        }) +
                        " sem afetar o quitamento das contas deste mês."
                      : "Atenção! Suas despesas do mês superam seu caixa disponível somado à fatura. Evite contrair novos gastos até liquidar os compromissos pendentes nesta competência."}
                  </p>
                </div>
              </div>

              {/* Breakdown lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Cards List Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <CardIcon size={14} className="text-muted-foreground" />
                    Cartões em Aberto (
                    {creditSpends > 0
                      ? "R$ " +
                        creditSpends.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })
                      : "Nenhum"}
                    )
                  </h4>

                  {creditCards
                    .map((card) => {
                      const totalCardSpends = transactions
                        .filter(
                          (tx) =>
                            tx.creditCardId === card.id &&
                            tx.status !== "cancelled",
                        )
                        .reduce((sum, tx) => sum + tx.amount, 0);
                      return { name: card.name, amount: totalCardSpends, card };
                    })
                    .filter((c) => c.amount > 0).length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/80 italic p-3 border border-dashed border-border rounded-lg bg-muted/20">
                      Nenhum gasto acumulado em cartões.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {creditCards
                        .map((card) => {
                          const totalCardSpends = transactions
                            .filter(
                              (tx) =>
                                tx.creditCardId === card.id &&
                                tx.status !== "cancelled",
                            )
                            .reduce((sum, tx) => sum + tx.amount, 0);
                          return {
                            name: card.name,
                            amount: totalCardSpends,
                            card,
                          };
                        })
                        .filter((c) => c.amount > 0)
                        .map(({ name, amount, card }) => {
                          return (
                            <div
                              key={card.id}
                              className="flex justify-between items-center p-2.5 rounded-lg border border-border bg-card"
                            >
                              <span
                                className="text-xs font-semibold text-foreground truncate max-w-[140px]"
                                title={name}
                              >
                                {name}
                              </span>
                              <span className="text-xs font-bold font-mono text-foreground">
                                R${" "}
                                {amount.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Bills List Breakdown */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar size={14} className="text-muted-foreground" />
                    Contas Pendentes (
                    {currentMonthPendingExpenses > 0
                      ? "R$ " +
                        currentMonthPendingExpenses.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })
                      : "Nenhuma"}
                    )
                  </h4>

                  {transactions.filter((tx) => {
                    const isExpense =
                      tx.type === "expense" || tx.type === "despesa";
                    const isPending =
                      tx.status === "pending" || tx.status === "pendente";
                    const isNotCreditCard = !tx.creditCardId;
                    const txMonth = tx.date.substring(0, 7);
                    return (
                      isExpense &&
                      isPending &&
                      isNotCreditCard &&
                      txMonth <= currentMonthStr
                    );
                  }).length === 0 ? (
                    <p className="text-[11px] text-muted-foreground/80 italic p-3 border border-dashed border-border rounded-lg bg-muted/20">
                      Nenhuma conta fixa ou despesa programada pendente neste
                      mês.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {transactions
                        .filter((tx) => {
                          const isExpense =
                            tx.type === "expense" || tx.type === "despesa";
                          const isPending =
                            tx.status === "pending" || tx.status === "pendente";
                          const isNotCreditCard = !tx.creditCardId;
                          const txMonth = tx.date.substring(0, 7);
                          return (
                            isExpense &&
                            isPending &&
                            isNotCreditCard &&
                            txMonth <= currentMonthStr
                          );
                        })
                        .map((tx) => {
                          return (
                            <div
                              key={tx.id}
                              className="flex justify-between items-center p-2.5 rounded-lg border border-border bg-card"
                            >
                              <div className="flex flex-col truncate pr-2">
                                <span
                                  className="text-xs font-semibold text-foreground truncate max-w-[130px]"
                                  title={tx.description}
                                >
                                  {tx.description}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  Vencimento:{" "}
                                  {new Date(tx.date).toLocaleDateString(
                                    "pt-BR",
                                  )}
                                </span>
                              </div>
                              <span className="text-xs font-bold font-mono text-rose-500">
                                R${" "}
                                {tx.amount.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              </div>

              {/* Informative footer tip */}
              <div className="p-3 bg-muted/30 border border-border/50 rounded-xl text-[11px] text-muted-foreground/90 space-y-1">
                <p className="font-bold flex items-center gap-1 text-foreground">
                  <Info size={12} className="text-purple-500 shrink-0" />
                  Diferença entre o Patrimônio e o Disponível Seguro:
                </p>
                <p className="leading-relaxed">
                  Seu <strong>Patrimônio (Saldo Geral)</strong> atual é de R${" "}
                  {totalBalance.toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}
                  . O <strong>Disponível Seguro</strong> trabalha de forma
                  diferente: ele remove valores que você marcou como "Isolados"
                  (investimentos ou reservas) e subtrai do seu caixa o que você
                  já gastou nos cartões e as contas fixas pendentes neste mês,
                  garantindo que você nunca gaste dinheiro já comprometido.
                </p>
              </div>
            </div>

            {/* Modal Bottom Close Bar */}
            <div className="border-t border-border pt-3 flex justify-end shrink-0">
              <button
                onClick={() => setShowSafeBalanceModal(false)}
                className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 text-white dark:text-neutral-950 font-bold rounded-xl text-xs shadow transition duration-200 cursor-pointer"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PWA Instruction Modal */}
      {showPWAInstructionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowPWAInstructionModal(false)}
              className="absolute top-4 right-4 p-1 rounded-xl text-muted-foreground hover:bg-muted"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 border-b border-border pb-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  Como instalar o aplicativo (PWA)
                </h3>
                <p className="text-[10px] text-muted-foreground">
                  Instale o Fidúcia para carregar mais rápido e rodar off-line
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* iPhone (iOS) guidance */}
              <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-950/20">
                <span className="text-[10px] uppercase font-bold text-[#8b5cf6] tracking-widest block mb-2">
                  Para iPhone ou iPad (iOS)
                </span>
                <ol className="list-decimal pl-4 text-xs text-muted-foreground space-y-2 leading-relaxed">
                  <li>
                    Abra o navegador{" "}
                    <strong className="text-foreground font-semibold">
                      Safari
                    </strong>
                    .
                  </li>
                  <li>Insira o link deste aplicativo e carregue-o.</li>
                  <li>
                    Toque no botão{" "}
                    <strong className="text-foreground font-semibold">
                      Compartilhar
                    </strong>{" "}
                    (ícone de quadrado com uma seta para cima na barra
                    inferior).
                  </li>
                  <li>
                    Role a lista de opções para baixo e selecione{" "}
                    <strong className="text-foreground font-semibold">
                      Adicionar à Tela de Início
                    </strong>
                    .
                  </li>
                  <li>
                    Clique em{" "}
                    <strong className="text-foreground font-semibold">
                      Adicionar
                    </strong>{" "}
                    no canto superior direito para confirmar.
                  </li>
                </ol>
              </div>

              {/* Android/Chrome guidance */}
              <div className="p-4 rounded-xl border border-border bg-slate-50/50 dark:bg-slate-950/20">
                <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-widest block mb-2">
                  Para Android, Chrome ou Edge (Desktop/Celular)
                </span>
                <ol className="list-decimal pl-4 text-xs text-muted-foreground space-y-2 leading-relaxed">
                  <li>
                    Basta clicar no botão{" "}
                    <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Instalar App
                    </strong>{" "}
                    no topo de nosso painel.
                  </li>
                  <li>
                    Ou procure pelo ícone de monitor/celular na barra de
                    endereços (URL) do seu navegador e clique nele.
                  </li>
                  <li>
                    Selecione "Instalar" para adicionar instantaneamente o
                    aplicativo à sua lista de apps nativos.
                  </li>
                </ol>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowPWAInstructionModal(false)}
                className="px-4 py-2.5 bg-neutral-900 border border-slate-200 dark:border-slate-800 hover:bg-neutral-800 dark:bg-slate-800 dark:hover:bg-slate-700/80 text-white dark:text-slate-100 font-bold rounded-xl text-xs shadow transition duration-200 cursor-pointer"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Confirm Dialog */}
      <ConfirmDialog
        {...globalConfirm}
        onCancel={() =>
          setGlobalConfirm((prev) => ({ ...prev, isOpen: false }))
        }
      />

      {/* Statement Modal removed - replaced by StatementPage in tabs */}
    </div>
  );
}
