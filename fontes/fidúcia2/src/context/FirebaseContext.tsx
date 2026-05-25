import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User as AuthUser, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  writeBatch,
  getDocFromServer,
  deleteField
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { User, Account, Category, Transaction, CreditCard, Budget, Goal, Invoice, ClosedPeriod, Tag, ActivityLog } from '../types';

// Helper to recursively remove undefined fields so Firestore doesn't throw errors
function cleanUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefinedFields(item)) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        if (value !== undefined) {
          cleaned[key] = cleanUndefinedFields(value);
        }
      }
    }
    return cleaned;
  }
  return obj;
}

interface FirebaseContextType {
  authUser: AuthUser | null;
  currentUser: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
  updateUserName: (newName: string) => Promise<void>;
  
  getActivityLogs: () => Promise<ActivityLog[]>;
  
  // Custom API CRUD helpers wrapping with handleFirestoreError
  getAccounts: () => Promise<Account[]>;
  createAccount: (account: Omit<Account, 'id' | 'createdAt'>) => Promise<string>;
  updateAccount: (id: string, account: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;

  getCreditCards: () => Promise<CreditCard[]>;
  createCreditCard: (card: Omit<CreditCard, 'id' | 'createdAt'>) => Promise<string>;
  updateCreditCard: (id: string, card: Partial<CreditCard>) => Promise<void>;
  deleteCreditCard: (id: string) => Promise<void>;

  getCategories: () => Promise<Category[]>;
  createCategory: (category: Omit<Category, 'id' | 'createdAt'>) => Promise<string>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  resetCategoriesToDefault: () => Promise<number>;
  
  getTags: () => Promise<Tag[]>;
  createTag: (tag: Omit<Tag, 'id' | 'createdAt'>) => Promise<string>;
  updateTag: (id: string, tag: Partial<Tag>) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
  
  getTransactions: () => Promise<Transaction[]>;
  createTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<string>;
  createBulkTransactions: (txs: Omit<Transaction, 'id' | 'createdAt'>[]) => Promise<void>;
  updateTransaction: (id: string, tx: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;

  getBudgets: () => Promise<Budget[]>;
  saveBudget: (budget: Omit<Budget, 'id' | 'createdAt'>) => Promise<string>;
  updateBudget: (id: string, amount: number) => Promise<void>;

  getGoals: () => Promise<Goal[]>;
  createGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => Promise<string>;
  updateGoal: (id: string, goal: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  getInvoices: (cardId: string) => Promise<Invoice[]>;
  getInvoiceByPeriod: (cardId: string, period: string) => Promise<Invoice | null>;
  createInvoice: (invoice: Omit<Invoice, 'id'>) => Promise<string>;
  updateInvoice: (id: string, invoice: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;

  getClosedPeriods: () => Promise<ClosedPeriod[]>;
  createClosedPeriod: (period: Omit<ClosedPeriod, 'id'>) => Promise<string>;
  deleteClosedPeriod: (id: string) => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Connection validation at startup (Constraint from SKILL.md)
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration: Client is offline.");
        }
      }
    }
    testConnection();
  }, []);

  // Listen to auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setAuthUser(user);
      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userDocRef);
          
          if (!userSnap.exists()) {
            // New user registration
            const newUser: User = {
              email: user.email || '',
              name: user.displayName || 'Usuário',
              createdAt: new Date().toISOString()
            };
            await setDoc(userDocRef, newUser);
            setCurrentUser(newUser);

            // Bootstrap default structures for an interactive professional layout
            await bootstrapUserData(user.uid);
          } else {
            setCurrentUser(userSnap.data() as User);
          }
        } catch (error) {
          console.error('Error fetching user metadata: ', error);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Bootstrap dummy standard data for new users so the interface looks beautiful and functional
  const bootstrapUserData = async (userId: string) => {
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      // 1. Core Categories
      const defaultTree = [
        {
          name: 'Aluguel e moradia', type: 'expense' as const, icon: 'Home',
          subs: [
            { name: 'Aluguel', icon: 'Home' },
            { name: 'Condomínio', icon: 'Home' },
            { name: 'IPTU + TRSD', icon: 'FileText' },
            { name: 'Energia elétrica', icon: 'Zap' },
            { name: 'Água e esgoto', icon: 'Droplets' },
          ]
        },
        {
          name: 'Casa', type: 'expense' as const, icon: 'Home',
          subs: [
            { name: 'Empregados domésticos', icon: 'Users' },
            { name: 'Lavanderia e passadeira', icon: 'Shirt' },
            { name: 'Mobiliário', icon: 'Sofa' },
            { name: 'Reparos e conservação', icon: 'Wrench' }
          ]
        },
        {
          name: 'Mercado', type: 'expense' as const, icon: 'ShoppingCart',
          subs: [
            { name: 'Supermercado', icon: 'ShoppingCart' },
            { name: 'Feira livre', icon: 'Apple' }
          ]
        },
        {
          name: 'Alimentação fora', type: 'expense' as const, icon: 'Utensils',
          subs: [
            { name: 'Restaurantes e bares', icon: 'Utensils' },
            { name: 'Delivery', icon: 'Truck' },
            { name: 'Café e padaria', icon: 'Coffee' },
            { name: 'Lanches', icon: 'Pizza' }
          ]
        },
        {
          name: 'Transporte — veículo', type: 'expense' as const, icon: 'Car',
          subs: [
            { name: 'Combustível', icon: 'Fuel' },
            { name: 'Financiamento veículo', icon: 'Car' },
            { name: 'Seguro veicular', icon: 'Shield' },
            { name: 'Tributos (IPVA, licenciamento)', icon: 'FileText' },
            { name: 'Manutenção e peças', icon: 'Wrench' },
            { name: 'Lava-jato', icon: 'Droplets' },
            { name: 'Estacionamento', icon: 'ParkingCircle' },
            { name: 'Multas', icon: 'AlertTriangle' }
          ]
        },
        {
          name: 'Transporte urbano', type: 'expense' as const, icon: 'Bus',
          subs: [
            { name: 'Táxi / Uber', icon: 'Car' },
            { name: 'Metrô / Ônibus', icon: 'Bus' }
          ]
        },
        {
          name: 'Saúde', type: 'expense' as const, icon: 'HeartPulse',
          subs: [
            { name: 'Plano de saúde', icon: 'HeartPulse' },
            { name: 'Médicos e terapeutas', icon: 'Stethoscope' },
            { name: 'Dentista', icon: 'Smile' },
            { name: 'Farmácia', icon: 'Pill' },
            { name: 'Exames e procedimentos', icon: 'Activity' }
          ]
        },
        {
          name: 'Cuidados pessoais', type: 'expense' as const, icon: 'Users',
          subs: [
            { name: 'Barbearia / Cabelereiro', icon: 'Scissors' },
            { name: 'Manicure e pedicure', icon: 'Hand' },
            { name: 'Depilação', icon: 'Sparkles' },
            { name: 'Cosméticos e higiene', icon: 'Bath' },
            { name: 'Estética e afins', icon: 'Star' }
          ]
        },
        {
          name: 'Fitness e esporte', type: 'expense' as const, icon: 'Activity',
          subs: [
            { name: 'Academia', icon: 'Dumbbell' },
            { name: 'Esportes e atividades', icon: 'Activity' },
            { name: 'Equipamentos esportivos', icon: 'BaggageClaim' }
          ]
        },
        {
          name: 'Educação', type: 'expense' as const, icon: 'GraduationCap',
          subs: [
            { name: 'Escola (mensalidade)', icon: 'GraduationCap' },
            { name: 'Faculdade / Pós-graduação', icon: 'BookOpen' },
            { name: 'Financiamento estudantil', icon: 'Landmark' },
            { name: 'Cursos e treinamentos', icon: 'Video' },
            { name: 'Inscrição em concursos', icon: 'FileText' },
            { name: 'Livros didáticos', icon: 'Book' },
            { name: 'Material e uniforme escolar', icon: 'Backpack' }
          ]
        },
        {
          name: 'Lazer e cultura', type: 'expense' as const, icon: 'Ticket',
          subs: [
            { name: 'Cinema e teatro', icon: 'Ticket' },
            { name: 'Shows e eventos', icon: 'Music' },
            { name: 'Jogos', icon: 'Gamepad2' },
            { name: 'Literatura', icon: 'Book' },
            { name: 'Hobbies em geral', icon: 'Palette' }
          ]
        },
        {
          name: 'Viagens', type: 'expense' as const, icon: 'Plane',
          subs: [
            { name: 'Passagens', icon: 'Plane' },
            { name: 'Hospedagem', icon: 'Hotel' },
            { name: 'Alimentação na viagem', icon: 'Utensils' },
            { name: 'Passeios e tours', icon: 'Map' },
            { name: 'Seguro viagem', icon: 'Shield' }
          ]
        },
        {
          name: 'Vestuário', type: 'expense' as const, icon: 'Shirt',
          subs: [
            { name: 'Roupas e calçados', icon: 'Shirt' },
            { name: 'Acessórios', icon: 'Watch' }
          ]
        },
        {
          name: 'Eletrônicos e eletrodomésticos', type: 'expense' as const, icon: 'Laptop',
          subs: [
            { name: 'Eletrônicos', icon: 'Laptop' },
            { name: 'Eletrodomésticos', icon: 'Refrigerator' },
            { name: 'Utensílios domésticos', icon: 'Coffee' },
            { name: 'Cama, mesa e banho', icon: 'Bed' }
          ]
        },
        {
          name: 'Família e filhos', type: 'expense' as const, icon: 'Baby',
          subs: [
            { name: 'Brinquedos e presentes', icon: 'Gift' },
            { name: 'Atividades infantis', icon: 'Activity' },
            { name: 'Vestuário infantil', icon: 'Shirt' }
          ]
        },
        {
          name: 'Presentes', type: 'expense' as const, icon: 'Gift',
          subs: [
            { name: 'Presentes', icon: 'Gift' }
          ]
        },
        {
          name: 'Doações', type: 'expense' as const, icon: 'Heart',
          subs: [
            { name: 'Dízimos', icon: 'Heart' },
            { name: 'Ofertas e missões', icon: 'Globe' }
          ]
        },
        {
          name: 'Assinaturas e serviços digitais', type: 'expense' as const, icon: 'Tv',
          subs: [
            { name: 'Streaming', icon: 'Tv' },
            { name: 'Programa de pontos', icon: 'CreditCard' }
          ]
        },
        {
          name: 'Telecomunicações', type: 'expense' as const, icon: 'Smartphone',
          subs: [
            { name: 'Internet', icon: 'Wifi' },
            { name: 'Telefonia', icon: 'Smartphone' }
          ]
        },
        {
          name: 'Serviços bancários', type: 'expense' as const, icon: 'Landmark',
          subs: [
            { name: 'Anuidade cartão de crédito', icon: 'CreditCard' },
            { name: 'Tarifa pacote de serviços', icon: 'Landmark' },
            { name: 'Juros cartão de crédito', icon: 'Percent' },
            { name: 'IOF', icon: 'Banknote' }
          ]
        },
        {
          name: 'Impostos', type: 'expense' as const, icon: 'FileText',
          subs: [
            { name: 'IRRF', icon: 'FileText' },
            { name: 'Outras taxas e tributos', icon: 'FileText' }
          ]
        },
        {
          name: 'Trabalho e profissão', type: 'expense' as const, icon: 'Briefcase',
          subs: [
            { name: 'Entidade de classe', icon: 'Building' },
            { name: 'Despesas IBO', icon: 'Briefcase' },
            { name: 'Material de escritório', icon: 'Paperclip' },
            { name: 'Prestadores de serviço', icon: 'Users' }
          ]
        },
        {
          name: 'Dívidas e empréstimos', type: 'expense' as const, icon: 'DollarSign',
          subs: [
            { name: 'Empréstimos pessoais', icon: 'DollarSign' },
            { name: 'Financiamentos', icon: 'Landmark' },
            { name: 'Parcelamentos', icon: 'CreditCard' }
          ]
        },
        {
          name: 'Investimentos — custos', type: 'expense' as const, icon: 'TrendingDown',
          subs: [
            { name: 'Custódia', icon: 'Lock' },
            { name: 'Custos operacionais', icon: 'Activity' },
            { name: 'IOF sobre investimentos', icon: 'Percent' },
            { name: 'Perdas', icon: 'TrendingDown' },
            { name: 'Cota SICOOB', icon: 'Building' }
          ]
        },
        
        // 💰 RECEITAS
        {
          name: 'Salário e remuneração', type: 'income' as const, icon: 'Briefcase',
          subs: [
            { name: 'Salário / Pró-labore', icon: 'Briefcase' },
            { name: '13º salário', icon: 'Banknote' },
            { name: 'Férias', icon: 'Sun' },
            { name: 'Bônus e comissões', type: 'Award' }
          ]
        },
        {
          name: 'Renda extra', type: 'income' as const, icon: 'Plus',
          subs: [
            { name: 'Freelas e consultorias', icon: 'Laptop' },
            { name: 'Venda de bens', icon: 'ShoppingBag' },
            { name: 'Prestação de serviços', icon: 'Wrench' }
          ]
        },
        {
          name: 'Rendas passivas', type: 'income' as const, icon: 'TrendingUp',
          subs: [
            { name: 'Aluguel recebido', icon: 'Home' },
            { name: 'Dividendos', icon: 'TrendingUp' },
            { name: 'Juros recebidos', icon: 'Percent' }
          ]
        },
        {
          name: 'Investimentos — rendimentos', type: 'income' as const, icon: 'TrendingUp',
          subs: [
            { name: 'Rendimentos renda fixa', icon: 'TrendingUp' },
            { name: 'Rendimentos renda variável', icon: 'TrendingUp' },
            { name: 'Resgates', icon: 'Download' }
          ]
        },
        {
          name: 'Reembolsos e restituições', type: 'income' as const, icon: 'Undo',
          subs: [
            { name: 'Reembolso de despesas', icon: 'Undo' },
            { name: 'Cashback cartão', icon: 'CreditCard' },
            { name: 'Restituição IR', icon: 'FileText' },
            { name: 'Transferências recebidas', icon: 'ArrowRightLeft' }
          ]
        }
      ];

      const categoryRefs: { [name: string]: string } = {};

      for (const group of defaultTree) {
        const catRef = doc(collection(db, 'categories'));
        batch.set(catRef, { userId, name: group.name, type: group.type, icon: group.icon, isDefault: true, createdAt: now });
        categoryRefs[group.name] = catRef.id;

        for (const sub of group.subs) {
          const subRef = doc(collection(db, 'categories'));
          batch.set(subRef, { userId, name: sub.name, type: group.type, icon: sub.icon, isDefault: true, parentId: catRef.id, createdAt: now });
          categoryRefs[sub.name] = subRef.id;
        }
      }

      // 2. Default Checking Account
      const initialAccountRef = doc(collection(db, 'accounts'));
      const initialAccount: Account = {
        userId,
        name: 'Carteira Principal',
        type: 'checking',
        balance: 1500.00,
        createdAt: now
      };
      batch.set(initialAccountRef, initialAccount);

      // 3. Default Savings Account
      const savingsAccountRef = doc(collection(db, 'accounts'));
      const savingsAccount: Account = {
        userId,
        name: 'Reserva de Emergência',
        type: 'savings',
        balance: 5000.00,
        createdAt: now
      };
      batch.set(savingsAccountRef, savingsAccount);

      // 4. Default Credit Card
      const cardRef = doc(collection(db, 'creditCards'));
      const defaultCard: CreditCard = {
        userId,
        name: 'Nuvens Card Black',
        limit: 8000.00,
        closingDay: 5,
        dueDay: 12,
        createdAt: now
      };
      batch.set(cardRef, defaultCard);

      // Commit the batch bootstrap
      await batch.commit();

      // Add 2 initial transactions
      const txCollection = collection(db, 'transactions');
      
      // Income Transaction
      await addDoc(txCollection, {
        userId,
        type: 'income',
        amount: 3500.00,
        date: new Date().toISOString(),
        description: 'Salário Bootstrap Ensino',
        categoryId: categoryRefs['Salário'],
        accountId: initialAccountRef.id,
        status: 'paid',
        createdAt: now
      });

      // Expense Transaction
      await addDoc(txCollection, {
        userId,
        type: 'expense',
        amount: 154.90,
        date: new Date().toISOString(),
        description: 'Supermercado Semanal',
        categoryId: categoryRefs['Alimentação'],
        accountId: initialAccountRef.id,
        status: 'paid',
        createdAt: now
      });

      // Goals Bootstrap
      await addDoc(collection(db, 'goals'), {
        userId,
        name: 'Comprar Notebook Novo',
        targetAmount: 6000.00,
        currentAmount: 1800.00,
        deadline: new Date(new Date().getFullYear(), new Date().getMonth() + 6, 15).toISOString().split('T')[0],
        createdAt: now
      });

    } catch (err) {
      console.error('Error bootstrapping default structure: ', err);
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error('Error signing in with Google: ', err);
      throw err;
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Error signing out: ', err);
    }
  };

  const updateUserName = async (newName: string) => {
    if (!auth.currentUser || !currentUser) return;
    const path = `users/${auth.currentUser.uid}`;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { name: newName });
      setCurrentUser({ ...currentUser, name: newName });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
      throw err;
    }
  };

  const logActivity = async (
    action: 'create' | 'update' | 'delete', 
    entityType: ActivityLog['entityType'], 
    entityId: string, 
    description: string, 
    dataBefore?: any, 
    dataAfter?: any
  ): Promise<void> => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'activityLogs'), {
        userId: auth.currentUser.uid,
        action,
        entityType,
        entityId,
        description,
        dataBefore: dataBefore || null,
        dataAfter: dataAfter || null,
        createdAt: new Date().toISOString()
      });
    } catch (err) {
      console.warn('Failed to log activity:', err);
    }
  };

  const getActivityLogs = async (): Promise<ActivityLog[]> => {
    if (!auth.currentUser) return [];
    const path = 'activityLogs';
    try {
      const q = query(collection(db, path), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      const logs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ActivityLog[];
      // Filter 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      return logs.filter(log => new Date(log.createdAt) >= ninetyDaysAgo).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  };

  // ----- Accounts CRUD -----
  const getAccounts = async (): Promise<Account[]> => {
    if (!auth.currentUser) return [];
    const path = 'accounts';
    try {
      const q = query(collection(db, path), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  };

  const createAccount = async (account: Omit<Account, 'id' | 'createdAt'>): Promise<string> => {
    const path = 'accounts';
    try {
      const docRef = await addDoc(collection(db, path), cleanUndefinedFields({
        ...account,
        createdAt: new Date().toISOString()
      }));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      return '';
    }
  };

  const updateAccount = async (id: string, account: Partial<Account>): Promise<void> => {
    const path = `accounts/${id}`;
    try {
      await updateDoc(doc(db, 'accounts', id), cleanUndefinedFields(account));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteAccount = async (id: string): Promise<void> => {
    const path = `accounts/${id}`;
    try {
      await deleteDoc(doc(db, 'accounts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // ----- Credit Cards CRUD -----
  const getCreditCards = async (): Promise<CreditCard[]> => {
    if (!auth.currentUser) return [];
    const path = 'creditCards';
    try {
      const q = query(collection(db, path), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreditCard));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  };

  const createCreditCard = async (card: Omit<CreditCard, 'id' | 'createdAt'>): Promise<string> => {
    const path = 'creditCards';
    try {
      const docRef = await addDoc(collection(db, path), cleanUndefinedFields({
        ...card,
        createdAt: new Date().toISOString()
      }));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      return '';
    }
  };

  const updateCreditCard = async (id: string, card: Partial<CreditCard>): Promise<void> => {
    const path = `creditCards/${id}`;
    try {
      await updateDoc(doc(db, 'creditCards', id), cleanUndefinedFields(card));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteCreditCard = async (id: string): Promise<void> => {
    const path = `creditCards/${id}`;
    try {
      await deleteDoc(doc(db, 'creditCards', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // ----- Categories CRUD -----
  const getCategories = async (): Promise<Category[]> => {
    if (!auth.currentUser) return [];
    const path = 'categories';
    try {
      const q = query(collection(db, path), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  };

  const createCategory = async (category: Omit<Category, 'id' | 'createdAt'>): Promise<string> => {
    const path = 'categories';
    try {
      const docRef = await addDoc(collection(db, path), cleanUndefinedFields({
        ...category,
        createdAt: new Date().toISOString()
      }));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      return '';
    }
  };

  const updateCategory = async (id: string, category: Partial<Category>): Promise<void> => {
    const path = `categories/${id}`;
    try {
      const payload: any = { ...category };
      
      // Convert null or undefined fields to deleteField() to prevent Firestore errors
      Object.keys(payload).forEach(key => {
        if (payload[key] === null || payload[key] === undefined) {
          payload[key] = deleteField();
        }
      });
      
      await updateDoc(doc(db, 'categories', id), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteCategory = async (id: string): Promise<void> => {
    const path = `categories/${id}`;
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // ----- Tags CRUD -----
  const resetCategoriesToDefault = async (): Promise<number> => {
    if (!auth.currentUser) return 0;
    const path = 'categories';
    try {
      const q = query(collection(db, path), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      const existingCategories = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
      const existingNames = new Set(existingCategories.map(c => c.name.toLowerCase()));
      
      const defaultTree = [
        {
          name: 'Aluguel e moradia', type: 'expense' as const, icon: 'Home',
          subs: [
            { name: 'Aluguel', icon: 'Home' },
            { name: 'Condomínio', icon: 'Home' },
            { name: 'IPTU + TRSD', icon: 'FileText' },
            { name: 'Energia elétrica', icon: 'Zap' },
            { name: 'Água e esgoto', icon: 'Droplets' },
          ]
        },
        {
          name: 'Casa', type: 'expense' as const, icon: 'Home',
          subs: [
            { name: 'Empregados domésticos', icon: 'Users' },
            { name: 'Lavanderia e passadeira', icon: 'Shirt' },
            { name: 'Mobiliário', icon: 'Sofa' },
            { name: 'Reparos e conservação', icon: 'Wrench' }
          ]
        },
        {
          name: 'Mercado', type: 'expense' as const, icon: 'ShoppingCart',
          subs: [
            { name: 'Supermercado', icon: 'ShoppingCart' },
            { name: 'Feira livre', icon: 'Apple' }
          ]
        },
        {
          name: 'Alimentação fora', type: 'expense' as const, icon: 'Utensils',
          subs: [
            { name: 'Restaurantes e bares', icon: 'Utensils' },
            { name: 'Delivery', icon: 'Truck' },
            { name: 'Café e padaria', icon: 'Coffee' },
            { name: 'Lanches', icon: 'Pizza' }
          ]
        },
        {
          name: 'Transporte — veículo', type: 'expense' as const, icon: 'Car',
          subs: [
            { name: 'Combustível', icon: 'Fuel' },
            { name: 'Financiamento veículo', icon: 'Car' },
            { name: 'Seguro veicular', icon: 'Shield' },
            { name: 'Tributos (IPVA, licenciamento)', icon: 'FileText' },
            { name: 'Manutenção e peças', icon: 'Wrench' },
            { name: 'Lava-jato', icon: 'Droplets' },
            { name: 'Estacionamento', icon: 'ParkingCircle' },
            { name: 'Multas', icon: 'AlertTriangle' }
          ]
        },
        {
          name: 'Transporte urbano', type: 'expense' as const, icon: 'Bus',
          subs: [
            { name: 'Táxi / Uber', icon: 'Car' },
            { name: 'Metrô / Ônibus', icon: 'Bus' }
          ]
        },
        {
          name: 'Saúde', type: 'expense' as const, icon: 'HeartPulse',
          subs: [
            { name: 'Plano de saúde', icon: 'HeartPulse' },
            { name: 'Médicos e terapeutas', icon: 'Stethoscope' },
            { name: 'Dentista', icon: 'Smile' },
            { name: 'Farmácia', icon: 'Pill' },
            { name: 'Exames e procedimentos', icon: 'Activity' }
          ]
        },
        {
          name: 'Cuidados pessoais', type: 'expense' as const, icon: 'Users',
          subs: [
            { name: 'Barbearia / Cabelereiro', icon: 'Scissors' },
            { name: 'Manicure e pedicure', icon: 'Hand' },
            { name: 'Depilação', icon: 'Sparkles' },
            { name: 'Cosméticos e higiene', icon: 'Bath' },
            { name: 'Estética e afins', icon: 'Star' }
          ]
        },
        {
          name: 'Fitness e esporte', type: 'expense' as const, icon: 'Activity',
          subs: [
            { name: 'Academia', icon: 'Dumbbell' },
            { name: 'Esportes e atividades', icon: 'Activity' },
            { name: 'Equipamentos esportivos', icon: 'BaggageClaim' }
          ]
        },
        {
          name: 'Educação', type: 'expense' as const, icon: 'GraduationCap',
          subs: [
            { name: 'Escola (mensalidade)', icon: 'GraduationCap' },
            { name: 'Faculdade / Pós-graduação', icon: 'BookOpen' },
            { name: 'Financiamento estudantil', icon: 'Landmark' },
            { name: 'Cursos e treinamentos', icon: 'Video' },
            { name: 'Inscrição em concursos', icon: 'FileText' },
            { name: 'Livros didáticos', icon: 'Book' },
            { name: 'Material e uniforme escolar', icon: 'Backpack' }
          ]
        },
        {
          name: 'Lazer e cultura', type: 'expense' as const, icon: 'Ticket',
          subs: [
            { name: 'Cinema e teatro', icon: 'Ticket' },
            { name: 'Shows e eventos', icon: 'Music' },
            { name: 'Jogos', icon: 'Gamepad2' },
            { name: 'Literatura', icon: 'Book' },
            { name: 'Hobbies em geral', icon: 'Palette' }
          ]
        },
        {
          name: 'Viagens', type: 'expense' as const, icon: 'Plane',
          subs: [
            { name: 'Passagens', icon: 'Plane' },
            { name: 'Hospedagem', icon: 'Hotel' },
            { name: 'Alimentação na viagem', icon: 'Utensils' },
            { name: 'Passeios e tours', icon: 'Map' },
            { name: 'Seguro viagem', icon: 'Shield' }
          ]
        },
        {
          name: 'Vestuário', type: 'expense' as const, icon: 'Shirt',
          subs: [
            { name: 'Roupas e calçados', icon: 'Shirt' },
            { name: 'Acessórios', icon: 'Watch' }
          ]
        },
        {
          name: 'Eletrônicos e eletrodomésticos', type: 'expense' as const, icon: 'Laptop',
          subs: [
            { name: 'Eletrônicos', icon: 'Laptop' },
            { name: 'Eletrodomésticos', icon: 'Refrigerator' },
            { name: 'Utensílios domésticos', icon: 'Coffee' },
            { name: 'Cama, mesa e banho', icon: 'Bed' }
          ]
        },
        {
          name: 'Família e filhos', type: 'expense' as const, icon: 'Baby',
          subs: [
            { name: 'Brinquedos e presentes', icon: 'Gift' },
            { name: 'Atividades infantis', icon: 'Activity' },
            { name: 'Vestuário infantil', icon: 'Shirt' }
          ]
        },
        {
          name: 'Presentes', type: 'expense' as const, icon: 'Gift',
          subs: [
            { name: 'Presentes', icon: 'Gift' }
          ]
        },
        {
          name: 'Doações', type: 'expense' as const, icon: 'Heart',
          subs: [
            { name: 'Dízimos', icon: 'Heart' },
            { name: 'Ofertas e missões', icon: 'Globe' }
          ]
        },
        {
          name: 'Assinaturas e serviços digitais', type: 'expense' as const, icon: 'Tv',
          subs: [
            { name: 'Streaming', icon: 'Tv' },
            { name: 'Programa de pontos', icon: 'CreditCard' }
          ]
        },
        {
          name: 'Telecomunicações', type: 'expense' as const, icon: 'Smartphone',
          subs: [
            { name: 'Internet', icon: 'Wifi' },
            { name: 'Telefonia', icon: 'Smartphone' }
          ]
        },
        {
          name: 'Serviços bancários', type: 'expense' as const, icon: 'Landmark',
          subs: [
            { name: 'Anuidade cartão de crédito', icon: 'CreditCard' },
            { name: 'Tarifa pacote de serviços', icon: 'Landmark' },
            { name: 'Juros cartão de crédito', icon: 'Percent' },
            { name: 'IOF', icon: 'Banknote' }
          ]
        },
        {
          name: 'Impostos', type: 'expense' as const, icon: 'FileText',
          subs: [
            { name: 'IRRF', icon: 'FileText' },
            { name: 'Outras taxas e tributos', icon: 'FileText' }
          ]
        },
        {
          name: 'Trabalho e profissão', type: 'expense' as const, icon: 'Briefcase',
          subs: [
            { name: 'Entidade de classe', icon: 'Building' },
            { name: 'Despesas IBO', icon: 'Briefcase' },
            { name: 'Material de escritório', icon: 'Paperclip' },
            { name: 'Prestadores de serviço', icon: 'Users' }
          ]
        },
        {
          name: 'Dívidas e empréstimos', type: 'expense' as const, icon: 'DollarSign',
          subs: [
            { name: 'Empréstimos pessoais', icon: 'DollarSign' },
            { name: 'Financiamentos', icon: 'Landmark' },
            { name: 'Parcelamentos', icon: 'CreditCard' }
          ]
        },
        {
          name: 'Investimentos — custos', type: 'expense' as const, icon: 'TrendingDown',
          subs: [
            { name: 'Custódia', icon: 'Lock' },
            { name: 'Custos operacionais', icon: 'Activity' },
            { name: 'IOF sobre investimentos', icon: 'Percent' },
            { name: 'Perdas', icon: 'TrendingDown' },
            { name: 'Cota SICOOB', icon: 'Building' }
          ]
        },
        
        // 💰 RECEITAS
        {
          name: 'Salário e remuneração', type: 'income' as const, icon: 'Briefcase',
          subs: [
            { name: 'Salário / Pró-labore', icon: 'Briefcase' },
            { name: '13º salário', icon: 'Banknote' },
            { name: 'Férias', icon: 'Sun' },
            { name: 'Bônus e comissões', icon: 'Award' }
          ]
        },
        {
          name: 'Renda extra', type: 'income' as const, icon: 'Plus',
          subs: [
            { name: 'Freelas e consultorias', icon: 'Laptop' },
            { name: 'Venda de bens', icon: 'ShoppingBag' },
            { name: 'Prestação de serviços', icon: 'Wrench' }
          ]
        },
        {
          name: 'Rendas passivas', type: 'income' as const, icon: 'TrendingUp',
          subs: [
            { name: 'Aluguel recebido', icon: 'Home' },
            { name: 'Dividendos', icon: 'TrendingUp' },
            { name: 'Juros recebidos', icon: 'Percent' }
          ]
        },
        {
          name: 'Investimentos — rendimentos', type: 'income' as const, icon: 'TrendingUp',
          subs: [
            { name: 'Rendimentos renda fixa', icon: 'TrendingUp' },
            { name: 'Rendimentos renda variável', icon: 'TrendingUp' },
            { name: 'Resgates', icon: 'Download' }
          ]
        },
        {
          name: 'Reembolsos e restituições', type: 'income' as const, icon: 'Undo',
          subs: [
            { name: 'Reembolso de despesas', icon: 'Undo' },
            { name: 'Cashback cartão', icon: 'CreditCard' },
            { name: 'Restituição IR', icon: 'FileText' },
            { name: 'Transferências recebidas', icon: 'ArrowRightLeft' }
          ]
        }
      ];

      const batch = writeBatch(db);
      const now = new Date().toISOString();
      let addedCount = 0;
      
      const normalizeStr = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      
      for (const group of defaultTree) {
        let parentCat = existingCategories.find(c => normalizeStr(c.name) === normalizeStr(group.name) && c.type === group.type);
        let parentId = parentCat?.id;
        
        if (!parentCat) {
          parentId = doc(collection(db, path)).id;
          const newParent: Category = {
            id: parentId,
            userId: auth.currentUser.uid,
            name: group.name,
            type: group.type,
            icon: group.icon,
            isDefault: true,
            createdAt: now
          };
          batch.set(doc(db, path, parentId), newParent);
          addedCount++;
          existingCategories.push(newParent);
        }
        
        if (parentId) {
          for (const sub of group.subs) {
            let subCat = existingCategories.find(c => normalizeStr(c.name) === normalizeStr(sub.name) && c.type === group.type);
            if (!subCat) {
              const subId = doc(collection(db, path)).id;
              const newSub: Category = {
                id: subId,
                userId: auth.currentUser.uid,
                name: sub.name,
                type: group.type,
                icon: sub.icon,
                isDefault: true,
                parentId: parentId,
                createdAt: now
              };
              batch.set(doc(db, path, subId), newSub);
              addedCount++;
              existingCategories.push(newSub);
            } else if (subCat.parentId !== parentId) {
              batch.update(doc(db, path, subCat.id as string), { parentId: parentId });
              subCat.parentId = parentId;
              addedCount++;
            }
          }
        }
      }
      
      if (addedCount > 0) {
        await batch.commit();
        await logActivity('create', 'category', 'batch_default', `Foram adicionadas ou atualizadas ${addedCount} categorias do plano de contas oficial.`, null, null);
      }
      return addedCount;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      throw error;
    }
  };

  const getTags = async (): Promise<Tag[]> => {
    if (!auth.currentUser) return [];
    const path = 'tags';
    try {
      const q = query(collection(db, path), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tag));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  };

  const createTag = async (tag: Omit<Tag, 'id' | 'createdAt'>): Promise<string> => {
    const path = 'tags';
    try {
      const docRef = await addDoc(collection(db, path), cleanUndefinedFields({
        ...tag,
        createdAt: new Date().toISOString()
      }));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      return '';
    }
  };

  const updateTag = async (id: string, tag: Partial<Tag>): Promise<void> => {
    const path = `tags/${id}`;
    try {
      await updateDoc(doc(db, 'tags', id), cleanUndefinedFields(tag));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteTag = async (id: string): Promise<void> => {
    const path = `tags/${id}`;
    try {
      await deleteDoc(doc(db, 'tags', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // ----- Transactions CRUD -----
  const getTransactions = async (): Promise<Transaction[]> => {
    if (!auth.currentUser) return [];
    const path = 'transactions';
    try {
      const q = query(collection(db, path), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  };

  const createTransaction = async (tx: Omit<Transaction, 'id' | 'createdAt'>): Promise<string> => {
    const path = 'transactions';
    try {
      // Fetch current account if we are updating balance concurrently
      if (tx.accountId && tx.status === 'paid') {
        const accRef = doc(db, 'accounts', tx.accountId);
        const accSnap = await getDoc(accRef);
        if (accSnap.exists()) {
          const accData = accSnap.data() as Account;
          const isExpense = tx.type === 'expense' || tx.type === 'despesa';
          const isIncome = tx.type === 'income' || tx.type === 'receita';
          
          let newBalance = accData.balance;
          if (isExpense) newBalance -= tx.amount;
          if (isIncome) newBalance += tx.amount;

          // Transaction batch with existsAfter guarantee (atomic account update)
          const batch = writeBatch(db);
          const newTxRef = doc(collection(db, path));
          
          const newTx = cleanUndefinedFields({
            ...tx,
            createdAt: new Date().toISOString()
          });
          batch.set(newTxRef, newTx);
          batch.update(accRef, { balance: newBalance });
          await batch.commit();
          
          await logActivity('create', 'transaction', newTxRef.id, `Criou o lançamento: ${tx.description}`, null, newTx);
          return newTxRef.id;
        }
      }
      
      // Fallback simple write matching the single document update
      const newTxData = cleanUndefinedFields({
        ...tx,
        createdAt: new Date().toISOString()
      });
      const docRef = await addDoc(collection(db, path), newTxData);
      await logActivity('create', 'transaction', docRef.id, `Criou o lançamento: ${tx.description}`, null, newTxData);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      return '';
    }
  };

  const createBulkTransactions = async (txs: Omit<Transaction, 'id' | 'createdAt'>[]): Promise<void> => {
    const path = 'transactions';
    try {
      const batch = writeBatch(db);
      const newTxs: any[] = [];
      const accountBalanceAdjustments: { [accountId: string]: number } = {};

      for (const tx of txs) {
        const txRef = doc(collection(db, path));
        const newTxData = cleanUndefinedFields({
          ...tx,
          createdAt: new Date().toISOString()
        });
        batch.set(txRef, newTxData);
        newTxs.push({ id: txRef.id, data: newTxData });

        if (tx.accountId && tx.status === 'paid') {
          const isExpense = tx.type === 'expense' || tx.type === 'despesa';
          const isIncome = tx.type === 'income' || tx.type === 'receita';
          const amountDiff = isExpense ? -tx.amount : isIncome ? tx.amount : 0;
          accountBalanceAdjustments[tx.accountId] = (accountBalanceAdjustments[tx.accountId] || 0) + amountDiff;
        }
      }

      // Fetch and apply balance adjustments
      for (const accId of Object.keys(accountBalanceAdjustments)) {
        const adjustment = accountBalanceAdjustments[accId];
        if (adjustment !== 0) {
          const accRef = doc(db, 'accounts', accId);
          const accSnap = await getDoc(accRef);
          if (accSnap.exists()) {
            const accData = accSnap.data() as Account;
            const newBalance = accData.balance + adjustment;
            batch.update(accRef, { balance: newBalance });
          }
        }
      }

      await batch.commit();
      for (const tx of newTxs) {
        logActivity('create', 'transaction', tx.id, `Criou lançamento: ${tx.data.description}`, null, tx.data);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const updateTransaction = async (id: string, tx: Partial<Transaction>): Promise<void> => {
    const path = `transactions/${id}`;
    try {
      const txRef = doc(db, 'transactions', id);
      const oldSnap = await getDoc(txRef);
      const oldData = oldSnap.exists() ? oldSnap.data() as Transaction : null;

      const newTxUpdate: any = cleanUndefinedFields({
        ...tx,
        updatedAt: new Date().toISOString()
      });
      
      // Convert null or undefined fields to deleteField() to prevent Firestore errors
      Object.keys(newTxUpdate).forEach(key => {
        if (newTxUpdate[key] === null || newTxUpdate[key] === undefined) {
          newTxUpdate[key] = deleteField();
        }
      });
      
      const batch = writeBatch(db);
      batch.update(txRef, newTxUpdate);

      // Handle balance adjustment if status changed
      if (oldData && oldData.accountId && tx.status && tx.status !== oldData.status && !oldData.creditCardId) {
        const accRef = doc(db, 'accounts', oldData.accountId);
        const accSnap = await getDoc(accRef);
        
        if (accSnap.exists()) {
          const accData = accSnap.data() as Account;
          const isExpense = oldData.type === 'expense' || oldData.type === 'despesa';
          const isIncome = oldData.type === 'income' || oldData.type === 'receita';
          
          let newBalance = accData.balance;
          
          if (tx.status === 'paid' && oldData.status === 'pending') {
            // Apply transaction
            if (isExpense) newBalance -= oldData.amount;
            if (isIncome) newBalance += oldData.amount;
          } else if (tx.status === 'pending' && oldData.status === 'paid') {
            // Revert transaction
            if (isExpense) newBalance += oldData.amount;
            if (isIncome) newBalance -= oldData.amount;
          }
          
          batch.update(accRef, { balance: newBalance });
        }
      }

      await batch.commit();

      await logActivity('update', 'transaction', id, `Atualizou o lançamento: ${oldData?.description || 'Lançamento'} para status ${tx.status || 'mesmo'}`, oldData, { ...(oldData || {}), ...newTxUpdate });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteTransaction = async (id: string): Promise<void> => {
    const path = `transactions/${id}`;
    try {
      // Revert balance on delete if it was paid
      const txDoc = await getDoc(doc(db, 'transactions', id));
      let oldData: any = null;
      if (txDoc.exists()) {
        const txData = txDoc.data() as Transaction;
        oldData = txData;
        if (txData.accountId && txData.status === 'paid') {
          const accRef = doc(db, 'accounts', txData.accountId);
          const accSnap = await getDoc(accRef);
          if (accSnap.exists()) {
            const accData = accSnap.data() as Account;
            const isExpense = txData.type === 'expense' || txData.type === 'despesa';
            const isIncome = txData.type === 'income' || txData.type === 'receita';
            
            let newBalance = accData.balance;
            if (isExpense) newBalance += txData.amount; // Add back spent money
            if (isIncome) newBalance -= txData.amount;  // Deduct salary
            
            const batch = writeBatch(db);
            batch.delete(doc(db, 'transactions', id));
            batch.update(accRef, { balance: newBalance });
            await batch.commit();
            await logActivity('delete', 'transaction', id, `Excluiu o lançamento: ${txData.description}`, oldData, null);
            return;
          }
        }
      }
      await deleteDoc(doc(db, 'transactions', id));
      if (oldData) {
        await logActivity('delete', 'transaction', id, `Excluiu o lançamento: ${oldData.description}`, oldData, null);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // ----- Budgets CRUD -----
  const getBudgets = async (): Promise<Budget[]> => {
    if (!auth.currentUser) return [];
    const path = 'budgets';
    try {
      const q = query(collection(db, path), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Budget));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  };

  const saveBudget = async (budget: Omit<Budget, 'id' | 'createdAt'>): Promise<string> => {
    const path = 'budgets';
    try {
      const q = query(
        collection(db, path), 
        where('userId', '==', budget.userId), 
        where('categoryId', '==', budget.categoryId)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const existingDoc = snap.docs[0];
        await updateDoc(existingDoc.ref, cleanUndefinedFields({ amount: budget.amount }));
        return existingDoc.id;
      }
      
      const docRef = await addDoc(collection(db, path), cleanUndefinedFields({
        ...budget,
        createdAt: new Date().toISOString()
      }));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      return '';
    }
  };

  const updateBudget = async (id: string, amount: number): Promise<void> => {
    const path = `budgets/${id}`;
    try {
      await updateDoc(doc(db, 'budgets', id), { amount });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  // ----- Goals CRUD -----
  const getGoals = async (): Promise<Goal[]> => {
    if (!auth.currentUser) return [];
    const path = 'goals';
    try {
      const q = query(collection(db, path), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  };

  const createGoal = async (goal: Omit<Goal, 'id' | 'createdAt'>): Promise<string> => {
    const path = 'goals';
    try {
      const docRef = await addDoc(collection(db, path), cleanUndefinedFields({
        ...goal,
        createdAt: new Date().toISOString()
      }));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      return '';
    }
  };

  const updateGoal = async (id: string, goal: Partial<Goal>): Promise<void> => {
    const path = `goals/${id}`;
    try {
      await updateDoc(doc(db, 'goals', id), cleanUndefinedFields(goal));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteGoal = async (id: string): Promise<void> => {
    const path = `goals/${id}`;
    try {
      await deleteDoc(doc(db, 'goals', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  // ----- Invoices CRUD (Credit Cards) -----
  const getInvoices = async (cardId: string): Promise<Invoice[]> => {
    if (!auth.currentUser) return [];
    const path = 'invoices';
    try {
      const q = query(
        collection(db, path), 
        where('userId', '==', auth.currentUser.uid),
        where('cardId', '==', cardId)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  };

  const getInvoiceByPeriod = async (cardId: string, period: string): Promise<Invoice | null> => {
    if (!auth.currentUser) return null;
    const path = 'invoices';
    try {
      const q = query(
        collection(db, path), 
        where('userId', '==', auth.currentUser.uid),
        where('cardId', '==', cardId),
        where('period', '==', period)
      );
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      return { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Invoice;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return null;
    }
  };

  const createInvoice = async (invoice: Omit<Invoice, 'id'>): Promise<string> => {
    const path = 'invoices';
    try {
      const docRef = await addDoc(collection(db, path), cleanUndefinedFields(invoice));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      return '';
    }
  };

  const updateInvoice = async (id: string, invoice: Partial<Invoice>): Promise<void> => {
    const path = `invoices/${id}`;
    try {
      await updateDoc(doc(db, 'invoices', id), cleanUndefinedFields(invoice));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const deleteInvoice = async (id: string): Promise<void> => {
    const path = `invoices/${id}`;
    try {
      await deleteDoc(doc(db, 'invoices', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const getClosedPeriods = async (): Promise<ClosedPeriod[]> => {
    if (!auth.currentUser) return [];
    const path = 'closedPeriods';
    try {
      const q = query(collection(db, path), where('userId', '==', auth.currentUser.uid));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClosedPeriod));
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
      return [];
    }
  };

  const createClosedPeriod = async (period: Omit<ClosedPeriod, 'id'>): Promise<string> => {
    const path = 'closedPeriods';
    try {
      const docRef = await addDoc(collection(db, path), cleanUndefinedFields(period));
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
      return '';
    }
  };

  const deleteClosedPeriod = async (id: string): Promise<void> => {
    const path = `closedPeriods/${id}`;
    try {
      await deleteDoc(doc(db, 'closedPeriods', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  return (
    <FirebaseContext.Provider value={{
      authUser,
      currentUser,
      loading,
      signInWithGoogle,
      logOut,
      updateUserName,
      
      getActivityLogs,
      
      getAccounts,
      createAccount,
      updateAccount,
      deleteAccount,

      getCreditCards,
      createCreditCard,
      updateCreditCard,
      deleteCreditCard,

      getCategories,
      createCategory,
      updateCategory,
      deleteCategory,
      resetCategoriesToDefault,

      getTags,
      createTag,
      updateTag,
      deleteTag,

      getTransactions,
      createTransaction,
      createBulkTransactions,
      updateTransaction,
      deleteTransaction,

      getBudgets,
      saveBudget,
      updateBudget,

      getGoals,
      createGoal,
      updateGoal,
      deleteGoal,

      getInvoices,
      getInvoiceByPeriod,
      createInvoice,
      updateInvoice,
      deleteInvoice,

      getClosedPeriods,
      createClosedPeriod,
      deleteClosedPeriod
    }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
