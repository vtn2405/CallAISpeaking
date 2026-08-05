const fs = require('fs');
let code = fs.readFileSync('e:\\ChatboxAI\\frontend\\app\\page.tsx', 'utf8');

// Replace all <a href="/login"...> and <a href="/register"...> with <Link>
code = code.replace(/<a href="\/login"(.*?)>(.*?)<\/a>/g, '<Link href="/login"$1>$2</Link>');
code = code.replace(/<a href="\/register"(.*?)>(.*?)<\/a>/g, '<Link href="/register"$1>$2</Link>');

fs.writeFileSync('e:\\ChatboxAI\\frontend\\app\\page.tsx', code);
console.log('Fixed tags');
