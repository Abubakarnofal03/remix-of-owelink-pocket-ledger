import { Link, useLocation } from "react-router-dom";
import { Home, Receipt, FileText, Wallet, Users, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/lib/haptics";

const navItems = [
  { path: "/", icon: Home, label: "Home", tourId: "nav-home" },
  { path: "/bills", icon: Receipt, label: "Bills", tourId: "nav-bills" },
  { path: "/ious", icon: FileText, label: "Owes", tourId: "nav-owes" },
  { path: "/expenses", icon: Wallet, label: "Expenses", tourId: "nav-expenses" },
  { path: "/groups", icon: UsersRound, label: "Groups", tourId: "nav-groups" },
  { path: "/contacts", icon: Users, label: "Contacts", tourId: "nav-contacts" },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== "/" && location.pathname.startsWith(item.path));
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => hapticLight()}
              data-tour={item.tourId}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full transition-all duration-200",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div
                className={cn(
                  "relative p-1.5 rounded-xl transition-all duration-200",
                  isActive && "bg-primary/10"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    isActive && "scale-110"
                  )}
                />
              </div>
              <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
