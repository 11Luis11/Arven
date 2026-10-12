-- ============================================================
-- CARRILLO STORE — Esquema SEGURO para Supabase (v2)
-- Ejecutar UNA vez en un proyecto NUEVO:
--   Supabase Dashboard → SQL Editor → New query → pegar todo → Run
--
-- Qué cambia frente a supabase_setup.sql (v1):
--   • Login con Supabase Auth: las contraseñas ya no se guardan en la tabla
--     pública `config` (la v1 las exponía a cualquier visitante).
--   • Row Level Security real: el público solo puede LEER catálogo y
--     configuración de la tienda. Ventas, clientes y caja requieren sesión.
--     (En la v1 cualquiera con la anon key podía borrar todas las ventas).
--   • Ventas atómicas en el servidor (create_sale): correlativo con
--     SECUENCIA (sin números repetidos entre cajas), descuento de stock con
--     bloqueo de fila y movimiento de caja en una sola transacción.
-- ============================================================

-- ------------------------------------------------------------
-- 0. UTILIDADES
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.safe_int(t TEXT)
RETURNS INT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN COALESCE(FLOOR(NULLIF(TRIM(t), '')::NUMERIC)::INT, 0);
EXCEPTION WHEN OTHERS THEN
  RETURN 0;
END $$;

CREATE OR REPLACE FUNCTION public.short_id(prefix TEXT)
RETURNS TEXT LANGUAGE sql VOLATILE AS $$
  SELECT prefix || '-' || SUBSTR(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT), 1, 9);
$$;

-- ------------------------------------------------------------
-- 1. PERFILES DE USUARIO (vinculados a Supabase Auth)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT 'Usuario',
  email      TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee', 'viewer')),
  active     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Rol del usuario actual (NULL si no tiene sesión o está desactivado)
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND active;
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.app_role() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = 'admin', FALSE);
$$;

CREATE OR REPLACE FUNCTION public.can_operate()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() IN ('admin', 'employee'), FALSE);
$$;

-- Al crear una cuenta en Auth se crea su perfil.
-- El PRIMER usuario del proyecto queda como administrador activo.
-- Los siguientes quedan INACTIVOS hasta que un administrador los active:
-- así, aunque alguien se registre por su cuenta, no obtiene acceso a nada.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first;
  INSERT INTO public.profiles (id, name, email, role, active)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''), SPLIT_PART(NEW.email, '@', 1)),
    LOWER(NEW.email),
    CASE WHEN is_first THEN 'admin' ELSE 'employee' END,
    is_first
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------
-- 2. TABLAS DE NEGOCIO
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

INSERT INTO public.config (key, value)
VALUES ('config', '{
  "storeName": "Carrillo Store",
  "storeSlogan": "Polos que reflejan tu estilo",
  "heroTitle": "Polos que reflejan tu estilo",
  "heroSubtitle": "Diseño minimalista, materiales premium y caída perfecta.",
  "bannerText": "ENVÍOS GRATIS A TODO EL PAÍS POR COMPRAS MAYORES A S/.199",
  "heroImages": [], "selectedOffers": [], "videos": [], "testimonials": [], "cupons": [],
  "footer": { "whatsapp": "", "email": "", "address": "", "facebookUrl": "", "instagramUrl": "", "tiktokUrl": "" }
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url   TEXT,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.products (
  id                TEXT PRIMARY KEY,
  category_id       TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  sku               TEXT,
  description       TEXT,
  price             NUMERIC(10,2) NOT NULL DEFAULT 0,
  offer_price       NUMERIC(10,2),
  wholesale_price   NUMERIC(10,2),
  wholesale_min_qty INT DEFAULT 6,
  stock             INT NOT NULL DEFAULT 0,
  image_url         TEXT,
  images            JSONB DEFAULT '[]',
  colors            JSONB DEFAULT '[]',
  sizes             JSONB DEFAULT '[]',
  wholesale_tiers   JSONB DEFAULT '[]',
  active            BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customers (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  phone           TEXT,
  email           TEXT,
  address         TEXT,
  document_type   TEXT DEFAULT 'DNI',
  document_number TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS public.invoice_seq START 1;

CREATE TABLE IF NOT EXISTS public.sales (
  id                TEXT PRIMARY KEY,
  invoice_number    TEXT NOT NULL UNIQUE,
  customer_id       TEXT REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name     TEXT NOT NULL DEFAULT 'Cliente Genérico',
  customer_document TEXT DEFAULT '00000000',
  total_amount      NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method    TEXT NOT NULL DEFAULT 'Efectivo',
  document_type     TEXT NOT NULL DEFAULT 'Boleta',
  operator          TEXT NOT NULL DEFAULT 'Sistema',
  type              TEXT NOT NULL DEFAULT 'pos',
  status            TEXT NOT NULL DEFAULT 'completed',
  created_by        UUID DEFAULT auth.uid(),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id            TEXT PRIMARY KEY,
  sale_id       TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id    TEXT REFERENCES public.products(id) ON DELETE SET NULL,
  product_name  TEXT NOT NULL,
  quantity      INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price    NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
  color_hex     TEXT,
  selected_size TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id                   TEXT PRIMARY KEY,
  opened_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_by            TEXT NOT NULL,
  authorized_by        TEXT,
  initial_amount       NUMERIC(10,2) NOT NULL DEFAULT 0,
  theoretical_amount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  closed_at            TIMESTAMPTZ,
  closed_by            TEXT,
  closed_authorized_by TEXT,
  real_amount          NUMERIC(10,2),
  difference           NUMERIC(10,2),
  status               TEXT NOT NULL DEFAULT 'open'
);
-- Solo puede haber UNA caja abierta a la vez (evita dobles aperturas)
CREATE UNIQUE INDEX IF NOT EXISTS one_open_cash_session ON public.cash_sessions ((status)) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id               TEXT PRIMARY KEY,
  cash_register_id TEXT REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
  description      TEXT,
  created_by       TEXT NOT NULL DEFAULT 'Sistema',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.action_logs (
  id        TEXT PRIMARY KEY,
  "user"    TEXT NOT NULL DEFAULT 'Sistema',
  action    TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_created_at       ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_status           ON public.sales(status);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id     ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id  ON public.sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_products_active        ON public.products(active);
CREATE INDEX IF NOT EXISTS idx_products_created_at    ON public.products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_sessions_opened   ON public.cash_sessions(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON public.cash_movements(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_ts         ON public.action_logs(timestamp DESC);

-- ------------------------------------------------------------
-- 3. STOCK Y VENTAS ATÓMICAS (se ejecutan en el servidor)
-- ------------------------------------------------------------

-- Aplica movimientos de stock. p_sign = -1 venta, +1 devolución.
-- p_items: [{product_id, quantity, color_hex, selected_size}, ...]
CREATE OR REPLACE FUNCTION public._apply_stock(p_items JSONB, p_sign INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r       RECORD;
  v_colors JSONB;
  v_stock  INT;
  v_delta  INT;
BEGIN
  -- Orden fijo por producto para evitar bloqueos cruzados entre cajas
  FOR r IN
    SELECT x.product_id, x.color_hex, x.selected_size, public.safe_int(x.quantity::TEXT) AS qty
    FROM jsonb_to_recordset(p_items) AS x(product_id TEXT, color_hex TEXT, selected_size TEXT, quantity NUMERIC)
    WHERE x.product_id IS NOT NULL
    ORDER BY x.product_id
  LOOP
    v_delta := p_sign * r.qty;
    SELECT COALESCE(colors, '[]'::jsonb), stock INTO v_colors, v_stock
      FROM public.products WHERE id = r.product_id FOR UPDATE;
    IF NOT FOUND THEN CONTINUE; END IF;

    IF jsonb_typeof(v_colors) = 'array' AND jsonb_array_length(v_colors) > 0 THEN
      IF r.color_hex IS NOT NULL THEN
        SELECT jsonb_agg(
          CASE WHEN LOWER(c->>'hex') = LOWER(r.color_hex) THEN
            c
            || jsonb_build_object('stock', GREATEST(0, public.safe_int(c->>'stock') + v_delta))
            || CASE
                 WHEN r.selected_size IS NOT NULL AND jsonb_typeof(c->'sizes_stock') = 'object' THEN
                   jsonb_build_object('sizes_stock',
                     (c->'sizes_stock') || jsonb_build_object(r.selected_size,
                       GREATEST(0, public.safe_int(c->'sizes_stock'->>r.selected_size) + v_delta)))
                 ELSE '{}'::jsonb
               END
          ELSE c END
          ORDER BY ord)
        INTO v_colors
        FROM jsonb_array_elements(v_colors) WITH ORDINALITY AS t(c, ord);
      END IF;
      SELECT COALESCE(SUM(public.safe_int(c->>'stock')), 0) INTO v_stock FROM jsonb_array_elements(v_colors) AS c;
      UPDATE public.products SET colors = v_colors, stock = v_stock, updated_at = NOW() WHERE id = r.product_id;
    ELSE
      UPDATE public.products SET stock = GREATEST(0, COALESCE(stock, 0) + v_delta), updated_at = NOW() WHERE id = r.product_id;
    END IF;
  END LOOP;
END $$;

-- Movimiento de caja con actualización atómica del monto teórico
CREATE OR REPLACE FUNCTION public.add_cash_movement(
  p_session_id TEXT, p_type TEXT, p_amount NUMERIC, p_description TEXT, p_user TEXT
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mov public.cash_movements;
BEGIN
  IF NOT public.can_operate() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_type NOT IN ('income', 'expense') THEN RAISE EXCEPTION 'Tipo de movimiento inválido'; END IF;
  INSERT INTO public.cash_movements (id, cash_register_id, type, amount, description, created_by)
  VALUES (public.short_id('mov'), p_session_id, p_type, COALESCE(p_amount, 0), p_description, COALESCE(p_user, 'Sistema'))
  RETURNING * INTO v_mov;
  IF COALESCE(p_description, '') <> 'Apertura de Caja' THEN
    UPDATE public.cash_sessions
       SET theoretical_amount = theoretical_amount + CASE WHEN p_type = 'income' THEN COALESCE(p_amount, 0) ELSE -COALESCE(p_amount, 0) END
     WHERE id = p_session_id;
  END IF;
  RETURN to_jsonb(v_mov);
END $$;

-- Registra una venta completa en una sola transacción
CREATE OR REPLACE FUNCTION public.create_sale(p_sale JSONB, p_items JSONB)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prefix  TEXT;
  v_invoice TEXT;
  v_id      TEXT := public.short_id('sale');
  v_total   NUMERIC := COALESCE(NULLIF(p_sale->>'total_amount', '')::NUMERIC, 0);
  v_sale    public.sales;
  v_session TEXT;
  v_operator TEXT := COALESCE(NULLIF(p_sale->>'operator', ''), 'Sistema');
BEGIN
  IF NOT public.can_operate() THEN RAISE EXCEPTION 'No autorizado para registrar ventas'; END IF;
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta no tiene productos';
  END IF;

  v_prefix := CASE p_sale->>'document_type' WHEN 'Factura' THEN 'FFF1' WHEN 'Sin Datos' THEN 'TTT1' ELSE 'BBB1' END;
  v_invoice := v_prefix || '-' || LPAD(NEXTVAL('public.invoice_seq')::TEXT, 6, '0');

  INSERT INTO public.sales (id, invoice_number, customer_id, customer_name, customer_document,
                            total_amount, discount_amount, payment_method, document_type, operator, type, status)
  VALUES (
    v_id, v_invoice,
    NULLIF(p_sale->>'customer_id', ''),
    COALESCE(NULLIF(p_sale->>'customer_name', ''), 'Cliente Genérico'),
    COALESCE(NULLIF(p_sale->>'customer_document', ''), '00000000'),
    v_total,
    COALESCE(NULLIF(p_sale->>'discount_amount', '')::NUMERIC, 0),
    COALESCE(NULLIF(p_sale->>'payment_method', ''), 'Efectivo'),
    COALESCE(NULLIF(p_sale->>'document_type', ''), 'Boleta'),
    v_operator,
    COALESCE(NULLIF(p_sale->>'type', ''), 'pos'),
    'completed'
  ) RETURNING * INTO v_sale;

  INSERT INTO public.sale_items (id, sale_id, product_id, product_name, quantity, unit_price, total_price, color_hex, selected_size)
  SELECT public.short_id('item'), v_id, x.product_id, COALESCE(x.product_name, 'Producto'),
         public.safe_int(x.quantity::TEXT), COALESCE(x.unit_price, 0),
         ROUND(public.safe_int(x.quantity::TEXT) * COALESCE(x.unit_price, 0), 2),
         x.color_hex, x.selected_size
  FROM jsonb_to_recordset(p_items) AS x(product_id TEXT, product_name TEXT, quantity NUMERIC, unit_price NUMERIC, color_hex TEXT, selected_size TEXT);

  PERFORM public._apply_stock(p_items, -1);

  IF v_sale.type = 'pos' AND v_sale.payment_method = 'Efectivo' THEN
    SELECT id INTO v_session FROM public.cash_sessions WHERE status = 'open' LIMIT 1;
    IF v_session IS NOT NULL THEN
      PERFORM public.add_cash_movement(v_session, 'income', v_total,
        'Venta POS #' || UPPER(RIGHT(v_id, 5)) || ' - Doc: ' || v_invoice, v_operator);
    END IF;
  END IF;

  INSERT INTO public.action_logs (id, "user", action)
  VALUES (public.short_id('log'), v_operator,
          'Registró Venta POS ' || v_invoice || ' por S/. ' || TO_CHAR(v_total, 'FM999999990.00') || ' (' || v_sale.payment_method || ')');

  RETURN to_jsonb(v_sale);
END $$;

-- Anula una venta: restaura stock y registra la salida de caja
CREATE OR REPLACE FUNCTION public.void_sale(p_sale_id TEXT, p_operator TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale    public.sales;
  v_items   JSONB;
  v_session TEXT;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Solo un administrador puede anular ventas'; END IF;
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venta no encontrada'; END IF;
  IF v_sale.status = 'voided' THEN RETURN to_jsonb(v_sale); END IF;

  UPDATE public.sales SET status = 'voided' WHERE id = p_sale_id RETURNING * INTO v_sale;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'product_id', product_id, 'quantity', quantity, 'color_hex', color_hex, 'selected_size', selected_size)), '[]'::jsonb)
    INTO v_items FROM public.sale_items WHERE sale_id = p_sale_id;
  PERFORM public._apply_stock(v_items, 1);

  IF v_sale.type = 'pos' AND v_sale.payment_method = 'Efectivo' THEN
    SELECT id INTO v_session FROM public.cash_sessions WHERE status = 'open' LIMIT 1;
    IF v_session IS NOT NULL THEN
      PERFORM public.add_cash_movement(v_session, 'expense', v_sale.total_amount,
        'ANULACIÓN VENTA POS #' || UPPER(RIGHT(v_sale.id, 5)) || ' (' || v_sale.invoice_number || ')', COALESCE(p_operator, 'Administrador'));
    END IF;
  END IF;

  INSERT INTO public.action_logs (id, "user", action)
  VALUES (public.short_id('log'), COALESCE(p_operator, 'Administrador'),
          'Anuló Venta POS ' || v_sale.invoice_number || ' de S/. ' || TO_CHAR(v_sale.total_amount, 'FM999999990.00'));

  RETURN to_jsonb(v_sale);
END $$;

-- Movimientos de stock genéricos (usado por cambios de producto)
CREATE OR REPLACE FUNCTION public.apply_stock(p_items JSONB, p_sign INT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF p_sign NOT IN (-1, 1) THEN RAISE EXCEPTION 'Signo inválido'; END IF;
  PERFORM public._apply_stock(p_items, p_sign);
END $$;

REVOKE ALL ON FUNCTION public._apply_stock(JSONB, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_sale(JSONB, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.void_sale(TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_cash_movement(TEXT, TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.apply_stock(JSONB, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sale(JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_sale(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_cash_movement(TEXT, TEXT, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_stock(JSONB, INT) TO authenticated;

-- ------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ------------------------------------------------------------
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs    ENABLE ROW LEVEL SECURITY;

-- Perfiles: cada uno ve el suyo; el personal ve a todos; solo admin modifica
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff());
CREATE POLICY profiles_admin_update ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY profiles_admin_delete ON public.profiles FOR DELETE TO authenticated
  USING (public.is_admin() AND id <> auth.uid());

-- Configuración de la tienda: lectura pública (ya NO contiene contraseñas)
CREATE POLICY config_read  ON public.config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY config_write ON public.config FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Catálogo: el público ve lo activo; el personal ve todo; solo admin edita
CREATE POLICY categories_read ON public.categories FOR SELECT TO anon, authenticated
  USING (active OR public.is_staff());
CREATE POLICY categories_write ON public.categories FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY products_read ON public.products FOR SELECT TO anon, authenticated
  USING (active OR public.is_staff());
CREATE POLICY products_write ON public.products FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Clientes: personal lee/crea/edita; solo admin elimina
CREATE POLICY customers_read   ON public.customers FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY customers_insert ON public.customers FOR INSERT TO authenticated WITH CHECK (public.can_operate());
CREATE POLICY customers_update ON public.customers FOR UPDATE TO authenticated USING (public.can_operate()) WITH CHECK (public.can_operate());
CREATE POLICY customers_delete ON public.customers FOR DELETE TO authenticated USING (public.is_admin());

-- Ventas: se crean/anulan por funciones; lectura para el personal; cambios de producto solo admin
CREATE POLICY sales_read   ON public.sales FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY sales_update ON public.sales FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY sale_items_read   ON public.sale_items FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY sale_items_insert ON public.sale_items FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY sale_items_update ON public.sale_items FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Caja: el personal operativo abre, cierra y registra movimientos
CREATE POLICY cash_sessions_read   ON public.cash_sessions FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY cash_sessions_insert ON public.cash_sessions FOR INSERT TO authenticated WITH CHECK (public.can_operate());
CREATE POLICY cash_sessions_update ON public.cash_sessions FOR UPDATE TO authenticated USING (public.can_operate()) WITH CHECK (public.can_operate());
CREATE POLICY cash_movements_read  ON public.cash_movements FOR SELECT TO authenticated USING (public.is_staff());

-- Bitácora: el personal registra; lectura para el personal
CREATE POLICY action_logs_read   ON public.action_logs FOR SELECT TO authenticated USING (public.is_staff());
CREATE POLICY action_logs_insert ON public.action_logs FOR INSERT TO authenticated WITH CHECK (public.is_staff());

-- ------------------------------------------------------------
-- 5. STORAGE (imágenes y videos de la tienda)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('store-media', 'store-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY store_media_read ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'store-media');
CREATE POLICY store_media_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-media' AND public.is_admin());
CREATE POLICY store_media_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'store-media' AND public.is_admin());
CREATE POLICY store_media_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'store-media' AND public.is_admin());

-- ------------------------------------------------------------
-- 6. REALTIME (los cambios respetan las políticas anteriores)
-- ------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.config, public.categories, public.products, public.customers,
  public.sales, public.sale_items, public.cash_sessions, public.cash_movements;

-- ============================================================
-- FIN. Siguiente paso: crea tu usuario administrador en
-- Authentication → Users → Add user (será admin automáticamente).
-- ============================================================
