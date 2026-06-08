/**
 * Debug script: test ZIP streaming on the .quiz file
 */

// Simulate the scormZipStream loadZipDirectory logic
import https from 'https';
import zlib from 'zlib';

const QUIZ_URL = 'https://pub-1f4b81c70d1f49cb8817cc2abbb92288.r2.dev/media-repo/unlimited-registry-review-quiz-pediatric-echo-8384d011/v1-UNLIMITED%20REGISTRY%20REVIEW%20QUIZ%20-%20PEDIATRIC%20ECHO.quiz';

function fetchRange(url, start, end) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { Range: `bytes=${start}-${end}` } }, (res) => {
      if (res.statusCode !== 206 && res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

// Step 1: HEAD to get file size
const fileSize = await new Promise((resolve, reject) => {
  const req = https.request(QUIZ_URL, { method: 'HEAD' }, (res) => {
    const cl = res.headers['content-length'];
    if (cl) resolve(parseInt(cl, 10));
    else reject(new Error('No Content-Length'));
  });
  req.on('error', reject);
  req.end();
});
console.log('File size:', fileSize, 'bytes', `(${(fileSize/1024/1024).toFixed(1)} MB)`);

// Step 2: Fetch last 128KB
const tailSize = Math.min(128 * 1024, fileSize);
const tailStart = fileSize - tailSize;
const tail = await fetchRange(QUIZ_URL, tailStart, fileSize - 1);
console.log('Fetched tail:', tail.length, 'bytes');

// Step 3: Find EOCD
let eocdPos = -1;
for (let i = tail.length - 22; i >= 0; i--) {
  if (tail.readUInt32LE(i) === 0x06054b50) {
    eocdPos = i;
    break;
  }
}
if (eocdPos < 0) { console.error('EOCD not found!'); process.exit(1); }

const entryCount = tail.readUInt16LE(eocdPos + 10);
const cdSize = tail.readUInt32LE(eocdPos + 12);
const cdOffset = tail.readUInt32LE(eocdPos + 16);
console.log(`EOCD: entries=${entryCount}, cdSize=${cdSize}, cdOffset=${cdOffset}`);

// Step 4: Fetch central directory
let cdBuf;
if (cdOffset >= tailStart) {
  const relStart = cdOffset - tailStart;
  cdBuf = tail.slice(relStart, relStart + cdSize);
  console.log('CD within tail buffer');
} else {
  cdBuf = await fetchRange(QUIZ_URL, cdOffset, cdOffset + cdSize - 1);
  console.log('CD fetched separately');
}
console.log('CD buffer size:', cdBuf.length);

// Step 5: Parse entries
const entries = [];
let offset = 0;
while (offset + 46 <= cdBuf.length) {
  const sig = cdBuf.readUInt32LE(offset);
  if (sig !== 0x02014b50) break;
  const method = cdBuf.readUInt16LE(offset + 10);
  const compressedSize = cdBuf.readUInt32LE(offset + 20);
  const uncompressedSize = cdBuf.readUInt32LE(offset + 24);
  const fileNameLen = cdBuf.readUInt16LE(offset + 28);
  const extraLen = cdBuf.readUInt16LE(offset + 30);
  const commentLen = cdBuf.readUInt16LE(offset + 32);
  const localHeaderOffset = cdBuf.readUInt32LE(offset + 42);
  const name = cdBuf.slice(offset + 46, offset + 46 + fileNameLen).toString('utf8');
  if (!name.endsWith('/')) {
    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
  }
  offset += 46 + fileNameLen + extraLen + commentLen;
}

console.log(`\nParsed ${entries.length} entries`);
console.log('First 10 entries:');
entries.slice(0, 10).forEach(e => console.log(`  ${e.name} (method=${e.method}, size=${e.uncompressedSize})`));

// Step 6: Find imsmanifest.xml
const manifest = entries.find(e => e.name.toLowerCase().includes('imsmanifest.xml'));
console.log('\nimsmanifest.xml:', manifest ? manifest.name : 'NOT FOUND');

// Step 7: Find index.html
const index = entries.find(e => e.name.toLowerCase().endsWith('index.html'));
console.log('index.html:', index ? index.name : 'NOT FOUND');

// Step 8: Show all HTML files
const htmlFiles = entries.filter(e => e.name.toLowerCase().endsWith('.html'));
console.log('\nAll HTML files:');
htmlFiles.forEach(e => console.log(`  ${e.name}`));
