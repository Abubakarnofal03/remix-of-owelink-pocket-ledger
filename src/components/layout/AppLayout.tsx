import { ReactNode, memo } from "react";
import { Header } from "./Header";
import { BottomNav } from "./BottomNav";

interface AppLayoutProps {
  children: ReactNode;
  hideNav?: boolean;
}

export const AppLayout = memo(function AppLayout({ children, hideNav }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className={`container px-4 pt-4 ${hideNav ? 'pb-8' : 'pb-24'}`}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
});
