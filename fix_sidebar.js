import fs from 'fs';
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

const regex = /<img \s*src=\{platformLogo \|\| "\/assets\/images\/logo_donationsphere_1785861089629\.jpg"\}\s*alt="Logo DonationSphere"\s*onError=\{\(e\) => \{\s*e\.currentTarget\.src = "https:\/\/images\.unsplash\.com\/photo-1488521787991-ed7bbaae773c\?auto=format&fit=crop&q=80&w=200";\s*\}\}\s*className="h-full w-full object-cover"\s*\/>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/;

code = code.replace(regex, `<img 
                  src={platformLogo || "/assets/images/logo_donationsphere_1785861089629.jpg"} 
                  alt="Logo DonationSphere" 
                  onError={(e) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&q=80&w=200";
                  }}
                  className="h-full w-full object-cover"
                />
              </div>`);

fs.writeFileSync('src/components/AdminDashboard.tsx', code);
