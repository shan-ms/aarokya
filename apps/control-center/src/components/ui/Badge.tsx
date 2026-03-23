'use client';

import { cn } from '@/lib/utils';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  success: 'bg-secondary-50 text-secondary-700 border-secondary-200',
  warning: 'bg-accent-50 text-accent-700 border-accent-200',
  error: 'bg-danger-50 text-danger-700 border-danger-200',
  info: 'bg-primary-50 text-primary-700 border-primary-200',
  neutral: 'bg-gray-50 text-gray-600 border-gray-200',
};

export default function Badge({ variant = 'neutral', children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
