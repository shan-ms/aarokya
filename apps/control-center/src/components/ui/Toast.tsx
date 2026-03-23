'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
}

interface ToastContextType {
  toast: (variant: ToastVariant, title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Return a no-op if context is not available (e.g., during SSR)
    return {
      toast: (_variant: ToastVariant, _title: string, _description?: string) => {
        // no-op
      },
    };
  }
  return ctx;
}

const variantIcon: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle className="h-5 w-5 text-secondary" />,
  error: <XCircle className="h-5 w-5 text-danger" />,
  warning: <AlertTriangle className="h-5 w-5 text-accent" />,
  info: <Info className="h-5 w-5 text-primary" />,
};

const variantBorder: Record<ToastVariant, string> = {
  success: 'border-l-secondary',
  error: 'border-l-danger',
  warning: 'border-l-accent',
  info: 'border-l-primary',
};

function ToastItem({ msg, onDismiss }: { msg: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(msg.id), 4000);
    return () => clearTimeout(timer);
  }, [msg.id, onDismiss]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex w-80 items-start gap-3 rounded-lg border border-gray-200 border-l-4 bg-white p-4 shadow-lg transition-all',
        variantBorder[msg.variant]
      )}
    >
      <div className="flex-shrink-0 pt-0.5">{variantIcon[msg.variant]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{msg.title}</p>
        {msg.description && (
          <p className="mt-0.5 text-xs text-gray-500">{msg.description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(msg.id)}
        className="flex-shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((variant: ToastVariant, title: string, description?: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, variant, title, description }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((msg) => (
          <ToastItem key={msg.id} msg={msg} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
