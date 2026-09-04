import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useIG() {
  const { user } = useAuth()
  const [empleados, setEmpleados] = useState([])
  const [vehiculos, setVehiculos] = useState([])
  const [ingresos, setIngresos] = useState([])
  const [gastos, setGastos] = useState([])
  const [nomina, setNomina] = useState([])
  const [prestamos, setPrestamos] = useState([])
  const [cierres, setCierres] = useState([])
  const [dispersiones, setDispersiones] = useState([])
  const [socios, setSocios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
  const [emp, veh, ing, gas, nom, pre, cie, dis, soc] = await Promise.all([
    supabase.from('empleados').select('*').eq('activo', true).order('numero'),
    supabase.from('vehiculos').select('*').order('placa'),
    supabase.from('ingresos').select('*').order('fecha', { ascending: false }),
    supabase.from('gastos').select('*').order('fecha', { ascending: false }),
    supabase.from('nomina').select('*').order('semana', { ascending: false }),
    supabase.from('prestamos').select('*').order('created_at', { ascending: false }),
    supabase.from('cierres_semanales').select('*').order('anio', { ascending: false }).order('semana', { ascending: false }),
    supabase.from('dispersiones').select('*').order('fecha', { ascending: false }),
    supabase.from('socios').select('*').order('created_at'),
  ])
  if (emp.error) throw emp.error
  setEmpleados(emp.data || [])
  setVehiculos(veh.data || [])
  setIngresos(ing.data || [])
  setGastos(gas.data || [])
  setNomina(nom.data || [])
  setPrestamos(pre.data || [])
  setCierres(cie.data || [])
  setDispersiones(dis.data || [])
  setSocios(soc.data || [])
} catch (err) {
  console.error('useIG error:', err)
  setError(err.message)
} finally {
  setLoading(false)
}
  }, [user])

  useEffect(() => { load() }, [load])

  const fmt$ = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  function getEmpleado(id) { return empleados.find(e => e.id === id) || { nombre: '—', numero: '—', sueldo_diario: 0 } }

  async function addEmpleado(data) {
    const { error } = await supabase.from('empleados').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function updateEmpleado(id, data) {
    const { error } = await supabase.from('empleados').update(data).eq('id', id)
    if (!error) load()
    return { error }
  }
  async function deleteEmpleado(id) {
    const { error } = await supabase.from('empleados').update({ activo: false }).eq('id', id)
    if (!error) load()
    return { error }
  }
  async function addVehiculo(data) {
    const { error } = await supabase.from('vehiculos').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function updateVehiculo(id, data) {
    const { error } = await supabase.from('vehiculos').update(data).eq('id', id)
    if (!error) load()
    return { error }
  }
  async function deleteVehiculo(id) {
    const { error } = await supabase.from('vehiculos').delete().eq('id', id)
    if (!error) load()
    return { error }
  }
  async function addIngreso(data) {
    const { error } = await supabase.from('ingresos').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function deleteIngreso(id) {
    const { error } = await supabase.from('ingresos').delete().eq('id', id)
    if (!error) load()
    return { error }
  }
  async function addGasto(data) {
    const { error } = await supabase.from('gastos').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function deleteGasto(id) {
    const { error } = await supabase.from('gastos').delete().eq('id', id)
    if (!error) load()
    return { error }
  }
    // ── Nómina ──
  async function addNomina(data) {
    const { data: row, error } = await supabase.from('nomina').insert({ ...data, user_id: user.id }).select().single()
    if (!error) load()
    return { error, id: row?.id }
  }
  async function addNominaLote(rows) {
    if (!rows.length) return { error: null, data: [] }
    const { data, error } = await supabase.from('nomina').insert(rows.map(r => ({ ...r, user_id: user.id }))).select()
    if (!error) await load()
    return { error, data: data || [] }
  }
  async function deleteNomina(id) {
    await revertirReembolsos(id)
    const { error } = await supabase.from('nomina').delete().eq('id', id)
    if (!error) load()
    return { error }
  }

  // ── Reembolsos: dinero prestado por un empleado/socio (gastos y préstamos) ──
  function getReembolsosPendientes(empleadoId) {
    if (!empleadoId) return []
    const g = gastos
      .filter(x => x.prestado_por === 'empleado' && x.prestado_por_empleado_id === empleadoId && !x.reembolsado)
      .map(x => ({ tipo: 'gasto', id: x.id, fecha: x.fecha, monto: Number(x.monto), descripcion: `${x.categoria}: ${x.concepto}` }))
    const p = prestamos
      .filter(x => x.prestado_por === 'empleado' && x.prestado_por_empleado_id === empleadoId && !x.reembolsado)
      .map(x => ({ tipo: 'prestamo', id: x.id, fecha: x.fecha, monto: Number(x.monto_original), descripcion: `Préstamo a ${getEmpleado(x.empleado_id).nombre}` }))
    return [...g, ...p].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
  }
  function notaReembolso(items) {
    if (!items.length) return null
    const f = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' }) : ''
    return 'Reembolso: ' + items.map(i => `${i.descripcion} ${f(i.fecha)} ${fmt$(i.monto)}`).join(' · ')
  }
  async function marcarReembolsados(items, nominaId, fecha) {
    const upd = { reembolsado: true, reembolso_nomina_id: nominaId, reembolso_fecha: fecha || new Date().toISOString().split('T')[0] }
    const gIds = items.filter(i => i.tipo === 'gasto').map(i => i.id)
    const pIds = items.filter(i => i.tipo === 'prestamo').map(i => i.id)
    if (gIds.length) await supabase.from('gastos').update(upd).in('id', gIds)
    if (pIds.length) await supabase.from('prestamos').update(upd).in('id', pIds)
    load()
  }
  async function revertirReembolsos(nominaId) {
    const upd = { reembolsado: false, reembolso_nomina_id: null, reembolso_fecha: null }
    await supabase.from('gastos').update(upd).eq('reembolso_nomina_id', nominaId)
    await supabase.from('prestamos').update(upd).eq('reembolso_nomina_id', nominaId)
  }
  async function addPrestamo(data) {
    const saldo = data.monto_original
    const { error } = await supabase.from('prestamos').insert({ ...data, saldo, monto_pagado: 0, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function aplicarDescuento(prestamoId, descuento) {
    const prestamo = prestamos.find(p => p.id === prestamoId)
    if (!prestamo) return { error: 'No encontrado' }
    const nuevoSaldo = Math.max(0, Number(prestamo.saldo) - Number(descuento))
    const nuevoPagado = Number(prestamo.monto_pagado) + Number(descuento)
    const nuevoEstado = nuevoSaldo === 0 ? 'Liquidado' : 'Activo'
    const { error } = await supabase.from('prestamos').update({ saldo: nuevoSaldo, monto_pagado: nuevoPagado, estado: nuevoEstado }).eq('id', prestamoId)
    if (!error) load()
    return { error }
  }
  async function addCierre(data) {
    const { error } = await supabase.from('cierres_semanales').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function updateCierreEstado(id, estado) {
    const update = { estado }
    if (estado === 'Cerrado') update.fecha_cierre = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('cierres_semanales').update(update).eq('id', id)
    if (!error) load()
    return { error }
  }
  async function addDispersion(cabecera, depositos) {
    const { data: disp, error: e1 } = await supabase
      .from('dispersiones')
      .insert({ ...cabecera, user_id: user.id })
      .select()
      .single()
    if (e1) return { error: e1 }
    const filas = depositos.map(d => ({ ...d, dispersion_id: disp.id }))
    const { error: e2 } = await supabase.from('dispersion_depositos').insert(filas)
    if (e2) return { error: e2 }
    load()
    return { error: null, id: disp.id }
  }
  async function getDepositos(dispersionId) {
    const { data, error } = await supabase
      .from('dispersion_depositos')
      .select('*')
      .eq('dispersion_id', dispersionId)
      .order('created_at')
    if (error) return []
    return data || []
  }
  async function deleteDispersion(id) {
    const { error } = await supabase.from('dispersiones').delete().eq('id', id)
    if (!error) load()
    return { error }
  }
  async function addSocio(data) {
  const { error } = await supabase.from('socios').insert({ ...data, user_id: user.id })
  if (!error) load()
  return { error }
}
async function updateSocio(id, data) {
  const { error } = await supabase.from('socios').update(data).eq('id', id)
  if (!error) load()
  return { error }
}
async function deleteSocio(id) {
  const { error } = await supabase.from('socios').delete().eq('id', id)
  if (!error) load()
  return { error }
}
async function updateCierreDistribucion(id, distribucion) {
  const { error } = await supabase.from('cierres_semanales').update({ distribucion }).eq('id', id)
  if (!error) load()
  return { error }
}

  return {
    empleados, vehiculos, ingresos, gastos, nomina, prestamos, cierres, dispersiones,
    loading, error, reload: load, fmt$, getEmpleado,
    addEmpleado, updateEmpleado, deleteEmpleado,
    addVehiculo, updateVehiculo, deleteVehiculo,
    addIngreso, deleteIngreso,
    addGasto, deleteGasto,
    addNomina, addNominaLote, deleteNomina,
    getReembolsosPendientes, notaReembolso, marcarReembolsados, revertirReembolsos,
    addPrestamo, aplicarDescuento,
    addCierre, updateCierreEstado,
     addDispersion, getDepositos, deleteDispersion,
    socios, addSocio, updateSocio, deleteSocio,
    updateCierreDistribucion,
  }
}