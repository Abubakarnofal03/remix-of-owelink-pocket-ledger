import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MatchRequest {
  phone_suffixes: string[];
}

interface MatchedContact {
  user_id: string;
  phone_number: string;
  phone_suffix: string;
  username: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user's token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Matching contacts for user: ${user.id}`);

    // Parse request body
    const body: MatchRequest = await req.json();
    const { phone_suffixes } = body;

    if (!phone_suffixes || !Array.isArray(phone_suffixes)) {
      return new Response(
        JSON.stringify({ error: 'phone_suffixes array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (phone_suffixes.length === 0) {
      return new Response(
        JSON.stringify({ matched: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit to 500 phone numbers per request for performance
    const limitedSuffixes = phone_suffixes.slice(0, 500);
    console.log(`Matching ${limitedSuffixes.length} phone suffixes`);

    // Query profiles that match any of the phone suffixes
    // Exclude the current user from results
    const { data: matchedProfiles, error: queryError } = await supabase
      .from('profiles')
      .select('user_id, phone_number, phone_suffix, username')
      .in('phone_suffix', limitedSuffixes)
      .neq('user_id', user.id);

    if (queryError) {
      console.error('Query error:', queryError);
      return new Response(
        JSON.stringify({ error: 'Failed to match contacts' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${matchedProfiles?.length || 0} matched contacts`);

    // Return matched profiles directly - nicknames will be applied client-side from local storage
    const matchedContacts: MatchedContact[] = (matchedProfiles || []).map(profile => ({
      user_id: profile.user_id,
      phone_number: profile.phone_number,
      phone_suffix: profile.phone_suffix,
      username: profile.username,
    }));

    return new Response(
      JSON.stringify({ matched: matchedContacts }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
