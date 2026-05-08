// Semana de producción: VIERNES a JUEVES
// Devuelve el viernes de la semana actual + offset
export function getSemana(offset = 0) {
  const hoy = new Date()
  // getDay(): 0=dom, 1=lun, 2=mar, 3=mie, 4=jue, 5=vie, 6=sab
  const dow = hoy.getDay()
  // Días desde el viernes más reciente
  // Si hoy es vie(5)=0, sab(6)=1, dom(0)=2, lun(1)=3, mar(2)=4, mie(3)=5, jue(4)=6
  const diasDesdeViernes = dow === 5 ? 0 : dow === 6 ? 1 : dow + 2
  const viernes = new Date(hoy)
  viernes.setDate(hoy.getDate() - diasDesdeViernes + offset * 7)
  const jueves = new Date(viernes)
  jueves.setDate(viernes.getDate() + 6)
  return {
    ini: viernes.toISOString().split('T')[0],
    fin: jueves.toISOString().split('T')[0],
    lunes: viernes, // mantenemos el nombre para compatibilidad
    dom: jueves,
  }
}

export function fmtSemanaLabel(s) {
  const opts = { day: 'numeric', month: 'short' }
  return (
    s.lunes.toLocaleDateString('es-MX', opts) +
    ' – ' +
    s.dom.toLocaleDateString('es-MX', { ...opts, year: 'numeric' })
  )
}

// Array de N semanas hacia atrás desde la semana actual (viernes a jueves)
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
      label: viernes.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) +
             ' – ' + jueves.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
    })
  }
  return sems
}

// Info de próximos cortes CN basada en la fecha de hoy
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
  if (d > 15 && d < pen) {
    const ds = pen - d
    return { tipo: 'info', msg: `Faltan ${ds} día${ds > 1 ? 's' : ''} para el corte CN del día ${pen}.` }
  }
  return null
}

export function getPeriodoCN(quincena, mes, anio) {
  const ult = new Date(anio, mes, 0).getDate()
  return quincena === '1'
    ? `1 al 15 de ${anio}-${String(mes).padStart(2, '0')}`
    : `16 al ${ult} de ${anio}-${String(mes).padStart(2, '0')}`
}

// Calcula el offset necesario para que getSemana(offset) caiga en la semana ISO `numSemana`
// del año en curso. Útil para saltar directo a una semana por número.
export function getOffsetDesdeSemana(numSemana) {
  const hoy = new Date()
  const anio = hoy.getFullYear()

  // Primer jueves del año (define la semana 1 según ISO 8601)
  const primerJueves = new Date(anio, 0, 1)
  while (primerJueves.getDay() !== 4) primerJueves.setDate(primerJueves.getDate() + 1)

  // Lunes de la semana 1
  const lunes1 = new Date(primerJueves)
  lunes1.setDate(primerJueves.getDate() - 3)

  // Viernes de la semana ISO objetivo (viernes = lunes + 4)
  const viernesObjetivo = new Date(lunes1)
  viernesObjetivo.setDate(lunes1.getDate() + (numSemana - 1) * 7 + 4)

  // Viernes de la semana actual
  const dow = hoy.getDay()
  const diasDesdeViernes = dow === 5 ? 0 : dow === 6 ? 1 : dow + 2
  const viernesActual = new Date(hoy)
  viernesActual.setDate(hoy.getDate() - diasDesdeViernes)

  // Diferencia en semanas
  const diffMs = viernesObjetivo.getTime() - viernesActual.getTime()
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000))
}