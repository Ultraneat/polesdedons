const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `
              const mappedAppMsgs = appMsgs.map((m: any) => {
                const app = userApps.find((a: any) => a.id === m.application_id);
                return {
                  ...m,
                  donation_id: app ? app.donation_id : null
                };
              });
              allMessages.push(...mappedAppMsgs);
`;

const replacement = `
              const mappedAppMsgs = appMsgs.map((m: any) => {
                const app = userApps.find((a: any) => a.id === m.application_id);
                return {
                  ...m,
                  donation_id: app ? app.donation_id : null
                };
              });
              // Deduplicate app messages against direct messages (they share same IDs if synced)
              mappedAppMsgs.forEach((m: any) => {
                if (!allMessages.some(am => am.id === m.id)) {
                  allMessages.push(m);
                }
              });
`;

code = code.replace(target, replacement);

fs.writeFileSync('server.ts', code);
