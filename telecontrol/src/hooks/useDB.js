import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useDB() {
  const { user } = useAuth()
  const [cuadrillas, setCuadrillas] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [conceptos, setConceptos] = useState([])
  const [produccion, setProduccion] = useState([])
  const [registrosCN, setRegistrosCN] = useState([])
  const [cortes, setCortes] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const uid = user.id
    const [c, pr, cn, prod, rcn, co] = await Promise.all([
      supabase.from('cuadrillas').select('*').eq('user_id', uid).order('nombre'),
      supabase.from('proyectos').select('*').eq('user_id', uid).order('nombre'),
      supabase.from('conceptos').select('*').eq('user_id', uid).order('num'),
      supabase.from('produccion').select('*').eq('user_id', uid).order('fecha', { ascending: false }),
      supabase.from('registros_cn').select('*').eq('user_id', uid).order('mes', { ascending: false }),
      supabase.from('cortes').select('*').eq('user_id', uid).order('fecha_corte', { ascending: false }),
    ])
    setCuadrillas(c.data || [])
    setProyectos(pr.data || [])
    setConceptos(cn.data || [])
    setProduccion(prod.data || [])
    setRegistrosCN(rcn.data || [])
    setCortes(co.data || [])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // CUADRILLAS
  async function addCuadrilla(data) {
    const { error } = await supabase.from('cuadrillas').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function deleteCuadrilla(id) {
    const { error } = await supabase.from('cuadrillas').delete().eq('id', id)
    if (!error) load()
    return { error }
  }

  // PROYECTOS
  async function addProyecto(data) {
    const { error } = await supabase.from('proyectos').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function deleteProyecto(id) {
    const { error } = await supabase.from('proyectos').delete().eq('id', id)
    if (!error) load()
    return { error }
  }

  // CONCEPTOS
  async function addConcepto(data) {
    const { error } = await supabase.from('conceptos').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function deleteConcepto(id) {
    const { error } = await supabase.from('conceptos').delete().eq('id', id)
    if (!error) load()
    return { error }
  }

  // PRODUCCION
  async function addProduccion(data) {
    const { error } = await supabase.from('produccion').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function deleteProduccion(id) {
    const { error } = await supabase.from('produccion').delete().eq('id', id)
    if (!error) load()
    return { error }
  }

  // REGISTROS CN
  async function addRegistroCN(data) {
    const { error } = await supabase.from('registros_cn').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function updateRegistroCNEstado(id, estado) {
    const { error } = await supabase.from('registros_cn').update({ estado }).eq('id', id)
    if (!error) load()
    return { error }
  }
  async function deleteRegistroCN(id) {
    const { error } = await supabase.from('registros_cn').delete().eq('id', id)
    if (!error) load()
    return { error }
  }

  // CORTES
  async function addCorte(data) {
    const { error } = await supabase.from('cortes').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function togglePagoCorte(id, estadoActual) {
    const nuevoEstado = estadoActual === 'Pagado' ? 'Pendiente' : 'Pagado'
    const update = {
      estado_pago: nuevoEstado,
      fecha_pago: nuevoEstado === 'Pagado' ? new Date().toISOString().split('T')[0] : null
    }
    const { error } = await supabase.from('cortes').update(update).eq('id', id)
    if (!error) load()
    return { error }
  }
  async function deleteCorte(id) {
    const { error } = await supabase.from('cortes').delete().eq('id', id)
    if (!error) load()
    return { error }
  }

  // Helpers
  function getCuadrilla(id) { return cuadrillas.find(c => c.id === id) || { nombre: '—' } }
  function getProyecto(id) { return proyectos.find(p => p.id === id) || { nombre: '—', ciudad: '—' } }
  function getConcepto(id) { return conceptos.find(c => c.id === id) || { nombre: '—', unidad: '—', precio: 0 } }
  function fmt$(n) { return '$' + Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

  return {
    cuadrillas, proyectos, conceptos, produccion, registrosCN, cortes, loading, reload: load,
    addCuadrilla, deleteCuadrilla,
    addProyecto, deleteProyecto,
    addConcepto, deleteConcepto,
    addProduccion, deleteProduccion,
    addRegistroCN, updateRegistroCNEstado, deleteRegistroCN,
    addCorte, togglePagoCorte, deleteCorte,
    getCuadrilla, getProyecto, getConcepto, fmt$
  }
}
