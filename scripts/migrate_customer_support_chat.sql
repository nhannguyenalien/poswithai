-- Link hỗ trợ riêng do knowledge-worker cấp cho từng khách hàng.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS support_chat_url TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS support_chat_session TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS support_chat_created_at TIMESTAMPTZ;
