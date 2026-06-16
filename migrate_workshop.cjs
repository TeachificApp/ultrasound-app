const mysql = require('mysql2/promise');
const fs = require('fs');

async function run() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL || process.env.RAILWAY_MYSQL_URL);
  
  // Read the landing_blocks from the file
  const landingBlocks = fs.existsSync('/home/ubuntu/workshop_landing_blocks.json')
    ? fs.readFileSync('/home/ubuntu/workshop_landing_blocks.json', 'utf8')
    : '[]';
  
  // Get the physical product data
  const [rows] = await conn.execute(
    'SELECT * FROM physical_products WHERE slug = ? LIMIT 1',
    ['intro-to-adult-echocardiography-hands-on-workshop']
  );
  
  if (!rows || rows.length === 0) {
    console.log('Physical product not found, checking all physical products...');
    const [all] = await conn.execute('SELECT id, slug, title FROM physical_products LIMIT 20');
    console.log(JSON.stringify(all, null, 2));
    await conn.end();
    return;
  }
  
  const product = rows[0];
  console.log('Found product:', product.id, product.title, product.slug);
  console.log('Price:', product.price, 'Compare at:', product.compare_at_price);
  
  // Check if workshop already exists
  const [existing] = await conn.execute(
    'SELECT id FROM workshops WHERE slug = ? LIMIT 1',
    [product.slug]
  );
  
  if (existing && existing.length > 0) {
    console.log('Workshop already exists with slug:', product.slug);
    await conn.end();
    return;
  }
  
  // Insert the workshop
  const [result] = await conn.execute(
    `INSERT INTO workshops (
      slug, title, subtitle, description, cover_image_url, thumbnail_url,
      status, brand, price, compare_at_price, is_free, currency, pricing_type,
      curriculum_enabled, landing_blocks, landing_headline, landing_body,
      meta_title, meta_description, seo_title, seo_description,
      show_in_library, library_order, is_featured, publish_domain,
      created_by_user_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      product.slug,
      product.title,
      product.subtitle || null,
      product.description || null,
      product.cover_image_url || null,
      product.thumbnail_url || null,
      'public',
      'aaus',
      Math.round(parseFloat(product.price || '0') * 100),
      product.compare_at_price ? Math.round(parseFloat(product.compare_at_price) * 100) : null,
      0, // is_free
      product.currency || 'usd',
      'one_time',
      0, // curriculum_enabled = false initially (no curriculum yet)
      landingBlocks,
      product.landing_headline || null,
      product.landing_body || null,
      product.meta_title || null,
      product.meta_description || null,
      product.seo_title || null,
      product.seo_description || null,
      product.show_in_library !== undefined ? product.show_in_library : 1,
      product.library_order || 0,
      product.is_featured || 0,
      product.publish_domain || null,
      product.created_by_user_id || 1,
    ]
  );
  
  const workshopId = result.insertId;
  console.log('Workshop created with ID:', workshopId);
  
  // Create an initial instance for the August 17-19 Columbus, Ohio workshop
  const [instanceResult] = await conn.execute(
    `INSERT INTO workshop_instances (
      workshop_id, title, location_type, venue_name, venue_city, venue_state, venue_country,
      start_date, end_date, price, available_for_purchase, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      workshopId,
      'August 2025 — Columbus, Ohio',
      'in_person',
      'Columbus, Ohio',
      'Columbus',
      'Ohio',
      'US',
      new Date('2025-08-17T08:00:00Z'),
      new Date('2025-08-19T18:00:00Z'),
      Math.round(parseFloat(product.price || '0') * 100),
      1, // available_for_purchase = true
      'published',
    ]
  );
  
  console.log('Workshop instance created with ID:', instanceResult.insertId);
  
  await conn.end();
  console.log('Migration complete!');
}

run().catch(e => { console.error(e); process.exit(1); });
