import { readFileSync } from 'fs';

const email = readFileSync('client/src/components/EmailBlockEditor.tsx', 'utf8');

// Extract EMAIL_SAFE_TYPES
const safeMatch = email.match(/const EMAIL_SAFE_TYPES[^=]*=\s*\[([\s\S]*?)\];/);
const safeTypes = safeMatch ? [...safeMatch[1].matchAll(/"([^"]+)"/g)].map(m => m[1]) : [];

// Extract emailBlockToHtml cases
const cases = new Set([...email.matchAll(/case "([^"]+)":/g)].map(m => m[1]));

console.log('EMAIL_SAFE_TYPES count:', safeTypes.length);
console.log('');

const missing = safeTypes.filter(t => !cases.has(t));
if (missing.length === 0) {
  console.log('✅ All EMAIL_SAFE_TYPES have emailBlockToHtml cases!');
} else {
  console.log('❌ Missing emailBlockToHtml cases:', missing.join(', '));
}
console.log('');
safeTypes.forEach(t => {
  const has = cases.has(t);
  console.log(has ? '✓' : '✗', t);
});
