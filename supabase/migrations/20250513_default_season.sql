-- Add a default active season for testing
INSERT INTO seasons (
  name, 
  description, 
  start_date, 
  end_date, 
  status
) VALUES (
  'Season of Elements', 
  'The inaugural season of the Rock Paper Scissors Championship!', 
  NOW(), 
  NOW() + INTERVAL '28 days', 
  'active'
)
ON CONFLICT DO NOTHING;