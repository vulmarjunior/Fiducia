import { HelpCircle, X } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from './ui/dialog';
import { Button } from './ui/button';

interface HelpItem {
  label: string;
  desc: string;
}

interface PageHelpProps {
  title: string;
  description: string;
  items?: HelpItem[];
  relatedPages?: string[];
}

export function PageHelp({ title, description, items, relatedPages }: PageHelpProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-8 h-8 rounded-full bg-secondary/50 dark:bg-secondary/80 text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center justify-center transition-all shrink-0"
        title="Ajuda"
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[95vw] sm:max-w-[420px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl bg-background max-h-[85vh] flex flex-col">
          <DialogHeader className="p-6 pb-0 flex flex-row items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-fiducia-blue/10 text-fiducia-blue flex items-center justify-center shrink-0 mt-0.5">
                <HelpCircle className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">{title}</DialogTitle>
              </div>
            </div>
            <DialogClose className="w-7 h-7 rounded-full bg-secondary/50 dark:bg-secondary/80 text-muted-foreground hover:bg-secondary hover:text-foreground flex items-center justify-center transition-all shrink-0">
              <X className="w-3.5 h-3.5" />
            </DialogClose>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-4 text-sm">
            <p className="text-secondary-foreground leading-relaxed">{description}</p>

            {items && items.length > 0 && (
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="p-3 bg-secondary/50 dark:bg-secondary/80 rounded-xl">
                    <div className="font-semibold text-foreground text-[13px] mb-0.5">{item.label}</div>
                    <div className="text-muted-foreground text-[12px] leading-relaxed">{item.desc}</div>
                  </div>
                ))}
              </div>
            )}

            {relatedPages && relatedPages.length > 0 && (
              <div className="pt-2">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Páginas relacionadas</div>
                <div className="flex flex-wrap gap-1.5">
                  {relatedPages.map((page, i) => (
                    <span key={i} className="px-2 py-1 bg-secondary/50 dark:bg-secondary/80 text-muted-foreground text-[11px] font-medium rounded-lg">
                      {page}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
