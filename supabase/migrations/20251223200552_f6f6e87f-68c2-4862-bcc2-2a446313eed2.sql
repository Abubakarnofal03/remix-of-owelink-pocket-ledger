-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create app role enum for future admin features
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- User roles table (security best practice)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Profiles table for user data
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    phone_number TEXT NOT NULL UNIQUE,
    avatar_url TEXT,
    business_mode_enabled BOOLEAN NOT NULL DEFAULT false,
    notification_preferences JSONB DEFAULT '{"push": true, "in_app": true}'::jsonb,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Contacts table (user's personal contacts with optional nicknames)
CREATE TABLE public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    nickname TEXT,
    linked_profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, phone_number)
);

-- Bills table
CREATE TABLE public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    due_date TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Bill participants (who owes what on a bill)
CREATE TABLE public.bill_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    amount_owed DECIMAL(12, 2) NOT NULL CHECK (amount_owed >= 0),
    amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (bill_id, phone_number)
);

-- IOUs table (simple debt records)
CREATE TABLE public.ious (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creditor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    debtor_phone_number TEXT NOT NULL,
    debtor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Invoices table (business mode)
CREATE TABLE public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_phone_number TEXT NOT NULL,
    client_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount > 0),
    amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (creator_id, invoice_number)
);

-- Payments table (tracks all payments across bills, IOUs, invoices)
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    payer_phone_number TEXT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    reference_type TEXT NOT NULL CHECK (reference_type IN ('bill', 'iou', 'invoice')),
    reference_id UUID NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('bill', 'iou', 'invoice', 'payment', 'reminder', 'system')),
    reference_type TEXT,
    reference_id UUID,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Activity log for audit trail
CREATE TABLE public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ious ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;

-- Function to get current user's phone number
CREATE OR REPLACE FUNCTION public.get_user_phone(_user_id UUID)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT phone_number FROM public.profiles WHERE user_id = _user_id
$$;

-- RLS Policies

-- User Roles
CREATE POLICY "Users can view own roles" ON public.user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- Profiles
CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Contacts
CREATE POLICY "Users can CRUD own contacts" ON public.contacts
    FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Bills
CREATE POLICY "Users can view bills they created" ON public.bills
    FOR SELECT TO authenticated USING (auth.uid() = creator_id AND deleted_at IS NULL);

CREATE POLICY "Users can view bills they participate in" ON public.bills
    FOR SELECT TO authenticated USING (
        deleted_at IS NULL AND
        id IN (
            SELECT bill_id FROM public.bill_participants 
            WHERE user_id = auth.uid() OR phone_number = public.get_user_phone(auth.uid())
        )
    );

CREATE POLICY "Users can create bills" ON public.bills
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their bills" ON public.bills
    FOR UPDATE TO authenticated USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their bills" ON public.bills
    FOR DELETE TO authenticated USING (auth.uid() = creator_id);

-- Bill Participants
CREATE POLICY "View participants of accessible bills" ON public.bill_participants
    FOR SELECT TO authenticated USING (
        bill_id IN (SELECT id FROM public.bills WHERE creator_id = auth.uid()) OR
        user_id = auth.uid() OR 
        phone_number = public.get_user_phone(auth.uid())
    );

CREATE POLICY "Bill creators can manage participants" ON public.bill_participants
    FOR ALL TO authenticated USING (
        bill_id IN (SELECT id FROM public.bills WHERE creator_id = auth.uid())
    );

-- IOUs
CREATE POLICY "View IOUs as creditor" ON public.ious
    FOR SELECT TO authenticated USING (auth.uid() = creditor_id AND deleted_at IS NULL);

CREATE POLICY "View IOUs as debtor" ON public.ious
    FOR SELECT TO authenticated USING (
        deleted_at IS NULL AND
        (debtor_user_id = auth.uid() OR debtor_phone_number = public.get_user_phone(auth.uid()))
    );

CREATE POLICY "Creditors can create IOUs" ON public.ious
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = creditor_id);

CREATE POLICY "Creditors can update IOUs" ON public.ious
    FOR UPDATE TO authenticated USING (auth.uid() = creditor_id);

CREATE POLICY "Creditors can delete IOUs" ON public.ious
    FOR DELETE TO authenticated USING (auth.uid() = creditor_id);

-- Invoices
CREATE POLICY "View invoices as creator" ON public.invoices
    FOR SELECT TO authenticated USING (auth.uid() = creator_id AND deleted_at IS NULL);

CREATE POLICY "View invoices as client" ON public.invoices
    FOR SELECT TO authenticated USING (
        deleted_at IS NULL AND
        (client_user_id = auth.uid() OR client_phone_number = public.get_user_phone(auth.uid()))
    );

CREATE POLICY "Creators can manage invoices" ON public.invoices
    FOR ALL TO authenticated USING (auth.uid() = creator_id);

-- Payments
CREATE POLICY "View payments for own transactions" ON public.payments
    FOR SELECT TO authenticated USING (
        payer_id = auth.uid() OR
        payer_phone_number = public.get_user_phone(auth.uid()) OR
        reference_id IN (SELECT id FROM public.bills WHERE creator_id = auth.uid()) OR
        reference_id IN (SELECT id FROM public.ious WHERE creditor_id = auth.uid()) OR
        reference_id IN (SELECT id FROM public.invoices WHERE creator_id = auth.uid())
    );

CREATE POLICY "Users can create payments" ON public.payments
    FOR INSERT TO authenticated WITH CHECK (true);

-- Notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications" ON public.notifications
    FOR INSERT TO authenticated WITH CHECK (true);

-- Activity Logs
CREATE POLICY "Users can view own activity" ON public.activity_logs
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "System can create activity logs" ON public.activity_logs
    FOR INSERT TO authenticated WITH CHECK (true);

-- Trigger to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, username, phone_number)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', 'User'),
        COALESCE(NEW.raw_user_meta_data->>'phone_number', '')
    );
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to auto-link bill participants when user signs up
CREATE OR REPLACE FUNCTION public.link_user_to_existing_records()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_phone TEXT;
BEGIN
    user_phone := NEW.phone_number;
    
    -- Link bill participants
    UPDATE public.bill_participants 
    SET user_id = NEW.user_id 
    WHERE phone_number = user_phone AND user_id IS NULL;
    
    -- Link IOUs
    UPDATE public.ious 
    SET debtor_user_id = NEW.user_id 
    WHERE debtor_phone_number = user_phone AND debtor_user_id IS NULL;
    
    -- Link Invoices
    UPDATE public.invoices 
    SET client_user_id = NEW.user_id 
    WHERE client_phone_number = user_phone AND client_user_id IS NULL;
    
    -- Link Contacts
    UPDATE public.contacts 
    SET linked_profile_id = NEW.id 
    WHERE phone_number = user_phone AND linked_profile_id IS NULL;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.link_user_to_existing_records();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add update triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bill_participants_updated_at BEFORE UPDATE ON public.bill_participants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ious_updated_at BEFORE UPDATE ON public.ious FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_profiles_phone ON public.profiles(phone_number);
CREATE INDEX idx_contacts_user_id ON public.contacts(user_id);
CREATE INDEX idx_contacts_phone ON public.contacts(phone_number);
CREATE INDEX idx_bills_creator ON public.bills(creator_id);
CREATE INDEX idx_bills_status ON public.bills(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_bill_participants_bill ON public.bill_participants(bill_id);
CREATE INDEX idx_bill_participants_phone ON public.bill_participants(phone_number);
CREATE INDEX idx_bill_participants_user ON public.bill_participants(user_id);
CREATE INDEX idx_ious_creditor ON public.ious(creditor_id);
CREATE INDEX idx_ious_debtor_phone ON public.ious(debtor_phone_number);
CREATE INDEX idx_ious_debtor_user ON public.ious(debtor_user_id);
CREATE INDEX idx_invoices_creator ON public.invoices(creator_id);
CREATE INDEX idx_invoices_client_phone ON public.invoices(client_phone_number);
CREATE INDEX idx_payments_reference ON public.payments(reference_type, reference_id);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, read);
CREATE INDEX idx_activity_logs_entity ON public.activity_logs(entity_type, entity_id);