import { getDb } from '../server/db.ts';
import { lmsCollections, lmsCollectionCourses, lmsCourses } from '../drizzle/schema.ts';
import { eq } from 'drizzle-orm';

async function main() {
  const db = await getDb();
  if (!db) { console.log('No DB'); process.exit(1); }
  
  // SPI collection is id=3 from the previous query
  const cc = await db.select().from(lmsCollectionCourses).where(eq(lmsCollectionCourses.collectionId, 3));
  console.log('SPI collection_courses entries:', cc.length);
  
  for (const item of cc) {
    const [course] = await db.select({ 
      id: lmsCourses.id, 
      title: lmsCourses.title, 
      type: lmsCourses.type, 
      status: lmsCourses.status,
      brand: lmsCourses.brand
    }).from(lmsCourses).where(eq(lmsCourses.id, item.courseId));
    console.log('  Course:', JSON.stringify(course));
  }
  
  // Also check: is the eBook in any collection?
  const allCC = await db.select().from(lmsCollectionCourses);
  const ebook = await db.select({ id: lmsCourses.id, title: lmsCourses.title, type: lmsCourses.type }).from(lmsCourses)
    .where(eq(lmsCourses.id, allCC.find(x => true)?.courseId ?? 0));
  
  // Find the eBook
  const allCourses = await db.select({ id: lmsCourses.id, title: lmsCourses.title, type: lmsCourses.type, status: lmsCourses.status })
    .from(lmsCourses);
  const ebookCourse = allCourses.find(c => c.title.includes('Sonographer') || c.title.includes('CEO'));
  if (ebookCourse) {
    console.log('\neBook course:', JSON.stringify(ebookCourse));
    const ebookInCollections = allCC.filter(x => x.courseId === ebookCourse.id);
    console.log('eBook in collections:', JSON.stringify(ebookInCollections));
  }
  
  process.exit(0);
}
main();
