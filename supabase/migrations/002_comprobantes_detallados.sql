-- ============================================================
-- Migración 002 — Comprobantes detallados
-- Ejecutar UNA vez en Supabase → SQL Editor (proyectos creados con schema.sql).
--   • Guarda SKU, nombre, color, precio de lista y promoción de cada línea,
--     para que las reimpresiones salgan igual que el comprobante original.
--   • Permite a los colaboradores subir el PDF del comprobante (envío por WhatsApp).
-- ============================================================

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS sku         TEXT,
  ADD COLUMN IF NOT EXISTS base_name   TEXT,
  ADD COLUMN IF NOT EXISTS color_name  TEXT,
  ADD COLUMN IF NOT EXISTS list_price  NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS promo_label TEXT;

-- Precio final con 4 decimales: las promos tipo "3 x S/ 100" dan 33.3333 por unidad
ALTER TABLE public.sale_items ALTER COLUMN unit_price TYPE NUMERIC(10,4);

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

  INSERT INTO public.sale_items (id, sale_id, product_id, product_name, quantity, unit_price, total_price,
                                 color_hex, selected_size, sku, base_name, color_name, list_price, promo_label)
  SELECT public.short_id('item'), v_id, x.product_id, COALESCE(x.product_name, 'Producto'),
         public.safe_int(x.quantity::TEXT), COALESCE(x.unit_price, 0),
         ROUND(public.safe_int(x.quantity::TEXT) * COALESCE(x.unit_price, 0), 2),
         x.color_hex, x.selected_size, x.sku, x.base_name, x.color_name, x.list_price, x.promo_label
  FROM jsonb_to_recordset(p_items) AS x(product_id TEXT, product_name TEXT, quantity NUMERIC, unit_price NUMERIC,
                                        color_hex TEXT, selected_size TEXT, sku TEXT, base_name TEXT,
                                        color_name TEXT, list_price NUMERIC, promo_label TEXT);

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

REVOKE ALL ON FUNCTION public.create_sale(JSONB, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_sale(JSONB, JSONB) TO authenticated;

-- Colaboradores pueden subir PDFs de comprobantes (solo en la carpeta receipts/)
DROP POLICY IF EXISTS store_media_receipts_insert ON storage.objects;
CREATE POLICY store_media_receipts_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store-media' AND name LIKE 'receipts/%' AND public.can_operate());
