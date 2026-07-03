-- 014: bookings.booking_link_id → ON DELETE CASCADE
--
-- Migration 001 declared this FK as `on delete cascade`, but the applied local
-- DB drifted to ON DELETE RESTRICT (confdeltype='r'). The effect: deleting a
-- booking page that has ANY bookings fails with FK error 23503, so the settings
-- "Delete booking page" flow (DELETE /api/booking-links/[id]) 500s the moment
-- anyone has booked. Recreate the constraint with cascade to match the intended
-- schema — deleting a link removes its bookings.
ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_booking_link_id_fkey;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_booking_link_id_fkey
  FOREIGN KEY (booking_link_id)
  REFERENCES public.booking_links(id)
  ON DELETE CASCADE;
