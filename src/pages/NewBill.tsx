import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { BillForm } from "@/components/bills/BillForm";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NewBill() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout hideNav>
      <div className="animate-fade-in pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/bills">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="font-display text-2xl font-bold text-foreground">
            Create Bill
          </h1>
        </div>

        <BillForm />
      </div>
    </AppLayout>
  );
}
