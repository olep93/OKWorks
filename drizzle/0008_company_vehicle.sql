ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS vehicle_name varchar(120);
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS vehicle_fuel_type varchar(16) NOT NULL DEFAULT 'GASOLINE';
ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS vehicle_auto_pass boolean NOT NULL DEFAULT false;
