-- 051: Optional venue (boisko) attached to a group. field_id links to the
-- fields directory; field_name is denormalized for display so listing a group
-- doesn't require a join.

ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS field_id UUID REFERENCES fields(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS field_name TEXT;
