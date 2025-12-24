-- Create device_tokens table for storing FCM tokens linked to phone numbers
CREATE TABLE public.device_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  phone_suffix TEXT NOT NULL,
  fcm_token TEXT NOT NULL,
  device_platform TEXT DEFAULT 'android',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, fcm_token)
);

-- Enable RLS
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own device tokens
CREATE POLICY "Users can manage own device tokens"
ON public.device_tokens
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- System can read all tokens for sending notifications
CREATE POLICY "System can read all device tokens"
ON public.device_tokens
FOR SELECT
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_device_tokens_updated_at
BEFORE UPDATE ON public.device_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();