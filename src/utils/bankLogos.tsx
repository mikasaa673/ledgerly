// ============================================================
// Ledgerly - Authentic Bank Logos & Presets
// ============================================================

import React from 'react';
import { Landmark, Wallet, Banknote } from 'lucide-react';
import { cn } from './index';

export interface BankPreset {
  key: string;
  name: string;
  shortName: string;
  color: string;
  bgColor: string;
  textColor: string;
  keywords: string[];
}

export const BANK_PRESETS: BankPreset[] = [
  {
    key: 'sbi',
    name: 'State Bank of India',
    shortName: 'SBI',
    color: '#0084ff',
    bgColor: '#1d4ed8',
    textColor: '#ffffff',
    keywords: ['sbi', 'state bank'],
  },
  {
    key: 'kotak',
    name: 'Kotak Mahindra Bank',
    shortName: 'KOTAK',
    color: '#ed1c24',
    bgColor: '#dc2626',
    textColor: '#ffffff',
    keywords: ['kotak', 'mahindra'],
  },
  {
    key: 'indusind',
    name: 'IndusInd Bank',
    shortName: 'INDUSIND',
    color: '#9c1c24',
    bgColor: '#881337',
    textColor: '#ffffff',
    keywords: ['indusind', 'induslnd'],
  },
  {
    key: 'idfc',
    name: 'IDFC FIRST Bank',
    shortName: 'IDFC',
    color: '#9e1b32',
    bgColor: '#9f1239',
    textColor: '#ffffff',
    keywords: ['idfc', 'first bank'],
  },
  {
    key: 'union',
    name: 'Union Bank of India',
    shortName: 'UNION',
    color: '#d32f2f',
    bgColor: '#b91c1c',
    textColor: '#ffffff',
    keywords: ['union bank', 'ubi', 'andhra bank', 'corporation bank'],
  },
  {
    key: 'slice',
    name: 'Slice Bank / Card',
    shortName: 'SLICE',
    color: '#6f32e9',
    bgColor: '#5925dc',
    textColor: '#ffffff',
    keywords: ['slice'],
  },
  {
    key: 'cash',
    name: 'Cash / Physical Wallet',
    shortName: 'CASH',
    color: '#10b981',
    bgColor: '#059669',
    textColor: '#ffffff',
    keywords: ['cash', 'wallet', 'physical', 'hand cash', 'in hand'],
  },
];

/**
 * Auto-detects the matching bank preset key from bank name
 */
export function autoDetectBankLogo(bankName?: string): string {
  if (!bankName) return 'sbi';
  const clean = bankName.toLowerCase().trim();

  for (const preset of BANK_PRESETS) {
    if (preset.keywords.some((k) => clean.includes(k))) {
      return preset.key;
    }
  }

  return 'sbi';
}

/**
 * Get preset metadata by key or name
 */
export function getBankPreset(keyOrName?: string): BankPreset {
  if (!keyOrName) return BANK_PRESETS[0];

  const byKey = BANK_PRESETS.find((p) => p.key === keyOrName.toLowerCase());
  if (byKey) return byKey;

  const detectedKey = autoDetectBankLogo(keyOrName);
  return BANK_PRESETS.find((p) => p.key === detectedKey) || BANK_PRESETS[0];
}

export const KNOWN_LOCAL_LOGOS: Record<string, string> = {
  idfc: '/bank-logos/idfc.png',
  indusind: '/bank-logos/induslnd.jpg',
  induslnd: '/bank-logos/induslnd.jpg',
  kotak: '/bank-logos/kotak.jpg',
  sbi: '/bank-logos/sbi.jpg',
  slice: '/bank-logos/slice.png',
  union: '/bank-logos/union.png',
};

interface BankLogoProps {
  bankName?: string;
  logoKey?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.webp'];

/**
 * High-definition authentic Bank Logo component
 * Automatically displays images from /bank-logos/{key}.png or custom uploaded image
 */
export function BankLogo({ bankName, logoKey, className, size = 'md' }: BankLogoProps) {
  const [imgFailed, setImgFailed] = React.useState(false);
  const [extIndex, setExtIndex] = React.useState(0);

  // Determine preset
  const presetKey = logoKey || autoDetectBankLogo(bankName);
  const preset = getBankPreset(presetKey);

  // Reset imgFailed if key changes
  React.useEffect(() => {
    setImgFailed(false);
    setExtIndex(0);
  }, [logoKey, bankName]);

  const sizeDimensions = {
    sm: 'w-7 h-7 text-[9px] rounded-lg',
    md: 'w-10 h-10 text-[11px] rounded-xl',
    lg: 'w-12 h-12 text-xs rounded-xl',
    xl: 'w-14 h-14 text-sm rounded-2xl',
  };

  // Determine image source candidate
  let candidateSrc: string | null = null;
  if (logoKey && (logoKey.startsWith('http://') || logoKey.startsWith('https://') || logoKey.startsWith('data:') || logoKey.startsWith('/'))) {
    candidateSrc = logoKey;
  } else if (preset.key && preset.key !== 'other') {
    if (KNOWN_LOCAL_LOGOS[preset.key]) {
      candidateSrc = KNOWN_LOCAL_LOGOS[preset.key];
    } else {
      candidateSrc = `/bank-logos/${preset.key}${EXTENSIONS[extIndex]}`;
    }
  }

  const handleImageError = () => {
    if (!KNOWN_LOCAL_LOGOS[preset.key] && extIndex < EXTENSIONS.length - 1) {
      setExtIndex((prev) => prev + 1);
    } else {
      setImgFailed(true);
    }
  };

  if (candidateSrc && !imgFailed) {
    return (
      <div
        className={cn(
          'overflow-hidden shrink-0 flex items-center justify-center select-none p-0 bg-transparent ring-1 ring-black/10 dark:ring-white/10 shadow-xs',
          sizeDimensions[size],
          className
        )}
        title={bankName || preset.name}
      >
        <img
          src={candidateSrc}
          alt={bankName || preset.name}
          className="w-full h-full object-cover block rounded-[inherit]"
          onError={handleImageError}
        />
      </div>
    );
  }

  // Render SVG emblems for known banks
  const renderEmblem = () => {
    switch (preset.key) {
      case 'hdfc':
        return (
          <div className="relative flex items-center justify-center w-full h-full bg-[#004c8f] text-white font-black">
            <svg viewBox="0 0 40 40" className="w-[72%] h-[72%]" fill="none">
              <rect x="2" y="2" width="36" height="36" rx="4" fill="#004c8f" stroke="#dc2626" strokeWidth="3" />
              <rect x="8" y="8" width="24" height="24" fill="#ffffff" />
              <rect x="14" y="14" width="12" height="12" fill="#004c8f" />
              <rect x="18" y="4" width="4" height="8" fill="#dc2626" />
              <rect x="18" y="28" width="4" height="8" fill="#dc2626" />
              <rect x="4" y="18" width="8" height="4" fill="#dc2626" />
              <rect x="28" y="18" width="8" height="4" fill="#dc2626" />
            </svg>
          </div>
        );

      case 'sbi':
        return (
          <div className="relative flex items-center justify-center w-full h-full bg-[#0084ff] text-white font-black">
            <svg viewBox="0 0 40 40" className="w-[78%] h-[78%]" fill="none">
              <circle cx="20" cy="20" r="16" fill="#0284c7" />
              <circle cx="20" cy="18" r="6" fill="#ffffff" />
              <rect x="18" y="18" width="4" height="14" fill="#ffffff" />
            </svg>
          </div>
        );

      case 'icici':
        return (
          <div className="relative flex items-center justify-center w-full h-full bg-gradient-to-br from-[#b91c1c] to-[#ea580c] text-white">
            <svg viewBox="0 0 40 40" className="w-[75%] h-[75%]" fill="none">
              <circle cx="20" cy="20" r="15" stroke="#ffffff" strokeWidth="3" strokeDasharray="60 30" />
              <circle cx="20" cy="12" r="3.5" fill="#ffffff" />
              <path d="M17 19H23V29H17z" fill="#ffffff" />
            </svg>
          </div>
        );

      case 'axis':
        return (
          <div className="relative flex items-center justify-center w-full h-full bg-[#831843] text-white">
            <svg viewBox="0 0 40 40" className="w-[75%] h-[75%]" fill="none">
              {/* Inverted Chevron / A */}
              <path d="M20 7L32 30H24L20 20L16 30H8L20 7Z" fill="#ffffff" />
              <path d="M20 20L24 30H16L20 20Z" fill="#be185d" />
            </svg>
          </div>
        );

      case 'kotak':
        return (
          <div className="relative flex items-center justify-center w-full h-full bg-[#dc2626] text-white">
            <svg viewBox="0 0 40 40" className="w-[75%] h-[75%]" fill="none">
              <path
                d="M12 20C12 16.5 15 14 18 14C22 14 26 26 30 26C33 26 35 23.5 35 20C35 16.5 33 14 30 14C26 14 22 26 18 26C15 26 12 23.5 12 20Z"
                stroke="#ffffff"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
        );

      case 'pnb':
        return (
          <div className="relative flex items-center justify-center w-full h-full bg-[#9f1239] text-white">
            <svg viewBox="0 0 40 40" className="w-[75%] h-[75%]" fill="none">
              <circle cx="20" cy="20" r="14" fill="#fbbf24" stroke="#ffffff" strokeWidth="2" />
              <circle cx="20" cy="20" r="8" fill="#9f1239" />
              <rect x="18" y="10" width="4" height="20" fill="#ffffff" />
            </svg>
          </div>
        );

      case 'bob':
        return (
          <div className="relative flex items-center justify-center w-full h-full bg-gradient-to-tr from-[#ea580c] to-[#f97316] text-white">
            <svg viewBox="0 0 40 40" className="w-[75%] h-[75%]" fill="none">
              <circle cx="16" cy="20" r="8" fill="#ffffff" />
              <circle cx="24" cy="20" r="8" fill="#ffffff" />
              <path d="M20 7L24 15H16L20 7Z" fill="#fef08a" />
              <path d="M20 33L16 25H24L20 33Z" fill="#fef08a" />
            </svg>
          </div>
        );

      case 'canara':
        return (
          <div className="relative flex items-center justify-center w-full h-full bg-[#0284c7] text-white">
            <svg viewBox="0 0 40 40" className="w-[75%] h-[75%]" fill="none">
              <path d="M12 28L24 8L36 28H12Z" fill="#facc15" opacity="0.9" />
              <path d="M8 12L20 32L32 12H8Z" fill="#38bdf8" opacity="0.85" />
            </svg>
          </div>
        );

      case 'union':
        return (
          <div className="relative flex items-center justify-center w-full h-full bg-[#b91c1c] text-white">
            <svg viewBox="0 0 40 40" className="w-[75%] h-[75%]" fill="none">
              <path d="M12 12V22C12 26 15 28 20 28C25 28 28 26 28 22V12H23V21C23 23 22 24 20 24C18 24 17 23 17 21V12H12Z" fill="#ffffff" />
              <path d="M22 14V23C22 26 24 28 28 28V24C26 24 25 23 25 21V14H22Z" fill="#0284c7" />
            </svg>
          </div>
        );

      case 'paytm':
        return (
          <div className="relative flex items-center justify-center w-full h-full bg-[#0369a1] text-white font-bold text-[10px]">
            <span className="tracking-tighter">Pay<span className="text-[#38bdf8]">tm</span></span>
          </div>
        );

      case 'slice':
        return (
          <div className="relative flex items-center justify-center w-full h-full bg-[#5925dc] text-white font-bold text-[10px]">
            <span className="tracking-tight font-extrabold lowercase">slice</span>
          </div>
        );

      case 'airtel':
        return (
          <div className="relative flex items-center justify-center w-full h-full bg-[#dc2626] text-white font-bold text-[11px]">
            <span className="italic tracking-tighter">airtel</span>
          </div>
        );

      case 'cash':
        return (
          <div className="relative flex items-center justify-center w-full h-full bg-emerald-600 text-white">
            <Banknote className="w-[60%] h-[60%]" strokeWidth={2.2} />
          </div>
        );

      default:
        return (
          <div className="relative flex items-center justify-center w-full h-full bg-zinc-800 text-zinc-100 font-bold">
            <Landmark className="w-[55%] h-[55%]" strokeWidth={2} />
          </div>
        );
    }
  };

  return (
    <div
      className={cn(
        'overflow-hidden shrink-0 flex items-center justify-center shadow-xs border border-black/10 dark:border-white/10 select-none',
        sizeDimensions[size],
        className
      )}
      title={bankName || preset.name}
    >
      {renderEmblem()}
    </div>
  );
}
