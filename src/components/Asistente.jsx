import { useState, useRef, useEffect } from 'react'
import { useDB } from '../hooks/useDB'
import { useIG } from '../hooks/useIG'

function AsistenteInner() {
  const db = useDB()
  const ig = useIG()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hola! Soy el asistente de TeleControl. Puedo ayudarte a analizar tu produccion, nomina, gastos e ingresos, o explicarte como usar cualquier modulo. En que te ayudo?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  function fmt(n) {
    return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })
  }

  function buildContext() {
    try {
      const totalProd = db.produccion.reduce((a, r) => a + Number(r.total || 0), 0)
      const totalNomina = ig.nomina.reduce((a, r) => a + Number(r.neto_pagar || 0), 0)
      const totalGastos = ig.gastos.reduce((a, r) => a + Number(r.monto || 0), 0)
      const totalIngresos = ig.ingresos.reduce((a, r) => a + Number(r.monto || 0), 0)
      const utilidad = totalIngresos - totalNomina - totalGastos

      return `DATOS ACTUALES:
Produccion: ${db.produccion.length} registros | Total: ${fmt(totalProd)}
Cuadrillas: ${db.cuadrillas.map(c => c.nombre).join(', ')}
Proyectos: ${db.proyectos.map(p => p.nombre).join(', ')}
CN pendientes: ${db.registrosCN.filter(r => r.estado === 'Pendiente').length}
Empleados: ${ig.empleados.length} (${ig.empleados.filter(e => (e.tipo_pago||'Semanal')==='Semanal').length} semanales, ${ig.empleados.filter(e => e.tipo_pago==='Quincenal').length} quincenales)
Nomina total: ${fmt(totalNomina)} | Gastos total: ${fmt(totalGastos)}
Ingresos total: ${fmt(totalIngresos)} | Utilidad neta: ${fmt(utilidad)}
Prestamos activos: ${ig.prestamos.filter(p => p.estado === 'Activo').length}
Cortes pendientes: ${db.cortes.filter(c => c.estado === 'Pendiente').length}`
    } catch (e) {
      return 'Contexto no disponible'
    }
  }

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)
    try {
      const apiMessages = [...messages, userMsg].slice(1)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, context: buildContext() }),
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setMessages(prev => [...prev, { role: 'assistant', content: data.content }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + err.message }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const sugerencias = [
    'Cual es la utilidad neta acumulada?',
    'Como registro un avance de produccion?',
    'Cuantos empleados tengo activos?',
    'Como genero un corte semanal?',
  ]

  return (
    <>
      <button onClick={() => setOpen(o => !o)} style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 200,
        width: 52, height: 52, borderRadius: '50%',
        background: '#0F3460', border: 'none', cursor: 'pointer',
        boxShadow: '0 4px 20px rgba(15,52,96,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {open
          ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F5A623" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        }
      </button>

      {open && (
        <div style={{
          position: 'fixed', bottom: 84, right: 24, zIndex: 200,
          width: 380, height: 520, background: '#fff',
          borderRadius: 16, boxShadow: '0 8px 40px rgba(15,52,96,0.2)',
          border: '1px solid #E8ECF4', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ background: '#0F3460', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#F5A623', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#0F3460', flexShrink: 0 }}>N</div>
            <div>
              <div style={{ color: '#fff', fontWeight: 500, fontSize: 14 }}>Asistente TeleControl</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>Powered by Claude - NOVUS</div>
            </div>
            <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#2ECC71' }} />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '82%', padding: '9px 13px',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? '#0F3460' : '#F4F6FB',
                  color: m.role === 'user' ? '#fff' : '#2D3A5A',
                  fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap',
                }}>{m.content}</div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex' }}>
                <div style={{ background: '#F4F6FB', padding: '10px 14px', borderRadius: '14px 14px 14px 4px', display: 'flex', gap: 4 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#0F3460', animation: 'pulse 1s ' + (i*0.2) + 's infinite' }} />
                  ))}
                </div>
              </div>
            )}
            {messages.length === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                {sugerencias.map((s, i) => (
                  <button key={i} onClick={() => setInput(s)} style={{
                    background: '#fff', border: '1px solid #E8ECF4', borderRadius: 8,
                    padding: '7px 12px', fontSize: 12, color: '#0F3460', cursor: 'pointer', textAlign: 'left',
                  }}>{s}</button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ padding: '10px 12px', borderTop: '1px solid #E8ECF4', display: 'flex', gap: 8 }}>
            <textarea
              value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="Escribe tu pregunta..." rows={1}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 10, border: '1px solid #CBD5E8', fontSize: 13, resize: 'none', outline: 'none', fontFamily: 'inherit', color: '#2D3A5A' }}
            />
            <button onClick={sendMessage} disabled={!input.trim() || loading} style={{
              width: 38, height: 38, borderRadius: 10, border: 'none', flexShrink: 0, alignSelf: 'flex-end',
              background: input.trim() && !loading ? '#0F3460' : '#E8ECF4', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !loading ? '#F5A623' : '#A0AABB'} strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <style>{'@keyframes pulse{0%,100%{opacity:.4}50%{opacity:1}}'}</style>
        </div>
      )}
    </>
  )
}

export default function Asistente() {
  return <AsistenteInner />
}