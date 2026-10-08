-- Naikkan batas foto selfie presensi 1 MB -> 5 MB.
-- Banyak peserta error karena foto HP modern > 1 MB.
-- Edge check-in/check-out (MAX_PHOTO_BYTES) diselaraskan terpisah.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('attendance-photos', 'attendance-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit;
