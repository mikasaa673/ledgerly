// ============================================================
// Ledgerly - Utility Functions
// ============================================================

import { format, parse, startOfMonth, endOfMonth, startOfYear, endOfYear, isToday, isBefore, isAfter, addMonths, parseISO } from 'date-fns';
import { nanoid } from 'nanoid';

// --- ID Generation ---
export const generateId = (): string => nanoid();

// --- Date Formatting (DD-MM-YYYY) ---
export const formatDate = (dateStr: string): string => {
  try {
    const date = parseISO(dateStr);
    return format(date, 'dd-MM-yyyy');
  } catch {
    return dateStr;
  }
};

export const formatDueDate = (dateStr: string): string => {
  try {
    const date = parseISO(dateStr);
    return format(date, 'MMM d');
  } catch {
    return dateStr;
  }
};

export const getDaysSince = (dateStr?: string): number | null => {
  if (!dateStr || !dateStr.trim()) return null;
  try {
    const d = parseISO(dateStr);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const startOfLent = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = startOfToday.getTime() - startOfLent.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
};

export const formatDateShort = (dateStr: string): string => {
  try {
    const date = parseISO(dateStr);
    return format(date, 'MMM d');
  } catch {
    return dateStr;
  }
};

export const computeNextMonthDate = (dateStr: string): string => {
  try {
    const d = parseISO(dateStr);
    const next = addMonths(d, 1);
    return format(next, 'yyyy-MM-dd');
  } catch {
    return dateStr;
  }
};

export const toISODate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

export const todayISO = (): string => toISODate(new Date());

export const nowISO = (): string => new Date().toISOString();

// --- Currency Formatting (INR with up to 2 decimal places support) ---
export const formatCurrency = (amount?: number | null, forceDecimals = false): string => {
  const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  // If the number has decimal cents (like 50.35), show 2 decimal places; otherwise clean whole number
  const hasDecimals = Math.abs(val % 1) >= 0.005;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: forceDecimals || hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(val);
};

export const roundToTwo = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export const formatCurrencyCompact = (amount?: number | null): string => {
  const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  if (val >= 10000000) {
    return `₹${(val / 10000000).toFixed(2)}Cr`;
  }
  if (val >= 100000) {
    return `₹${(val / 100000).toFixed(2)}L`;
  }
  if (val >= 1000) {
    return `₹${(val / 1000).toFixed(1)}K`;
  }
  return formatCurrency(val);
};

// --- Date Range Helpers ---
export const getMonthRange = (month: number, year: number) => ({
  start: startOfMonth(new Date(year, month - 1)),
  end: endOfMonth(new Date(year, month - 1)),
});

export const getYearRange = (year: number) => ({
  start: startOfYear(new Date(year, 0)),
  end: endOfYear(new Date(year, 0)),
});

export const getCurrentMonth = (): { month: number; year: number } => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

export const getMonthName = (month: number): string => {
  return format(new Date(2024, month - 1), 'MMMM');
};

export const getMonthYearLabel = (month: number, year: number): string => {
  return `${getMonthName(month)} ${year}`;
};

// --- Collection Status Helpers ---
export const getCollectionStatus = (
  dueDate: string,
  collectedAmount: number,
  expectedInterest: number,
  isFullyRepaid: boolean = false
): 'coming_soon' | 'due_today' | 'pending' | 'collected' | 'partial' => {
  if (expectedInterest > 0) {
    if (collectedAmount >= expectedInterest) return 'collected';
    if (collectedAmount > 0 && collectedAmount < expectedInterest) return 'partial';
  } else {
    // 0% EMI loan
    if (isFullyRepaid || collectedAmount > 0) return 'collected';
  }

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dueStr = (dueDate || '').slice(0, 10);

  if (!dueStr) return 'coming_soon';

  if (dueStr < todayStr) return 'pending';
  if (dueStr === todayStr) return 'due_today';
  return 'coming_soon';
};

// --- Next Due Date Calculator ---
export const calculateNextDueDate = (currentDueDate: string): string => {
  const date = parseISO(currentDueDate);
  const next = addMonths(date, 1);
  return toISODate(next);
};

// --- Validation ---
export const isPositiveNumber = (value: number): boolean => {
  return typeof value === 'number' && !isNaN(value) && value > 0;
};

export const isValidAmount = (value: number): boolean => {
  return typeof value === 'number' && !isNaN(value) && value >= 0;
};

// --- Percentage ---
export const calculatePercentage = (part: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
};

// --- cn utility for classnames ---
export const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ');
};

// --- Month list ---
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
