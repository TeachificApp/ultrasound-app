import mysql from 'mysql2/promise';

const url = process.env.RAILWAY_MYSQL_URL || process.env.DATABASE_URL;
if (!url) { console.error('No DB URL'); process.exit(1); }

const conn = await mysql.createConnection(url);

try {
  // Check if columns already exist
  const [rows] = await conn.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'funnel_pages' 
    AND COLUMN_NAME IN ('seo_title','seo_description','seo_image')
  `);
  const existing = rows.map(r => r.COLUMN_NAME);
  console.log('Existing SEO columns:', existing);

  if (!existing.includes('seo_title')) {
    await conn.query(`ALTER TABLE funnel_pages ADD COLUMN seo_title VARCHAR(255) NULL`);
    console.log('✓ Added seo_title');
  }
  if (!existing.includes('seo_description')) {
    await conn.query(`ALTER TABLE funnel_pages ADD COLUMN seo_description TEXT NULL`);
    console.log('✓ Added seo_description');
  }
  if (!existing.includes('seo_image')) {
    await conn.query(`ALTER TABLE funnel_pages ADD COLUMN seo_image VARCHAR(512) NULL`);
    console.log('✓ Added seo_image');
  }
  console.log('Migration complete.');
} finally {
  await conn.end();
}
