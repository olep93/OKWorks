CREATE TABLE IF NOT EXISTS email_delivery_events (
  event_id varchar(200) PRIMARY KEY,
  provider_message_id varchar(200) NOT NULL,
  event_type varchar(80) NOT NULL,
  payload_created_at timestamptz,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_delivery_events_message_idx
  ON email_delivery_events(provider_message_id, processed_at);

CREATE INDEX IF NOT EXISTS invoice_deliveries_provider_message_idx
  ON invoice_deliveries(provider_message_id);
