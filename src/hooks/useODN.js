import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { getSemanaISO } from '../lib/fechas'

// Conceptos que se manejan por NAP (los demás van por cantidad / porcentaje)
export const CONCEPTO_DROP = '8811d91f-fee7-446b-b1bd-e2771c0e10c2'      // DROP UNIFIBRA CINCHADO (m lineal)
export const CONCEPTO_NAP = '46067708-f44f-4fa0-84fc-d587e8d2afc3'       // INSTALACION DE NAP (pza)
export const CONCEPTO_POTENCIA = 'cf1b9b75-4aa9-48fd-9b24-0ea2e27a4652'  // PRUEBA DE POTENCIA NAP (pza)
export const ETAPAS = ['Construcción', 'Fusiones', 'Potencias', 'Otros']

const semanaDe = (fecha) => ({ semana: getSemanaISO(fecha), anio: new Date(fecha + 'T12:00:00').getFullYear() })
const num = (n) => Number(n || 0)

export function useODN() {
  const { user } = useAuth()
  const [odns, setOdns] = useState([])
  const [naps, setNaps] = useState([])
  const [alcances, setAlcances] = useState([])     // odn_conceptos
  const [avances, setAvances] = useState([])
  const [cobros, setCobros] = useState([])
  const [conceptos, setConceptos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true); setError(null)
    try {
      const [o, n, a, av, co, c] = await Promise.all([
        supabase.from('odns').select('*').order('rama').order('tipo').order('nombre'),
        supabase.from('odn_naps').select('*').order('nombre'),
        supabase.from('odn_conceptos').select('*'),
        supabase.from('odn_avances').select('*').order('fecha', { ascending: false }),
        supabase.from('odn_cobros').select('*').order('fecha', { ascending: false }),
        supabase.from('conceptos').select('*').order('num'),
      ])
      for (const r of [o, n, a, av, co, c]) if (r.error) throw r.error
      setOdns(o.data || []); setNaps(n.data || []); setAlcances(a.data || [])
      setAvances(av.data || []); setCobros(co.data || []); setConceptos(c.data || [])
    } catch (err) {
      console.error('useODN error:', err); setError(err.message)
    } finally { setLoading(false) }
  }, [user])

  useEffect(() => { load() }, [load])

  // ───────────────────────── Consultas ─────────────────────────
  const getConcepto = (id) => conceptos.find(c => c.id === id) || { nombre: '—', unidad: '', precio: 0, etapa: 'Otros', cobro_por: 'Avance' }
  const getODN = (id) => odns.find(o => o.id === id) || { rama: '—', nombre: '—', tipo: 'ODN' }
  const napsDe = (odnId) => naps.filter(n => n.odn_id === odnId)
  const alcancesDe = (odnId) => alcances.filter(a => a.odn_id === odnId)
  const avancesDe = (odnId) => avances.filter(a => a.odn_id === odnId)
  const cobrosDe = (odnId) => cobros.filter(c => c.odn_id === odnId)
  const cobroEtapa = (odnId, etapa) => cobros.find(c => c.odn_id === odnId && c.etapa === etapa) || null
  const ramas = [...new Set(odns.map(o => o.rama))].sort()

  // Etapas con NAPs se evalúan por NAPs; el resto por avances contra el alcance
  function esEtapaPorNaps(odnId, etapa) {
    return napsDe(odnId).length > 0 && (etapa === 'Construcción' || etapa === 'Potencias')
  }

  // Resumen de un concepto dentro de una ODN: alcance, avanzado, pct, importe
  function resumenConcepto(odnId, conceptoId) {
    const c = getConcepto(conceptoId)
    const alc = alcancesDe(odnId).find(a => a.concepto_id === conceptoId)
    const alcance = alc ? num(alc.cantidad) : 0
    const ns = napsDe(odnId)
    let avanzado
    if (ns.length && conceptoId === CONCEPTO_DROP) avanzado = ns.filter(n => n.construida).reduce((s, n) => s + num(n.metros_lineales), 0)
    else if (ns.length && conceptoId === CONCEPTO_NAP) avanzado = ns.filter(n => n.construida).length
    else if (ns.length && conceptoId === CONCEPTO_POTENCIA) avanzado = ns.filter(n => n.medida).length
    else avanzado = avancesDe(odnId).filter(a => a.concepto_id === conceptoId).reduce((s, a) => s + num(a.cantidad), 0)
    const pct = alcance > 0 ? Math.min(100, (avanzado / alcance) * 100) : 0
    return { concepto: c, alcance, avanzado, restante: Math.max(0, alcance - avanzado), pct, precio: num(c.precio), importeAlcance: alcance * num(c.precio), importeAvanzado: avanzado * num(c.precio) }
  }

  // Resumen de una etapa: conceptos, % ponderado por importe, si está terminada, cobro
  function resumenEtapa(odnId, etapa) {
    const items = alcancesDe(odnId).map(a => resumenConcepto(odnId, a.concepto_id)).filter(r => r.concepto.etapa === etapa)
    const importeAlcance = items.reduce((s, r) => s + r.importeAlcance, 0)
    const importeAvanzado = items.reduce((s, r) => s + r.importeAvanzado, 0)
    const pct = importeAlcance > 0 ? (importeAvanzado / importeAlcance) * 100 : 0
    let terminada
    if (esEtapaPorNaps(odnId, etapa)) {
      const ns = napsDe(odnId)
      terminada = etapa === 'Construcción' ? ns.every(n => n.construida) : ns.every(n => n.medida)
    } else {
      const porTerminar = items.filter(r => r.concepto.cobro_por === 'Terminada')
      terminada = porTerminar.length > 0 && porTerminar.every(r => r.avanzado >= r.alcance - 0.001)
    }
    const cobro = cobroEtapa(odnId, etapa)
    const importeCobrable = items.filter(r => r.concepto.cobro_por === 'Terminada').reduce((s, r) => s + r.importeAlcance, 0)
    return { etapa, items, importeAlcance, importeAvanzado, importeCobrable, pct, terminada, cobro, aplica: items.length > 0 }
  }

  function resumenODN(odnId) {
    const etapas = ETAPAS.map(e => resumenEtapa(odnId, e)).filter(r => r.aplica)
    const ns = napsDe(odnId)
    const valorTotal = etapas.reduce((s, e) => s + e.importeAlcance, 0)
    const valorAvanzado = etapas.reduce((s, e) => s + e.importeAvanzado, 0)
    const valorCobrado = cobrosDe(odnId).reduce((s, c) => s + num(c.importe), 0)
    return {
      etapas, naps: ns,
      napsConstruidas: ns.filter(n => n.construida).length,
      napsMedidas: ns.filter(n => n.medida).length,
      mlTotal: ns.reduce((s, n) => s + num(n.metros_lineales), 0),
      mlConstruidos: ns.filter(n => n.construida).reduce((s, n) => s + num(n.metros_lineales), 0),
      valorTotal, valorAvanzado, valorCobrado,
      pct: valorTotal > 0 ? (valorAvanzado / valorTotal) * 100 : 0,
      estado: etapas.length && etapas.every(e => e.cobro) ? 'Cobrada' : etapas.some(e => e.terminada) ? 'Parcial' : valorAvanzado > 0 ? 'En proceso' : 'Sin iniciar',
    }
  }

  // Semana: facturable = cobros de etapas cerradas + avances de conceptos "por avance"; real = todos los avances
  function resumenSemana(semana, anio) {
    const cobrosSem = cobros.filter(c => Number(c.semana) === Number(semana) && Number(c.anio) === Number(anio))
    const avancesSem = avances.filter(a => Number(a.semana) === Number(semana) && Number(a.anio) === Number(anio))
    const avancesPorAvance = avancesSem.filter(a => getConcepto(a.concepto_id).cobro_por === 'Avance')
    const facturableCobros = cobrosSem.reduce((s, c) => s + num(c.importe), 0)
    const facturableAvances = avancesPorAvance.reduce((s, a) => s + num(a.total), 0)
    const real = avancesSem.reduce((s, a) => s + num(a.total), 0)
    return { cobros: cobrosSem, avances: avancesSem, avancesPorAvance, facturableCobros, facturableAvances, facturable: facturableCobros + facturableAvances, real }
  }

  // ───────────────────────── Cierre de etapa ─────────────────────────
  // Crea el cobro si la etapa quedó terminada y aún no tiene cobro (usa datos frescos de la base)
  async function verificarCierreEtapa(odnId, etapa, fecha) {
    const [{ data: ns }, { data: alcs }, { data: avs }, { data: cobExist }] = await Promise.all([
      supabase.from('odn_naps').select('*').eq('odn_id', odnId),
      supabase.from('odn_conceptos').select('*').eq('odn_id', odnId),
      supabase.from('odn_avances').select('*').eq('odn_id', odnId),
      supabase.from('odn_cobros').select('id').eq('odn_id', odnId).eq('etapa', etapa).maybeSingle(),
    ])
    if (cobExist) return { cerrada: false, yaTenia: true }
    const items = (alcs || []).map(a => ({ ...a, c: getConcepto(a.concepto_id) })).filter(a => a.c.etapa === etapa)
    if (!items.length) return { cerrada: false }
    let terminada
    if ((ns || []).length && (etapa === 'Construcción' || etapa === 'Potencias')) {
      terminada = etapa === 'Construcción' ? ns.every(n => n.construida) : ns.every(n => n.medida)
    } else {
      const porTerminar = items.filter(a => a.c.cobro_por === 'Terminada')
      terminada = porTerminar.length > 0 && porTerminar.every(a => {
        const hecho = (avs || []).filter(x => x.concepto_id === a.concepto_id).reduce((s, x) => s + num(x.cantidad), 0)
        return hecho >= num(a.cantidad) - 0.001
      })
    }
    if (!terminada) return { cerrada: false }
    const importe = items.filter(a => a.c.cobro_por === 'Terminada').reduce((s, a) => s + num(a.cantidad) * num(a.c.precio), 0)
    if (importe <= 0) return { cerrada: false }
    const { error } = await supabase.from('odn_cobros').insert({ user_id: user.id, odn_id: odnId, etapa, tipo: 'Completa', fecha, ...semanaDe(fecha), importe })
    return { cerrada: !error, importe, error }
  }

  // Si una etapa tenía cobro "Completa" y ya no está terminada (se eliminó un avance), quita el cobro
  async function revisarCobroTrasReversion(odnId, etapa) {
    const cob = cobroEtapa(odnId, etapa)
    if (!cob || cob.tipo !== 'Completa') return
    const r = resumenEtapa(odnId, etapa)
    if (!r.terminada) await supabase.from('odn_cobros').delete().eq('id', cob.id)
  }

  // ───────────────────────── Registro de avances ─────────────────────────
  async function insertarAvance({ odn_id, concepto_id, cuadrilla_id, fecha, cantidad, porcentaje, notas }) {
    const c = getConcepto(concepto_id)
    const total = num(cantidad) * num(c.precio)
    const { data, error } = await supabase.from('odn_avances').insert({
      user_id: user.id, odn_id, concepto_id, cuadrilla_id: cuadrilla_id || null, fecha, ...semanaDe(fecha),
      porcentaje: porcentaje ?? null, cantidad, precio_unitario: num(c.precio), total, notas: notas || null,
    }).select().single()
    return { data, error }
  }

  // Construcción por NAPs: marca NAPs como construidas, registra avance de drop y NAP, cierra etapa si aplica
  async function registrarConstruccion({ odn_id, nap_ids, cuadrilla_id, fecha, notas }) {
    const sel = napsDe(odn_id).filter(n => nap_ids.includes(n.id) && !n.construida)
    if (!sel.length) return { error: { message: 'No hay NAPs nuevos por registrar.' } }
    const ml = sel.reduce((s, n) => s + num(n.metros_lineales), 0)
    const mlTotal = napsDe(odn_id).reduce((s, n) => s + num(n.metros_lineales), 0)
    const napTotal = napsDe(odn_id).length
    const a1 = await insertarAvance({ odn_id, concepto_id: CONCEPTO_DROP, cuadrilla_id, fecha, cantidad: ml, porcentaje: mlTotal ? (ml / mlTotal) * 100 : null, notas })
    if (a1.error) return { error: a1.error }
    const a2 = await insertarAvance({ odn_id, concepto_id: CONCEPTO_NAP, cuadrilla_id, fecha, cantidad: sel.length, porcentaje: napTotal ? (sel.length / napTotal) * 100 : null, notas })
    if (a2.error) return { error: a2.error }
    const { error } = await supabase.from('odn_naps')
      .update({ construida: true, construida_fecha: fecha, construida_cuadrilla_id: cuadrilla_id || null, construida_avance_id: a1.data.id })
      .in('id', sel.map(n => n.id))
    if (error) return { error }
    const cierre = await verificarCierreEtapa(odn_id, 'Construcción', fecha)
    await load()
    return { error: null, naps: sel.length, ml, cierre }
  }

  // Potencias por NAPs: marca NAPs medidas, registra avance, cierra etapa si aplica
  async function registrarMedicion({ odn_id, nap_ids, cuadrilla_id, fecha, notas }) {
    const sel = napsDe(odn_id).filter(n => nap_ids.includes(n.id) && !n.medida)
    if (!sel.length) return { error: { message: 'No hay NAPs nuevos por registrar.' } }
    const napTotal = napsDe(odn_id).length
    const a = await insertarAvance({ odn_id, concepto_id: CONCEPTO_POTENCIA, cuadrilla_id, fecha, cantidad: sel.length, porcentaje: napTotal ? (sel.length / napTotal) * 100 : null, notas })
    if (a.error) return { error: a.error }
    const { error } = await supabase.from('odn_naps')
      .update({ medida: true, medida_fecha: fecha, medida_cuadrilla_id: cuadrilla_id || null, medida_avance_id: a.data.id })
      .in('id', sel.map(n => n.id))
    if (error) return { error }
    const cierre = await verificarCierreEtapa(odn_id, 'Potencias', fecha)
    await load()
    return { error: null, naps: sel.length, cierre }
  }

  // Avance por cantidad o porcentaje (fusiones, tendidos, hilado, otros)
  async function registrarAvance({ odn_id, concepto_id, cuadrilla_id, fecha, cantidad, porcentaje, notas }) {
    const r = resumenConcepto(odn_id, concepto_id)
    let cant = num(cantidad)
    let pct = porcentaje != null ? num(porcentaje) : null
    if (pct != null && r.alcance > 0) cant = r.alcance * pct / 100
    if (cant <= 0) return { error: { message: 'La cantidad debe ser mayor a cero.' } }
    if (r.alcance > 0 && r.avanzado + cant > r.alcance + 0.001) return { error: { message: `Excede el alcance: quedan ${r.restante.toLocaleString('es-MX')} ${r.concepto.unidad} por avanzar.` } }
    if (pct == null && r.alcance > 0) pct = (cant / r.alcance) * 100
    const a = await insertarAvance({ odn_id, concepto_id, cuadrilla_id, fecha, cantidad: cant, porcentaje: pct, notas })
    if (a.error) return { error: a.error }
    const etapa = r.concepto.etapa
    const cierre = r.concepto.cobro_por === 'Terminada' ? await verificarCierreEtapa(odn_id, etapa, fecha) : { cerrada: false }
    await load()
    return { error: null, cantidad: cant, cierre }
  }

  // Liberar a cobro una etapa sin terminar (p. ej. potencias sin acceso): importe = lo avanzado
  async function liberarParcial({ odn_id, etapa, fecha, motivo }) {
    if (cobroEtapa(odn_id, etapa)) return { error: { message: 'Esta etapa ya tiene cobro.' } }
    const r = resumenEtapa(odn_id, etapa)
    const importe = r.items.filter(i => i.concepto.cobro_por === 'Terminada').reduce((s, i) => s + i.importeAvanzado, 0)
    if (importe <= 0) return { error: { message: 'No hay avance que liberar.' } }
    const { error } = await supabase.from('odn_cobros').insert({ user_id: user.id, odn_id, etapa, tipo: 'Parcial', fecha, ...semanaDe(fecha), importe, motivo: motivo || null })
    if (!error) await load()
    return { error, importe }
  }

  async function eliminarCobro(id) {
    const { error } = await supabase.from('odn_cobros').delete().eq('id', id)
    if (!error) await load()
    return { error }
  }

  // Eliminar un avance: revierte NAPs ligados y, si la etapa deja de estar terminada, quita su cobro
  async function eliminarAvance(id) {
    const a = avances.find(x => x.id === id)
    if (!a) return { error: { message: 'Avance no encontrado' } }
    if (a.concepto_id === CONCEPTO_DROP) {
      await supabase.from('odn_naps').update({ construida: false, construida_fecha: null, construida_cuadrilla_id: null, construida_avance_id: null }).eq('construida_avance_id', id)
      // el avance de NAP hermano (misma odn, fecha, cuadrilla, concepto NAP) se elimina también
      await supabase.from('odn_avances').delete().eq('odn_id', a.odn_id).eq('concepto_id', CONCEPTO_NAP).eq('fecha', a.fecha).eq('created_at', a.created_at)
    }
    if (a.concepto_id === CONCEPTO_POTENCIA) {
      await supabase.from('odn_naps').update({ medida: false, medida_fecha: null, medida_cuadrilla_id: null, medida_avance_id: null }).eq('medida_avance_id', id)
    }
    const { error } = await supabase.from('odn_avances').delete().eq('id', id)
    if (error) return { error }
    await load()
    const etapa = getConcepto(a.concepto_id).etapa
    await revisarCobroTrasReversion(a.odn_id, etapa)
    await load()
    return { error: null }
  }

  // ───────────────────────── Catálogo ─────────────────────────
  async function addODN(data) {
    const { data: row, error } = await supabase.from('odns').insert({ ...data, user_id: user.id }).select().single()
    if (!error) await load()
    return { error, id: row?.id }
  }
  async function updateODN(id, data) {
    const { error } = await supabase.from('odns').update(data).eq('id', id)
    if (!error) await load()
    return { error }
  }
  async function deleteODN(id) {
    const { error } = await supabase.from('odns').delete().eq('id', id)
    if (!error) await load()
    return { error }
  }
  // NAPs: al agregar/quitar se recalcula el alcance de drop, NAP y potencia
  async function sincronizarAlcanceNaps(odnId) {
    const { data: ns } = await supabase.from('odn_naps').select('*').eq('odn_id', odnId)
    const lista = ns || []
    const ml = lista.reduce((s, n) => s + num(n.metros_lineales), 0)
    const filas = [
      { odn_id: odnId, concepto_id: CONCEPTO_DROP, cantidad: ml },
      { odn_id: odnId, concepto_id: CONCEPTO_NAP, cantidad: lista.length },
      { odn_id: odnId, concepto_id: CONCEPTO_POTENCIA, cantidad: lista.length },
    ]
    if (!lista.length) { await supabase.from('odn_conceptos').delete().eq('odn_id', odnId).in('concepto_id', [CONCEPTO_DROP, CONCEPTO_NAP, CONCEPTO_POTENCIA]); return }
    await supabase.from('odn_conceptos').upsert(filas, { onConflict: 'odn_id,concepto_id' })
  }
  async function addNaps(odnId, lista) {   // lista: [{ nombre, drop_m, metros_lineales }]
    const { error } = await supabase.from('odn_naps').insert(lista.map(n => ({ ...n, odn_id: odnId })))
    if (!error) { await sincronizarAlcanceNaps(odnId); await load() }
    return { error }
  }
  async function updateNap(id, data) {
    const n = naps.find(x => x.id === id)
    const { error } = await supabase.from('odn_naps').update(data).eq('id', id)
    if (!error) { if (n) await sincronizarAlcanceNaps(n.odn_id); await load() }
    return { error }
  }
  async function deleteNap(id) {
    const n = naps.find(x => x.id === id)
    const { error } = await supabase.from('odn_naps').delete().eq('id', id)
    if (!error) { if (n) await sincronizarAlcanceNaps(n.odn_id); await load() }
    return { error }
  }
  // Alcance manual (fusiones, tendidos, hilado, otros)
  async function setAlcance(odnId, conceptoId, cantidad) {
    const { error } = num(cantidad) > 0
      ? await supabase.from('odn_conceptos').upsert({ odn_id: odnId, concepto_id: conceptoId, cantidad: num(cantidad) }, { onConflict: 'odn_id,concepto_id' })
      : await supabase.from('odn_conceptos').delete().eq('odn_id', odnId).eq('concepto_id', conceptoId)
    if (!error) await load()
    return { error }
  }

  const fmt$ = (n) => '$' + num(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return {
    odns, naps, alcances, avances, cobros, conceptos, ramas, loading, error, reload: load, fmt$,
    getConcepto, getODN, napsDe, alcancesDe, avancesDe, cobrosDe, cobroEtapa, esEtapaPorNaps,
    resumenConcepto, resumenEtapa, resumenODN, resumenSemana,
    registrarConstruccion, registrarMedicion, registrarAvance, liberarParcial, eliminarAvance, eliminarCobro,
    addODN, updateODN, deleteODN, addNaps, updateNap, deleteNap, setAlcance,
  }
}