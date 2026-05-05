import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const sqls = [
  `CREATE TABLE IF NOT EXISTS digital_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(255) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(500),
    description LONGTEXT,
    thumbnail_url TEXT,
    price INT NOT NULL DEFAULT 0,
    is_free BOOLEAN NOT NULL DEFAULT FALSE,
    currency VARCHAR(8) NOT NULL DEFAULT 'usd',
    status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
    landing_headline VARCHAR(500),
    landing_body LONGTEXT,
    landing_features LONGTEXT,
    meta_title VARCHAR(255),
    meta_description TEXT,
    download_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS digital_product_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_url TEXT NOT NULL,
    file_key VARCHAR(500) NOT NULL,
    file_size INT NOT NULL DEFAULT 0,
    mime_type VARCHAR(100),
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX idx_product_id (product_id)
  )`,
  `CREATE TABLE IF NOT EXISTS digital_purchases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_id INT NOT NULL,
    stripe_payment_intent_id VARCHAR(255),
    stripe_checkout_session_id VARCHAR(255),
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    INDEX idx_user_product (user_id, product_id)
  )`
];

for (const sql of sqls) {
  await conn.execute(sql);
  console.log("✓", sql.slice(0, 60));
}
await conn.end();
console.log("Done — digital downloads tables created");
