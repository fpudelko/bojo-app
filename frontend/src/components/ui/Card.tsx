import React from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
};

export default function Card({
  children,
  header,
  footer,
  className,
  padding = 'md',
  onClick,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden',
        className,
      )}
    >
      {header && (
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">{header}</div>
      )}

      <div className={paddingClasses[padding]}>{children}</div>

      {footer && (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">{footer}</div>
      )}
    </div>
  );
}
