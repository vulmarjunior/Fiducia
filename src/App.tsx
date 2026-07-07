import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Accounts } from './pages/Accounts';
import { CreditCards } from './pages/CreditCards';
import { Transactions } from './pages/Transactions';
import { Categories } from './pages/Categories';
import { Tags } from './pages/Tags';
import { Budgets } from './pages/Budgets';
import { Goals } from './pages/Goals';
import { Reports } from './pages/Reports';
import { Audit } from './pages/Audit';
import { Reconciliation } from './pages/Reconciliation';
import { ActivityLog } from './pages/ActivityLog';
import { SettingsPage } from './pages/Settings';
import { ImportCenter } from './pages/ImportCenter';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (user) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <TooltipProvider delay={300}>
        <Router>
          <Routes>
            <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
            
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="accounts" element={<Accounts />} />
              <Route path="cards" element={<CreditCards />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="importar" element={<ImportCenter />} />
              <Route path="importar/compartilhar" element={<ImportCenter />} />
              <Route path="importar/:id" element={<ImportCenter />} />
              <Route path="reconciliation" element={<Reconciliation />} />
              <Route path="audit" element={<Audit />} />
              <Route path="categories" element={<Categories />} />
              <Route path="tags" element={<Tags />} />
              <Route path="budgets" element={<Budgets />} />
              <Route path="goals" element={<Goals />} />
              <Route path="reports" element={<Reports />} />
              <Route path="activity" element={<ActivityLog />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </Router>
        <Toaster />
      </TooltipProvider>
    </AuthProvider>
  );
}
