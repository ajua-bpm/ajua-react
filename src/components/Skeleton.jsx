export default function Skeleton({ rows = 5 }) {
  return (
    <div style={{ padding: '8px 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          height: 36,
          background: 'linear-gradient(90deg, #F0F0F0 25%, #E8E8E8 50%, #F0F0F0 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.4s infinite',
          borderRadius: 6,
          marginBottom: 8,
          opacity: 1 - i * 0.1,
        }} />
      ))}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 8,
      padding: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,.10)',
      marginBottom: 20,
    }}>
      <div style={{ height: 20, width: '40%', background: '#F0F0F0', borderRadius: 4, marginBottom: 16,
        animation: 'shimmer 1.4s infinite', backgroundSize: '200% 100%',
        backgroundImage: 'linear-gradient(90deg, #F0F0F0 25%, #E8E8E8 50%, #F0F0F0 75%)' }} />
      <Skeleton rows={4} />
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
