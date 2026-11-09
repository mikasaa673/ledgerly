// ============================================================
// Ledgerly - Main App with Router & Provider
// Landing Page: Business Lending Register (User's Core Business)
// ============================================================

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import AuthGuard from './components/auth/AuthGuard';
import Layout from './components/layout/Layout';

// Pages
import BusinessLending from './pages/BusinessLending';
import Dashboard from './pages/Dashboard';
import PersonalLending from './pages/PersonalLending';
import Expenses from './pages/Expenses';
import IncomePage from './pages/IncomePage';
import BankAccounts from './pages/BankAccounts';
import SettingsPage from './pages/SettingsPage';
import LedgerPage from './pages/LedgerPage';

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AuthGuard>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Layout />}>
                {/* Primary Landing Page: Business Lending */}
                <Route index element={<BusinessLending />} />
                <Route path="business-lending" element={<BusinessLending />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="personal-lending" element={<PersonalLending />} />
                <Route path="expenses" element={<Expenses />} />
                <Route path="income" element={<IncomePage />} />
                <Route path="bank-accounts" element={<BankAccounts />} />
                <Route path="ledger" element={<LedgerPage />} />
                <Route path="reports" element={<Navigate to="/dashboard" replace />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthGuard>
      </AppProvider>
    </AuthProvider>
  );
}
