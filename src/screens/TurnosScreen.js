import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, Alert, Modal, FlatList
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { usuariosService } from '../services/api'
import { useTema } from '../context/TemaContext'

// ─── Configuración de turnos ───────────────────────────────────────────────
const TURNOS_CONFIG = {
  mañana: {
    label: 'Mañana',
    emoji: '🌅',
    horaInicio: '07:00',
    horaFin: '14:00',
    color: '#f59e0b',
    colorBg: '#fffbeb',
    colorBgDark: 'rgba(245,158,11,0.15)',
  },
  tarde: {
    label: 'Tarde',
    emoji: '🌇',
    horaInicio: '14:00',
    horaFin: '21:00',
    color: '#6366f1',
    colorBg: '#eef2ff',
    colorBgDark: 'rgba(99,102,241,0.15)',
  },
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// ─── Utilidades de fecha ───────────────────────────────────────────────────
const getLunes = (fecha = new Date()) => {
  const d = new Date(fecha)
  const dia = d.getDay()
  const diff = d.getDate() - dia + (dia === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const addDias = (fecha, dias) => {
  const d = new Date(fecha)
  d.setDate(d.getDate() + dias)
  return d
}

const fechaKey = (fecha) => {
  const d = new Date(fecha)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const hoyKey = () => fechaKey(new Date())

const formatFechaCorta = (fecha) =>
  new Date(fecha).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })

const formatHoraActual = () =>
  new Date().toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })

// ─── Componente principal ─────────────────────────────────────────────────
export default function TurnosEmpleadosScreen() {
  const { tema } = useTema()
  const [tab, setTab] = useState('hoy') // hoy | semana | asignar
  const [refreshing, setRefreshing] = useState(false)
  const [empleados, setEmpleados] = useState([])

  // asignaciones: { [fechaKey]: { [empleadoId]: 'mañana' | 'tarde' | null } }
  const [asignaciones, setAsignaciones] = useState({})
  // asistencias: { [fechaKey+empleadoId]: { entrada: hora, salida: hora } }
  const [asistencias, setAsistencias] = useState({})

  const [semanaOffset, setSemanaOffset] = useState(0)
  const [modalAsignar, setModalAsignar] = useState(false)
  const [modalAsistencia, setModalAsistencia] = useState(false)
  const [empleadoSel, setEmpleadoSel] = useState(null)
  const [diaSelIdx, setDiaSelIdx] = useState(null)
  const [turnoSel, setTurnoSel] = useState(null)

  const lunesBase = getLunes(addDias(new Date(), semanaOffset * 7))
  const diasSemana = Array.from({ length: 7 }, (_, i) => addDias(lunesBase, i))

  useEffect(() => { cargarDatos() }, [])
  usuariosService.listar().then(r => {
  const lista = (r.data || []).map(u => ({
    id: String(u.id),
    nombre: u.nombre,
    puesto: u.rol,
    avatar: u.rol === 'admin' ? '👑' : '👤'
  }))
  setEmpleados(lista)
}).catch(() => {})

  // ─── Persistencia local (reemplazá con tu API) ──────────────────────────
  const cargarDatos = async () => {
    try {
      const a = await AsyncStorage.getItem('turnos_asignaciones')
      const b = await AsyncStorage.getItem('turnos_asistencias')
      if (a) setAsignaciones(JSON.parse(a))
      if (b) setAsistencias(JSON.parse(b))
    } catch (e) { console.log('Error cargando turnos:', e) }
    finally { setRefreshing(false) }
  }

  const guardarAsignaciones = async (nuevas) => {
    setAsignaciones(nuevas)
    await AsyncStorage.setItem('turnos_asignaciones', JSON.stringify(nuevas))
  }

  const guardarAsistencias = async (nuevas) => {
    setAsistencias(nuevas)
    await AsyncStorage.setItem('turnos_asistencias', JSON.stringify(nuevas))
  }

  // ─── Acciones ────────────────────────────────────────────────────────────
  const getTurnoEmpleado = (empleadoId, fecha) => {
    const key = fechaKey(fecha)
    return asignaciones[key]?.[empleadoId] || null
  }

  const asignarTurno = async (empleadoId, fecha, turno) => {
    const key = fechaKey(fecha)
    const nuevas = {
      ...asignaciones,
      [key]: { ...(asignaciones[key] || {}), [empleadoId]: turno }
    }
    await guardarAsignaciones(nuevas)
  }

  const registrarEntrada = async (empleadoId, fecha) => {
    const key = `${fechaKey(fecha)}_${empleadoId}`
    const nuevas = {
      ...asistencias,
      [key]: { ...(asistencias[key] || {}), entrada: formatHoraActual() }
    }
    await guardarAsistencias(nuevas)
  }

  const registrarSalida = async (empleadoId, fecha) => {
    const key = `${fechaKey(fecha)}_${empleadoId}`
    const nuevas = {
      ...asistencias,
      [key]: { ...(asistencias[key] || {}), salida: formatHoraActual() }
    }
    await guardarAsistencias(nuevas)
  }

  const getAsistencia = (empleadoId, fecha) => {
    return asistencias[`${fechaKey(fecha)}_${empleadoId}`] || {}
  }

  // ─── Empleados de hoy ────────────────────────────────────────────────────
  const empleadosHoy = empleados.map(e => ({
    ...e,
    turno: getTurnoEmpleado(e.id, new Date()),
    asistencia: getAsistencia(e.id, new Date()),
  }))

  const resumenHoy = {
    mañana: empleadosHoy.filter(e => e.turno === 'mañana').length,
    tarde: empleadosHoy.filter(e => e.turno === 'tarde').length,
    sinTurno: empleadosHoy.filter(e => !e.turno).length,
  }

  // ────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>

      {/* HEADER */}
      <View style={{ backgroundColor: tema.fondoCard, padding: 20, paddingTop: 24, borderBottomWidth: 1, borderColor: tema.borde }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: tema.texto }}>👥 Turnos de Empleados</Text>
        <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 2 }}>Asignación y asistencia</Text>

        {/* Píldoras resumen hoy */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <View style={{ flex: 1, backgroundColor: TURNOS_CONFIG.mañana.colorBgDark, borderRadius: 10, padding: 10, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: TURNOS_CONFIG.mañana.color }}>{resumenHoy.mañana}</Text>
            <Text style={{ fontSize: 10, color: TURNOS_CONFIG.mañana.color, fontWeight: '700' }}>🌅 Mañana</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: TURNOS_CONFIG.tarde.colorBgDark, borderRadius: 10, padding: 10, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: TURNOS_CONFIG.tarde.color }}>{resumenHoy.tarde}</Text>
            <Text style={{ fontSize: 10, color: TURNOS_CONFIG.tarde.color, fontWeight: '700' }}>🌇 Tarde</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 10, alignItems: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: tema.textoTerciario }}>{resumenHoy.sinTurno}</Text>
            <Text style={{ fontSize: 10, color: tema.textoTerciario, fontWeight: '700' }}>Sin turno</Text>
          </View>
        </View>
      </View>

      {/* TABS */}
      <View style={{ flexDirection: 'row', backgroundColor: tema.fondoCard, borderBottomWidth: 1, borderColor: tema.borde }}>
        {[
          { id: 'hoy', label: '📅 Hoy' },
          { id: 'semana', label: '🗓️ Semana' },
          { id: 'asignar', label: '✏️ Asignar' },
        ].map(t => (
          <TouchableOpacity
            key={t.id}
            style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderColor: tab === t.id ? tema.primario : 'transparent' }}
            onPress={() => setTab(t.id)}
          >
            <Text style={{ fontSize: 12, fontWeight: '700', color: tab === t.id ? tema.primario : tema.textoTerciario }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarDatos() }} tintColor={tema.primario} />}>

        {/* ══════════════ TAB HOY ══════════════ */}
        {tab === 'hoy' && (
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: tema.textoTerciario, marginBottom: 12 }}>
              {new Date().toLocaleDateString('es-GT', { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase()}
            </Text>

            {empleadosHoy.map(emp => {
              const cfg = emp.turno ? TURNOS_CONFIG[emp.turno] : null
              const asist = emp.asistencia
              const yaEntro = !!asist.entrada
              const yaSalio = !!asist.salida

              return (
                <View
                  key={emp.id}
                  style={{
                    backgroundColor: tema.fondoCard,
                    borderRadius: 16,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: cfg ? cfg.color + '44' : tema.borde,
                    overflow: 'hidden',
                  }}
                >
                  {/* Barra de color de turno */}
                  {cfg && <View style={{ height: 3, backgroundColor: cfg.color }} />}

                  <View style={{ padding: 14 }}>
                    {/* Fila superior */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tema.fondoSecundario, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ fontSize: 22 }}>{emp.avatar}</Text>
                        </View>
                        <View>
                          <Text style={{ fontSize: 14, fontWeight: '900', color: tema.texto }}>{emp.nombre}</Text>
                          <Text style={{ fontSize: 11, color: tema.textoTerciario }}>{emp.puesto}</Text>
                        </View>
                      </View>

                      {cfg ? (
                        <View style={{ backgroundColor: cfg.colorBgDark, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: cfg.color }}>{cfg.emoji} {cfg.label}</Text>
                          <Text style={{ fontSize: 10, color: cfg.color, textAlign: 'center' }}>{cfg.horaInicio}–{cfg.horaFin}</Text>
                        </View>
                      ) : (
                        <View style={{ backgroundColor: tema.fondoSecundario, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 }}>
                          <Text style={{ fontSize: 11, color: tema.textoTerciario }}>Sin turno</Text>
                        </View>
                      )}
                    </View>

                    {/* Asistencia */}
                    {emp.turno && (
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity
                          style={{
                            flex: 1, padding: 10, borderRadius: 10, alignItems: 'center',
                            backgroundColor: yaEntro ? '#d1fae5' : tema.fondoSecundario,
                            borderWidth: 1, borderColor: yaEntro ? tema.success : tema.borde
                          }}
                          onPress={() => {
                            if (yaEntro) return
                            Alert.alert('Registrar Entrada', `¿Confirmar entrada de ${emp.nombre}?`, [
                              { text: 'Cancelar', style: 'cancel' },
                              { text: '✅ Confirmar', onPress: () => registrarEntrada(emp.id, new Date()) }
                            ])
                          }}
                        >
                          <Text style={{ fontSize: 16 }}>{yaEntro ? '✅' : '🟢'}</Text>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: yaEntro ? tema.success : tema.textoTerciario }}>
                            {yaEntro ? asist.entrada : 'Entrada'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{
                            flex: 1, padding: 10, borderRadius: 10, alignItems: 'center',
                            backgroundColor: yaSalio ? '#fee2e2' : tema.fondoSecundario,
                            borderWidth: 1, borderColor: yaSalio ? tema.danger : tema.borde,
                            opacity: !yaEntro ? 0.5 : 1
                          }}
                          disabled={!yaEntro}
                          onPress={() => {
                            if (yaSalio || !yaEntro) return
                            Alert.alert('Registrar Salida', `¿Confirmar salida de ${emp.nombre}?`, [
                              { text: 'Cancelar', style: 'cancel' },
                              { text: '⏹️ Confirmar', onPress: () => registrarSalida(emp.id, new Date()) }
                            ])
                          }}
                        >
                          <Text style={{ fontSize: 16 }}>{yaSalio ? '⏹️' : '🔴'}</Text>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: yaSalio ? tema.danger : tema.textoTerciario }}>
                            {yaSalio ? asist.salida : 'Salida'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {!emp.turno && (
                      <TouchableOpacity
                        style={{ padding: 10, borderRadius: 10, borderWidth: 1, borderColor: tema.primario, borderStyle: 'dashed', alignItems: 'center' }}
                        onPress={() => {
                          setEmpleadoSel(emp)
                          setDiaSelIdx(new Date().getDay() === 0 ? 6 : new Date().getDay() - 1)
                          setModalAsignar(true)
                        }}
                      >
                        <Text style={{ fontSize: 12, color: tema.primario, fontWeight: '700' }}>+ Asignar turno hoy</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )
            })}
          </View>
        )}

        {/* ══════════════ TAB SEMANA ══════════════ */}
        {tab === 'semana' && (
          <View style={{ padding: 16 }}>
            {/* Navegación semana */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <TouchableOpacity
                style={{ padding: 10, borderRadius: 10, backgroundColor: tema.fondoCard, borderWidth: 1, borderColor: tema.borde }}
                onPress={() => setSemanaOffset(semanaOffset - 1)}
              >
                <Text style={{ color: tema.primario, fontWeight: '700' }}>‹ Anterior</Text>
              </TouchableOpacity>

              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 13, fontWeight: '900', color: tema.texto }}>
                  {semanaOffset === 0 ? 'Esta Semana' : semanaOffset === 1 ? 'Próxima Semana' : semanaOffset === -1 ? 'Semana Pasada' : `Semana ${semanaOffset > 0 ? '+' : ''}${semanaOffset}`}
                </Text>
                <Text style={{ fontSize: 11, color: tema.textoTerciario }}>
                  {formatFechaCorta(diasSemana[0])} – {formatFechaCorta(diasSemana[6])}
                </Text>
              </View>

              <TouchableOpacity
                style={{ padding: 10, borderRadius: 10, backgroundColor: tema.fondoCard, borderWidth: 1, borderColor: tema.borde }}
                onPress={() => setSemanaOffset(semanaOffset + 1)}
              >
                <Text style={{ color: tema.primario, fontWeight: '700' }}>Siguiente ›</Text>
              </TouchableOpacity>
            </View>

            {/* Grilla semanal */}
            {empleados.map(emp => (
              <View key={emp.id} style={{ backgroundColor: tema.fondoCard, borderRadius: 14, marginBottom: 10, padding: 12, borderWidth: 1, borderColor: tema.borde }}>
                {/* Nombre empleado */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Text style={{ fontSize: 18 }}>{emp.avatar}</Text>
                  <View>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: tema.texto }}>{emp.nombre}</Text>
                    <Text style={{ fontSize: 10, color: tema.textoTerciario }}>{emp.puesto}</Text>
                  </View>
                </View>

                {/* Días de la semana */}
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  {diasSemana.map((dia, idx) => {
                    const turno = getTurnoEmpleado(emp.id, dia)
                    const cfg = turno ? TURNOS_CONFIG[turno] : null
                    const esHoy = fechaKey(dia) === hoyKey()

                    return (
                      <TouchableOpacity
                        key={idx}
                        style={{
                          flex: 1,
                          borderRadius: 8,
                          padding: 4,
                          alignItems: 'center',
                          minHeight: 52,
                          justifyContent: 'center',
                          backgroundColor: cfg ? cfg.colorBgDark : tema.fondoSecundario,
                          borderWidth: esHoy ? 2 : 1,
                          borderColor: esHoy ? tema.primario : cfg ? cfg.color + '44' : tema.borde,
                        }}
                        onPress={() => {
                          setEmpleadoSel(emp)
                          setDiaSelIdx(idx)
                          setModalAsignar(true)
                        }}
                      >
                        <Text style={{ fontSize: 9, fontWeight: '700', color: esHoy ? tema.primario : tema.textoTerciario }}>
                          {DIAS_SEMANA[idx]}
                        </Text>
                        <Text style={{ fontSize: 9, color: tema.textoTerciario }}>{formatFechaCorta(dia)}</Text>
                        {cfg ? (
                          <Text style={{ fontSize: 14, marginTop: 2 }}>{cfg.emoji}</Text>
                        ) : (
                          <Text style={{ fontSize: 12, color: tema.borde, marginTop: 2 }}>–</Text>
                        )}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              </View>
            ))}

            {/* Leyenda */}
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 8 }}>
              {Object.entries(TURNOS_CONFIG).map(([key, cfg]) => (
                <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text style={{ fontSize: 14 }}>{cfg.emoji}</Text>
                  <Text style={{ fontSize: 11, color: cfg.color, fontWeight: '700' }}>{cfg.label} {cfg.horaInicio}–{cfg.horaFin}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ══════════════ TAB ASIGNAR ══════════════ */}
        {tab === 'asignar' && (
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 12 }}>
              Asignar turnos para hoy — {new Date().toLocaleDateString('es-GT', { weekday: 'long', day: '2-digit', month: 'short' })}
            </Text>

            {empleados.map(emp => {
              const turnoHoy = getTurnoEmpleado(emp.id, new Date())
              return (
                <View key={emp.id} style={{ backgroundColor: tema.fondoCard, borderRadius: 14, marginBottom: 10, padding: 14, borderWidth: 1, borderColor: tema.borde }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <Text style={{ fontSize: 24 }}>{emp.avatar}</Text>
                    <View>
                      <Text style={{ fontSize: 14, fontWeight: '900', color: tema.texto }}>{emp.nombre}</Text>
                      <Text style={{ fontSize: 11, color: tema.textoTerciario }}>{emp.puesto}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {/* Mañana */}
                    {Object.entries(TURNOS_CONFIG).map(([key, cfg]) => (
                      <TouchableOpacity
                        key={key}
                        style={{
                          flex: 1, padding: 12, borderRadius: 12, alignItems: 'center',
                          backgroundColor: turnoHoy === key ? cfg.colorBgDark : tema.fondoSecundario,
                          borderWidth: 2,
                          borderColor: turnoHoy === key ? cfg.color : tema.borde,
                        }}
                        onPress={() => asignarTurno(emp.id, new Date(), turnoHoy === key ? null : key)}
                      >
                        <Text style={{ fontSize: 22 }}>{cfg.emoji}</Text>
                        <Text style={{ fontSize: 12, fontWeight: '900', color: turnoHoy === key ? cfg.color : tema.textoTerciario, marginTop: 2 }}>{cfg.label}</Text>
                        <Text style={{ fontSize: 10, color: turnoHoy === key ? cfg.color : tema.textoTerciario }}>{cfg.horaInicio}–{cfg.horaFin}</Text>
                      </TouchableOpacity>
                    ))}

                    {/* Sin turno */}
                    <TouchableOpacity
                      style={{
                        flex: 1, padding: 12, borderRadius: 12, alignItems: 'center',
                        backgroundColor: !turnoHoy ? '#fee2e2' : tema.fondoSecundario,
                        borderWidth: 2,
                        borderColor: !turnoHoy ? tema.danger : tema.borde,
                      }}
                      onPress={() => asignarTurno(emp.id, new Date(), null)}
                    >
                      <Text style={{ fontSize: 22 }}>🚫</Text>
                      <Text style={{ fontSize: 12, fontWeight: '900', color: !turnoHoy ? tema.danger : tema.textoTerciario, marginTop: 2 }}>Libre</Text>
                      <Text style={{ fontSize: 10, color: !turnoHoy ? tema.danger : tema.textoTerciario }}>Sin turno</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )
            })}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ─── MODAL ASIGNAR TURNO (desde grilla semana) ──────────────────── */}
      <Modal visible={modalAsignar} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: tema.texto, marginBottom: 4 }}>✏️ Asignar Turno</Text>
            {empleadoSel && diaSelIdx !== null && (
              <Text style={{ fontSize: 13, color: tema.textoTerciario, marginBottom: 20 }}>
                {empleadoSel.avatar} {empleadoSel.nombre} · {DIAS_SEMANA[diaSelIdx]} {formatFechaCorta(diasSemana[diaSelIdx])}
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              {Object.entries(TURNOS_CONFIG).map(([key, cfg]) => {
                const turnoActual = empleadoSel ? getTurnoEmpleado(empleadoSel.id, diasSemana[diaSelIdx]) : null
                return (
                  <TouchableOpacity
                    key={key}
                    style={{
                      flex: 1, padding: 16, borderRadius: 14, alignItems: 'center',
                      backgroundColor: turnoActual === key ? cfg.colorBgDark : tema.fondoSecundario,
                      borderWidth: 2, borderColor: turnoActual === key ? cfg.color : tema.borde,
                    }}
                    onPress={() => {
                      asignarTurno(empleadoSel.id, diasSemana[diaSelIdx], turnoActual === key ? null : key)
                      setModalAsignar(false)
                    }}
                  >
                    <Text style={{ fontSize: 28 }}>{cfg.emoji}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: turnoActual === key ? cfg.color : tema.texto, marginTop: 4 }}>{cfg.label}</Text>
                    <Text style={{ fontSize: 11, color: turnoActual === key ? cfg.color : tema.textoTerciario }}>{cfg.horaInicio} – {cfg.horaFin}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <TouchableOpacity
              style={{ padding: 14, borderRadius: 12, backgroundColor: '#fee2e2', alignItems: 'center', marginBottom: 10 }}
              onPress={() => {
                asignarTurno(empleadoSel.id, diasSemana[diaSelIdx], null)
                setModalAsignar(false)
              }}
            >
              <Text style={{ color: tema.danger, fontWeight: '700' }}>🚫 Sin turno / Día libre</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{ padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }}
              onPress={() => setModalAsignar(false)}
            >
              <Text style={{ color: tema.textoTerciario, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  )
}