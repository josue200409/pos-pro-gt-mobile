import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, Alert, ActivityIndicator, FlatList, Image
} from 'react-native'
import { useTema } from '../context/TemaContext'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = 'https://pos-pro-gt-backend.onrender.com/api'

const TIPOS_DIA = [
  { value: 'trabajo',  label: 'Trabajo',  emoji: '💼', color: '#1a56db' },
  { value: 'descanso', label: 'Descanso', emoji: '😴', color: '#059669' },
  { value: 'vacacion', label: 'Vacación', emoji: '🏖️', color: '#F97316' },
  { value: 'feriado',  label: 'Feriado',  emoji: '🎉', color: '#8B5CF6' },
]

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

async function getToken() {
  return await AsyncStorage.getItem('token')
}

async function api(endpoint, method = 'GET', body = null) {
  const token = await getToken()
  const config = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  }
  if (body) config.body = JSON.stringify(body)
  const res = await fetch(`${BASE_URL}${endpoint}`, config)
  return res.json()
}

export default function EmpleadosScreen() {
  const { tema } = useTema()
  const s = estilos(tema)

  const [usuario, setUsuario] = useState(null)
  const [esAdmin, setEsAdmin] = useState(false)
  const [cargando, setCargando] = useState(false)

  // Admin: lista empleados
  const [empleados, setEmpleados] = useState([])
  const [vistaAdmin, setVistaAdmin] = useState('lista') // 'lista' | 'crear' | 'calendario'
  const [empleadoSel, setEmpleadoSel] = useState(null)

  // Crear empleado
  const [formNombre, setFormNombre] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formTelefono, setFormTelefono] = useState('')
  const [formRol, setFormRol] = useState('empleado')

  // Calendario
  const hoy = new Date()
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [diasCalendario, setDiasCalendario] = useState([])
  const [diaSeleccionado, setDiaSeleccionado] = useState(null)
  const [modalDia, setModalDia] = useState(false)
  const [tipoAsignar, setTipoAsignar] = useState('trabajo')
  const [notaDia, setNotaDia] = useState('')

  // Rango
  const [modalRango, setModalRango] = useState(false)
  const [rangoInicio, setRangoInicio] = useState('')
  const [rangoFin, setRangoFin] = useState('')
  const [rangoTipo, setRangoTipo] = useState('trabajo')
  const [rangoExcluirDomingos, setRangoExcluirDomingos] = useState(true)

  useEffect(() => {
    obtenerUsuario()
  }, [])

  useEffect(() => {
    if (esAdmin) cargarEmpleados()
    else cargarMiCalendario()
  }, [esAdmin])

  useEffect(() => {
    if (empleadoSel) cargarCalendarioEmpleado(empleadoSel.id)
    else if (!esAdmin) cargarMiCalendario()
  }, [mes, anio, empleadoSel])

  async function obtenerUsuario() {
    const data = await AsyncStorage.getItem('usuario')
    if (data) {
      const u = JSON.parse(data)
      setUsuario(u)
      setEsAdmin(u.rol === 'admin')
    }
  }

  async function cargarEmpleados() {
    setCargando(true)
    try {
      const data = await api('/empleados')
      setEmpleados(Array.isArray(data) ? data : [])
    } catch { setEmpleados([]) }
    setCargando(false)
  }

  async function cargarCalendarioEmpleado(id) {
    try {
      const data = await api(`/empleados/${id}/calendario?mes=${mes}&anio=${anio}`)
      setDiasCalendario(Array.isArray(data) ? data : [])
    } catch { setDiasCalendario([]) }
  }

  async function cargarMiCalendario() {
    try {
      const data = await api(`/empleados/mi/calendario?mes=${mes}&anio=${anio}`)
      setDiasCalendario(Array.isArray(data) ? data : [])
    } catch { setDiasCalendario([]) }
  }

  async function crearEmpleado() {
    if (!formNombre || !formEmail || !formPassword) {
      return Alert.alert('Error', 'Nombre, email y contraseña son requeridos')
    }
    setCargando(true)
    try {
      const res = await api('/empleados', 'POST', {
        nombre: formNombre,
        email: formEmail,
        password: formPassword,
        telefono: formTelefono,
        rol: formRol
      })
      if (res.ok) {
        Alert.alert('Empleado creado', `${formNombre} fue agregado correctamente`)
        setFormNombre(''); setFormEmail(''); setFormPassword('')
        setFormTelefono(''); setFormRol('empleado')
        setVistaAdmin('lista')
        cargarEmpleados()
      } else {
        Alert.alert('Error', res.error || 'No se pudo crear')
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar')
    }
    setCargando(false)
  }

  async function eliminarEmpleado(emp) {
    Alert.alert(
      'Eliminar empleado',
      `¿Eliminar a ${emp.nombre} completamente? Esto no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            const res = await api(`/empleados/${emp.id}`, 'DELETE')
            if (res.ok) {
              Alert.alert('Listo', 'Empleado eliminado')
              if (empleadoSel?.id === emp.id) { setEmpleadoSel(null); setVistaAdmin('lista') }
              cargarEmpleados()
            } else {
              Alert.alert('Error', res.error)
            }
          }
        }
      ]
    )
  }

  async function asignarDia() {
    if (!diaSeleccionado || !empleadoSel) return
    const res = await api(`/empleados/${empleadoSel.id}/calendario`, 'POST', {
      fecha: diaSeleccionado,
      tipo: tipoAsignar,
      nota: notaDia
    })
    if (res.ok) {
      setModalDia(false)
      setNotaDia('')
      cargarCalendarioEmpleado(empleadoSel.id)
    } else {
      Alert.alert('Error', res.error)
    }
  }

  async function borrarDia(fecha) {
    if (!empleadoSel) return
    const res = await api(`/empleados/${empleadoSel.id}/calendario/${fecha}`, 'DELETE')
    if (res.ok) {
      setModalDia(false)
      cargarCalendarioEmpleado(empleadoSel.id)
    }
  }

  async function asignarRango() {
    if (!rangoInicio || !rangoFin) return Alert.alert('Error', 'Selecciona fechas de inicio y fin')
    if (!empleadoSel) return
    setCargando(true)
    const res = await api(`/empleados/${empleadoSel.id}/calendario/rango`, 'POST', {
      fecha_inicio: rangoInicio,
      fecha_fin: rangoFin,
      tipo: rangoTipo,
      excluir_domingos: rangoExcluirDomingos
    })
    setCargando(false)
    if (res.ok) {
      Alert.alert('Rango asignado', `${res.dias_asignados} días asignados`)
      setModalRango(false)
      setRangoInicio(''); setRangoFin('')
      cargarCalendarioEmpleado(empleadoSel.id)
    } else {
      Alert.alert('Error', res.error)
    }
  }

  // ── Helpers calendario ────────────────────────────────────────────────────
  function getDiasDelMes() {
    const primero = new Date(anio, mes - 1, 1)
    const ultimo  = new Date(anio, mes, 0)
    const diasVacios = primero.getDay() // 0=Dom
    const totalDias  = ultimo.getDate()

    const celdas = []
    for (let i = 0; i < diasVacios; i++) celdas.push(null)
    for (let d = 1; d <= totalDias; d++) celdas.push(d)
    return celdas
  }

  function infoDia(dia) {
    if (!dia) return null
    const fechaStr = `${anio}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}`
    return diasCalendario.find(d => d.fecha?.startsWith(fechaStr)) || null
  }

  function tipoDiaInfo(tipo) {
    return TIPOS_DIA.find(t => t.value === tipo) || TIPOS_DIA[0]
  }

  function cambiarMes(delta) {
    let nuevoMes = mes + delta
    let nuevoAnio = anio
    if (nuevoMes > 12) { nuevoMes = 1; nuevoAnio++ }
    if (nuevoMes < 1)  { nuevoMes = 12; nuevoAnio-- }
    setMes(nuevoMes)
    setAnio(nuevoAnio)
  }

  function resumenMes() {
    const conteo = { trabajo: 0, descanso: 0, vacacion: 0, feriado: 0 }
    diasCalendario.forEach(d => { if (conteo[d.tipo] !== undefined) conteo[d.tipo]++ })
    return conteo
  }

  const celdasMes = getDiasDelMes()
  const resumen = resumenMes()
  const esHoy = (dia) => {
    const h = new Date()
    return dia === h.getDate() && mes === h.getMonth() + 1 && anio === h.getFullYear()
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA EMPLEADO — solo su calendario
  // ══════════════════════════════════════════════════════════════════════════
  if (!esAdmin) {
    return (
      <View style={s.contenedor}>
        <View style={[s.header, { backgroundColor: '#1a56db' }]}>
          <Text style={s.titulo}>Mi Horario</Text>
          <Text style={s.subtitulo}>{usuario?.nombre}</Text>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {/* Navegación mes */}
          <View style={s.navMes}>
            <TouchableOpacity style={s.navBtn} onPress={() => cambiarMes(-1)}>
              <Text style={s.navBtnTexto}>‹</Text>
            </TouchableOpacity>
            <Text style={s.navMesTitulo}>{MESES[mes - 1]} {anio}</Text>
            <TouchableOpacity style={s.navBtn} onPress={() => cambiarMes(1)}>
              <Text style={s.navBtnTexto}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Resumen */}
          <View style={s.resumenRow}>
            {TIPOS_DIA.map(t => (
              <View key={t.value} style={[s.resumenChip, { borderColor: t.color }]}>
                <Text style={s.resumenEmoji}>{t.emoji}</Text>
                <Text style={[s.resumenNum, { color: t.color }]}>{resumen[t.value]}</Text>
                <Text style={s.resumenLabel}>{t.label}</Text>
              </View>
            ))}
          </View>

          {/* Calendario */}
          <View style={s.calendario}>
            {DIAS_SEMANA.map(d => (
              <Text key={d} style={s.diaSemanaHeader}>{d}</Text>
            ))}
            {celdasMes.map((dia, i) => {
              const info = dia ? infoDia(dia) : null
              const tInfo = info ? tipoDiaInfo(info.tipo) : null
              return (
                <View
                  key={i}
                  style={[
                    s.celda,
                    !dia && s.celdaVacia,
                    tInfo && { backgroundColor: tInfo.color + '25', borderColor: tInfo.color + '60' },
                    esHoy(dia) && s.celdaHoy
                  ]}
                >
                  {dia && (
                    <>
                      <Text style={[s.celdaNum, esHoy(dia) && { color: '#1a56db', fontWeight: '900' }]}>{dia}</Text>
                      {tInfo && <Text style={s.celdaEmoji}>{tInfo.emoji}</Text>}
                    </>
                  )}
                </View>
              )
            })}
          </View>

          {/* Leyenda */}
          <View style={s.leyenda}>
            {TIPOS_DIA.map(t => (
              <View key={t.value} style={s.leyendaItem}>
                <View style={[s.leyendaColor, { backgroundColor: t.color }]} />
                <Text style={s.leyendaTexto}>{t.emoji} {t.label}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VISTA ADMIN
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View style={s.contenedor}>
      <View style={[s.header, { backgroundColor: '#7C3AED' }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={s.titulo}>Empleados</Text>
            <Text style={s.subtitulo}>{empleados.length} registrados</Text>
          </View>
          {vistaAdmin === 'lista' && (
            <TouchableOpacity style={s.btnHeaderNuevo} onPress={() => setVistaAdmin('crear')}>
              <Text style={s.btnHeaderNuevoTexto}>+ Nuevo</Text>
            </TouchableOpacity>
          )}
          {vistaAdmin !== 'lista' && (
            <TouchableOpacity style={s.btnHeaderVolver} onPress={() => { setVistaAdmin('lista'); setEmpleadoSel(null) }}>
              <Text style={s.btnHeaderVolverTexto}>← Volver</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

        {/* ── LISTA DE EMPLEADOS ─────────────────────────────────────────── */}
        {vistaAdmin === 'lista' && (
          <View style={{ padding: 16 }}>
            {cargando
              ? <ActivityIndicator color={tema.primario} style={{ marginTop: 40 }} />
              : empleados.length === 0
                ? <Text style={s.vacio}>No hay empleados registrados</Text>
                : empleados.map(emp => (
                    <View key={emp.id} style={s.card}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {/* Avatar */}
                        {emp.foto_url
                          ? <Image source={{ uri: emp.foto_url }} style={s.avatar} />
                          : <View style={[s.avatar, s.avatarPlaceholder]}>
                              <Text style={{ fontSize: 22 }}>👤</Text>
                            </View>
                        }
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={s.cardNombre}>{emp.nombre}</Text>
                          <Text style={s.cardEmail}>{emp.email}</Text>
                          {emp.telefono && <Text style={s.cardTel}>📞 {emp.telefono}</Text>}
                          <View style={s.rolRow}>
                            <View style={[s.rolBadge, { backgroundColor: emp.rol === 'admin' ? '#7C3AED22' : '#1a56db22' }]}>
                              <Text style={[s.rolTexto, { color: emp.rol === 'admin' ? '#7C3AED' : '#1a56db' }]}>
                                {emp.rol === 'admin' ? '👑 Admin' : '👷 Empleado'}
                              </Text>
                            </View>
                            <View style={[s.rolBadge, { backgroundColor: emp.activo ? '#05966922' : '#EF444422' }]}>
                              <Text style={[s.rolTexto, { color: emp.activo ? '#059669' : '#EF4444' }]}>
                                {emp.activo ? 'Activo' : 'Inactivo'}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      <View style={s.cardAcciones}>
                        <TouchableOpacity
                          style={[s.btnAccion, { backgroundColor: '#1a56db22', borderColor: '#1a56db' }]}
                          onPress={() => { setEmpleadoSel(emp); setVistaAdmin('calendario') }}
                        >
                          <Text style={[s.btnAccionTexto, { color: '#1a56db' }]}>📅 Calendario</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.btnAccion, { backgroundColor: '#EF444422', borderColor: '#EF4444' }]}
                          onPress={() => eliminarEmpleado(emp)}
                        >
                          <Text style={[s.btnAccionTexto, { color: '#EF4444' }]}>🗑️ Eliminar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
            }
          </View>
        )}

        {/* ── CREAR EMPLEADO ─────────────────────────────────────────────── */}
        {vistaAdmin === 'crear' && (
          <View style={{ padding: 16 }}>
            <Text style={s.seccionTitulo}>Nuevo Empleado</Text>

            {[
              { label: 'Nombre completo *', value: formNombre, setter: setFormNombre, placeholder: 'Ej: Juan Pérez' },
              { label: 'Email *', value: formEmail, setter: setFormEmail, placeholder: 'Ej: juan@empresa.com', keyboard: 'email-address' },
              { label: 'Contraseña *', value: formPassword, setter: setFormPassword, placeholder: 'Mínimo 6 caracteres', secure: true },
              { label: 'Teléfono', value: formTelefono, setter: setFormTelefono, placeholder: 'Ej: 5555-1234', keyboard: 'phone-pad' },
            ].map(f => (
              <View key={f.label} style={s.campoGroup}>
                <Text style={s.campoLabel}>{f.label}</Text>
                <TextInput
                  style={s.campoInput}
                  value={f.value}
                  onChangeText={f.setter}
                  placeholder={f.placeholder}
                  placeholderTextColor={tema.textoTerciario}
                  keyboardType={f.keyboard || 'default'}
                  secureTextEntry={f.secure || false}
                  autoCapitalize={f.keyboard === 'email-address' ? 'none' : 'words'}
                />
              </View>
            ))}

            {/* Rol */}
            <View style={s.campoGroup}>
              <Text style={s.campoLabel}>Rol</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                {[{ v: 'empleado', l: '👷 Empleado' }, { v: 'admin', l: '👑 Admin' }].map(r => (
                  <TouchableOpacity
                    key={r.v}
                    style={[s.rolBtn, formRol === r.v && s.rolBtnActivo]}
                    onPress={() => setFormRol(r.v)}
                  >
                    <Text style={[s.rolBtnTexto, formRol === r.v && { color: '#fff' }]}>{r.l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[s.btnCrear, cargando && { opacity: 0.6 }]}
              onPress={crearEmpleado}
              disabled={cargando}
            >
              {cargando
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnCrearTexto}>Crear Empleado</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ── CALENDARIO DE EMPLEADO ─────────────────────────────────────── */}
        {vistaAdmin === 'calendario' && empleadoSel && (
          <View style={{ padding: 16 }}>
            {/* Info empleado */}
            <View style={s.empleadoInfo}>
              {empleadoSel.foto_url
                ? <Image source={{ uri: empleadoSel.foto_url }} style={s.avatarGrande} />
                : <View style={[s.avatarGrande, s.avatarPlaceholder]}><Text style={{ fontSize: 32 }}>👤</Text></View>
              }
              <View style={{ marginLeft: 14 }}>
                <Text style={s.empleadoNombre}>{empleadoSel.nombre}</Text>
                <Text style={s.empleadoRol}>{empleadoSel.rol === 'admin' ? '👑 Admin' : '👷 Empleado'}</Text>
                {empleadoSel.telefono && <Text style={s.empleadoTel}>📞 {empleadoSel.telefono}</Text>}
              </View>
            </View>

            {/* Navegación mes */}
            <View style={s.navMes}>
              <TouchableOpacity style={s.navBtn} onPress={() => cambiarMes(-1)}>
                <Text style={s.navBtnTexto}>‹</Text>
              </TouchableOpacity>
              <Text style={s.navMesTitulo}>{MESES[mes - 1]} {anio}</Text>
              <TouchableOpacity style={s.navBtn} onPress={() => cambiarMes(1)}>
                <Text style={s.navBtnTexto}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Resumen */}
            <View style={s.resumenRow}>
              {TIPOS_DIA.map(t => (
                <View key={t.value} style={[s.resumenChip, { borderColor: t.color }]}>
                  <Text style={s.resumenEmoji}>{t.emoji}</Text>
                  <Text style={[s.resumenNum, { color: t.color }]}>{resumen[t.value]}</Text>
                  <Text style={s.resumenLabel}>{t.label}</Text>
                </View>
              ))}
            </View>

            {/* Botón asignar rango */}
            <TouchableOpacity style={s.btnRango} onPress={() => setModalRango(true)}>
              <Text style={s.btnRangoTexto}>📅 Asignar rango de días</Text>
            </TouchableOpacity>

            {/* Calendario interactivo */}
            <View style={s.calendario}>
              {DIAS_SEMANA.map(d => (
                <Text key={d} style={s.diaSemanaHeader}>{d}</Text>
              ))}
              {celdasMes.map((dia, i) => {
                const info = dia ? infoDia(dia) : null
                const tInfo = info ? tipoDiaInfo(info.tipo) : null
                const fechaStr = dia ? `${anio}-${String(mes).padStart(2,'0')}-${String(dia).padStart(2,'0')}` : null
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      s.celda,
                      !dia && s.celdaVacia,
                      tInfo && { backgroundColor: tInfo.color + '25', borderColor: tInfo.color + '60' },
                      esHoy(dia) && s.celdaHoy
                    ]}
                    onPress={() => {
                      if (!dia) return
                      setDiaSeleccionado(fechaStr)
                      setTipoAsignar(info?.tipo || 'trabajo')
                      setNotaDia(info?.nota || '')
                      setModalDia(true)
                    }}
                    disabled={!dia}
                  >
                    {dia && (
                      <>
                        <Text style={[s.celdaNum, esHoy(dia) && { color: '#1a56db', fontWeight: '900' }]}>{dia}</Text>
                        {tInfo ? <Text style={s.celdaEmoji}>{tInfo.emoji}</Text> : <Text style={s.celdaVacioTexto}>+</Text>}
                      </>
                    )}
                  </TouchableOpacity>
                )
              })}
            </View>

            <View style={{ height: 40 }} />
          </View>
        )}

      </ScrollView>

      {/* ── MODAL ASIGNAR DÍA ──────────────────────────────────────────────── */}
      <Modal visible={modalDia} transparent animationType="slide">
        <View style={s.modalFondo}>
          <View style={s.modalCaja}>
            <Text style={s.modalTitulo}>
              Día {diaSeleccionado?.split('-').reverse().join('/')}
            </Text>
            <Text style={s.modalSubtitulo}>Empleado: {empleadoSel?.nombre}</Text>

            <View style={s.tiposGrid}>
              {TIPOS_DIA.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[s.tipoBton, tipoAsignar === t.value && { backgroundColor: t.color, borderColor: t.color }]}
                  onPress={() => setTipoAsignar(t.value)}
                >
                  <Text style={s.tipoEmoji}>{t.emoji}</Text>
                  <Text style={[s.tipoLabel, tipoAsignar === t.value && { color: '#fff' }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[s.campoInput, { marginTop: 12 }]}
              value={notaDia}
              onChangeText={setNotaDia}
              placeholder="Nota opcional..."
              placeholderTextColor={tema.textoTerciario}
            />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[s.btnAccion, { flex: 1, justifyContent: 'center', backgroundColor: '#EF444422', borderColor: '#EF4444' }]}
                onPress={() => borrarDia(diaSeleccionado)}
              >
                <Text style={[s.btnAccionTexto, { color: '#EF4444', textAlign: 'center' }]}>Borrar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnAccion, { flex: 2, justifyContent: 'center', backgroundColor: '#1a56db', borderColor: '#1a56db' }]}
                onPress={asignarDia}
              >
                <Text style={[s.btnAccionTexto, { color: '#fff', textAlign: 'center' }]}>Guardar</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.modalCerrar} onPress={() => setModalDia(false)}>
              <Text style={s.modalCerrarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL RANGO ────────────────────────────────────────────────────── */}
      <Modal visible={modalRango} transparent animationType="slide">
        <View style={s.modalFondo}>
          <View style={s.modalCaja}>
            <Text style={s.modalTitulo}>Asignar rango de días</Text>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.campoLabel}>Desde</Text>
                <TextInput
                  style={s.campoInput}
                  value={rangoInicio}
                  onChangeText={setRangoInicio}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={tema.textoTerciario}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.campoLabel}>Hasta</Text>
                <TextInput
                  style={s.campoInput}
                  value={rangoFin}
                  onChangeText={setRangoFin}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={tema.textoTerciario}
                />
              </View>
            </View>

            <Text style={[s.campoLabel, { marginBottom: 8 }]}>Tipo</Text>
            <View style={s.tiposGrid}>
              {TIPOS_DIA.map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[s.tipoBton, rangoTipo === t.value && { backgroundColor: t.color, borderColor: t.color }]}
                  onPress={() => setRangoTipo(t.value)}
                >
                  <Text style={s.tipoEmoji}>{t.emoji}</Text>
                  <Text style={[s.tipoLabel, rangoTipo === t.value && { color: '#fff' }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.checkRow, { marginTop: 12 }]}
              onPress={() => setRangoExcluirDomingos(!rangoExcluirDomingos)}
            >
              <View style={[s.checkbox, rangoExcluirDomingos && s.checkboxActivo]}>
                {rangoExcluirDomingos && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
              </View>
              <Text style={s.checkLabel}>Excluir domingos</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[s.btnAccion, { flex: 1, justifyContent: 'center' }]}
                onPress={() => setModalRango(false)}
              >
                <Text style={[s.btnAccionTexto, { textAlign: 'center', color: tema.textoSecundario }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnAccion, { flex: 2, justifyContent: 'center', backgroundColor: '#1a56db', borderColor: '#1a56db' }]}
                onPress={asignarRango}
                disabled={cargando}
              >
                {cargando
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={[s.btnAccionTexto, { color: '#fff', textAlign: 'center' }]}>Asignar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
const estilos = (tema) => StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: tema.fondo },
  header: { padding: 20, paddingTop: 50 },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  subtitulo: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  btnHeaderNuevo: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  btnHeaderNuevoTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  btnHeaderVolver: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  btnHeaderVolverTexto: { color: '#fff', fontWeight: '600', fontSize: 13 },

  vacio: { textAlign: 'center', color: tema.textoSecundario, marginTop: 40, fontSize: 15 },
  seccionTitulo: { fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 16 },

  card: { backgroundColor: tema.fondoCard, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: tema.borde },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { backgroundColor: tema.fondoSecundario, alignItems: 'center', justifyContent: 'center' },
  avatarGrande: { width: 72, height: 72, borderRadius: 36 },
  cardNombre: { fontSize: 16, fontWeight: '700', color: tema.texto },
  cardEmail: { fontSize: 12, color: tema.textoSecundario, marginTop: 2 },
  cardTel: { fontSize: 12, color: tema.textoSecundario, marginTop: 2 },
  rolRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  rolBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  rolTexto: { fontSize: 11, fontWeight: '700' },
  cardAcciones: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnAccion: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  btnAccionTexto: { fontSize: 13, fontWeight: '600' },

  campoGroup: { marginBottom: 14 },
  campoLabel: { fontSize: 12, fontWeight: '600', color: tema.textoSecundario, marginBottom: 6 },
  campoInput: { backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 12, color: tema.texto, fontSize: 14 },
  rolBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 2, borderColor: tema.borde, alignItems: 'center', backgroundColor: tema.fondoCard },
  rolBtnActivo: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
  rolBtnTexto: { fontSize: 13, fontWeight: '700', color: tema.texto },
  btnCrear: { backgroundColor: '#7C3AED', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnCrearTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },

  empleadoInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: tema.fondoCard, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: tema.borde },
  empleadoNombre: { fontSize: 18, fontWeight: '700', color: tema.texto },
  empleadoRol: { fontSize: 13, color: tema.textoSecundario, marginTop: 2 },
  empleadoTel: { fontSize: 12, color: tema.textoSecundario, marginTop: 2 },

  navMes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  navBtn: { backgroundColor: tema.fondoCard, borderRadius: 10, width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tema.borde },
  navBtnTexto: { fontSize: 22, color: tema.texto, fontWeight: '700' },
  navMesTitulo: { fontSize: 16, fontWeight: '700', color: tema.texto },

  resumenRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  resumenChip: { flex: 1, alignItems: 'center', backgroundColor: tema.fondoCard, borderRadius: 10, paddingVertical: 8, borderWidth: 1.5 },
  resumenEmoji: { fontSize: 16 },
  resumenNum: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  resumenLabel: { fontSize: 9, color: tema.textoSecundario, marginTop: 1 },

  btnRango: { backgroundColor: tema.fondoCard, borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: '#1a56db', borderStyle: 'dashed' },
  btnRangoTexto: { color: '#1a56db', fontWeight: '700', fontSize: 14 },

  calendario: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginBottom: 16 },
  diaSemanaHeader: { width: '13%', textAlign: 'center', fontSize: 11, fontWeight: '700', color: tema.textoSecundario, paddingVertical: 4 },
  celda: { width: '13%', aspectRatio: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: tema.fondoCard, borderWidth: 1, borderColor: tema.borde },
  celdaVacia: { backgroundColor: 'transparent', borderColor: 'transparent' },
  celdaHoy: { borderColor: '#1a56db', borderWidth: 2 },
  celdaNum: { fontSize: 12, fontWeight: '600', color: tema.texto },
  celdaEmoji: { fontSize: 10, marginTop: 1 },
  celdaVacioTexto: { fontSize: 16, color: tema.textoTerciario, marginTop: 2 },

  leyenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12, backgroundColor: tema.fondoCard, borderRadius: 12, borderWidth: 1, borderColor: tema.borde },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  leyendaColor: { width: 10, height: 10, borderRadius: 5 },
  leyendaTexto: { fontSize: 12, color: tema.textoSecundario },

  tiposGrid: { flexDirection: 'row', gap: 8 },
  tipoBton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 2, borderColor: tema.borde, backgroundColor: tema.fondoCard },
  tipoEmoji: { fontSize: 18 },
  tipoLabel: { fontSize: 10, fontWeight: '600', color: tema.texto, marginTop: 3 },

  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: tema.borde, backgroundColor: tema.fondoCard, alignItems: 'center', justifyContent: 'center' },
  checkboxActivo: { backgroundColor: '#1a56db', borderColor: '#1a56db' },
  checkLabel: { fontSize: 14, color: tema.texto },

  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCaja: { backgroundColor: tema.fondoCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 4 },
  modalSubtitulo: { fontSize: 13, color: tema.textoSecundario, marginBottom: 14 },
  modalCerrar: { backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 10 },
  modalCerrarTexto: { color: tema.texto, fontWeight: '600' },
})