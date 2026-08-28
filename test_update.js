import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://kkcvaklqgacdoxwnsglv.supabase.co";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY3Zha2xxZ2FjZG94d25zZ2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NDg0MTgsImV4cCI6MjEwMzQyNDQxOH0.444gr5pXns3Iy9obEm1NkWM0TtO5N1C-amtId0gZFP8";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY3Zha2xxZ2FjZG94d25zZ2x2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Nzg0ODQxOCwiZXhwIjoyMTAzNDI0NDE4fQ.zcLmweM5927EFusMDVXPun5yyGcMv-T9TWlJbLID33o";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

async function test() {
  const id = '221dcbb9-6eef-4f21-bb34-756aecac0785'; // A testimonial with approved: false
  const { data, error } = await supabase
    .from("testimonials")
    .update({ approved: true })
    .eq("id", id)
    .select();
  
  console.log("Update result:", data, error);
}
test();
