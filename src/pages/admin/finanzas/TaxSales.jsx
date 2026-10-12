import { useEffect, useMemo, useState } from 'react';
import { Search, Download, FileText, Receipt, Percent, Hash } from 'lucide-react';
import { DataService, subscribeToRealtime } from '../../../services/dataService';
import { getTaxConfig, isActiveSale, toNum } from '../../../utils/taxData';
import { splitIGV, formatMoney, formatDate } from '../../../utils/taxRegimes';
import { downloadCsv } from '../../../utils/csv';
import { toast } from '../../../utils/toast';
import { Badge, KpiCard, KpiGrid, SectionHeader, LoadingState, EmptyRow, PeriodPicker, SaleStatusBadge } from './shared';
import { csvRow, money2, docLabel, docTone, num, numRight } from './helpers';

const DOC_FILTERS = ['Todos', 'Factura', 'Boleta', 'Sin Datos'];

export default function TaxSales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('PEN');
  const [docFilter, setDocFilter] = useState('Todos');
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(() => new Date().getMonth());
  const [year, setYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    const load = async () => {
      try {
        const [s, cfg] = await Promise.all([DataService.getSales(), DataService.getConfig()]);
        setSales((s || []).filter(isActiveSale));
        setCurrency(getTaxConfig(cfg).currency);
      } catch (e) {
        console.error(e);
        toast.error('No se pudieron cargar las ventas.');
      } finally {
        setLoading(false);
      }
    };
    load();
    const unsub = subscribeToRealtime(() => load());
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sales.filter(s => {
      const d = new Date(s.created_at);
      if (d.getMonth() !== month || d.getFullYear() !== year) return false;
      if (docFilter !== 'Todos' && s.document_type !== docFilter) return false;
      if (q && !(`${s.invoice_number || ''} ${s.customer_name || ''}`.toLowerCase().includes(q))) return false;
      return true;
    }).map(s => {
      const total = toNum(s.total_amount);
      return { ...s, total, ...splitIGV(total) };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [sales, docFilter, search, month, year]);

  const totals = filtered.reduce((acc, s) => {
    acc.total += s.total; acc.base += s.base; acc.igv += s.igv;
    return acc;
  }, { total: 0, base: 0, igv: 0 });

  const facturas = filtered.filter(s => s.document_type === 'Factura').length;
  const boletas = filtered.length - facturas;

  const exportCsv = () => {
    if (filtered.length === 0) { toast.warning('No hay comprobantes para exportar en este periodo.'); return; }
    const header = 'Tipo,Serie-Numero,Cliente,Documento,Fecha,Base Imponible,IGV,Total\n';
    const rows = filtered.map(s => csvRow([
      s.document_type, s.invoice_number, s.customer_name, s.customer_document || '',
      formatDate(s.created_at), money2(s.base), money2(s.igv), money2(s.total),
    ])).join('\n');
    downloadCsv(`ventas_${year}_${month + 1}.csv`, header + rows);
    toast.success(`Exportados ${filtered.length} comprobantes`);
  };

  if (loading) return <LoadingState label="Cargando ventas..." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SectionHeader
        title="Ventas (facturas y boletas)"
        subtitle="Comprobantes de venta emitidos automáticamente desde el POS y la tienda online. Las ventas anuladas no se incluyen."
        actions={<button type="button" className="btn-secondary" onClick={exportCsv}><Download size={15} /> Exportar CSV</button>}
      />

      <KpiGrid min={170}>
        <KpiCard label="Total ventas" value={formatMoney(totals.total, currency)} icon={Receipt} />
        <KpiCard label="Base imponible" value={formatMoney(totals.base, currency)} icon={FileText} />
        <KpiCard label="IGV cobrado" value={formatMoney(totals.igv, currency)} icon={Percent} tone="info" />
        <KpiCard label="Facturas / Boletas" value={`${facturas} / ${boletas}`} icon={Hash} />
      </KpiGrid>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="input-field" style={{ paddingLeft: '36px' }} placeholder="Buscar por número o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input-field" aria-label="Tipo de comprobante" style={{ width: 'auto' }} value={docFilter} onChange={e => setDocFilter(e.target.value)}>
            {DOC_FILTERS.map(o => <option key={o} value={o}>{o === 'Todos' ? 'Todos los tipos' : docLabel(o)}</option>)}
          </select>
          <PeriodPicker month={month} onMonth={setMonth} year={year} onYear={setYear} />
        </div>

        <div className="table-wrap">
          <table className="data-table" style={{ minWidth: '780px' }}>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Serie-Número</th>
                <th>Cliente</th>
                <th>Fecha</th>
                <th style={{ textAlign: 'right' }}>Base</th>
                <th style={{ textAlign: 'right' }}>IGV</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <EmptyRow colSpan={8} icon={Receipt} title="No hay comprobantes en este periodo" text="Prueba con otro mes, tipo de comprobante o término de búsqueda." />
              ) : filtered.map(s => (
                <tr key={s.id}>
                  <td><Badge tone={docTone(s.document_type)}>{docLabel(s.document_type)}</Badge></td>
                  <td style={{ ...num, fontWeight: 500 }}>{s.invoice_number || '—'}</td>
                  <td>{s.customer_name || 'Cliente varios'}</td>
                  <td style={num}>{formatDate(s.created_at)}</td>
                  <td style={numRight}>{formatMoney(s.base, currency)}</td>
                  <td style={numRight}>{formatMoney(s.igv, currency)}</td>
                  <td style={{ ...numRight, fontWeight: 600 }}>{formatMoney(s.total, currency)}</td>
                  <td><SaleStatusBadge sale={s} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
