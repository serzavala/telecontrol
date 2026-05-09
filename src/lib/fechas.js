// Semana de producción: VIERNES a JUEVES

export function getSemana(offset = 0) {
  const hoy = new Date()
  const dow = hoy.getDay()
  const diasDesdeViernes = dow === 5 ? 0 : dow === 6 ? 1 : dow + 2
  const viernes = new Date(hoy)
  viernes.setDate(hoy.getDate() - diasDesdeViernes + offset * 7)
  const jueves = new Date(viernes)
  jueves.setDate(viernes.getDate() + 6)
  return {
    ini: viernes.toISOString().split('T')[0],
    fin: jueves.toISOString().split('T')[0],
    lunes: viernes,
    dom: jueves,
  }
}

export function fmtSemanaLabel(s) {
  const opts = { day: 'numeric', month: 'short' }
  return s.lunes.toLocaleDateString('es-MX', opts) + ' – ' + s.dom.toLocaleDateString('es-MX', { ...opts, year: 'numeric' })
}

export function getSemanas(n) {
  const hoy = new Date()
  const dow = hoy.getDay()
  const diasDesdeViernes = dow === 5 ? 0 : dow === 6 ? 1 : dow + 2
  const viernesActual = new Date(hoy)
  viernesActual.setDate(hoy.getDate() - diasDesdeViernes)
  const sems = []
  for (let i = n - 1; i >= 0; i--) {
    const viernes = new Date(viernesActual)
    viernes.setDate(viernesActual.getDate() - i * 7)
    const jueves = new Date(viernes)
    jueves.setDate(viernes.getDate() + 6)
    sems.push({
      ini: viernes.toISOString().split('T')[0],
      fin: jueves.toISOString().split('T')[0],
      label: viernes.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) + ' – ' + jueves.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
    })
  }
  return sems
}

// Número de semana PROPIA (viernes a jueves)
// Semana 1 = primera semana viernes-jueves del año
export function getSemanaISO(fecha) {
  const date = typeof fecha === 'string' ? new Date(fecha + 'T12:00:00') : new Date(fecha)
  const anio = date.getFullYear()
  const enero1 = new Date(anio, 0, 1)
  const dow1 = enero1.getDay()
  // Retroceder hasta el viernes anterior o igual al 1 de enero
  const diasHastaViernes = dow1 === 5 ? 0 : dow1 === 6 ? 6 : dow1 + 2
  const primerViernes = new Date(enero1)
  primerViernes.setDate(enero1.getDate() - diasHastaViernes)
  const diffMs = date - primerViernes
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffDias < 0) return getSemanaISO(new Date(anio - 1, 11, 31))
  return Math.floor(diffDias / 7) + 1
}

export function getOffsetDesdeSemana(numSemana) {
  for (let o = -30; o <= 30; o++) {
    const s = getSemana(o)
    const semFin = getSemanaISO(s.fin)
    const anioFin = new Date(s.fin).getFullYear()
    if (semFin === numSemana && anioFin === new Date().getFullYear()) return o
  }
  for (let o = -30; o <= 30; o++) {
    if (getSemanaISO(getSemana(o).fin) === numSemana) return o
  }
  return 0
}

export function getInfoCortesCN() {
  const hoy = new Date()
  const d = hoy.getDate()
  const ult = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate()
  const pen = ult - 1
  if (d === 14) return { tipo: 'warn', msg: 'Hoy es día 14 — corte 1ª quincena CN. Genera el PDF hoy.' }
  if (d === 15) return { tipo: 'success', msg: 'Hoy es día 15 — día de cobro 1ª quincena CN.' }
  if (d === pen) return { tipo: 'warn', msg: `Hoy es día ${d} — corte 2ª quincena CN. Genera el PDF hoy.` }
  if (d === ult) return { tipo: 'success', msg: 'Último día del mes — cobro 2ª quincena CN.' }
  if (d < 14) return { tipo: 'info', msg: `Faltan ${14 - d} día${14 - d > 1 ? 's' : ''} para el corte CN del día 14.` }
  if (d > 15 && d < pen) { const ds = pen - d; return { tipo: 'info', msg: `Faltan ${ds} día${ds > 1 ? 's' : ''} para el corte CN del día ${pen}.` } }
  return null
}

export function getPeriodoCN(quincena, mes, anio) {
  const ult = new Date(anio, mes, 0).getDate()
  return quincena === '1' ? `1 al 15 de ${anio}-${String(mes).padStart(2, '0')}` : `16 al ${ult} de ${anio}-${String(mes).padStart(2, '0')}`
}
