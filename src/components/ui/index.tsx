// ============================================================
// Ledgerly - Minimalist Clean Light & Dark UI Components
// ============================================================

import React, { type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, useState, useEffect, useRef } from 'react';
import { X, AlertTriangle, Loader2, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, addMonths } from 'date-fns';
import { cn } from '../../utils';

// --- Card ---
interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ children, className, onClick }: CardProps) {
  const hasCustomPadding = className && /\b(?:p|px|py|pt|pb|pl|pr)-\S+/.test(className);
  return (
    <div
      onClick={onClick}
      className={cn(
        'rounded-xl border border-zinc-200/80 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 transition-all duration-150',
        !hasCustomPadding && 'p-5 sm:p-6',
        onClick && 'cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-xs',
        className
      )}
      style={{
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.02), 0 1px 2px -1px rgba(0, 0, 0, 0.02)',
      }}
    >
      {children}
    </div>
  );
}

// --- Stat Card ---
interface StatCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  subtitle?: string;
  trend?: { value: string; positive: boolean };
  className?: string;
  valueClassName?: string;
}

export function StatCard({ label, value, icon, subtitle, trend, className, valueClassName }: StatCardProps) {
  return (
    <Card className={cn('flex flex-col justify-between p-3 sm:p-3.5', className)}>
      <div className="flex items-center justify-between gap-1 min-w-0">
        <p className="text-[11px] sm:text-xs font-semibold text-zinc-500 dark:text-zinc-400 tracking-tight leading-tight whitespace-normal break-words" title={label}>
          {label}
        </p>
        {icon && (
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-zinc-50 border border-zinc-100 dark:bg-zinc-800 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center shrink-0">
            {icon}
          </div>
        )}
      </div>
      <div className="mt-1.5 sm:mt-2 min-w-0 overflow-visible">
        <p className={cn(
          "text-base sm:text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50 font-mono-num whitespace-nowrap overflow-visible",
          valueClassName
        )}>
          {value}
        </p>
        {subtitle && (
          <p className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-tight truncate" title={subtitle}>{subtitle}</p>
        )}
        {trend && (
          <p className={cn('text-xs font-medium mt-1', trend.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
            {trend.value}
          </p>
        )}
      </div>
    </Card>
  );
}

// --- Button ---
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 shadow-xs font-semibold',
  secondary: 'bg-white hover:bg-zinc-50 text-zinc-800 border border-zinc-200/90 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700 shadow-xs font-medium',
  danger: 'bg-red-600 hover:bg-red-700 text-white dark:bg-red-600 dark:hover:bg-red-700 shadow-xs font-semibold',
  ghost: 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium',
};

const buttonSizes = {
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-4 py-2 text-xs rounded-lg',
  lg: 'px-5 py-2.5 text-sm rounded-lg',
};

export function Button({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-1.5 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer',
        buttonStyles[variant],
        buttonSizes[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// --- Input ---
interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helpText?: string;
}

function DateInputField({
  label,
  error,
  helpText,
  className,
  value,
  onChange,
  min,
  max,
  id,
  name,
  placeholder = 'dd-mm-yyyy',
  disabled,
  required,
  type,
  ...props
}: InputFieldProps) {
  // Convert incoming ISO (YYYY-MM-DD) or any date string to display DD-MM-YYYY
  const toDisplay = (val: string | number | readonly string[] | undefined): string => {
    if (!val || typeof val !== 'string') return '';
    const trimmed = val.trim();
    const ymd = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (ymd) {
      const year = ymd[1];
      const month = ymd[2].padStart(2, '0');
      const day = ymd[3].padStart(2, '0');
      return `${day}-${month}-${year}`;
    }
    const dmy = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
    if (dmy) {
      let year = dmy[3];
      if (year.length === 2) year = `20${year}`;
      return `${dmy[1].padStart(2, '0')}-${dmy[2].padStart(2, '0')}-${year}`;
    }
    return trimmed;
  };

  const toISO = (val: string): string => {
    if (!val) return '';
    const cleaned = val.trim();
    // 1. DD-MM-YYYY or DD/MM/YYYY or DD-MM-YY
    const dmy = cleaned.replace(/[/.]/g, '-').match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})$/);
    if (dmy) {
      const day = dmy[1].padStart(2, '0');
      const month = dmy[2].padStart(2, '0');
      let year = dmy[3];
      if (year.length === 2) year = `20${year}`;
      const mNum = parseInt(month, 10);
      const dNum = parseInt(day, 10);
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
        return `${year}-${month}-${day}`;
      }
    }
    // 2. 8-digit continuous DDMMYYYY e.g. 07112026
    const digits = cleaned.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (digits) {
      const day = digits[1];
      const month = digits[2];
      const year = digits[3];
      const mNum = parseInt(month, 10);
      const dNum = parseInt(day, 10);
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31) {
        return `${year}-${month}-${day}`;
      }
    }
    // 3. YYYY-MM-DD
    const ymd = cleaned.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (ymd) {
      const year = ymd[1];
      const month = ymd[2].padStart(2, '0');
      const day = ymd[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return '';
  };

  const isoValue = typeof value === 'string' ? value : '';
  const [displayText, setDisplayText] = useState(() => toDisplay(value));
  const hiddenPickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDisplayText(toDisplay(value));
  }, [value]);

  const emitChange = (newIso: string) => {
    if (onChange) {
      const event = {
        target: { value: newIso, name, id },
        currentTarget: { value: newIso, name, id },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(event);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplayText(raw);
    const parsedIso = toISO(raw);
    if (parsedIso) {
      emitChange(parsedIso);
    } else if (!raw) {
      emitChange('');
    }
  };

  const handleBlur = () => {
    const parsedIso = toISO(displayText);
    if (parsedIso) {
      setDisplayText(toDisplay(parsedIso));
      emitChange(parsedIso);
    } else if (displayText.trim() === '') {
      setDisplayText('');
      emitChange('');
    } else {
      setDisplayText(toDisplay(value));
    }
  };

  const handlePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedIso = e.target.value;
    setDisplayText(toDisplay(selectedIso));
    emitChange(selectedIso);
  };

  const openPicker = () => {
    if (hiddenPickerRef.current) {
      if (typeof hiddenPickerRef.current.showPicker === 'function') {
        try {
          hiddenPickerRef.current.showPicker();
          return;
        } catch {}
      }
      hiddenPickerRef.current.focus();
    }
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          type="text"
          id={id}
          name={name}
          value={displayText}
          onChange={handleTextChange}
          onBlur={handleBlur}
          onKeyDown={(e) => {
            if (e.key === 'F4' || (e.altKey && e.key === 'ArrowDown')) {
              e.preventDefault();
              openPicker();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={cn(
            'w-full pl-3 pr-10 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-900 text-base sm:text-xs font-mono-num transition-colors outline-none',
            'dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-100 dark:placeholder:text-zinc-500',
            'placeholder:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600',
            'focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:focus:border-zinc-300 dark:focus:ring-zinc-300',
            error ? 'border-red-500 dark:border-red-500 focus:border-red-500' : '',
            className
          )}
          {...props}
        />

        {/* Calendar Picker Trigger */}
        <div
          onClick={openPicker}
          className="absolute right-0 top-0 bottom-0 w-10 flex items-center justify-center cursor-pointer rounded-r-lg group"
          title="Click to open calendar"
        >
          <Calendar className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-zinc-300 transition-colors pointer-events-none" />
          <input
            ref={hiddenPickerRef}
            type="date"
            value={isoValue}
            min={min}
            max={max}
            disabled={disabled}
            tabIndex={-1}
            aria-label={label || 'Select date'}
            onChange={handlePickerChange}
            onClick={(e) => {
              if (typeof (e.currentTarget as any).showPicker === 'function') {
                try {
                  (e.currentTarget as any).showPicker();
                } catch {}
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full [&::-webkit-calendar-picker-indicator]:opacity-0"
          />
        </div>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
      {helpText && <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{helpText}</p>}
    </div>
  );
}

export function Input(props: InputFieldProps) {
  if (props.type === 'date') {
    return <DateInputField {...props} />;
  }
  const { label, error, helpText, className, id, step, ...rest } = props;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      )}
      <input
        id={id}
        step={props.type === 'number' ? (step ?? 'any') : step}
        className={cn(
          'w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-900 text-base sm:text-xs transition-colors outline-none',
          'dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-100 dark:placeholder:text-zinc-500',
          'placeholder:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600',
          'focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:focus:border-zinc-300 dark:focus:ring-zinc-300',
          error ? 'border-red-500 dark:border-red-500 focus:border-red-500' : '',
          className
        )}
        {...rest}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
      {helpText && <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{helpText}</p>}
    </div>
  );
}

// --- Interactive Inline Calendar Picker ---
export interface CalendarPickerProps {
  label?: string;
  value: string; // ISO date 'YYYY-MM-DD'
  onChange: (val: string) => void;
  error?: string;
  helpText?: string;
  className?: string;
}

export function CalendarPicker({
  label = 'Due Date',
  value,
  onChange,
  error,
  helpText,
  className,
}: CalendarPickerProps) {
  const initialDate = (() => {
    if (value) {
      try {
        const d = parseISO(value);
        if (!isNaN(d.getTime())) return d;
      } catch {}
    }
    return new Date();
  })();

  const [viewDate, setViewDate] = useState<Date>(initialDate);

  useEffect(() => {
    if (value) {
      try {
        const d = parseISO(value);
        if (!isNaN(d.getTime())) {
          setViewDate(d);
        }
      } catch {}
    }
  }, [value]);

  const viewYear = viewDate.getFullYear();
  const viewMonthIndex = viewDate.getMonth();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate((d) => addMonths(d, -1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setViewDate((d) => addMonths(d, 1));
  };

  const handleToday = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = new Date();
    setViewDate(now);
    onChange(format(now, 'yyyy-MM-dd'));
  };

  const firstDayOfWeek = new Date(viewYear, viewMonthIndex, 1).getDay();
  const daysInCurrentMonth = new Date(viewYear, viewMonthIndex + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonthIndex, 0).getDate();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  interface DayCell {
    day: number;
    iso: string;
    isCurrentMonth: boolean;
  }

  const cells: DayCell[] = [];

  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    const dateObj = new Date(viewYear, viewMonthIndex - 1, d);
    cells.push({
      day: d,
      iso: format(dateObj, 'yyyy-MM-dd'),
      isCurrentMonth: false,
    });
  }

  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const dateObj = new Date(viewYear, viewMonthIndex, d);
    cells.push({
      day: d,
      iso: format(dateObj, 'yyyy-MM-dd'),
      isCurrentMonth: true,
    });
  }

  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const dateObj = new Date(viewYear, viewMonthIndex + 1, d);
    cells.push({
      day: d,
      iso: format(dateObj, 'yyyy-MM-dd'),
      isCurrentMonth: false,
    });
  }

  const selectedText = (() => {
    if (!value) return 'None selected';
    try {
      const d = parseISO(value);
      if (!isNaN(d.getTime())) {
        return format(d, 'dd-MM-yyyy (EEE, MMM d)');
      }
    } catch {}
    return value;
  })();

  const weekHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            {label}
          </label>
          {value && (
            <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 font-mono-num">
              {selectedText}
            </span>
          )}
        </div>
      )}

      <div className="p-3 rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/90 shadow-2xs">
        {/* Calendar Navigation Header */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 px-1 select-none">
              {format(viewDate, 'MMMM yyyy')}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleToday}
            className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-2 py-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            Today
          </button>
        </div>

        {/* Weekday Labels */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1 select-none">
          {weekHeaders.map((w, idx) => (
            <span
              key={w}
              className={cn(
                'text-[10px] font-semibold py-0.5',
                idx === 0 || idx === 6
                  ? 'text-zinc-400 dark:text-zinc-500'
                  : 'text-zinc-500 dark:text-zinc-400'
              )}
            >
              {w}
            </span>
          ))}
        </div>

        {/* Day Grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const isSelected = cell.iso === value;
            const isCurrentToday = cell.iso === todayStr;

            return (
              <button
                key={cell.iso}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(cell.iso);
                  if (!cell.isCurrentMonth) {
                    setViewDate(parseISO(cell.iso));
                  }
                }}
                className={cn(
                  'h-8 text-xs font-mono-num rounded-lg flex items-center justify-center transition-all cursor-pointer select-none',
                  isSelected
                    ? 'bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950 font-bold shadow-xs scale-102 ring-1 ring-zinc-950 dark:ring-zinc-100'
                    : isCurrentToday
                    ? 'border border-blue-500/80 font-bold text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/30'
                    : cell.isCurrentMonth
                    ? 'text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-medium'
                    : 'text-zinc-300 dark:text-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                )}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
      {helpText && <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{helpText}</p>}
    </div>
  );
}

// --- Select ---
interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className, ...props }: SelectFieldProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      )}
      <select
        className={cn(
          'w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-900 text-base sm:text-xs transition-colors outline-none cursor-pointer',
          'dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-100',
          'hover:border-zinc-300 dark:hover:border-zinc-600 focus:border-zinc-950 dark:focus:border-zinc-300 focus:ring-1 focus:ring-zinc-950 dark:focus:ring-zinc-300',
          error ? 'border-red-500 dark:border-red-500' : '',
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
    </div>
  );
}

// --- Textarea ---
interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className, ...props }: TextareaFieldProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      )}
      <textarea
        className={cn(
          'w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-900 text-base sm:text-xs transition-colors outline-none resize-y',
          'dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-zinc-100 dark:placeholder:text-zinc-500',
          'placeholder:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600',
          'focus:border-zinc-950 focus:ring-1 focus:ring-zinc-950 dark:focus:border-zinc-300 dark:focus:ring-zinc-300',
          error ? 'border-red-500 dark:border-red-500' : '',
          className
        )}
        rows={3}
        {...props}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400 font-medium">{error}</p>}
    </div>
  );
}

// --- Modal ---
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  zIndex?: string;
}

const modalSizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

export function Modal({ isOpen, onClose, title, children, size = 'md', zIndex = 'z-[100]' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className={cn('fixed inset-0 flex items-center justify-center p-3 sm:p-4', zIndex)}>
      <div className="fixed inset-0 bg-zinc-950/40 dark:bg-black/70 backdrop-blur-xs" onClick={onClose} />
      <div
        className={cn(
          'relative w-full rounded-2xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 max-h-[92vh] flex flex-col shadow-xl animate-fade-in',
          modalSizes[size]
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h3 className="text-sm font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}

// --- Confirm Dialog ---
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger' }: ConfirmDialogProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm" zIndex="z-[120]">
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="w-9 h-9 rounded-full bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {message}
          </p>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant={variant === 'danger' ? 'danger' : 'primary'} size="sm" onClick={handleConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --- Badge ---
interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

const badgeStyles = {
  default: 'bg-zinc-100 text-zinc-700 border border-zinc-200/60 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60',
  warning: 'bg-amber-50 text-amber-800 border border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60',
  danger: 'bg-red-50 text-red-700 border border-red-200/60 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/60',
  info: 'bg-blue-50 text-blue-700 border border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60',
};

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium', badgeStyles[variant], className)}>
      {children}
    </span>
  );
}

// --- Empty State ---
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && (
        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3 text-zinc-600 dark:text-zinc-400">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      {description && (
        <p className="text-xs mt-1 max-w-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// --- Loading Spinner ---
export function LoadingSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <Loader2 className="w-6 h-6 animate-spin text-zinc-400 dark:text-zinc-600" />
    </div>
  );
}

// --- Page Header ---
interface PageHeaderProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-zinc-200/60 dark:border-zinc-800">
      <div>
        {title && <h1 className="text-base sm:text-lg font-bold tracking-tight text-zinc-950 dark:text-zinc-50">{title}</h1>}
        {description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

// --- Tabs ---
interface TabsProps {
  tabs: { key: string; label: string; count?: number }[];
  activeTab: string;
  onChange: (key: string) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex gap-1 p-1 rounded-lg bg-zinc-100/90 border border-zinc-200/70 dark:bg-zinc-900 dark:border-zinc-800 overflow-x-auto max-w-full">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'px-2.5 sm:px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0',
            activeTab === tab.key
              ? 'bg-white text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50 shadow-xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-[10px] opacity-60">({tab.count})</span>
          )}
        </button>
      ))}
    </div>
  );
}
