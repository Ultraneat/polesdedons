import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  'const { data: supConvs } = await supabase.from("agent_conversations").select("id").catch(() => ({ data: [] }));',
  `let supConvs = []; try { const res = await supabase.from("agent_conversations").select("id"); supConvs = res.data || []; } catch(e) {}`
);

code = code.replace(
  'const existingConvIds = new Set((supConvs || []).map(c => c.id));',
  'const existingConvIds = new Set(supConvs.map(c => c.id));'
);

code = code.replace(
  'const { data: supSubs } = await supabase.from("application_submissions").select("id").catch(() => ({ data: [] }));',
  `let supSubs = []; try { const res = await supabase.from("application_submissions").select("id"); supSubs = res.data || []; } catch(e) {}`
);

code = code.replace(
  'const existingSubIds = new Set((supSubs || []).map(s => s.id));',
  'const existingSubIds = new Set(supSubs.map(s => s.id));'
);

fs.writeFileSync('server.ts', code);
