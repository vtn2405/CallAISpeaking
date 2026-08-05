import { ReactNode } from 'react';

interface SettingsCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  isDangerZone?: boolean;
}

export function SettingsCard({ title, description, children, isDangerZone }: SettingsCardProps) {
  return (
    <section 
      className={`bg-white rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden ${
        isDangerZone ? 'border border-red-200' : 'border border-hairline'
      }`}
    >
      <div className="p-6 border-b border-hairline bg-white">
        <h2 className={`font-space text-lg font-medium tracking-tight ${isDangerZone ? 'text-red-600' : 'text-charcoal'}`}>
          {title}
        </h2>
        {description && (
          <p className="text-[13px] text-steel mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      <div className="p-6 bg-white flex flex-col gap-5">
        {children}
      </div>
    </section>
  );
}
