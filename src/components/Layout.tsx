import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { TransactionDialogProvider, useTransactionDialog } from '../contexts/TransactionDialogContext';

import { LayoutDashboard, Receipt, CreditCard, Wallet, LogOut, Menu, Tags, PieChart, Target, FileText, Download, Tag, ListChecks, History, Settings, Sun, Moon, Upload, Plus, X, Sparkles } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from './ui/button';
import { lazy, Suspense, useState, useEffect } from 'react';
import { Logo } from './Logo';
import { APP_VERSION } from '../lib/utils';

const TransactionDialog = lazy(() => import('./TransactionDialog').then((module) => ({ default: module.TransactionDialog })));

export function Layout() {
  return (
    <TransactionDialogProvider>
      <LayoutContent />
    </TransactionDialogProvider>
  );
}

function LayoutContent() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { open: openTransactionDialog } = useTransactionDialog();
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    setMounted(true);
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  const mainNavItems: { name: string; path: string; icon: any; badge?: string }[] = [
    { name: 'Visão Geral', path: '/', icon: LayoutDashboard },
    { name: 'Lançamentos', path: '/transactions', icon: Receipt },
    { name: 'Importar', path: '/importar', icon: Upload },
    { name: 'Conciliação', path: '/reconciliation', icon: ListChecks },
    { name: 'Auditoria', path: '/audit', icon: FileText },
    { name: 'Contas', path: '/accounts', icon: Wallet },
    { name: 'Cartões', path: '/cards', icon: CreditCard },
  ];

  const planningNavItems = [
    { name: 'Orçamentos', path: '/budgets', icon: PieChart },
    { name: 'Relatórios', path: '/reports', icon: FileText },
    { name: 'Simulador', path: '/simulator', icon: Sparkles },
    { name: 'Metas', path: '/goals', icon: Target },
    { name: 'Categorias', path: '/categories', icon: Tags },
    { name: 'Tags', path: '/tags', icon: Tag },
    { name: 'Atividades', path: '/activity', icon: History },
    { name: 'Configurações', path: '/settings', icon: Settings },
  ];

  const userInitials = user?.displayName 
    ? user.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : user?.email?.[0].toUpperCase() || 'U';

  return (
    <>
    <Suspense fallback={null}><TransactionDialog /></Suspense>
    <div className="flex h-screen bg-background text-foreground font-sans">
      {/* Sidebar */}
      <aside id="app-navigation" aria-label="Navegação principal" className={`fixed inset-y-0 left-0 z-50 w-[240px] bg-card border-r border-border flex flex-col transform transition-transform duration-200 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:relative shrink-0`}>
        
        {/* Logo Area */}
        <div className="p-6 border-b border-border">
          <Logo size={48} withText />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto space-y-6">
          <div>
            <div className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-3 mb-2">Principal</div>
            <div className="space-y-1">
              {mainNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[14px] font-medium transition-all group ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
                    {item.name}
                    {item.badge && (
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive ? 'bg-white/20 text-white dark:bg-background/30 dark:text-foreground' : 'bg-fiducia-red/10 text-fiducia-red'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase px-3 mb-2">Planejamento</div>
            <div className="space-y-1">
              {planningNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-[14px] font-medium transition-all group ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'}`} />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Footer / User Card */}
        <div className="p-4 border-t border-border space-y-2">
          {isInstallable && (
            <Button 
              onClick={handleInstallClick} 
              variant="outline" 
              className="w-full justify-start gap-3 rounded-xl border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary transition-all"
            >
              <Download className="w-4 h-4" />
              Instalar App
            </Button>
          )}
          {mounted && (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[14px] font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-all"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            </button>
          )}
          <div 
            className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer hover:bg-secondary/80 transition-all group border border-transparent hover:border-border"
            onClick={logout}
          >
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary text-[12px] font-bold shrink-0 group-hover:scale-105 transition-transform">
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-foreground truncate">{user?.displayName || 'Usuário'}</div>
              <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
            </div>
            <LogOut className="w-4 h-4 text-muted-foreground group-hover:text-fiducia-red transition-colors" />
          </div>
          <p className="text-center text-[10px] text-muted-foreground/50 font-mono">
            Fiducia v{APP_VERSION}
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
        <header className="bg-card border-b border-border h-16 flex items-center px-4 md:hidden">
          <button type="button" aria-label="Abrir menu" aria-controls="app-navigation" aria-expanded={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(true)} className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <Menu className="w-6 h-6" />
          </button>
          <div className="ml-4">
            <Logo size={28} withText />
          </div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 md:pb-6">
          <Outlet />
        </main>
      </div>

      <nav aria-label="Navegação rápida" className="fixed inset-x-0 bottom-0 z-30 grid h-20 grid-cols-5 items-center border-t border-border bg-card/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <Link to="/" aria-current={location.pathname === '/' ? 'page' : undefined} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium ${location.pathname === '/' ? 'text-primary' : 'text-muted-foreground'}`}>
          <LayoutDashboard className="h-5 w-5" /><span>Início</span>
        </Link>
        <Link to="/transactions" aria-current={location.pathname === '/transactions' ? 'page' : undefined} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium ${location.pathname === '/transactions' ? 'text-primary' : 'text-muted-foreground'}`}>
          <Receipt className="h-5 w-5" /><span>Lançamentos</span>
        </Link>
        <button type="button" aria-label="Novo lançamento" onClick={() => openTransactionDialog()} className="mx-auto -mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95">
          <Plus className="h-6 w-6" />
        </button>
        <Link to="/accounts" aria-current={location.pathname === '/accounts' ? 'page' : undefined} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium ${location.pathname === '/accounts' ? 'text-primary' : 'text-muted-foreground'}`}>
          <Wallet className="h-5 w-5" /><span>Contas</span>
        </Link>
        <Link to="/cards" aria-current={location.pathname === '/cards' ? 'page' : undefined} className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-medium ${location.pathname === '/cards' ? 'text-primary' : 'text-muted-foreground'}`}>
          <CreditCard className="h-5 w-5" /><span>Cartões</span>
        </Link>
      </nav>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
    </>
  );
}
