import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import { ReportingPeriodProvider } from './contexts/ReportingPeriodContext';

const Login = lazy(() => import('./pages/Login').then((module) => ({ default: module.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((module) => ({ default: module.Dashboard })));
const Accounts = lazy(() => import('./pages/Accounts').then((module) => ({ default: module.Accounts })));
const CreditCards = lazy(() => import('./pages/CreditCards').then((module) => ({ default: module.CreditCards })));
const Transactions = lazy(() => import('./pages/Transactions').then((module) => ({ default: module.Transactions })));
const Categories = lazy(() => import('./pages/Categories').then((module) => ({ default: module.Categories })));
const Tags = lazy(() => import('./pages/Tags').then((module) => ({ default: module.Tags })));
const Budgets = lazy(() => import('./pages/Budgets').then((module) => ({ default: module.Budgets })));
const Goals = lazy(() => import('./pages/Goals').then((module) => ({ default: module.Goals })));
const Reports = lazy(() => import('./pages/Reports').then((module) => ({ default: module.Reports })));
const Audit = lazy(() => import('./pages/Audit').then((module) => ({ default: module.Audit })));
const Reconciliation = lazy(() => import('./pages/Reconciliation').then((module) => ({ default: module.Reconciliation })));
const ActivityLog = lazy(() => import('./pages/ActivityLog').then((module) => ({ default: module.ActivityLog })));
const SettingsPage = lazy(() => import('./pages/Settings').then((module) => ({ default: module.SettingsPage })));
const ImportCenter = lazy(() => import('./pages/ImportCenter').then((module) => ({ default: module.ImportCenter })));
const Simulator = lazy(() => import('./pages/Simulator').then((module) => ({ default: module.Simulator })));

function LoadingScreen() {
  return <div role="status" className="min-h-[40vh] flex items-center justify-center text-muted-foreground">Carregando…</div>;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady } = useAuth();
  if (!isAuthReady) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthReady } = useAuth();
  if (!isAuthReady) return <LoadingScreen />;
  if (user) return <Navigate to="/" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <TooltipProvider delay={300}>
        <ReportingPeriodProvider>
          <Router>
            <Suspense fallback={<LoadingScreen />}>
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
                  <Route path="simulator" element={<Simulator />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>
              </Routes>
            </Suspense>
          </Router>
        </ReportingPeriodProvider>
        <Toaster />
      </TooltipProvider>
    </AuthProvider>
  );
}
