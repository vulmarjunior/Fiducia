import React from 'react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  isDestructive = true
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-background border border-border rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isDestructive ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-primary/10 text-primary'}`}>
              <AlertCircle size={20} />
            </div>
            <h3 className="text-base font-bold text-foreground">{title}</h3>
          </div>
          <button 
            onClick={onCancel}
            className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-foreground/80 whitespace-pre-wrap">{message}</p>
        </div>
        
        <div className="flex items-center justify-end gap-3 p-4 bg-muted/40 border-t border-border">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground bg-background border border-border hover:bg-muted rounded-xl transition"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-xl transition shadow-sm ${
              isDestructive 
                ? 'bg-red-500 hover:bg-red-600 border border-red-600/20' 
                : 'bg-primary hover:bg-primary/90 border border-primary/20'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
