import React from 'react';
import { clsx } from 'clsx';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-700 text-white hover:bg-primary-800 focus:ring-primary-600 border border-transparent shadow-sm',
  secondary:
    'bg-white dark:bg-slate-800 text-primary-700 hover:bg-primary-50 dark:hover:bg-slate-700 focus:ring-primary-500 border border-transparent shadow-sm',
  accent:
    'bg-accent-500 text-primary-950 hover:bg-accent-400 focus:ring-accent-500 border border-transparent shadow-sm font-semibold',
  outline:
    'bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus:ring-slate-400 border border-slate-300 dark:border-slate-600',
  ghost:
    'bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-slate-400 border border-transparent',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  // HTML domyślnie nadaje przyciskowi `type="submit"`, więc KAŻDY Button
  // wewnątrz formularza bez jawnego `type` wysyłał ten formularz. W kreatorze
  // meczu kosztowało to opublikowanie meczu przy kliknięciu „Dalej".
  // Domyślne `button` odwraca tę zasadę: zatwierdzenie wymaga jawnej deklaracji.
  // Wszystkie formularze w repo mają dziś swój `type="submit"` wypisany wprost.
  type = 'button',
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium',
        'transition-[background-color,box-shadow,transform] duration-150 ease-out',
        'active:scale-[0.97] motion-reduce:active:scale-100',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
