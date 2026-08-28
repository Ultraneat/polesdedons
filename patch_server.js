const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// We will replace POST /api/messages emitting logic to hydrate the payload
// And syncAgentConversationToApplication emitting logic
// And POST /api/agent-conversations/:donation_id emitting logic
