import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  onClick?: () => void;
}

export function Card({ children, className = '', hoverable = false, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] ${hoverable ? 'transition-all duration-200 hover:border-[var(--border-default)] hover:shadow-[var(--shadow-md)] cursor-pointer' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
