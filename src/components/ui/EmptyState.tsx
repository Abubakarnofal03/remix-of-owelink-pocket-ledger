import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  children?: ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = React.memo(({
  icon: Icon,
  title,
  description,
  action,
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in",
        className
      )}
    >
      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      <p className="text-muted-foreground text-sm max-w-xs mb-6">{description}</p>
      {action && (
        <Button onClick={action.onClick} size="lg">
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
});

EmptyState.displayName = "EmptyState";
