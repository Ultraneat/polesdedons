const fs = require('fs');
let code = fs.readFileSync('src/components/CandidateDashboard.tsx', 'utf8');

const target = `
                    let displayMessages = allUserMessages;
                    if (application) {
                      displayMessages = allUserMessages.filter(m => 
                        m.donation_id === application.donation_id || 
                        m.application_id === application.id
                      );
                    } else if (generalChatDonationId) {
                      displayMessages = allUserMessages.filter(m => 
                        m.donation_id === generalChatDonationId
                      );
                    }
`;

const replacement = `
                    let displayMessages = allUserMessages;
                    if (application) {
                      displayMessages = allUserMessages.filter(m => 
                        m.donation_id === application.donation_id || 
                        m.application_id === application.id
                      );
                    } else {
                      // Unified inbox: Show all messages that are not linked to a specific application,
                      // OR just show everything so the user sees all their Vitrine and General chats.
                      // Let's merge generalChatMessages and allUserMessages just to be safe.
                      const merged = [...allUserMessages];
                      generalChatMessages.forEach(gm => {
                        if (!merged.some(m => m.id === gm.id)) {
                          merged.push(gm);
                        }
                      });
                      displayMessages = merged;
                    }
`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/CandidateDashboard.tsx', code);
