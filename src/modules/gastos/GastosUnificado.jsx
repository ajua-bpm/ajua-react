import { useState } from 'react';
import Gastos from './Gastos';
import GastosSemanales from '../ventas/GastosSemanales';
import Maquila from '../ventas/Maquila';

const T = { primary:'#1B5E20', border:'#E0E0E0', white:'#FFFFFF', textMid:'#6B6B60' };

const TABS = [
  { id:'diarios',   label:'Gastos Diarios',   Component: Gastos          },
  { id:'semanales', label:'Gastos Semanales',  Component: GastosSemanales },
  { id:'generales', label:'Gastos Generales',  Component: Maquila         },
];

export default function GastosUnificado() {
  const [tab, setTab] = useState('diarios');
  const Active = TABS.find(t => t.id === tab).Component;

  return (
    <div style={{ fontFamily:'inherit', maxWidth:1160 }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:'1.35rem', fontWeight:800, color:T.primary, margin:0 }}>Gastos</h1>
        <p style={{ fontSize:'.82rem', color:T.textMid, marginTop:4 }}>Diarios · Semanales · Generales</p>
      </div>

      <div style={{ display:'flex', gap:0, marginBottom:28, borderBottom:`2px solid ${T.border}` }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'10px 22px',
            fontWeight: tab === t.id ? 700 : 500,
            fontSize:'.85rem',
            cursor:'pointer',
            background:'none',
            border:'none',
            borderBottom: tab === t.id ? `3px solid ${T.primary}` : '3px solid transparent',
            color: tab === t.id ? T.primary : T.textMid,
            marginBottom:'-2px',
            fontFamily:'inherit',
            transition:'all .12s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      <Active />
    </div>
  );
}
