import { useState } from 'react';
import { useCollection, useWrite } from '../../hooks/useFirestore';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useToast } from '../../components/Toast';

const C = { green:'#1A3D28',acc:'#4A9E6A',sand:'#E8DCC8',danger:'#c0392b',bg:'#F9F6EF' };

const BLANK = { nombre:'', pais:'Guatemala', contacto:'', telefono:'', email:'', banco:'', credito:'', productos:'', obs:'' };

export default function Proveedores() {
  const toast = useToast();
  const { data, loading } = useCollection('proveedores', { orderField:'nombre', limit:300 });
  const { add, update, remove, saving } = useWrite('proveedores');

  const [form, setForm] = useState(BLANK);
  const [editId, setEditId] = useState(null);
  const [search, setSearch] = useState('');

  const handleSave = async () => {
    if (!form.nombre) { toast('⚠ Nombre requerido', 'error'); return; }
    if (editId) {
      await update(editId, form);
      toast('✓ Proveedor actualizado');
    } else {
      await add(form);
      toast('✓ Proveedor agregado');
    }
    setForm(BLANK); setEditId(null);
  };

  const startEdit = (r) => { setForm({ ...BLANK, ...r }); setEditId(r.id); };
  const cancelEdit = () => { setForm(BLANK); setEditId(null); };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar proveedor?')) return;
    await remove(id);
    toast('Proveedor eliminado');
  };

  if (loading) return <LoadingSpinner/>;

  const filtered = data.filter(r => !search || r.nombre?.toLowerCase().includes(search.toLowerCase()) || r.pais?.toLowerCase().includes(search.toLowerCase()));

  const inp = (id, label, ph='') => (
    <label style={{display:'flex',flexDirection:'column',gap:4,fontSize:'.72rem',fontWeight:700,textTransform:'uppercase',color:C.acc,letterSpacing:'.06em'}}>
      {label}
      <input value={form[id]} onChange={e=>setForm(f=>({...f,[id]:e.target.value}))} placeholder={ph}
        style={{padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none'}}/>
    </label>
  );

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>🏭 Proveedores y Productores</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:24}}>Base de datos de proveedores</p>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20,marginBottom:20}}>
        <div style={{fontWeight:700,color:C.green,marginBottom:16}}>{editId?'Editar proveedor':'Nuevo proveedor'}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:16}}>
          {inp('nombre','Nombre *')}
          {inp('pais','País')}
          {inp('contacto','Contacto')}
          {inp('telefono','Teléfono')}
          {inp('email','Email')}
          {inp('banco','Banco / Cuenta')}
          {inp('credito','Crédito (días)')}
          {inp('productos','Productos que provee')}
        </div>
        <textarea value={form.obs} onChange={e=>setForm(f=>({...f,obs:e.target.value}))}
          placeholder="Observaciones..." rows={2}
          style={{width:'100%',padding:'9px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',resize:'vertical'}}/>
        <div style={{display:'flex',gap:10,marginTop:12}}>
          <button onClick={handleSave} disabled={saving}
            style={{padding:'12px 28px',background:saving?'#ccc':C.green,color:'#fff',border:'none',borderRadius:6,fontWeight:700,fontSize:'.88rem',cursor:saving?'not-allowed':'pointer'}}>
            {saving?'Guardando...':editId?'Actualizar':'Agregar'}
          </button>
          {editId && <button onClick={cancelEdit} style={{padding:'12px 20px',background:'#f0f0f0',border:'none',borderRadius:6,fontWeight:600,cursor:'pointer'}}>Cancelar</button>}
        </div>
      </div>

      <div style={{background:'#fff',border:`1px solid ${C.sand}`,borderRadius:8,padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <div style={{fontWeight:700,color:C.green}}>Lista ({filtered.length})</div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar..."
            style={{padding:'7px 12px',border:`1.5px solid ${C.sand}`,borderRadius:4,fontSize:'.85rem',outline:'none',width:180}}/>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:'.8rem'}}>
            <thead><tr style={{background:C.bg}}>
              {['Nombre','País','Contacto','Teléfono','Banco','Crédito','Productos','Acciones'].map(h=>(
                <th key={h} style={{padding:'7px 10px',textAlign:'left',fontWeight:700,color:'#6B8070',borderBottom:`1px solid ${C.sand}`}}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map(r=>(
                <tr key={r.id} style={{borderBottom:`1px solid ${C.sand}`}}>
                  <td style={{padding:'7px 10px',fontWeight:600}}>{r.nombre}</td>
                  <td style={{padding:'7px 10px'}}>{r.pais||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.contacto||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.telefono||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.banco||'—'}</td>
                  <td style={{padding:'7px 10px'}}>{r.credito?`${r.credito}d`:'—'}</td>
                  <td style={{padding:'7px 10px',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.productos||'—'}</td>
                  <td style={{padding:'7px 10px'}}>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>startEdit(r)} style={{padding:'3px 10px',background:C.acc,color:'#fff',border:'none',borderRadius:4,fontSize:'.72rem',fontWeight:600,cursor:'pointer'}}>Editar</button>
                      <button onClick={()=>handleDelete(r.id)} style={{padding:'3px 10px',background:C.danger,color:'#fff',border:'none',borderRadius:4,fontSize:'.72rem',fontWeight:600,cursor:'pointer'}}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length===0 && <div style={{textAlign:'center',padding:24,color:'#aaa'}}>Sin proveedores</div>}
        </div>
      </div>
    </div>
  );
}
