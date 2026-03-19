import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import { useToast } from '../../components/Toast';
import Skeleton from '../../components/Skeleton';

// ── Design tokens ────────────────────────────────────────────────
const T = {
  primary: '#1B5E20', secondary: '#2E7D32', white: '#FFFFFF',
  bgLight: '#F5F5F5', border: '#E0E0E0', textDark: '#1A1A18',
  textMid: '#6B6B60', danger: '#C62828', warn: '#E65100',
};
const shadow = '0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06)';
const card   = { background: '#fff', borderRadius: 8, boxShadow: shadow, padding: 20, marginBottom: 20 };

const thSt = {
  color: T.white, padding: '10px 14px', fontSize: '.75rem',
  fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em',
  textAlign: 'left', whiteSpace: 'nowrap',
};
const tdSt = { padding: '9px 14px', fontSize: '.83rem', borderBottom: '1px solid #F0F0F0', color: T.textDark };

const LS = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: '.72rem', fontWeight: 600, textTransform: 'uppercase',
  color: T.textMid, letterSpacing: '.06em',
};
const IS = {
  padding: '9px 12px', border: '1.5px solid #E0E0E0', borderRadius: 6,
  fontSize: '.88rem', outline: 'none', fontFamily: 'inherit',
};

const BLANK = {
  nombre: '', pais: 'Guatemala', contacto: '', telefono: '',
  email: '', banco: '', credito: '', productos: '', obs: '',
};

// ── Field helper ─────────────────────────────────────────────────
function Field({ id, label, form, setForm, placeholder = '' }) {
  return (
    <label style={LS}>
      {label}
      <input
        value={form[id] || ''}
        onChange={e => setForm(f => ({ ...f, [id]: e.target.value }))}
        placeholder={placeholder}
        style={IS}
      />
    </label>
  );
}

// ── Action button ─────────────────────────────────────────────────
function Btn({ onClick, color, children, small }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: small ? '4px 12px' : '11px 22px',
        background: color, color: T.white, border: 'none',
        borderRadius: small ? 4 : 6, fontWeight: 600,
        fontSize: small ? '.72rem' : '.88rem', cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export default function Proveedores() {
  const toast = useToast();
  const { data, loading }       = useCollection('proveedores', { orderField: 'nombre', limit: 300 });
  const { add, update, remove, saving } = useWrite('proveedores');

  const [form, setForm]   = useState({ ...BLANK });
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');

  const handleSave = async () => {
    if (!form.nombre.trim()) { toast('El nombre del proveedor es requerido', 'error'); return; }
    if (editId) {
      await update(editId, form);
      toast('Proveedor actualizado correctamente');
    } else {
      await add(form);
      toast('Proveedor agregado correctamente');
    }
    setForm({ ...BLANK });
    setEditId(null);
  };

  const startEdit = r => {
    setForm({ ...BLANK, ...r });
    setEditId(r.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const cancelEdit = () => { setForm({ ...BLANK }); setEditId(null); };

  const handleDelete = async id => {
    if (!confirm('¿Eliminar este proveedor? Esta acción no se puede deshacer.')) return;
    await remove(id);
    toast('Proveedor eliminado');
  };

  const filtered = data.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.nombre?.toLowerCase().includes(q) ||
      r.pais?.toLowerCase().includes(q) ||
      r.contacto?.toLowerCase().includes(q) ||
      r.productos?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ padding: '24px 28px', fontFamily: 'inherit', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: T.textDark }}>
          Proveedores y Productores
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '.83rem', color: T.textMid }}>
          Base de datos de proveedores — {data.length} registrados
        </p>
      </div>

      {/* Form */}
      <div style={{ ...card, borderLeft: `4px solid ${editId ? T.warn : T.primary}` }}>
        <div style={{ fontWeight: 700, fontSize: '.95rem', color: T.textDark, marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #F0F0F0' }}>
          {editId ? 'Editar proveedor' : 'Nuevo proveedor'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 14, marginBottom: 14 }}>
          <Field id="nombre"    label="Nombre *"         form={form} setForm={setForm} />
          <Field id="pais"      label="País"             form={form} setForm={setForm} />
          <Field id="contacto"  label="Contacto"         form={form} setForm={setForm} />
          <Field id="telefono"  label="Teléfono"         form={form} setForm={setForm} />
          <Field id="email"     label="Email"            form={form} setForm={setForm} />
          <Field id="banco"     label="Banco / Cuenta"   form={form} setForm={setForm} />
          <Field id="credito"   label="Crédito (días)"   form={form} setForm={setForm} />
          <Field id="productos" label="Productos que provee" form={form} setForm={setForm} />
        </div>
        <label style={{ ...LS, marginBottom: 16 }}>
          Observaciones
          <textarea
            value={form.obs || ''}
            onChange={e => setForm(f => ({ ...f, obs: e.target.value }))}
            rows={2}
            style={{ ...IS, resize: 'vertical' }}
          />
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '11px 24px', background: saving ? T.border : (editId ? T.warn : T.primary),
              color: T.white, border: 'none', borderRadius: 6, fontWeight: 600,
              fontSize: '.88rem', cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Guardando…' : editId ? 'Actualizar' : 'Agregar proveedor'}
          </button>
          {editId && (
            <button
              onClick={cancelEdit}
              style={{ padding: '11px 20px', background: T.bgLight, border: `1px solid ${T.border}`, borderRadius: 6, fontWeight: 600, fontSize: '.88rem', cursor: 'pointer', color: T.textMid }}
            >
              Cancelar
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontWeight: 700, fontSize: '.9rem', color: T.textDark }}>
            Lista ({filtered.length}{search ? ` de ${data.length}` : ''})
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, país, producto…"
            style={{ ...IS, width: 240, fontSize: '.83rem' }}
          />
        </div>

        {loading ? (
          <Skeleton rows={6} />
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: T.textMid, fontSize: '.88rem' }}>
            {search ? 'Sin resultados para la búsqueda.' : 'Sin proveedores registrados aún.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: T.primary }}>
                  {['Nombre', 'País', 'Contacto', 'Teléfono', 'Banco', 'Crédito', 'Acciones'].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 1 ? '#F9FBF9' : '#fff' }}>
                    <td style={{ ...tdSt, fontWeight: 600 }}>
                      {r.nombre}
                      {r.productos && (
                        <div style={{ fontSize: '.72rem', color: T.textMid, marginTop: 2 }}>
                          {r.productos.length > 50 ? r.productos.slice(0, 50) + '…' : r.productos}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdSt, color: T.textMid }}>{r.pais || 'Guatemala'}</td>
                    <td style={tdSt}>{r.contacto || '—'}</td>
                    <td style={tdSt}>{r.telefono || '—'}</td>
                    <td style={{ ...tdSt, color: T.textMid }}>{r.banco || '—'}</td>
                    <td style={tdSt}>
                      {r.credito
                        ? <span style={{ padding: '2px 8px', borderRadius: 4, background: '#E8F5E9', color: T.secondary, fontWeight: 600, fontSize: '.78rem' }}>{r.credito}d</span>
                        : <span style={{ color: T.textMid }}>—</span>
                      }
                    </td>
                    <td style={tdSt}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn onClick={() => startEdit(r)} color={T.secondary} small>Editar</Btn>
                        <Btn onClick={() => handleDelete(r.id)} color={T.danger} small>Eliminar</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
