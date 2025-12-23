-- Add phone_suffix column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_suffix text;
CREATE INDEX IF NOT EXISTS idx_profiles_phone_suffix ON public.profiles(phone_suffix);

-- Add phone_suffix column to contacts
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS phone_suffix text;
CREATE INDEX IF NOT EXISTS idx_contacts_phone_suffix ON public.contacts(phone_suffix);

-- Add phone_suffix column to bill_participants
ALTER TABLE public.bill_participants ADD COLUMN IF NOT EXISTS phone_suffix text;
CREATE INDEX IF NOT EXISTS idx_bill_participants_phone_suffix ON public.bill_participants(phone_suffix);

-- Add phone_suffix column to ious
ALTER TABLE public.ious ADD COLUMN IF NOT EXISTS debtor_phone_suffix text;
CREATE INDEX IF NOT EXISTS idx_ious_debtor_phone_suffix ON public.ious(debtor_phone_suffix);

-- Backfill existing data (extract last 10 digits)
UPDATE public.profiles SET phone_suffix = RIGHT(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) WHERE phone_suffix IS NULL;
UPDATE public.contacts SET phone_suffix = RIGHT(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) WHERE phone_suffix IS NULL;
UPDATE public.bill_participants SET phone_suffix = RIGHT(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) WHERE phone_suffix IS NULL;
UPDATE public.ious SET debtor_phone_suffix = RIGHT(regexp_replace(debtor_phone_number, '[^0-9]', '', 'g'), 10) WHERE debtor_phone_suffix IS NULL;

-- Create function to set phone_suffix automatically
CREATE OR REPLACE FUNCTION public.set_phone_suffix()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'profiles' OR TG_TABLE_NAME = 'contacts' OR TG_TABLE_NAME = 'bill_participants' THEN
    NEW.phone_suffix := RIGHT(regexp_replace(NEW.phone_number, '[^0-9]', '', 'g'), 10);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create function to set debtor phone_suffix for ious
CREATE OR REPLACE FUNCTION public.set_debtor_phone_suffix()
RETURNS TRIGGER AS $$
BEGIN
  NEW.debtor_phone_suffix := RIGHT(regexp_replace(NEW.debtor_phone_number, '[^0-9]', '', 'g'), 10);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for auto-populating phone_suffix
DROP TRIGGER IF EXISTS profiles_phone_suffix_trigger ON public.profiles;
CREATE TRIGGER profiles_phone_suffix_trigger 
  BEFORE INSERT OR UPDATE OF phone_number ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_phone_suffix();

DROP TRIGGER IF EXISTS contacts_phone_suffix_trigger ON public.contacts;
CREATE TRIGGER contacts_phone_suffix_trigger 
  BEFORE INSERT OR UPDATE OF phone_number ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_phone_suffix();

DROP TRIGGER IF EXISTS bill_participants_phone_suffix_trigger ON public.bill_participants;
CREATE TRIGGER bill_participants_phone_suffix_trigger 
  BEFORE INSERT OR UPDATE OF phone_number ON public.bill_participants
  FOR EACH ROW EXECUTE FUNCTION public.set_phone_suffix();

DROP TRIGGER IF EXISTS ious_debtor_phone_suffix_trigger ON public.ious;
CREATE TRIGGER ious_debtor_phone_suffix_trigger 
  BEFORE INSERT OR UPDATE OF debtor_phone_number ON public.ious
  FOR EACH ROW EXECUTE FUNCTION public.set_debtor_phone_suffix();

-- Update link_user_to_existing_records function to use phone_suffix matching
CREATE OR REPLACE FUNCTION public.link_user_to_existing_records()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update get_user_phone to also return phone_suffix
CREATE OR REPLACE FUNCTION public.get_user_phone_suffix(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
    SELECT phone_suffix FROM public.profiles WHERE user_id = _user_id
$$;