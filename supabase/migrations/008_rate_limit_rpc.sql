-- Atomic rate-limit check: resets expired windows and increments in one
-- transaction to eliminate the TOCTOU race in the application-level
-- read-then-write pattern.
CREATE OR REPLACE FUNCTION rate_limit_check(
  p_key text,
  p_limit int,
  p_window_start timestamptz,
  p_now timestamptz
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  v_count int;
BEGIN
  -- Upsert: if the row doesn't exist or the window expired, reset to 1.
  -- Otherwise increment the count. Return the resulting count.
  INSERT INTO rate_limit_entries (key, count, window_start)
  VALUES (p_key, 1, p_now)
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
      WHEN rate_limit_entries.window_start < p_window_start
        THEN 1
      ELSE rate_limit_entries.count + 1
    END,
    window_start = CASE
      WHEN rate_limit_entries.window_start < p_window_start
        THEN p_now
      ELSE rate_limit_entries.window_start
    END
  RETURNING count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;
