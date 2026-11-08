// ============================================================
// Ledgerly - Authentication Guard Component
// Ensures no financial data or dashboard is exposed without login
// ============================================================

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import LoginPage from '../../pages/LoginPage';
import { Loader2 } from 'lucide-react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <div className="flex flex-col items-center gap-3">
          <img
            src="/logo-dark.png"
            alt="Ledgerly"
            className="w-12 h-12 object-contain animate-pulse block dark:hidden"
          />
          <img
            src="/logo-light.png"
            alt="Ledgerly"
            className="w-12 h-12 object-contain animate-pulse hidden dark:block"
          />
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
            <span>Loading your ledger...</span>
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated -> Lock the app behind the Login page
  if (!user) {
    return <LoginPage />;
  }

  // Authenticated -> Allow access to the financial workspace
  return <>{children}</>;
}
