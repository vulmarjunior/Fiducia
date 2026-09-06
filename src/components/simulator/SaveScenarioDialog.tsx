import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { BookmarkPlus, Loader2 } from 'lucide-react';

interface SaveScenarioDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  defaultDescription?: string;
  isSaving: boolean;
  onSave: (name: string, description: string) => Promise<void>;
}

export function SaveScenarioDialog({
  isOpen,
  onOpenChange,
  defaultName = '',
  defaultDescription = '',
  isSaving,
  onSave,
}: SaveScenarioDialogProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState(defaultDescription);

  useEffect(() => {
    if (isOpen) {
      setName(defaultName);
      setDescription(defaultDescription);
    }
  }, [isOpen, defaultName, defaultDescription]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await onSave(name.trim(), description.trim());
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookmarkPlus className="w-5 h-5 text-fiducia-blue" />
              Salvar Cenário de Simulação
            </DialogTitle>
            <DialogDescription>
              Este cenário será salvo na sua conta do Fiducia e ficará disponível em qualquer dispositivo.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">
                Nome do Cenário <span className="text-fiducia-red">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Reforma do Apartamento, Troca de Carro"
                maxLength={100}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-muted-foreground">
                Descrição ou Anotações (opcional)
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Considerando parcelamento em 10x sem juros"
                maxLength={250}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !name.trim()}
              className="gap-1.5 font-bold"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar no Firestore'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
