import type { ReactNode } from 'react';
import { MedievalButton } from './MedievalButton';

interface Props {
  title: string;
  children: ReactNode;
  onBack?: () => void;
  width?: string;
}

/** Moldura padrão das telas de menu (título + conteúdo + voltar). */
export function ScreenFrame({ title, children, onBack, width = 'max-w-2xl' }: Props) {
  return (
    <div className="menu-backdrop flex h-full w-full items-center justify-center p-4">
      <div className={`panel-wood flex max-h-full w-full ${width} flex-col p-6`}>
        <h1 className="title-engraved mb-4 text-center text-2xl">{title}</h1>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
        {onBack && (
          <div className="mt-5 flex justify-center">
            <MedievalButton onClick={onBack}>Voltar</MedievalButton>
          </div>
        )}
      </div>
    </div>
  );
}
