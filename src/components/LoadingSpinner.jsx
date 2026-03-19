export default function LoadingSpinner({ text = 'Cargando...' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60, gap: 16, color: '#6B8070' }}>
      <div style={{
        width: 36, height: 36,
        border: '3px solid #E8DCC8',
        borderTop: '3px solid #1A3D28',
        borderRadius: '50%',
        animation: 'spin .8s linear infinite',
      }} />
      <span style={{ fontSize: '.85rem' }}>{text}</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
