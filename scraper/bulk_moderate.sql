-- Bulk moderation SQL
-- Run in Supabase SQL Editor
-- Order matters: later steps don't overwrite already-set statuses

BEGIN;

-- 1. HIDE: gyms, fitness, climbing walls, anything non-field
UPDATE fields
SET moderation_status = 'hidden',
    map_visibility    = 'hidden'
WHERE moderation_status IS DISTINCT FROM 'approved'
  AND (
    sport && ARRAY['siłownia', 'fitness', 'gym', 'wspinaczka', 'boks', 'sztuki walki', 'taniec']
    OR name  ILIKE '%siłowni%'
    OR name  ILIKE '%fitness%'
    OR name  ILIKE '%gym%'
    OR name  ILIKE '%wspinaczk%'
    OR name  ILIKE '%crossfit%'
    OR name  ILIKE '%trening%'
    OR venue_type IN ('gym', 'fitness')
  );

-- 2. APPROVE: beach volleyball venues
UPDATE fields
SET moderation_status = 'approved',
    map_visibility    = 'public'
WHERE (moderation_status IS NULL OR moderation_status = 'pending')
  AND 'siatkówka plażowa' = ANY(sport);

-- 3. APPROVE: Orliki
UPDATE fields
SET moderation_status = 'approved',
    map_visibility    = 'public'
WHERE (moderation_status IS NULL OR moderation_status = 'pending')
  AND (venue_type = 'orlik' OR name ILIKE '%orlik%');

-- 4. APPROVE: venues with contact data (phone / website / email / description)
UPDATE fields
SET moderation_status = 'approved',
    map_visibility    = 'public'
WHERE (moderation_status IS NULL OR moderation_status = 'pending')
  AND (
    phone       IS NOT NULL
    OR website  IS NOT NULL
    OR email    IS NOT NULL
    OR (description IS NOT NULL AND description <> '')
  );

-- 5. Fix already-approved venues that still have wrong map_visibility
UPDATE fields
SET map_visibility = 'public'
WHERE moderation_status = 'approved'
  AND map_visibility != 'public';

-- 6. Fix hidden venues map_visibility
UPDATE fields
SET map_visibility = 'hidden'
WHERE moderation_status = 'hidden'
  AND map_visibility != 'hidden';

COMMIT;

-- Summary check
SELECT
  COALESCE(moderation_status, 'pending') AS moderation_status,
  map_visibility,
  COUNT(*) AS count
FROM fields
GROUP BY moderation_status, map_visibility
ORDER BY moderation_status, map_visibility;
