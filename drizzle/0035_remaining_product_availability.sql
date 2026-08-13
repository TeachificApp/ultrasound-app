-- Extend remaining purchasable product status fields with consistent availability states.
ALTER TABLE digital_products MODIFY COLUMN status ENUM('draft','published','hidden','private','archived','enrollment_closed','waitlist','presale') NOT NULL DEFAULT 'draft';
ALTER TABLE bundles MODIFY COLUMN status ENUM('draft','published','enrollment_closed','waitlist','presale') NOT NULL DEFAULT 'draft';
ALTER TABLE membership_plans MODIFY COLUMN status ENUM('draft','published','enrollment_closed','waitlist','presale') NOT NULL DEFAULT 'draft';
ALTER TABLE standalone_quizzes MODIFY COLUMN status ENUM('draft','published','archived','enrollment_closed','waitlist','presale') NOT NULL DEFAULT 'draft';
