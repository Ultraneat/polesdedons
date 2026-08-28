import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function fix() {
  const { data, error } = await supabase.rpc('execute_sql', { sql: "ALTER TABLE public.agent_conversations ALTER COLUMN user_id TYPE TEXT;" });
  console.log("RPC result:", data, error);
}
fix();
