-- 010: bookings.updated_at
--
-- Two live handlers reference bookings.updated_at, which never existed:
--   - app/api/booking/cancel/route.ts writes it on cancellation (500)
--   - app/api/booking-links/[id]/bookings/route.ts selects it (500)
--
-- Add the column plus the same BEFORE UPDATE trigger style migration 001 uses
-- for profiles/calendars/events/tasks/etc. (public.update_updated_at()).

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

DROP TRIGGER IF EXISTS update_bookings_updated_at ON public.bookings;
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at();
