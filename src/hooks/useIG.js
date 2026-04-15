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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const uid = user.id
      const [emp, veh, ing, gas, nom, pre, cie] = await Promise.all([
        supabase.from('empleados').select('*').eq('user_id', uid).eq('activo', true).order('numero'),
        supabase.from('vehiculos').select('*').eq('user_id', uid).order('placa'),
        supabase.from('ingresos').select('*').eq('user_id', uid).order('fecha', { ascending: false }),
        supabase.from('gastos').select('*').eq('user_id', uid).order('fecha', { ascending: false }),
        supabase.from('nomina').select('*').eq('user_id', uid).order('semana', { ascending: false }),
        supabase.from('prestamos').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabase.from('cierres_semanales').select('*').eq('user_id', uid).order('anio', { ascending: false }).order('semana', { ascending: false }),
      ])
      if (emp.error) throw emp.error
      setEmpleados(emp.data || [])
      setVehiculos(veh.data || [])
      setIngresos(ing.data || [])
      setGastos(gas.data || [])
      setNomina(nom.data || [])
      setPrestamos(pre.data || [])
      setCierres(cie.data || [])
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
  async function addNomina(data) {
    const { error } = await supabase.from('nomina').insert({ ...data, user_id: user.id })
    if (!error) load()
    return { error }
  }
  async function deleteNomina(id) {
    const { error } = await supabase.from('nomina').delete().eq('id', id)
    if (!error) load()
    return { error }
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

  return {
    empleados, vehiculos, ingresos, gastos, nomina, prestamos, cierres,
    loading, error, reload: load, fmt$, getEmpleado,
    addEmpleado, updateEmpleado, deleteEmpleado,
    addVehiculo, updateVehiculo, deleteVehiculo,
    addIngreso, deleteIngreso,
    addGasto, deleteGasto,
    addNomina, deleteNomina,
    addPrestamo, aplicarDescuento,
    addCierre, updateCierreEstado,
  }
}
