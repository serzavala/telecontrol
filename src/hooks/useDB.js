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
    if (!user) { setLoading(false); return }
    setLoading(true)
    try {
      // SIN filtro por user_id — todos los usuarios ven los mismos datos
      const [cua, pro, con, prod, cn, cor] = await Promise.all([
        supabase.from('cuadrillas').select('*').order('nombre'),
        supabase.from('proyectos').select('*').order('nombre'),
        supabase.from('conceptos').select('*').order('num'),
        supabase.from('produccion').select('*').order('fecha', { ascending: false }),
        supabase.from('registros_cn').select('*').order('mes', { ascending: false }),
        supabase.from('cortes').select('*').order('fecha_corte', { ascending: false }),
      ])
      setCuadrillas(cua.data || [])
      setProyectos(pro.data || [])
      setConceptos(con.data || [])
      setProduccion(prod.data || [])
      setRegistrosCN(cn.data || [])
      setCortes(cor.data || [])
    } catch (err) {
      console.error('useDB error:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  const getCuadrilla = (id) => cuadrillas.find(c => c.id === id) || { nombre: '—' }
  const getProyecto = (id) => proyectos.find(p => p.id === id) || { nombre: '—', ciudad: '—' }
  const getConcepto = (id) => conceptos.find(c => c.id === id) || { nombre: '—', unidad: '', num: '' }

  async function addCuadrilla(data) {
    const { error } = await supabase.from('cuadrillas').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function updateCuadrilla(id, data) {
    const { error } = await supabase.from('cuadrillas').update(data).eq('id', id)
    if (!error) load()
    return { error }
  }
  async function deleteCuadrilla(id) {
    const { error } = await supabase.from('cuadrillas').delete().eq('id', id)
    if (!error) load()
    return { error }
  }

  async function addProyecto(data) {
    const { error } = await supabase.from('proyectos').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function updateProyecto(id, data) {
    const { error } = await supabase.from('proyectos').update(data).eq('id', id)
    if (!error) load()
    return { error }
  }
  async function deleteProyecto(id) {
    const { error } = await supabase.from('proyectos').delete().eq('id', id)
    if (!error) load()
    return { error }
  }

  async function addConcepto(data) {
    const { error } = await supabase.from('conceptos').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function updateConcepto(id, data) {
    const { error } = await supabase.from('conceptos').update(data).eq('id', id)
    if (!error) load()
    return { error }
  }
  async function deleteConcepto(id) {
    const { error } = await supabase.from('conceptos').delete().eq('id', id)
    if (!error) load()
    return { error }
  }

  async function addProduccion(data) {
    const { error } = await supabase.from('produccion').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function updateProduccion(id, data) {
    const { error } = await supabase.from('produccion').update(data).eq('id', id)
    if (!error) load()
    return { error }
  }
  async function deleteProduccion(id) {
    const { error } = await supabase.from('produccion').delete().eq('id', id)
    if (!error) load()
    return { error }
  }

  async function addRegistroCN(data) {
    const { error } = await supabase.from('registros_cn').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function updateRegistroCN(id, data) {
    const { error } = await supabase.from('registros_cn').update(data).eq('id', id)
    if (!error) load()
    return { error }
  }
  async function deleteRegistroCN(id) {
    const { error } = await supabase.from('registros_cn').delete().eq('id', id)
    if (!error) load()
    return { error }
  }

  async function addCorte(data) {
    const { error } = await supabase.from('cortes').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function updateCorte(id, data) {
    const { error } = await supabase.from('cortes').update(data).eq('id', id)
    if (!error) load()
    return { error }
  }
  async function deleteCorte(id) {
    const { error } = await supabase.from('cortes').delete().eq('id', id)
    if (!error) load()
    return { error }
  }

  return {
    cuadrillas, proyectos, conceptos, produccion, registrosCN, cortes,
    loading, reload: load,
    getCuadrilla, getProyecto, getConcepto,
    addCuadrilla, updateCuadrilla, deleteCuadrilla,
    addProyecto, updateProyecto, deleteProyecto,
    addConcepto, updateConcepto, deleteConcepto,
    addProduccion, updateProduccion, deleteProduccion,
    addRegistroCN, updateRegistroCN, deleteRegistroCN,
    addCorte, updateCorte, deleteCorte,
  }
}