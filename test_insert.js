import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('agent_conversations').insert([{
    donation_id: 'test',
    user_id: 'guest_123456789',
    user_name: 'test',
    content: 'test',
    sender: 'user'
  }]);
  console.log("Insert result:", data, error);
}
test();
