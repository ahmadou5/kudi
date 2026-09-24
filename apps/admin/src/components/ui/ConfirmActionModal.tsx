'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, HelpCircle, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

export interface ConfirmActionModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'destructive' | 'warning';
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmActionModal({
  isOpen,
  title,
  description,
  confirmText = 'Confirm & Proceed',
  cancelText = 'Cancel',
  variant = 'warning',
  isLoading = false,
  onConfirm,
  onCancel
}: ConfirmActionModalProps) {
  if (!isOpen) return null;

  const iconBg =
    variant === 'destructive'
      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
      : variant === 'warning'
      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';

  const confirmButtonVariant = variant === 'destructive' ? 'destructive' : 'primary';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-border/80 bg-background p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl border p-2.5 ${iconBg}`}>
              {variant === 'destructive' ? (
                <ShieldAlert className="h-5 w-5" />
              ) : variant === 'warning' ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <HelpCircle className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-foreground">Confirm Administrative Action</h3>
              <p className="text-[11px] text-muted-foreground font-mono">Operator Authorization Required</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-xl p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="space-y-2 rounded-xl border border-border/60 bg-muted/30 p-4 text-xs">
          <div className="font-bold text-foreground text-sm">{title}</div>
          <p className="text-muted-foreground leading-relaxed">{description}</p>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border/40">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={isLoading} className="text-xs">
            {cancelText}
          </Button>

          <Button
            variant={confirmButtonVariant}
            size="sm"
            onClick={onConfirm}
            disabled={isLoading}
            className="text-xs gap-1.5 font-semibold"
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Processing...
              </span>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
