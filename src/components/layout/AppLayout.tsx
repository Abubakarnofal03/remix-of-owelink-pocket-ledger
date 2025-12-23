import { ReactNode } from "react";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container px-4 pb-24 pt-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
