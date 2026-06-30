-- ============================================================
-- CARRILLO STORE — Script SQL completo para Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- ============================================================
-- 1. CONFIGURACIÓN DE TIENDA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- Insertar configuración inicial por defecto
INSERT INTO public.config (key, value)
VALUES ('config', '{
  "storeName": "Carrillo Store",
  "storeSlogan": "Polos que reflejan tu estilo",
  "storeLogoUrl": "",
  "storeFaviconUrl": "",
  "heroTitle": "Polos que reflejan tu estilo",
  "heroSubtitle": "Diseño minimalista, materiales premium y caída perfecta.",
  "bannerText": "ENVÍOS GRATIS A TODO EL PAÍS POR COMPRAS MAYORES A S/.199",
  "heroImages": [],
  "selectedOffers": [],
  "videos": [],
  "testimonials": [],
  "footer": {
    "whatsapp": "+51 987 654 321",
    "email": "soporte@carrillostore.com",
    "address": "Av. Larco 123, Lima, Perú",
    "facebookUrl": "#",
    "instagramUrl": "#",
    "tiktokUrl": "#"
  },
  "users": [
    {
      "id": "u-1",
      "name": "Administrador Principal",
      "email": "admin@carrillostore.com",
      "role": "admin",
      "password": "admin123"
    }
  ],
  "cupons": []
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2. CATEGORÍAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url   TEXT,
  active      BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. PRODUCTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id               TEXT PRIMARY KEY,
  category_id      TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  sku              TEXT,
  description      TEXT,
  price            NUMERIC(10,2) NOT NULL DEFAULT 0,
  offer_price      NUMERIC(10,2),
  wholesale_price  NUMERIC(10,2),
  wholesale_min_qty INT DEFAULT 6,
  stock            INT NOT NULL DEFAULT 0,
  image_url        TEXT,
  images           JSONB DEFAULT '[]',
  colors           JSONB DEFAULT '[]',
  sizes            JSONB DEFAULT '[]',
  wholesale_tiers  JSONB DEFAULT '[]',
  active           BOOLEAN DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. CLIENTES
-- ============================================================
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

-- ============================================================
-- 5. VENTAS
-- ============================================================
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
  type              TEXT NOT NULL DEFAULT 'pos',   -- 'pos' | 'online'
  status            TEXT NOT NULL DEFAULT 'completed', -- 'completed' | 'voided'
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. ITEMS DE VENTA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sale_items (
  id           TEXT PRIMARY KEY,
  sale_id      TEXT NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id   TEXT REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity     INT NOT NULL DEFAULT 1,
  unit_price   NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
  color_hex    TEXT,
  selected_size TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. SESIONES DE CAJA REGISTRADORA
-- ============================================================
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
  status               TEXT NOT NULL DEFAULT 'open'  -- 'open' | 'closed'
);

-- ============================================================
-- 8. MOVIMIENTOS DE CAJA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cash_movements (
  id               TEXT PRIMARY KEY,
  cash_register_id TEXT REFERENCES public.cash_sessions(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,   -- 'income' | 'expense'
  amount           NUMERIC(10,2) NOT NULL DEFAULT 0,
  description      TEXT,
  created_by       TEXT NOT NULL DEFAULT 'Sistema',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. BITÁCORA DE ACCIONES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.action_logs (
  id        TEXT PRIMARY KEY,
  "user"    TEXT NOT NULL DEFAULT 'Sistema',
  action    TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. ÍNDICES PARA RENDIMIENTO
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sales_created_at   ON public.sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_operator     ON public.sales(operator);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_products_active    ON public.products(active);
CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON public.cash_movements(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_action_logs_ts     ON public.action_logs(timestamp DESC);

-- ============================================================
-- 11. ROW LEVEL SECURITY (RLS)
-- Habilitar RLS y permitir acceso total con anon key
-- (Para producción real restringe por rol de usuario)
-- ============================================================
ALTER TABLE public.config          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs     ENABLE ROW LEVEL SECURITY;

-- Políticas: acceso completo con anon key (app maneja auth propia)
CREATE POLICY "allow_all_config"         ON public.config         FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_categories"     ON public.categories     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_products"       ON public.products       FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_customers"      ON public.customers      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sales"          ON public.sales          FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_sale_items"     ON public.sale_items     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_cash_sessions"  ON public.cash_sessions  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_cash_movements" ON public.cash_movements FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_action_logs"    ON public.action_logs    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- 12. STORAGE BUCKET PARA IMÁGENES (ejecutar si usas Storage)
-- ============================================================
-- En Supabase Dashboard → Storage → New Bucket
-- Nombre: store-media
-- Public: TRUE
--
-- O ejecutar esto (requiere extensión storage habilitada):
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('store-media', 'store-media', true)
-- ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 13. REALTIME — habilitar para tablas clave
-- En Supabase Dashboard → Database → Replication
-- Activar: sales, products, categories, config
-- ============================================================

-- ============================================================
-- FIN DEL SCRIPT
-- ============================================================
