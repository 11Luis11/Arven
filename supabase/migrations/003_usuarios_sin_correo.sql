-- ============================================================
-- Migración 003 — Crear usuarios del panel sin depender del correo
-- Ejecutar UNA vez en Supabase → SQL Editor.
--
-- Antes, crear un colaborador usaba el registro público de Supabase:
--   • con "Confirm email" activado, Supabase intentaba enviar un correo
--     (límite de pocos correos por hora en el plan gratuito) y la cuenta
--     quedaba sin poder entrar;
--   • además obligaba a dejar abierto el registro público.
-- Ahora un ADMINISTRADOR crea la cuenta directamente, ya confirmada.
-- Después de ejecutar esto puedes DESACTIVAR "Allow new users to sign up".
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT, p_password TEXT, p_name TEXT, p_role TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_id    UUID := gen_random_uuid();
  v_email TEXT := LOWER(TRIM(p_email));
  v_prof  public.profiles;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo un administrador puede crear usuarios'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Correo inválido'; END IF;
  IF LENGTH(COALESCE(p_password, '')) < 6 THEN RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres'; END IF;
  IF p_role NOT IN ('admin', 'employee', 'viewer') THEN RAISE EXCEPTION 'Rol inválido'; END IF;
  IF EXISTS (SELECT 1 FROM auth.users WHERE LOWER(email) = v_email) THEN
    RAISE EXCEPTION 'Ya existe una cuenta con este correo';
  END IF;

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    crypt(p_password, gen_salt('bf')), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('name', p_name), NOW(), NOW(),
    '', '', '', ''
  );

  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (
    gen_random_uuid(), v_id, v_id::TEXT,
    jsonb_build_object('sub', v_id::TEXT, 'email', v_email, 'email_verified', true),
    'email', NOW(), NOW(), NOW()
  );

  -- El trigger on_auth_user_created ya creó el perfil (inactivo): se activa con su rol
  UPDATE public.profiles
     SET name = COALESCE(NULLIF(TRIM(p_name), ''), SPLIT_PART(v_email, '@', 1)), role = p_role, active = TRUE
   WHERE id = v_id
  RETURNING * INTO v_prof;

  RETURN to_jsonb(v_prof);
END $$;

-- Restablecer la contraseña de un usuario (por si la olvida)
CREATE OR REPLACE FUNCTION public.admin_set_password(p_user_id UUID, p_password TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo un administrador puede cambiar contraseñas'; END IF;
  IF LENGTH(COALESCE(p_password, '')) < 6 THEN RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres'; END IF;
  UPDATE auth.users SET encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = NOW() WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuario no encontrado'; END IF;
END $$;

-- Confirmar cuentas que quedaron pendientes por el correo de confirmación
UPDATE auth.users SET email_confirmed_at = NOW() WHERE email_confirmed_at IS NULL;

REVOKE ALL ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_password(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_password(UUID, TEXT) TO authenticated;
