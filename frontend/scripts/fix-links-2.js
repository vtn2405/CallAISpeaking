const fs = require('fs');
let code = fs.readFileSync('e:\\ChatboxAI\\frontend\\app\\page.tsx', 'utf8');

// Use 's' flag so dot matches newlines!
code = code.replace(/<a href="\/login"(.*?)>(.*?)<\/a>/gs, '<Link href="/login"$1>$2</Link>');
code = code.replace(/<a href="\/register"(.*?)>(.*?)<\/a>/gs, '<Link href="/register"$1>$2</Link>');

// Add type="button" to buttons in page.tsx
code = code.replace(/<button id="burger"/g, '<button type="button" id="burger"');
code = code.replace(/<button className="pulsering"/g, '<button type="button" className="pulsering"');
code = code.replace(/<button id="soundBtn"/g, '<button type="button" id="soundBtn"');

fs.writeFileSync('e:\\ChatboxAI\\frontend\\app\\page.tsx', code);
console.log('Fixed tags completely');
