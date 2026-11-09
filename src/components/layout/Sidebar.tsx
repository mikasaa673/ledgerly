// ============================================================
// Ledgerly - Minimalist Clean Light & Dark Sidebar Navigation
// ============================================================

import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import AuthModal from '../auth/AuthModal';
import {
  Briefcase,
  LayoutDashboard,
  Users,
  Receipt,
  TrendingUp,
  Landmark,
  BookOpen,
  Settings,
  X,
  IndianRupee,
  RotateCcw,
  Sun,
  Moon,
  Cloud,
} from 'lucide-react';

const navItems = [
  { to: '/', icon: Briefcase, label: 'Business', badge: 'Primary' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/personal-lending', icon: Users, label: 'Personal' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/income', icon: TrendingUp, label: 'Income' },
  { to: '/bank-accounts', icon: Landmark, label: 'Bank Accounts' },
  { to: '/ledger', icon: BookOpen, label: 'Ledger Log', badge: 'Audit' },
  { to: '/settings', icon: Settings, label: 'Settings & Backups' },
];

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen, setShowResetConfirm, theme, toggleTheme } = useApp();
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Clean White / Dark Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-all duration-200 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800/80">
          <NavLink to="/" className="flex items-center gap-2 group">
            <img
              src="/logo-light.png"
              alt="Ledgerly"
              className="h-8 w-auto object-contain block dark:hidden transition-transform duration-150 group-hover:scale-[1.02]"
            />
            <img
              src="/logo-dark.png"
              alt="Ledgerly"
              className="h-8 w-auto object-contain hidden dark:block transition-transform duration-150 group-hover:scale-[1.02]"
            />
          </NavLink>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-md text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Label */}
        <div className="px-6 pt-5 pb-2">
          <p className="text-[10px] font-semibold tracking-wider text-zinc-400 dark:text-zinc-500 uppercase">
            Menu
          </p>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isRoot = item.to === '/';
            const isActive = isRoot
              ? location.pathname === '/' || location.pathname === '/business-lending'
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 font-semibold shadow-xs'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <item.icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-zinc-950 dark:text-zinc-100 stroke-[2.2]' : 'text-zinc-500 dark:text-zinc-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && !isActive && (
                  <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Actions Section: Theme Toggle & Reset Values */}
        <div className="px-3 py-2 space-y-1 border-t border-zinc-100 dark:border-zinc-800/80">
          {/* Quick Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all cursor-pointer"
            title="Toggle Light / Dark mode"
          >
            <div className="flex items-center gap-2.5">
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-zinc-500" />
              )}
              <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
            </div>
            <span className="text-[10px] text-zinc-400 capitalize">{theme}</span>
          </button>

          {/* Reset Values Action */}
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setShowResetConfirm(true);
            }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-100 dark:hover:border-red-900/40 transition-all cursor-pointer"
            title="Reset all values to zero"
          >
            <div className="flex items-center gap-2.5">
              <RotateCcw className="w-3.5 h-3.5 text-zinc-500 group-hover:text-red-500" />
              <span>Reset Values</span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">0</span>
          </button>
        </div>

        {/* Footer Cloud Sync & Account Tile */}
        <div className="p-3 border-t border-zinc-100 dark:border-zinc-800/80">
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className="w-full text-left p-2.5 rounded-xl bg-zinc-50 hover:bg-zinc-100/80 dark:bg-zinc-900/60 dark:hover:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0 pr-1">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                  user ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400'
                }`}>
                  <Cloud className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate block">
                    {user ? 'Cloud Synced' : 'Cloud Sync'}
                  </span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate block">
                    {user ? user.email : 'Click to Sign In / Connect'}
                  </span>
                </div>
              </div>
              <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${user ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            </div>
          </button>
        </div>
      </aside>

      {/* Cloud Sync & Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </>
  );
}
