import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
const base =
  'w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground/70 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive';
export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input data-slot="input" className={cn(base, 'h-10', className)} {...props} />;
}
export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(base, 'min-h-24 resize-y', className)}
      {...props}
    />
  );
}
export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(base, 'h-10', className)} {...props} />;
}
