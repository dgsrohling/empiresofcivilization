import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  /** Etiqueta exibida quando o botão está desabilitado (ex.: "Fase 5"). */
  badge?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function MedievalButton({ children, badge, size = 'md', className = '', ...rest }: Props) {
  return (
    <button type="button" className={`btn-medieval ${SIZES[size]} ${className}`} {...rest}>
      <span>{children}</span>
      {badge && <span className="rounded-sm border border-brass-dim/70 bg-wood-950/70 px-1.5 py-px font-body text-[10px] tracking-normal text-parchment-dim">{badge}</span>}
    </button>
  );
}
