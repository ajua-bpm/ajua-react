// Config de las 3 áreas (workspaces). Pantalla de entrada con botones grandes,
// cada área muestra solo su propio menú en el sidebar.

export const AREAS = [
  {
    id: 'admin',
    label: 'Administración',
    icon: '💼',
    desc: 'Finanzas, cuentas, personal y comercial',
    home: '/dashboard',
    color: '#1F3A2C',   // forest
  },
  {
    id: 'oper',
    label: 'Operación',
    icon: '📦',
    desc: 'Inventario, Walmart, ventas y despachos',
    home: '/stock',
    color: '#A8835A',   // ochre
  },
  {
    id: 'bpm',
    label: 'Cumplimiento',
    icon: '🧪',
    desc: 'BPM: transporte, bodega e higiene',
    home: '/bpm/al',
    color: '#2D6645',   // canopy
  },
];

// Cada sección del menú pertenece a un área
export const SECTION_AREA = {
  'Inicio': 'admin',
  'Finanzas': 'admin',
  'Comercial': 'admin',
  'Equipo': 'admin',
  'Sistema': 'admin',
  'Inventario y Ventas': 'oper',
  'Transporte': 'bpm',
  'Bodega': 'bpm',
  'Higiene': 'bpm',
};

export const areaById = (id) => AREAS.find(a => a.id === id) || AREAS[0];
