import type { ReactNode } from 'react';

type CardProps = {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
};

export function Card({ title, icon, children, className = '', action }: CardProps) {
  return (
    <section className={`card ${className}`.trim()}>
      <header className="card__header">
        <div className="card__title">
          <span className="card__icon" aria-hidden="true">{icon}</span>
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
