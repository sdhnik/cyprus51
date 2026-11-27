-- Course GPX for the race abroad (file in storage: gpx/<user id>/abroad-course.gpx).
-- Safe to run more than once.
alter table public.abroad_plans add column if not exists course_gpx text
  check (course_gpx ~ '^[0-9a-f-]{36}/abroad-course\.gpx$');
