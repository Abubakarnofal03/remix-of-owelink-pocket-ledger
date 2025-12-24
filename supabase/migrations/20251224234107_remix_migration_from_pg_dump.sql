CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql" WITH SCHEMA "pg_catalog";
CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'admin',
    'user'
);


--
-- Name: get_user_phone(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_phone(_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT phone_number FROM public.profiles WHERE user_id = _user_id
$$;


--
-- Name: get_user_phone_suffix(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_phone_suffix(_user_id uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT phone_suffix FROM public.profiles WHERE user_id = _user_id
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = _user_id AND role = _role
    )
$$;


--
-- Name: is_bill_creator(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_bill_creator(bill_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM bills 
    WHERE id = bill_id AND creator_id = auth.uid()
  );
$$;


--
-- Name: is_bill_participant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_bill_participant(bill_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
  SELECT EXISTS (
    SELECT 1
    FROM public.bill_participants bp
    WHERE bp.bill_id = $1
      AND (
        bp.user_id = auth.uid()
        OR COALESCE(bp.phone_suffix, RIGHT(regexp_replace(bp.phone_number, '[^0-9]', '', 'g'), 10)) = public.get_user_phone_suffix(auth.uid())
      )
  );
$_$;


--
-- Name: link_user_to_existing_records(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_user_to_existing_records() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    user_phone_suffix TEXT;
BEGIN
    user_phone_suffix := NEW.phone_suffix;
    
    -- Link bill participants by phone_suffix
    UPDATE public.bill_participants 
    SET user_id = NEW.user_id 
    WHERE phone_suffix = user_phone_suffix AND user_id IS NULL;
    
    -- Link IOUs by debtor_phone_suffix
    UPDATE public.ious 
    SET debtor_user_id = NEW.user_id 
    WHERE debtor_phone_suffix = user_phone_suffix AND debtor_user_id IS NULL;
    
    -- Link Invoices by phone_suffix (need to add column later if needed)
    UPDATE public.invoices 
    SET client_user_id = NEW.user_id 
    WHERE RIGHT(regexp_replace(client_phone_number, '[^0-9]', '', 'g'), 10) = user_phone_suffix 
      AND client_user_id IS NULL;
    
    -- Link Contacts by phone_suffix
    UPDATE public.contacts 
    SET linked_profile_id = NEW.id 
    WHERE phone_suffix = user_phone_suffix AND linked_profile_id IS NULL;
    
    RETURN NEW;
END;
$$;


--
-- Name: set_debtor_phone_suffix(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_debtor_phone_suffix() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.debtor_phone_suffix := RIGHT(regexp_replace(NEW.debtor_phone_number, '[^0-9]', '', 'g'), 10);
  RETURN NEW;
END;
$$;


--
-- Name: set_phone_suffix(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_phone_suffix() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF TG_TABLE_NAME = 'profiles' OR TG_TABLE_NAME = 'contacts' OR TG_TABLE_NAME = 'bill_participants' THEN
    NEW.phone_suffix := RIGHT(regexp_replace(NEW.phone_number, '[^0-9]', '', 'g'), 10);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bill_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bill_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bill_id uuid NOT NULL,
    phone_number text NOT NULL,
    user_id uuid,
    amount_owed numeric(12,2) NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone_suffix text,
    CONSTRAINT bill_participants_amount_owed_check CHECK ((amount_owed >= (0)::numeric)),
    CONSTRAINT bill_participants_amount_paid_check CHECK ((amount_paid >= (0)::numeric)),
    CONSTRAINT bill_participants_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partial'::text, 'paid'::text])))
);


--
-- Name: bills; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bills (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    title text NOT NULL,
    description text,
    total_amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    due_date timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT bills_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partial'::text, 'paid'::text, 'overdue'::text]))),
    CONSTRAINT bills_total_amount_check CHECK ((total_amount > (0)::numeric))
);


--
-- Name: contacts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    phone_number text NOT NULL,
    nickname text,
    linked_profile_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone_suffix text
);


--
-- Name: device_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    phone_suffix text NOT NULL,
    fcm_token text NOT NULL,
    device_platform text DEFAULT 'android'::text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creator_id uuid NOT NULL,
    client_phone_number text NOT NULL,
    client_user_id uuid,
    invoice_number text NOT NULL,
    title text NOT NULL,
    description text,
    total_amount numeric(12,2) NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    due_date timestamp with time zone NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT invoices_amount_paid_check CHECK ((amount_paid >= (0)::numeric)),
    CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partial'::text, 'paid'::text, 'overdue'::text]))),
    CONSTRAINT invoices_total_amount_check CHECK ((total_amount > (0)::numeric))
);


--
-- Name: ious; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ious (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    creditor_id uuid NOT NULL,
    debtor_phone_number text NOT NULL,
    debtor_user_id uuid,
    amount numeric(12,2) NOT NULL,
    amount_paid numeric(12,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    description text,
    due_date timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    debtor_phone_suffix text,
    CONSTRAINT ious_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT ious_amount_paid_check CHECK ((amount_paid >= (0)::numeric)),
    CONSTRAINT ious_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'partial'::text, 'paid'::text])))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    type text NOT NULL,
    reference_type text,
    reference_id uuid,
    read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['bill'::text, 'iou'::text, 'invoice'::text, 'payment'::text, 'reminder'::text, 'system'::text])))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    payer_id uuid,
    payer_phone_number text NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    reference_type text NOT NULL,
    reference_id uuid NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payments_reference_type_check CHECK ((reference_type = ANY (ARRAY['bill'::text, 'iou'::text, 'invoice'::text])))
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    username text NOT NULL,
    phone_number text NOT NULL,
    avatar_url text,
    business_mode_enabled boolean DEFAULT false NOT NULL,
    notification_preferences jsonb DEFAULT '{"push": true, "in_app": true}'::jsonb,
    settings jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone_suffix text
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: activity_logs activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);


--
-- Name: bill_participants bill_participants_bill_id_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_participants
    ADD CONSTRAINT bill_participants_bill_id_phone_number_key UNIQUE (bill_id, phone_number);


--
-- Name: bill_participants bill_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_participants
    ADD CONSTRAINT bill_participants_pkey PRIMARY KEY (id);


--
-- Name: bills bills_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_pkey PRIMARY KEY (id);


--
-- Name: contacts contacts_user_id_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_user_id_phone_number_key UNIQUE (user_id, phone_number);


--
-- Name: device_tokens device_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_pkey PRIMARY KEY (id);


--
-- Name: device_tokens device_tokens_user_id_fcm_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_tokens
    ADD CONSTRAINT device_tokens_user_id_fcm_token_key UNIQUE (user_id, fcm_token);


--
-- Name: invoices invoices_creator_id_invoice_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_creator_id_invoice_number_key UNIQUE (creator_id, invoice_number);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: ious ious_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ious
    ADD CONSTRAINT ious_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_phone_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_phone_number_key UNIQUE (phone_number);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: idx_activity_logs_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_entity ON public.activity_logs USING btree (entity_type, entity_id);


--
-- Name: idx_bill_participants_bill; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bill_participants_bill ON public.bill_participants USING btree (bill_id);


--
-- Name: idx_bill_participants_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bill_participants_phone ON public.bill_participants USING btree (phone_number);


--
-- Name: idx_bill_participants_phone_suffix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bill_participants_phone_suffix ON public.bill_participants USING btree (phone_suffix);


--
-- Name: idx_bill_participants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bill_participants_user ON public.bill_participants USING btree (user_id);


--
-- Name: idx_bills_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bills_creator ON public.bills USING btree (creator_id);


--
-- Name: idx_bills_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bills_status ON public.bills USING btree (status) WHERE (deleted_at IS NULL);


--
-- Name: idx_contacts_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_phone ON public.contacts USING btree (phone_number);


--
-- Name: idx_contacts_phone_suffix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_phone_suffix ON public.contacts USING btree (phone_suffix);


--
-- Name: idx_contacts_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contacts_user_id ON public.contacts USING btree (user_id);


--
-- Name: idx_invoices_client_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_client_phone ON public.invoices USING btree (client_phone_number);


--
-- Name: idx_invoices_creator; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_creator ON public.invoices USING btree (creator_id);


--
-- Name: idx_ious_creditor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ious_creditor ON public.ious USING btree (creditor_id);


--
-- Name: idx_ious_debtor_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ious_debtor_phone ON public.ious USING btree (debtor_phone_number);


--
-- Name: idx_ious_debtor_phone_suffix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ious_debtor_phone_suffix ON public.ious USING btree (debtor_phone_suffix);


--
-- Name: idx_ious_debtor_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ious_debtor_user ON public.ious USING btree (debtor_user_id);


--
-- Name: idx_notifications_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, read);


--
-- Name: idx_payments_reference; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_reference ON public.payments USING btree (reference_type, reference_id);


--
-- Name: idx_profiles_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_phone ON public.profiles USING btree (phone_number);


--
-- Name: idx_profiles_phone_suffix; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profiles_phone_suffix ON public.profiles USING btree (phone_suffix);


--
-- Name: bill_participants bill_participants_phone_suffix_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bill_participants_phone_suffix_trigger BEFORE INSERT OR UPDATE OF phone_number ON public.bill_participants FOR EACH ROW EXECUTE FUNCTION public.set_phone_suffix();


--
-- Name: contacts contacts_phone_suffix_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER contacts_phone_suffix_trigger BEFORE INSERT OR UPDATE OF phone_number ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.set_phone_suffix();


--
-- Name: ious ious_debtor_phone_suffix_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ious_debtor_phone_suffix_trigger BEFORE INSERT OR UPDATE OF debtor_phone_number ON public.ious FOR EACH ROW EXECUTE FUNCTION public.set_debtor_phone_suffix();


--
-- Name: profiles on_profile_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_profile_created AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.link_user_to_existing_records();


--
-- Name: profiles profiles_phone_suffix_trigger; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_phone_suffix_trigger BEFORE INSERT OR UPDATE OF phone_number ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_phone_suffix();


--
-- Name: bill_participants update_bill_participants_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bill_participants_updated_at BEFORE UPDATE ON public.bill_participants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: bills update_bills_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_bills_updated_at BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: contacts update_contacts_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: device_tokens update_device_tokens_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_device_tokens_updated_at BEFORE UPDATE ON public.device_tokens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: invoices update_invoices_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: ious update_ious_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_ious_updated_at BEFORE UPDATE ON public.ious FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: activity_logs activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: bill_participants bill_participants_bill_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_participants
    ADD CONSTRAINT bill_participants_bill_id_fkey FOREIGN KEY (bill_id) REFERENCES public.bills(id) ON DELETE CASCADE;


--
-- Name: bill_participants bill_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bill_participants
    ADD CONSTRAINT bill_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: bills bills_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bills
    ADD CONSTRAINT bills_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: contacts contacts_linked_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_linked_profile_id_fkey FOREIGN KEY (linked_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: contacts contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contacts
    ADD CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_client_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_client_user_id_fkey FOREIGN KEY (client_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: invoices invoices_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ious ious_creditor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ious
    ADD CONSTRAINT ious_creditor_id_fkey FOREIGN KEY (creditor_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: ious ious_debtor_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ious
    ADD CONSTRAINT ious_debtor_user_id_fkey FOREIGN KEY (debtor_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: payments payments_payer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_payer_id_fkey FOREIGN KEY (payer_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: bill_participants Bill creators can manage participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Bill creators can manage participants" ON public.bill_participants USING (public.is_bill_creator(bill_id));


--
-- Name: bills Creators can delete their bills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can delete their bills" ON public.bills FOR DELETE TO authenticated USING ((auth.uid() = creator_id));


--
-- Name: invoices Creators can manage invoices; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can manage invoices" ON public.invoices TO authenticated USING ((auth.uid() = creator_id));


--
-- Name: bills Creators can update their bills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creators can update their bills" ON public.bills FOR UPDATE TO authenticated USING ((auth.uid() = creator_id));


--
-- Name: ious Creditors can create IOUs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creditors can create IOUs" ON public.ious FOR INSERT TO authenticated WITH CHECK ((auth.uid() = creditor_id));


--
-- Name: ious Creditors can delete IOUs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creditors can delete IOUs" ON public.ious FOR DELETE TO authenticated USING ((auth.uid() = creditor_id));


--
-- Name: ious Creditors can update IOUs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creditors can update IOUs" ON public.ious FOR UPDATE TO authenticated USING ((auth.uid() = creditor_id));


--
-- Name: bill_participants Participants can view own participation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Participants can view own participation" ON public.bill_participants FOR SELECT USING (((user_id = auth.uid()) OR (COALESCE(phone_suffix, "right"(regexp_replace(phone_number, '[^0-9]'::text, ''::text, 'g'::text), 10)) = public.get_user_phone_suffix(auth.uid()))));


--
-- Name: profiles Profiles are viewable by authenticated users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: activity_logs System can create activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create activity logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: notifications System can create notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: device_tokens System can read all device tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can read all device tokens" ON public.device_tokens FOR SELECT USING (true);


--
-- Name: contacts Users can CRUD own contacts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can CRUD own contacts" ON public.contacts TO authenticated USING ((auth.uid() = user_id));


--
-- Name: bills Users can create bills; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create bills" ON public.bills FOR INSERT TO authenticated WITH CHECK ((auth.uid() = creator_id));


--
-- Name: payments Users can create payments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));


--
-- Name: device_tokens Users can manage own device tokens; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage own device tokens" ON public.device_tokens USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = user_id));


--
-- Name: bills Users can view bills they created; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view bills they created" ON public.bills FOR SELECT TO authenticated USING (((auth.uid() = creator_id) AND (deleted_at IS NULL)));


--
-- Name: bills Users can view bills they participate in; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view bills they participate in" ON public.bills FOR SELECT USING (((deleted_at IS NULL) AND public.is_bill_participant(id)));


--
-- Name: activity_logs Users can view own activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own activity" ON public.activity_logs FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT TO authenticated USING ((auth.uid() = user_id));


--
-- Name: user_roles Users can view own roles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ious View IOUs as creditor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View IOUs as creditor" ON public.ious FOR SELECT TO authenticated USING (((auth.uid() = creditor_id) AND (deleted_at IS NULL)));


--
-- Name: ious View IOUs as debtor; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View IOUs as debtor" ON public.ious FOR SELECT USING (((deleted_at IS NULL) AND ((debtor_user_id = auth.uid()) OR (COALESCE(debtor_phone_suffix, "right"(regexp_replace(debtor_phone_number, '[^0-9]'::text, ''::text, 'g'::text), 10)) = public.get_user_phone_suffix(auth.uid())))));


--
-- Name: invoices View invoices as client; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View invoices as client" ON public.invoices FOR SELECT USING (((deleted_at IS NULL) AND ((client_user_id = auth.uid()) OR ("right"(regexp_replace(client_phone_number, '[^0-9]'::text, ''::text, 'g'::text), 10) = public.get_user_phone_suffix(auth.uid())))));


--
-- Name: invoices View invoices as creator; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View invoices as creator" ON public.invoices FOR SELECT TO authenticated USING (((auth.uid() = creator_id) AND (deleted_at IS NULL)));


--
-- Name: payments View payments for own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "View payments for own transactions" ON public.payments FOR SELECT TO authenticated USING (((payer_id = auth.uid()) OR (payer_phone_number = public.get_user_phone(auth.uid())) OR (reference_id IN ( SELECT bills.id
   FROM public.bills
  WHERE (bills.creator_id = auth.uid()))) OR (reference_id IN ( SELECT ious.id
   FROM public.ious
  WHERE (ious.creditor_id = auth.uid()))) OR (reference_id IN ( SELECT invoices.id
   FROM public.invoices
  WHERE (invoices.creator_id = auth.uid())))));


--
-- Name: activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: bill_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bill_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: bills; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

--
-- Name: contacts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

--
-- Name: device_tokens; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: ious; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ious ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: payments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;