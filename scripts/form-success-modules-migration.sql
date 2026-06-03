-- Form Success Modules: multi-path post-submission routing

ALTER TABLE generalFormTemplates
  ADD COLUMN defaultSuccessModuleId INT NULL AFTER successRedirectUrl,
  ADD COLUMN passingScorePercent INT NULL AFTER defaultSuccessModuleId;

CREATE TABLE IF NOT EXISTS generalFormSuccessModules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  templateId INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  moduleType ENUM('inline_message', 'full_page', 'redirect_url') NOT NULL,
  inlineContent LONGTEXT NULL,
  pageContent LONGTEXT NULL,
  redirectUrl VARCHAR(2000) NULL,
  isEnabled TINYINT(1) NOT NULL DEFAULT 1,
  sortOrder INT NOT NULL DEFAULT 0,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_success_modules_template (templateId)
);

CREATE TABLE IF NOT EXISTS generalFormSuccessRoutingRules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  templateId INT NOT NULL,
  ruleLabel VARCHAR(255) NOT NULL DEFAULT '',
  successModuleId INT NOT NULL,
  logicOperator VARCHAR(10) NOT NULL DEFAULT 'all',
  conditions LONGTEXT NOT NULL,
  sortOrder INT NOT NULL DEFAULT 0,
  isEnabled TINYINT(1) NOT NULL DEFAULT 1,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_success_routing_template (templateId),
  INDEX idx_success_routing_module (successModuleId)
);
