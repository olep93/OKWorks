ALTER TABLE order_entries ADD COLUMN IF NOT EXISTS mime_type varchar(160);
ALTER TABLE order_entries ADD COLUMN IF NOT EXISTS file_size integer;
ALTER TABLE order_entries ADD COLUMN IF NOT EXISTS file_data bytea;
