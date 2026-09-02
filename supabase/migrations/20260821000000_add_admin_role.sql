-- -----------------------------------------------------------------------------
-- Migration: add_admin_role
-- Introduces an admin flag on profiles plus an is_admin() helper and admin RLS
-- policies so a Next.js admin dashboard can manage catalog data with the same
-- Supabase auth as the mobile app.
--
-- Promote an admin manually (service role / SQL editor):
--   UPDATE public.profiles SET is_admin = TRUE WHERE id = '<user-uuid>';
-- -----------------------------------------------------------------------------

ALTER TABLE profiles ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.is_admin IS 'Grants access to the admin dashboard and admin-only RLS policies.';

-- Helper used by admin RLS policies. SECURITY DEFINER so it can read profiles
-- without the caller having a SELECT policy bypass; it only returns a boolean.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_admin = TRUE
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- -----------------------------------------------------------------------------
-- Admin policies: exercises catalog
-- -----------------------------------------------------------------------------
CREATE POLICY exercises_select_admin ON exercises
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY exercises_insert_admin ON exercises
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY exercises_update_admin ON exercises
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY exercises_delete_admin ON exercises
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- -----------------------------------------------------------------------------
-- Admin policies: exercise translations
-- -----------------------------------------------------------------------------
CREATE POLICY exercise_translations_select_admin ON exercise_translations
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY exercise_translations_modify_admin ON exercise_translations
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- Admin policies: exercise media assets
-- -----------------------------------------------------------------------------
CREATE POLICY exercise_media_assets_select_admin
  ON exercise_media_assets
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY exercise_media_assets_modify_admin
  ON exercise_media_assets
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- -----------------------------------------------------------------------------
-- Admin storage policy: write access to the exercise-media bucket
-- -----------------------------------------------------------------------------
CREATE POLICY "exercise media admin writes"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'exercise-media' AND public.is_admin())
WITH CHECK (bucket_id = 'exercise-media' AND public.is_admin());
