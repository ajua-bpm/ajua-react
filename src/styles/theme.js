// Design tokens — AJÚA BPM v2 — Professional Enterprise
export const T = {
  // Colors
  primary:   '#1B5E20',   // Verde oscuro — headers, botones primarios
  secondary: '#2E7D32',   // Verde medio — acentos, links
  accent:    '#43A047',   // Verde claro — hover states
  white:     '#FFFFFF',
  bgLight:   '#F5F5F5',   // Fondo app
  bgGreen:   '#E8F5E9',   // Verde claro fondo
  bgCard:    '#FFFFFF',   // Fondo tarjetas
  border:    '#E0E0E0',   // Bordes
  borderMed: '#BDBDBD',   // Bordes con más peso
  textDark:  '#1A1A18',   // Texto principal
  textMid:   '#6B6B60',   // Texto secundario
  textLight: '#6B6B60',   // Texto terciario
  danger:    '#C62828',   // Rojo error
  warn:      '#E65100',   // Naranja advertencia
  info:      '#1565C0',   // Azul info
  success:   '#2E7D32',   // Verde éxito

  // Shadows
  shadow:   '0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06)',
  shadowMd: '0 4px 8px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.05)',
  shadowLg: '0 10px 24px rgba(0,0,0,.10)',

  // Border radius
  r:   '8px',
  rSm: '4px',
  rLg: '12px',

  // Table header bg
  tableHead: '#1B5E20',
  tableHeadTxt: '#FFFFFF',
  tableRowAlt: '#F9FBF9',
  tableRowHover: '#E8F5E9',
};

// Status badge colors
export const STATUS = {
  pendiente:   { bg: '#FFF3E0', color: '#E65100', label: '⏳ Pendiente' },
  procesando:  { bg: '#E3F2FD', color: '#1565C0', label: '⚙️ Procesando' },
  entregado:   { bg: '#E8F5E9', color: '#2E7D32', label: '🚛 Entregado' },
  cobrado:     { bg: '#E8F5E9', color: '#1B5E20', label: '✓ Cobrado' },
  cancelado:   { bg: '#FFEBEE', color: '#C62828', label: '✗ Cancelado' },
  aprobado:    { bg: '#E8F5E9', color: '#2E7D32', label: '✓ Aprobado' },
  rechazado:   { bg: '#FFEBEE', color: '#C62828', label: '✗ Rechazado' },
  cumple:      { bg: '#E8F5E9', color: '#2E7D32', label: '✓ Cumple' },
  no_cumple:   { bg: '#FFEBEE', color: '#C62828', label: '✗ No cumple' },
  borrador:    { bg: '#F5F5F5', color: '#6B6B60', label: '📝 Borrador' },
  enviada:     { bg: '#FFF3E0', color: '#E65100', label: '📤 Enviada' },
  activo:      { bg: '#E8F5E9', color: '#2E7D32', label: '● Activo' },
  inactivo:    { bg: '#FFEBEE', color: '#C62828', label: '● Inactivo' },
  presente:    { bg: '#E8F5E9', color: '#2E7D32', label: '✓ Presente' },
  ausente:     { bg: '#FFEBEE', color: '#C62828', label: '✗ Ausente' },
  permiso:     { bg: '#FFF3E0', color: '#E65100', label: '📋 Permiso' },
  descontado:  { bg: '#E8F5E9', color: '#2E7D32', label: '✓ Descontado' },
};

// Shared style helpers
export const S = {
  card: {
    background: '#FFFFFF',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,.10), 0 1px 2px rgba(0,0,0,.06)',
    padding: '20px',
    marginBottom: '20px',
  },
  pageTitle: {
    fontSize: '1.35rem',
    fontWeight: 700,
    color: '#1B5E20',
    marginBottom: 4,
    letterSpacing: '-.01em',
  },
  pageSubtitle: {
    fontSize: '.82rem',
    color: '#6B6B60',
    marginBottom: '24px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: '.72rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    color: '#6B6B60',
    letterSpacing: '.06em',
  },
  input: {
    padding: '9px 12px',
    border: '1.5px solid #E0E0E0',
    borderRadius: '6px',
    fontSize: '.88rem',
    outline: 'none',
    color: '#1A1A18',
    background: '#fff',
    transition: 'border-color .15s',
  },
  select: {
    padding: '9px 12px',
    border: '1.5px solid #E0E0E0',
    borderRadius: '6px',
    fontSize: '.88rem',
    outline: 'none',
    color: '#1A1A18',
    background: '#fff',
    cursor: 'pointer',
  },
  btnPrimary: {
    padding: '10px 24px',
    background: '#1B5E20',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '.88rem',
    cursor: 'pointer',
    letterSpacing: '.02em',
  },
  btnSecondary: {
    padding: '9px 20px',
    background: '#fff',
    color: '#2E7D32',
    border: '1.5px solid #2E7D32',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '.88rem',
    cursor: 'pointer',
  },
  btnDanger: {
    padding: '9px 16px',
    background: '#C62828',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 600,
    fontSize: '.82rem',
    cursor: 'pointer',
  },
  th: {
    padding: '10px 14px',
    textAlign: 'left',
    fontWeight: 600,
    fontSize: '.75rem',
    textTransform: 'uppercase',
    letterSpacing: '.05em',
    background: '#1B5E20',
    color: '#FFFFFF',
    borderBottom: 'none',
  },
  td: {
    padding: '9px 14px',
    fontSize: '.83rem',
    color: '#1A1A18',
    borderBottom: '1px solid #F0F0F0',
  },
};
