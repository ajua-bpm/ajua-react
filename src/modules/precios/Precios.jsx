import { useState } from 'react';
import * as XLSX from 'xlsx';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';
import { db, collection, getDocs, query, where, addDoc, updateDoc, deleteDoc, doc } from '../../firebase';

const C = {
  green: '#1A3D28', light: '#2E7D32', acc: '#4A9E6A',
  sand: '#E8DCC8', danger: '#c0392b', bg: '#F9F6EF',
  gray: '#6B8070', white: '#fff',
};

const TIPOS_CLIENTE = ['Restaurante', 'Hotel', 'Supermercado', 'Distribuidor', 'Mayorista', 'Otro'];

const fmtQ = (n) => `Q ${Number(n || 0).toFixed(2)}`;
const today = () => new Date().toISOString().slice(0, 10);
const todayFormatted = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};

// ─── Shared UI helpers ─────────────────────────────────────────────────────────

const TH = ({ children, style }) => (
  <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: C.gray, borderBottom: `1px solid ${C.sand}`, fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.06em', background: C.bg, ...style }}>
    {children}
  </th>
);
const TD = ({ children, style }) => (
  <td style={{ padding: '7px 10px', borderBottom: `1px solid ${C.sand}`, fontSize: '.82rem', verticalAlign: 'middle', ...style }}>
    {children}
  </td>
);

const Inp = ({ label, value, onChange, type = 'text', placeholder = '', style = {} }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: C.acc, letterSpacing: '.06em' }}>
    {label}
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ padding: '8px 11px', border: `1.5px solid ${C.sand}`, borderRadius: 4, fontSize: '.85rem', outline: 'none', ...style }}
    />
  </label>
);

const Sel = ({ label, value, onChange, children, style = {} }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: C.acc, letterSpacing: '.06em' }}>
    {label}
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ padding: '8px 11px', border: `1.5px solid ${C.sand}`, borderRadius: 4, fontSize: '.85rem', outline: 'none', ...style }}
    >
      {children}
    </select>
  </label>
);

const BtnPrimary = ({ onClick, disabled, children, style = {} }) => (
  <button onClick={onClick} disabled={disabled} style={{
    padding: '10px 22px', background: disabled ? '#ccc' : C.green, color: '#fff',
    border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '.85rem',
    cursor: disabled ? 'not-allowed' : 'pointer', ...style,
  }}>
    {children}
  </button>
);

const BtnSecondary = ({ onClick, children, style = {} }) => (
  <button onClick={onClick} style={{
    padding: '10px 18px', background: '#f0f0f0', color: '#333',
    border: 'none', borderRadius: 6, fontWeight: 600, fontSize: '.83rem', cursor: 'pointer', ...style,
  }}>
    {children}
  </button>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.white, border: `1px solid ${C.sand}`, borderRadius: 8, padding: 20, ...style }}>
    {children}
  </div>
);

// ─── Excel utilities ───────────────────────────────────────────────────────────

function autoColWidths(ws, headers, rows) {
  const cols = headers.map((h, i) => {
    const maxData = rows.reduce((max, row) => Math.max(max, String(row[i] ?? '').length), 0);
    return { wch: Math.max(String(h).length, maxData) + 2 };
  });
  ws['!cols'] = cols;
}

function exportListaGeneral(rows) {
  const wb = XLSX.utils.book_new();
  const aoa = [
    ['AGROINDUSTRIA AJÚA — Lista de Precios General'],
    [`Vigencia: ${todayFormatted()}`],
    [],
    ['Código', 'Producto', 'Presentación', 'Unidad', 'Precio Q'],
    ...rows.map(r => [r.codigo, r.producto, r.presentacion, r.unidad, Number(r.precioBase || 0)]),
    [],
    ['Precios sujetos a cambio sin previo aviso'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Merge title rows
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
  ];

  // Column widths based on data rows
  autoColWidths(ws,
    ['Código', 'Producto', 'Presentación', 'Unidad', 'Precio Q'],
    rows.map(r => [r.codigo, r.producto, r.presentacion, r.unidad, Number(r.precioBase || 0)])
  );

  XLSX.utils.book_append_sheet(wb, ws, 'Lista General');
  XLSX.writeFile(wb, 'Lista_Precios_General.xlsx');
}

function exportListaCliente(cliente, rows) {
  const wb = XLSX.utils.book_new();
  const nombre = cliente.nombre || '';
  const aoa = [
    [`AGROINDUSTRIA AJÚA — Lista de Precios: ${nombre.toUpperCase()}`],
    ['CONFIDENCIAL — Solo para uso del cliente mencionado'],
    [`Vigencia: ${todayFormatted()}`],
    [],
    ['Código', 'Producto', 'Presentación', 'Unidad', 'Precio Acordado Q'],
    ...rows.map(r => [r.codigo, r.producto, r.presentacion, r.unidad, Number(r.precioAcordado || r.precioBase || 0)]),
    [],
    ['Precio acordado válido según contrato comercial vigente.'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 4 } },
  ];
  autoColWidths(ws,
    ['Código', 'Producto', 'Presentación', 'Unidad', 'Precio Acordado Q'],
    rows.map(r => [r.codigo, r.producto, r.presentacion, r.unidad, Number(r.precioAcordado || r.precioBase || 0)])
  );
  XLSX.utils.book_append_sheet(wb, ws, 'Lista Cliente');
  const filename = `Lista_${cliente.codigo || 'CLI'}_${nombre.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ─── TAB 1: Lista General ──────────────────────────────────────────────────────

function TabListaGeneral() {
  const toast = useToast();
  const { data: productos, loading: loadProd } = useCollection('iProductos', { orderField: 'nombre' });
  const { data: presentaciones, loading: loadPres } = useCollection('iPresentaciones', { orderField: 'codigo' });
  const { update: updatePres } = useWrite('iPresentaciones');

  const [editPrecioId, setEditPrecioId] = useState(null);
  const [editPrecioVal, setEditPrecioVal] = useState('');
  const [saving, setSaving] = useState(false);

  if (loadProd || loadPres) return <LoadingSpinner />;

  // Build joined rows
  const prodMap = Object.fromEntries(productos.map(p => [p.id, p]));
  const rows = presentaciones
    .filter(p => p.activo !== false)
    .map(p => ({
      ...p,
      productoNombre: prodMap[p.productoId]?.nombre || p.producto || '—',
      productoCategoria: prodMap[p.productoId]?.categoria || '',
      displayDesc: p.descripcion || p.nombre || '—',
    }))
    .sort((a, b) => (a.productoNombre || '').localeCompare(b.productoNombre || '', 'es'));

  const startEditPrecio = (row) => {
    setEditPrecioId(row.id);
    setEditPrecioVal(String(row.precioBase || ''));
  };

  const savePrecio = async (id) => {
    const val = parseFloat(editPrecioVal);
    if (isNaN(val) || val < 0) { toast('⚠ Precio inválido', 'error'); return; }
    setSaving(true);
    try {
      await updatePres(id, { precioBase: val });
      toast('✓ Precio actualizado');
      setEditPrecioId(null);
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const excelRows = rows.map(r => ({
    codigo: r.codigo || '',
    producto: r.productoNombre,
    presentacion: r.displayDesc !== '—' ? r.displayDesc : '',
    unidad: r.unidad || '',
    precioBase: r.precioBase,
  }));

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <BtnSecondary onClick={() => exportListaGeneral(excelRows)}>⬇ Exportar Excel</BtnSecondary>
        <span style={{ fontSize: '.78rem', color: C.gray, alignSelf: 'center' }}>Para agregar productos/presentaciones: Administración → Productos</span>
      </div>

      <Card>
        <div style={{ fontWeight: 700, color: C.green, marginBottom: 12 }}>
          Presentaciones activas ({rows.length})
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
            <thead>
              <tr>
                <TH>Código</TH>
                <TH>Producto</TH>
                <TH>Presentación</TH>
                <TH>Unidad</TH>
                <TH>Precio Base Q</TH>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ background: '#fff' }}>
                  <TD><span style={{ fontFamily: 'monospace', fontSize: '.78rem' }}>{r.codigo || '—'}</span></TD>
                  <TD style={{ fontWeight: 600 }}>{r.productoNombre}</TD>
                  <TD>{r.displayDesc}</TD>
                  <TD>{r.unidad || '—'}</TD>
                  <TD>
                    {editPrecioId === r.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="number"
                          step="0.01"
                          value={editPrecioVal}
                          onChange={e => setEditPrecioVal(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') savePrecio(r.id); if (e.key === 'Escape') setEditPrecioId(null); }}
                          onBlur={() => savePrecio(r.id)}
                          autoFocus
                          style={{ width: 90, padding: '4px 8px', border: `2px solid ${C.light}`, borderRadius: 4, fontSize: '.85rem', outline: 'none' }}
                        />
                      </div>
                    ) : (
                      <span
                        onClick={() => startEditPrecio(r)}
                        title="Clic para editar"
                        style={{ cursor: 'pointer', color: C.green, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: 'rgba(26,61,40,.07)', display: 'inline-block' }}
                      >
                        {fmtQ(r.precioBase)}
                      </span>
                    )}
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: '#aaa' }}>Sin presentaciones activas</div>}
        </div>
      </Card>
    </div>
  );
}

// ─── TAB 2: Precios por Cliente ────────────────────────────────────────────────

function TabPreciosCliente() {
  const toast = useToast();
  const { data: clientes, loading: loadCli } = useCollection('iclientes', { orderField: 'nombre' });
  const { data: productos, loading: loadProd } = useCollection('iProductos', { orderField: 'nombre' });
  const { data: presentaciones, loading: loadPres } = useCollection('iPresentaciones', { orderField: 'codigo' });

  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [search, setSearch] = useState('');
  const [preciosCliente, setPreciosCliente] = useState([]);
  const [loadingPrecios, setLoadingPrecios] = useState(false);
  const [editCell, setEditCell] = useState(null); // { presentacionId, value, vigenteDesde, vigenteHasta, existingId }
  const [saving, setSaving] = useState(false);

  const cliente = clientes.find(c => c.id === selectedClienteId);

  const loadPreciosCliente = async (clienteId) => {
    if (!clienteId) { setPreciosCliente([]); return; }
    setLoadingPrecios(true);
    try {
      const snap = await getDocs(query(collection(db, 'preciosCliente'), where('clienteId', '==', clienteId)));
      setPreciosCliente(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally { setLoadingPrecios(false); }
  };

  const handleSelectCliente = (id) => {
    setSelectedClienteId(id);
    setEditCell(null);
    loadPreciosCliente(id);
  };

  if (loadCli || loadProd || loadPres) return <LoadingSpinner />;

  const prodMap = Object.fromEntries(productos.map(p => [p.id, p]));
  const rows = presentaciones
    .filter(p => p.activo !== false)
    .map(p => {
      const pc = preciosCliente.find(pc2 => pc2.presentacionId === p.id);
      return { ...p, productoNombre: prodMap[p.productoId]?.nombre || '—', precioClienteRecord: pc || null };
    })
    .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));

  const filteredClientes = clientes.filter(c =>
    !search || c.nombre?.toLowerCase().includes(search.toLowerCase()) || c.codigo?.toLowerCase().includes(search.toLowerCase())
  );

  const startEditCell = (row) => {
    const pc = row.precioClienteRecord;
    setEditCell({
      presentacionId: row.id,
      value: pc ? String(pc.precio || '') : '',
      vigenteDesde: pc?.vigenteDesde || '',
      vigenteHasta: pc?.vigenteHasta || '',
      existingId: pc?.id || null,
    });
  };

  const saveEditCell = async () => {
    if (!editCell || !selectedClienteId) return;
    const val = parseFloat(editCell.value);
    setSaving(true);
    try {
      if (!editCell.value || val === 0) {
        // Remove record if exists
        if (editCell.existingId) {
          await deleteDoc(doc(db, 'preciosCliente', editCell.existingId));
          toast('Precio cliente eliminado');
        }
      } else {
        const payload = {
          clienteId: selectedClienteId,
          presentacionId: editCell.presentacionId,
          precio: val,
          activo: true,
          vigenteDesde: editCell.vigenteDesde || null,
          vigenteHasta: editCell.vigenteHasta || null,
        };
        if (editCell.existingId) {
          await updateDoc(doc(db, 'preciosCliente', editCell.existingId), payload);
          toast('✓ Precio cliente actualizado');
        } else {
          await addDoc(collection(db, 'preciosCliente'), { ...payload, _ts: new Date().toISOString() });
          toast('✓ Precio cliente guardado');
        }
      }
      await loadPreciosCliente(selectedClienteId);
      setEditCell(null);
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const excelRows = rows.map(r => ({
    codigo: r.codigo || '',
    producto: r.productoNombre,
    presentacion: r.descripcion || '',
    unidad: r.unidad || '',
    precioBase: r.precioBase,
    precioAcordado: r.precioClienteRecord ? r.precioClienteRecord.precio : r.precioBase,
  }));

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Inp label="Buscar cliente" value={search} onChange={setSearch} placeholder="Nombre o código..." />
          </div>
          <div style={{ flex: 2, minWidth: 220 }}>
            <Sel label="Cliente" value={selectedClienteId} onChange={handleSelectCliente}>
              <option value="">— Seleccionar cliente —</option>
              {filteredClientes.map(c => (
                <option key={c.id} value={c.id}>{c.codigo ? `[${c.codigo}] ` : ''}{c.nombre}</option>
              ))}
            </Sel>
          </div>
          {selectedClienteId && (
            <BtnSecondary onClick={() => exportListaCliente(cliente || {}, excelRows)}>
              ⬇ Exportar Excel — {cliente?.nombre || ''}
            </BtnSecondary>
          )}
        </div>
      </Card>

      {selectedClienteId && (
        <Card>
          {loadingPrecios ? <LoadingSpinner /> : (
            <>
              <div style={{ fontWeight: 700, color: C.green, marginBottom: 12 }}>
                Precios para: {cliente?.nombre} ({rows.length} presentaciones)
              </div>
              {editCell && (
                <div style={{ background: '#f0f7f2', border: `1px solid ${C.acc}`, borderRadius: 6, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontWeight: 600, color: C.green, marginBottom: 10, fontSize: '.85rem' }}>
                    Editando precio — {rows.find(r => r.id === editCell.presentacionId)?.descripcion}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 10, marginBottom: 10 }}>
                    <Inp label="Precio Q (vacío = eliminar)" type="number" value={editCell.value}
                      onChange={v => setEditCell(ec => ({ ...ec, value: v }))} />
                    <Inp label="Vigente Desde" type="date" value={editCell.vigenteDesde}
                      onChange={v => setEditCell(ec => ({ ...ec, vigenteDesde: v }))} />
                    <Inp label="Vigente Hasta" type="date" value={editCell.vigenteHasta}
                      onChange={v => setEditCell(ec => ({ ...ec, vigenteHasta: v }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <BtnPrimary onClick={saveEditCell} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</BtnPrimary>
                    <BtnSecondary onClick={() => setEditCell(null)}>Cancelar</BtnSecondary>
                  </div>
                </div>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <TH>Código</TH>
                      <TH>Producto</TH>
                      <TH>Presentación</TH>
                      <TH>Unidad</TH>
                      <TH>Precio Base</TH>
                      <TH>Precio Cliente</TH>
                      <TH>Ahorro %</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => {
                      const pc = r.precioClienteRecord;
                      const base = Number(r.precioBase || 0);
                      const acordado = pc ? Number(pc.precio || 0) : null;
                      const ahorro = (acordado !== null && base > 0) ? ((base - acordado) / base * 100) : null;
                      const isEditing = editCell?.presentacionId === r.id;
                      return (
                        <tr key={r.id} style={{ background: isEditing ? '#f0f7f2' : '#fff' }}>
                          <TD><span style={{ fontFamily: 'monospace', fontSize: '.75rem' }}>{r.codigo || '—'}</span></TD>
                          <TD style={{ fontWeight: 600 }}>{r.productoNombre}</TD>
                          <TD>{r.descripcion || '—'}</TD>
                          <TD>{r.unidad || '—'}</TD>
                          <TD style={{ color: C.gray }}>{fmtQ(base)}</TD>
                          <TD>
                            <span
                              onClick={() => startEditCell(r)}
                              title="Clic para editar precio cliente"
                              style={{
                                cursor: 'pointer',
                                padding: '3px 10px', borderRadius: 4,
                                background: pc ? 'rgba(26,61,40,.09)' : '#f0f0f0',
                                color: pc ? C.green : '#aaa',
                                fontWeight: pc ? 700 : 400,
                                fontSize: '.82rem',
                                display: 'inline-block',
                              }}
                            >
                              {pc ? fmtQ(pc.precio) : 'Base'}
                            </span>
                          </TD>
                          <TD>
                            {ahorro !== null && (
                              <span style={{ color: ahorro > 0 ? C.acc : C.danger, fontWeight: 600, fontSize: '.78rem' }}>
                                {ahorro > 0 ? `▼ ${ahorro.toFixed(1)}%` : `▲ ${Math.abs(ahorro).toFixed(1)}%`}
                              </span>
                            )}
                          </TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── TAB 3: Precios por Volumen ────────────────────────────────────────────────

function TabVolumen() {
  const toast = useToast();
  const { data: presentaciones, loading: loadPres } = useCollection('iPresentaciones', { orderField: 'codigo' });
  const { data: clientes, loading: loadCli } = useCollection('iclientes', { orderField: 'nombre' });
  const { data: productos } = useCollection('iProductos', { orderField: 'nombre' });

  const [selectedPresentId, setSelectedPresentId] = useState('');
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [tiers, setTiers] = useState([]);
  const [loadingTiers, setLoadingTiers] = useState(false);
  const [form, setForm] = useState({ cantidadMinima: '', precio: '', clienteId: '' });
  const [saving, setSaving] = useState(false);

  const prodMap = Object.fromEntries((productos || []).map(p => [p.id, p]));

  const loadTiers = async (presentacionId) => {
    if (!presentacionId) { setTiers([]); return; }
    setLoadingTiers(true);
    try {
      const snap = await getDocs(query(collection(db, 'preciosVolumen'), where('presentacionId', '==', presentacionId)));
      setTiers(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => Number(a.cantidadMinima) - Number(b.cantidadMinima)));
    } finally { setLoadingTiers(false); }
  };

  const handleSelectPresent = (id) => {
    setSelectedPresentId(id);
    loadTiers(id);
  };

  const handleAddTier = async () => {
    if (!selectedPresentId) { toast('⚠ Selecciona una presentación', 'error'); return; }
    if (!form.cantidadMinima || !form.precio) { toast('⚠ Cantidad mínima y precio requeridos', 'error'); return; }
    setSaving(true);
    try {
      await addDoc(collection(db, 'preciosVolumen'), {
        presentacionId: selectedPresentId,
        cantidadMinima: Number(form.cantidadMinima),
        precio: parseFloat(form.precio),
        clienteId: form.clienteId || null,
        activo: true,
        _ts: new Date().toISOString(),
      });
      toast('✓ Nivel de volumen agregado');
      setForm({ cantidadMinima: '', precio: '', clienteId: '' });
      await loadTiers(selectedPresentId);
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleDeleteTier = async (id) => {
    if (!confirm('¿Eliminar este nivel de precio por volumen?')) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'preciosVolumen', id));
      toast('Nivel eliminado');
      await loadTiers(selectedPresentId);
    } catch (e) { toast('Error: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  if (loadPres || loadCli) return <LoadingSpinner />;

  const presentacionesOptions = presentaciones
    .filter(p => p.activo !== false)
    .map(p => ({ ...p, productoNombre: prodMap[p.productoId]?.nombre || '' }));

  const clienteMap = Object.fromEntries(clientes.map(c => [c.id, c]));
  const selectedPresent = presentaciones.find(p => p.id === selectedPresentId);

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
          <Sel label="Presentación" value={selectedPresentId} onChange={handleSelectPresent}>
            <option value="">— Seleccionar presentación —</option>
            {presentacionesOptions.map(p => (
              <option key={p.id} value={p.id}>
                {p.codigo ? `[${p.codigo}] ` : ''}{p.productoNombre} — {p.descripcion}
              </option>
            ))}
          </Sel>
        </div>
      </Card>

      {selectedPresentId && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, color: C.green, marginBottom: 12, fontSize: '.88rem' }}>
              Agregar nivel de precio — {selectedPresent?.descripcion}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 12 }}>
              <Inp label="Cantidad Mínima *" type="number" value={form.cantidadMinima}
                onChange={v => setForm(f => ({ ...f, cantidadMinima: v }))} placeholder="ej. 10" />
              <Inp label="Precio Q *" type="number" value={form.precio}
                onChange={v => setForm(f => ({ ...f, precio: v }))} placeholder="ej. 5.50" />
              <Sel label="Cliente (opcional)" value={form.clienteId} onChange={v => setForm(f => ({ ...f, clienteId: v }))}>
                <option value="">Todos los clientes</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Sel>
            </div>
            <BtnPrimary onClick={handleAddTier} disabled={saving}>{saving ? 'Guardando...' : 'Agregar nivel'}</BtnPrimary>
          </Card>

          <Card>
            <div style={{ fontWeight: 700, color: C.green, marginBottom: 12 }}>Niveles de precio por volumen</div>
            {loadingTiers ? <LoadingSpinner /> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <TH>Cantidad Mínima</TH>
                      <TH>Precio Q</TH>
                      <TH>Cliente</TH>
                      <TH>Acciones</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {tiers.map(t => (
                      <tr key={t.id}>
                        <TD style={{ fontWeight: 700 }}>{t.cantidadMinima}+</TD>
                        <TD style={{ color: C.green, fontWeight: 700 }}>{fmtQ(t.precio)}</TD>
                        <TD>{t.clienteId ? (clienteMap[t.clienteId]?.nombre || t.clienteId) : <span style={{ color: '#aaa', fontStyle: 'italic' }}>Todos</span>}</TD>
                        <TD>
                          <button onClick={() => handleDeleteTier(t.id)} style={{
                            padding: '3px 10px', background: C.danger, color: '#fff',
                            border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer',
                          }}>
                            Eliminar
                          </button>
                        </TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tiers.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 24, color: '#aaa' }}>Sin niveles de volumen para esta presentación</div>
                )}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

// ─── TAB 4: Clientes CRUD ──────────────────────────────────────────────────────

function TabClientes() {
  const toast = useToast();
  const { data, loading } = useCollection('iclientes', { orderField: 'nombre' });
  const { add, update, remove, saving } = useWrite('iclientes');

  const BLANK = { codigo: '', nombre: '', tipo: 'Otro', contacto: '', telefono: '', email: '', nit: '', direccion: '', activo: true };
  const [form, setForm] = useState({ ...BLANK });
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  if (loading) return <LoadingSpinner />;

  const filtered = data.filter(r =>
    !search ||
    r.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    r.codigo?.toLowerCase().includes(search.toLowerCase()) ||
    r.tipo?.toLowerCase().includes(search.toLowerCase())
  );

  // Auto-generate next code
  const nextCode = () => {
    const codes = data.map(c => c.codigo).filter(c => /^CLI-\d+$/.test(c || ''));
    const nums = codes.map(c => parseInt(c.replace('CLI-', ''), 10));
    const max = nums.length ? Math.max(...nums) : 0;
    return `CLI-${String(max + 1).padStart(3, '0')}`;
  };

  const startNew = () => {
    setForm({ ...BLANK, codigo: nextCode() });
    setEditId(null);
    setShowForm(true);
  };

  const startEdit = (r) => {
    setForm({ ...BLANK, ...r });
    setEditId(r.id);
    setShowForm(true);
  };

  const cancelForm = () => {
    setForm({ ...BLANK });
    setEditId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.nombre) { toast('⚠ Nombre requerido', 'error'); return; }
    if (editId) {
      await update(editId, form);
      toast('✓ Cliente actualizado');
    } else {
      await add(form);
      toast('✓ Cliente agregado');
    }
    cancelForm();
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar cliente?')) return;
    await remove(id);
    toast('Cliente eliminado');
  };

  const toggleActivo = async (r) => {
    await update(r.id, { activo: !r.activo });
    toast(`Cliente ${!r.activo ? 'activado' : 'desactivado'}`);
  };

  const f = (id, label, type = 'text', placeholder = '') => (
    <Inp label={label} type={type} value={form[id]} onChange={v => setForm(ff => ({ ...ff, [id]: v }))} placeholder={placeholder} />
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <BtnPrimary onClick={startNew}>+ Nuevo Cliente</BtnPrimary>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, código o tipo..."
          style={{ padding: '8px 14px', border: `1.5px solid ${C.sand}`, borderRadius: 6, fontSize: '.85rem', outline: 'none', width: 260 }}
        />
      </div>

      {showForm && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: C.green, marginBottom: 14 }}>{editId ? 'Editar Cliente' : 'Nuevo Cliente'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 12 }}>
            {f('codigo', 'Código (auto)')}
            {f('nombre', 'Nombre *')}
            <Sel label="Tipo" value={form.tipo} onChange={v => setForm(ff => ({ ...ff, tipo: v }))}>
              {TIPOS_CLIENTE.map(t => <option key={t} value={t}>{t}</option>)}
            </Sel>
            {f('contacto', 'Contacto')}
            {f('telefono', 'Teléfono')}
            {f('email', 'Email', 'email')}
            {f('nit', 'NIT')}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', color: C.acc, letterSpacing: '.06em', marginBottom: 12 }}>
            Dirección
            <textarea
              value={form.direccion}
              onChange={e => setForm(ff => ({ ...ff, direccion: e.target.value }))}
              rows={2}
              style={{ padding: '8px 11px', border: `1.5px solid ${C.sand}`, borderRadius: 4, fontSize: '.85rem', outline: 'none', resize: 'vertical' }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.83rem', color: C.gray, marginBottom: 14, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.activo} onChange={e => setForm(ff => ({ ...ff, activo: e.target.checked }))} />
            Cliente activo
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <BtnPrimary onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : editId ? 'Actualizar' : 'Agregar'}</BtnPrimary>
            <BtnSecondary onClick={cancelForm}>Cancelar</BtnSecondary>
          </div>
        </Card>
      )}

      <Card>
        <div style={{ fontWeight: 700, color: C.green, marginBottom: 12 }}>Clientes ({filtered.length})</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <TH>Código</TH>
                <TH>Nombre</TH>
                <TH>Tipo</TH>
                <TH>Contacto</TH>
                <TH>Email</TH>
                <TH>Activo</TH>
                <TH>Acciones</TH>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} style={{ background: r.activo === false ? '#fafafa' : '#fff', opacity: r.activo === false ? 0.6 : 1 }}>
                  <TD><span style={{ fontFamily: 'monospace', fontSize: '.75rem' }}>{r.codigo || '—'}</span></TD>
                  <TD style={{ fontWeight: 600 }}>{r.nombre}</TD>
                  <TD>
                    <span style={{ padding: '2px 8px', borderRadius: 4, background: '#f0f7f2', color: C.green, fontSize: '.75rem', fontWeight: 600 }}>
                      {r.tipo || '—'}
                    </span>
                  </TD>
                  <TD>{r.contacto || '—'}</TD>
                  <TD style={{ fontSize: '.78rem', color: C.gray }}>{r.email || '—'}</TD>
                  <TD>
                    <span
                      onClick={() => toggleActivo(r)}
                      style={{ cursor: 'pointer', fontSize: '.75rem', fontWeight: 700, color: r.activo !== false ? C.acc : '#aaa' }}
                    >
                      {r.activo !== false ? '● Activo' : '○ Inactivo'}
                    </span>
                  </TD>
                  <TD>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => startEdit(r)} style={{ padding: '3px 10px', background: C.acc, color: '#fff', border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>
                        Editar
                      </button>
                      <button onClick={() => handleDelete(r.id)} style={{ padding: '3px 10px', background: C.danger, color: '#fff', border: 'none', borderRadius: 4, fontSize: '.72rem', fontWeight: 600, cursor: 'pointer' }}>
                        Eliminar
                      </button>
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 32, color: '#aaa' }}>Sin clientes{search ? ' que coincidan' : ''}</div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ─── Main Precios Component ────────────────────────────────────────────────────

const TABS = [
  { key: 'general',  label: 'Lista General' },
  { key: 'cliente',  label: 'Precios por Cliente' },
  { key: 'volumen',  label: 'Precios por Volumen' },
  { key: 'clientes', label: 'Clientes' },
];

export default function Precios() {
  const [tab, setTab] = useState('general');

  return (
    <div>
      <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: C.green, marginBottom: 4 }}>
        💲 Lista de Precios
      </h1>
      <p style={{ fontSize: '.82rem', color: C.gray, marginBottom: 20 }}>
        Gestión de precios, tarifas por cliente y descuentos por volumen
      </p>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `2px solid ${C.sand}`, paddingBottom: 0, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 20px',
              background: tab === t.key ? C.green : 'transparent',
              color: tab === t.key ? '#fff' : C.gray,
              border: 'none',
              borderRadius: '6px 6px 0 0',
              fontWeight: tab === t.key ? 700 : 500,
              fontSize: '.84rem',
              cursor: 'pointer',
              borderBottom: tab === t.key ? `2px solid ${C.green}` : '2px solid transparent',
              marginBottom: -2,
              transition: 'all .15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general'  && <TabListaGeneral />}
      {tab === 'cliente'  && <TabPreciosCliente />}
      {tab === 'volumen'  && <TabVolumen />}
      {tab === 'clientes' && <TabClientes />}
    </div>
  );
}
