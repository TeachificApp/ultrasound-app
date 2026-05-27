import { getDb } from '../server/db.ts';
import { lmsCollections, lmsCollectionCourses, lmsCourses } from '../drizzle/schema.ts';
import { eq, and, asc } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) { console.log('No DB'); process.exit(1); }
  
  // Replicate getCollection logic for SPI (id=3)
  const [col] = await db.select().from(lmsCollections)
    .where(and(eq(lmsCollections.id, 3), eq(lmsCollections.isPublished, true))).limit(1);
  console.log('Collection:', col);
  
  const cc = await db.select().from(lmsCollectionCourses)
    .where(eq(lmsCollectionCourses.collectionId, 3)).orderBy(asc(lmsCollectionCourses.position));
  console.log('Collection courses entries:', cc);
  
  const courses = await Promise.all(cc.map(async ({ courseId }) => {
    const [c] = await db.select().from(lmsCourses)
      .where(and(eq(lmsCourses.id, courseId), eq(lmsCourses.status, 'public'))).limit(1);
    return c ?? null;
  }));
  const filtered = courses.filter(Boolean);
  console.log('Returned courses count:', filtered.length);
  filtered.forEach(c => console.log('  -', c.id, c.title, c.type));
  
  // Also check: what does listCourses return (no filters)?
  const allPublic = await db.select({ id: lmsCourses.id, title: lmsCourses.title, type: lmsCourses.type })
    .from(lmsCourses).where(eq(lmsCourses.status, 'public'));
  console.log('\nAll public courses:', allPublic.length);
  allPublic.forEach(c => console.log('  -', c.id, c.title, c.type));
  
  process.exit(0);
}
main();
