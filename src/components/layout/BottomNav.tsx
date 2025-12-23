import React, { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Receipt, FileText, Users, Bell, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/bills", icon: Receipt, label: "Bills" },
  { path: "/ious", icon: FileText, label: "IOUs" },
  { path: "/contacts", icon: Users, label: "Contacts" },
  { path: "/notifications", icon: Bell, label: "Alerts" },
] as const;

interface NavItemProps {
  path: string;
  icon: LucideIcon;
  label: string;
  isActive: boolean;
}

const NavItem: React.FC<NavItemProps> = React.memo(({ path, icon: Icon, label, isActive }) => {
  return (
    <Link
      to={path}
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
      <span className="text-[10px] font-medium mt-0.5">{label}</span>
    </Link>
  );
});

NavItem.displayName = "NavItem";

interface BottomNavProps {}

export const BottomNav: React.FC<BottomNavProps> = React.memo(() => {
  const location = useLocation();
  const currentPath = location.pathname;

  const renderedNavItems = useMemo(() => 
    navItems.map((item) => (
      <NavItem
        key={item.path}
        path={item.path}
        icon={item.icon}
        label={item.label}
        isActive={currentPath === item.path}
      />
    )),
    [currentPath]
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-pb">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {renderedNavItems}
      </div>
    </nav>
  );
});

BottomNav.displayName = "BottomNav";
