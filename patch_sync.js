const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `    if (localDb.applications.length > 0) {
      for (const app of localDb.applications) {
        if (uuidRegex.test(app.id) && uuidRegex.test(app.donation_id) && !existingAppIds.has(app.id)) {
          await supabase.from("applications").insert([app]);
        }
      }
    }
    
    // 4. APPLICATION MESSAGES`;

const replacement = `    if (localDb.applications.length > 0) {
      for (const app of localDb.applications) {
        if (uuidRegex.test(app.id) && uuidRegex.test(app.donation_id) && !existingAppIds.has(app.id)) {
          await supabase.from("applications").insert([app]);
        }
      }
    }

    // 3.5 AGENT CONVERSATIONS (Syncing local agent chats)
    if (localDb.agent_conversations) {
      const { data: supConvs } = await supabase.from("agent_conversations").select("id").catch(() => ({ data: [] }));
      const existingConvIds = new Set((supConvs || []).map(c => c.id));
      for (const donId in localDb.agent_conversations) {
        for (const msg of localDb.agent_conversations[donId]) {
          if (!existingConvIds.has(msg.id)) {
             try {
               await supabase.from("agent_conversations").insert([msg]);
             } catch(e) {}
          }
        }
      }
    }

    // 3.6 APPLICATION SUBMISSIONS
    if (localDb.application_submissions && localDb.application_submissions.length > 0) {
      const { data: supSubs } = await supabase.from("application_submissions").select("id").catch(() => ({ data: [] }));
      const existingSubIds = new Set((supSubs || []).map(s => s.id));
      for (const sub of localDb.application_submissions) {
        if (!existingSubIds.has(sub.id)) {
           try {
             await supabase.from("application_submissions").insert([sub]);
           } catch(e) {}
        }
      }
    }
    
    // 4. APPLICATION MESSAGES`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
