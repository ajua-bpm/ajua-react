const C = { green:'#1A3D28', sand:'#E8DCC8' };

export default function Croquis() {
  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:800,color:C.green,marginBottom:4}}>🗺️ Croquis de Bodega</h1>
      <p style={{fontSize:'.82rem',color:'#6B8070',marginBottom:16}}>Distribución y plano de la bodega</p>
      <div style={{border:`1px solid ${C.sand}`,borderRadius:8,overflow:'hidden',background:'#fff'}}>
        <iframe
          src="https://agroajua.com/croquis_bodega.html"
          title="Croquis Bodega"
          style={{width:'100%',height:'80vh',border:'none',display:'block'}}
        />
      </div>
    </div>
  );
}
