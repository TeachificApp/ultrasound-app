import { readFileSync } from 'fs';

const catalog = readFileSync('client/src/pages/admin/LandingPageBuilder.tsx', 'utf8');
const preview = readFileSync('client/src/components/BlockPreview.tsx', 'utf8');
const lessonEditor = readFileSync('client/src/components/LessonBlockEditor.tsx', 'utf8');
const emailEditor = readFileSync('client/src/components/EmailBlockEditor.tsx', 'utf8');
const assignmentEditor = readFileSync('client/src/components/AssignmentBlockEditor.tsx', 'utf8');
const coursePlayer = readFileSync('client/src/pages/CoursePlayer.tsx', 'utf8');

// Extract types from BLOCK_CATALOG
const catalogTypes = [...catalog.matchAll(/\{ type: "([^"]+)"/g)].map(m => m[1]);
const uniqueCatalog = [...new Set(catalogTypes)].sort();

// Extract cases from each file
const previewCases = new Set([...preview.matchAll(/case "([^"]+)":/g)].map(m => m[1]));
const lessonCases = new Set([...lessonEditor.matchAll(/case "([^"]+)":/g)].map(m => m[1]));
const emailCases = new Set([...emailEditor.matchAll(/case "([^"]+)":/g)].map(m => m[1]));
const assignmentCases = new Set([...assignmentEditor.matchAll(/case "([^"]+)":/g)].map(m => m[1]));
const playerCases = new Set([...coursePlayer.matchAll(/case "([^"]+)":/g)].map(m => m[1]));

console.log('=== BLOCK TYPE COVERAGE AUDIT ===\n');
console.log('Total catalog types:', uniqueCatalog.length);
console.log('');

// Check which catalog types are missing from BlockPreview
const missingPreview = uniqueCatalog.filter(t => !previewCases.has(t));
console.log('Missing from BlockPreview (', missingPreview.length, '):');
missingPreview.forEach(t => console.log('  -', t));

console.log('');
// Check which catalog types are missing from LessonBlockEditor
const missingLesson = uniqueCatalog.filter(t => !lessonCases.has(t));
console.log('Missing from LessonBlockEditor (', missingLesson.length, '):');
missingLesson.forEach(t => console.log('  -', t));

console.log('');
// Check which catalog types are missing from EmailBlockEditor
const missingEmail = uniqueCatalog.filter(t => !emailCases.has(t));
console.log('Missing from EmailBlockEditor (', missingEmail.length, '):');
missingEmail.forEach(t => console.log('  -', t));

console.log('');
console.log('=== ALL CATALOG TYPES ===');
uniqueCatalog.forEach(t => {
  const inPreview = previewCases.has(t) ? '✓' : '✗';
  const inLesson = lessonCases.has(t) ? '✓' : '✗';
  const inEmail = emailCases.has(t) ? '✓' : '✗';
  const inAssignment = assignmentCases.has(t) ? '✓' : '✗';
  console.log(`  ${t.padEnd(35)} Preview:${inPreview} Lesson:${inLesson} Email:${inEmail} Assignment:${inAssignment}`);
});
