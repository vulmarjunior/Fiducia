import { Info } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';

interface MetricLine {
  label: string;
  value: string;
}

interface MetricExplanationDialogProps {
  title: string;
  description: string;
  formula: string;
  lines: MetricLine[];
  note?: string;
}

export function MetricExplanationDialog({ title, description, formula, lines, note }: MetricExplanationDialogProps) {
  return (
    <Dialog>
      <DialogTrigger render={<button type="button" aria-label={`Entender ${title}`} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" />}>
        <Info className="h-3.5 w-3.5" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="rounded-xl border border-border bg-secondary/40 p-3 font-mono text-xs text-foreground">{formula}</div>
        <dl className="divide-y divide-border rounded-xl border border-border">
          {lines.map((line) => (
            <div key={line.label} className="flex items-center justify-between gap-4 px-3 py-2.5">
              <dt className="text-muted-foreground">{line.label}</dt>
              <dd className="text-right font-mono font-semibold">{line.value}</dd>
            </div>
          ))}
        </dl>
        {note && <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>}
      </DialogContent>
    </Dialog>
  );
}
