export interface Profile {
  id: string;
  user_id: string;
  username: string;
  phone_number: string;
  avatar_url: string | null;
  business_mode_enabled: boolean;
  notification_preferences: {
    push: boolean;
    in_app: boolean;
  };
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  phone_number: string;
  nickname: string | null;
  linked_profile_id: string | null;
  linked_profile?: Profile | null;
  created_at: string;
  updated_at: string;
}

export interface Bill {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  total_amount: number;
  currency: string;
  due_date: string | null;
  status: "pending" | "partial" | "paid" | "overdue";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  participants?: BillParticipant[];
  creator?: Profile;
}

export interface BillParticipant {
  id: string;
  bill_id: string;
  phone_number: string;
  user_id: string | null;
  amount_owed: number;
  amount_paid: number;
  status: "pending" | "partial" | "paid";
  created_at: string;
  updated_at: string;
  profile?: Profile | null;
}

export interface IOU {
  id: string;
  creditor_id: string;
  debtor_phone_number: string;
  debtor_user_id: string | null;
  amount: number;
  amount_paid: number;
  currency: string;
  description: string | null;
  due_date: string | null;
  status: "pending" | "partial" | "paid";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  creditor?: Profile;
  debtor?: Profile | null;
}

export interface Invoice {
  id: string;
  creator_id: string;
  client_phone_number: string;
  client_user_id: string | null;
  invoice_number: string;
  title: string;
  description: string | null;
  total_amount: number;
  amount_paid: number;
  currency: string;
  due_date: string;
  status: "pending" | "partial" | "paid" | "overdue";
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  creator?: Profile;
  client?: Profile | null;
}

export interface Payment {
  id: string;
  payer_id: string | null;
  payer_phone_number: string;
  amount: number;
  currency: string;
  reference_type: "bill" | "iou" | "invoice";
  reference_id: string;
  notes: string | null;
  created_at: string;
  payer?: Profile | null;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "bill" | "iou" | "invoice" | "payment" | "reminder" | "system";
  reference_type: string | null;
  reference_id: string | null;
  read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Summary types
export interface DebtSummary {
  totalOwedToYou: number;
  totalYouOwe: number;
  netBalance: number;
  currency: string;
}

export interface PersonDebt {
  phoneNumber: string;
  name: string;
  amount: number;
  currency: string;
  items: DebtItem[];
}

export interface DebtItem {
  id: string;
  type: "bill" | "iou" | "invoice";
  title: string;
  amount: number;
  amountPaid: number;
  remaining: number;
  dueDate: string | null;
  status: string;
  createdAt: string;
}
