import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.rpc('execute_sql', { sql: "SELECT column_name FROM information_schema.columns WHERE table_name = 'agent_conversations';" });
  console.log("RPC:", data, error);
}
test();
