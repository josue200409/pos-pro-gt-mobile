import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, Alert, ActivityIndicator, FlatList
} from 'react-native'
import { useTema } from '../context/TemaContext'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system'

const BASE_URL = 'https://pos-pro-gt-backend.onrender.com/api'

async function getToken() { return await AsyncStorage.getItem('token') }
async function api(endpoint, method = 'GET', body = null) {
  const token = await getToken()
  const config = { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
  if (body) config.body = JSON.stringify(body)
  const res = await fetch(`${BASE_URL}${endpoint}`, config)
  return res.json()
}

const TABS = [
  { id: 'actividad', label: 'Actividad',  emoji: '📋' },
  { id: 'alertas',   label: 'Alertas',    emoji: '🚨' },
  { id: 'backup',    label: 'Backup',     emoji: '☁️' },
]

const MODULOS = ['Todos', 'auth', 'ventas', 'inventario', 'seguridad', 'empleados', 'mermas']

export default function SeguridadScreen() {
  const { tema } = useTema()
  const s = estilos(tema)

  const [tab, setTab] = useState('actividad')
  const [cargando, setCargando] = useState(false)

  // Actividad
  const [actividad, setActividad] = useState([])
  const [resumen, setResumen] = useState(null)
  const [filtroModulo, setFiltroModulo] = useState('Todos')
  const [soloSospechosos, setSoloSospechosos] = useState(false)

  // Alertas
  const [bloqueados, setBloqueados] = useState([])
  const [intentosFallidos, setIntentosFallidos] = useState([])

  // Backup
  const [historialBackup, setHistorialBackup] = useState([])
  const [modalEmail, setModalEmail] = useState(false)
  const [emailDestino, setEmailDestino] = useState('')
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [descargando, setDescargando] = useState(false)

  useEffect(() => {
    if (tab === 'actividad') { cargarActividad(); cargarResumen() }
    if (tab === 'alertas')   { cargarBloqueados(); cargarResumen() }
    if (tab === 'backup')    cargarHistorialBackup()
  }, [tab])

  useEffect(() => {
    if (tab === 'actividad') cargarActividad()
  }, [filtroModulo, soloSospechosos])

  async function cargarActividad() {
    setCargando(true)
    try {
      let url = '/seguridad/actividad?limite=100'
      if (filtroModulo !== 'Todos') url += `&modulo=${filtroModulo}`
      if (soloSospechosos) url += '&sospechoso=true'
      const data = await api(url)
      setActividad(Array.isArray(data) ? data : [])
    } catch { setActividad([]) }
    setCargando(false)
  }

  async function cargarResumen() {
    try {
      const data = await api('/seguridad/actividad/resumen')
      setResumen(data)
      if (data.intentos_fallidos) setIntentosFallidos(data.intentos_fallidos)
    } catch {}
  }

  async function cargarBloqueados() {
    try {
      const data = await api('/seguridad/bloqueados')
      setBloqueados(Array.isArray(data) ? data : [])
    } catch { setBloqueados([]) }
  }

  async function cargarHistorialBackup() {
    try {
      const data = await api('/seguridad/backup/historial')
      setHistorialBackup(Array.isArray(data) ? data : [])
    } catch { setHistorialBackup([]) }
  }

  async function desbloquearCuenta(email) {
    Alert.alert('Desbloquear cuenta', `¿Desbloquear a ${email}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desbloquear', onPress: async () => {
        const res = await api('/seguridad/desbloquear', 'POST', { email })
        if (res.ok) { Alert.alert('Listo', `${email} desbloqueado`); cargarBloqueados() }
        else Alert.alert('Error', res.error)
      }}
    ])
  }

  async function descargarBackup() {
    setDescargando(true)
    try {
      const token = await getToken()
      const fecha = new Date().toISOString().split('T')[0]
      const fileUri = FileSystem.documentDirectory + `backup_posprogt_${fecha}.json`

      const result = await FileSystem.downloadAsync(
        `${BASE_URL}/seguridad/backup/generar`,
        fileUri,
        { headers: { Authorization: `Bearer ${token}` } }
      )

      if (result.status === 200) {
        await Sharing.shareAsync(result.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Guardar backup',
          UTI: 'public.json'
        })
        cargarHistorialBackup()
      } else {
        Alert.alert('Error', 'No se pudo generar el backup')
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo descargar el backup: ' + e.message)
    }
    setDescargando(false)
  }

  async function enviarBackupEmail() {
    if (!emailDestino) return Alert.alert('Error', 'Ingresa un email')
    setEnviandoEmail(true)
    try {
      const res = await api('/seguridad/backup/email', 'POST', { email_destino: emailDestino })
      if (res.ok) {
        Alert.alert('Enviado', `Backup enviado a ${emailDestino}`)
        setModalEmail(false)
        setEmailDestino('')
        cargarHistorialBackup()
      } else {
        Alert.alert('Error', res.error || 'No se pudo enviar')
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar al servidor')
    }
    setEnviandoEmail(false)
  }

  function formatFecha(f) {
    if (!f) return ''
    const d = new Date(f)
    return d.toLocaleDateString('es-GT') + ' ' + d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })
  }

  function colorAccion(accion) {
    if (!accion) return tema.textoSecundario
    if (accion.includes('FALLIDO') || accion.includes('BLOQUEADO')) return '#EF4444'
    if (accion.includes('EXITOSO') || accion.includes('COMPLETADO')) return '#059669'
    if (accion.includes('ELIMINAR') || accion.includes('DELETE')) return '#F97316'
    if (accion.includes('BACKUP')) return '#8B5CF6'
    return tema.primario
  }

  function emojiAccion(accion) {
    if (!accion) return '📌'
    if (accion.includes('LOGIN_EXITOSO')) return '✅'
    if (accion.includes('LOGIN_FALLIDO')) return '❌'
    if (accion.includes('BLOQUEADO') || accion.includes('BLOQUEA')) return '🔒'
    if (accion.includes('LOGOUT')) return '🚪'
    if (accion.includes('BACKUP')) return '💾'
    if (accion.includes('ELIMINAR') || accion.includes('DELETE')) return '🗑️'
    if (accion.includes('CREAR') || accion.includes('INSERT')) return '➕'
    if (accion.includes('EDITAR') || accion.includes('UPDATE')) return '✏️'
    return '📌'
  }

  return (
    <View style={s.contenedor}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.titulo}>Seguridad</Text>
        <Text style={s.subtitulo}>Monitoreo y respaldo del sistema</Text>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[s.tab, tab === t.id && s.tabActivo]}
            onPress={() => setTab(t.id)}
          >
            <Text style={[s.tabTexto, tab === t.id && s.tabTextoActivo]}>
              {t.emoji} {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

        {/* ── ACTIVIDAD ──────────────────────────────────────────────────── */}
        {tab === 'actividad' && (
          <View style={{ padding: 14 }}>
            {/* Resumen hoy */}
            {resumen && (
              <View style={s.resumenGrid}>
                <View style={[s.resumenCard, { borderLeftColor: tema.primario }]}>
                  <Text style={[s.resumenNum, { color: tema.primario }]}>{resumen.hoy?.total || 0}</Text>
                  <Text style={s.resumenLabel}>Acciones hoy</Text>
                </View>
                <View style={[s.resumenCard, { borderLeftColor: '#EF4444' }]}>
                  <Text style={[s.resumenNum, { color: '#EF4444' }]}>{resumen.hoy?.sospechas || 0}</Text>
                  <Text style={s.resumenLabel}>Sospechas</Text>
                </View>
                <View style={[s.resumenCard, { borderLeftColor: '#059669' }]}>
                  <Text style={[s.resumenNum, { color: '#059669' }]}>{resumen.hoy?.usuarios_activos || 0}</Text>
                  <Text style={s.resumenLabel}>Usuarios activos</Text>
                </View>
              </View>
            )}

            {/* Filtros */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {MODULOS.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[s.filtroChip, filtroModulo === m && s.filtroChipActivo]}
                  onPress={() => setFiltroModulo(m)}
                >
                  <Text style={[s.filtroChipTexto, filtroModulo === m && { color: '#fff' }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Toggle solo sospechosos */}
            <TouchableOpacity
              style={[s.toggleSospechosos, soloSospechosos && { backgroundColor: '#EF444422', borderColor: '#EF4444' }]}
              onPress={() => setSoloSospechosos(!soloSospechosos)}
            >
              <Text style={[s.toggleTexto, soloSospechosos && { color: '#EF4444' }]}>
                🚨 {soloSospechosos ? 'Mostrando solo sospechas' : 'Mostrar solo sospechas'}
              </Text>
            </TouchableOpacity>

            {cargando
              ? <ActivityIndicator color={tema.primario} style={{ marginTop: 30 }} />
              : actividad.length === 0
                ? <Text style={s.vacio}>Sin registros de actividad</Text>
                : actividad.map(item => (
                    <View key={item.id} style={[s.actividadCard, item.sospechoso && s.actividadCardAlerta]}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <Text style={{ fontSize: 14 }}>{emojiAccion(item.accion)}</Text>
                            <Text style={[s.actividadAccion, { color: colorAccion(item.accion) }]}>
                              {item.accion?.replace(/_/g, ' ')}
                            </Text>
                            {item.sospechoso && (
                              <View style={s.badgeAlerta}><Text style={s.badgeAlertaTexto}>⚠️ Sospechoso</Text></View>
                            )}
                          </View>
                          <Text style={s.actividadUsuario}>👤 {item.nombre_usuario || 'N/A'}</Text>
                          {item.modulo && <Text style={s.actividadModulo}>📦 {item.modulo}</Text>}
                          {item.detalle && <Text style={s.actividadDetalle}>{item.detalle}</Text>}
                          {item.ip && <Text style={s.actividadIp}>🌐 {item.ip}</Text>}
                        </View>
                        <Text style={s.actividadFecha}>{formatFecha(item.created_at)}</Text>
                      </View>
                    </View>
                  ))
            }
          </View>
        )}

        {/* ── ALERTAS ────────────────────────────────────────────────────── */}
        {tab === 'alertas' && (
          <View style={{ padding: 14 }}>
            {/* Cuentas bloqueadas */}
            <Text style={s.seccionTitulo}>🔒 Cuentas bloqueadas</Text>
            {bloqueados.length === 0
              ? <View style={s.sinAlertas}><Text style={s.sinAlertasTexto}>✅ No hay cuentas bloqueadas</Text></View>
              : bloqueados.map(b => (
                  <View key={b.id} style={s.alertaCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <Text style={s.alertaEmail}>{b.email}</Text>
                        <Text style={s.alertaInfo}>{b.intentos} intentos fallidos</Text>
                        <Text style={s.alertaFecha}>Bloqueado: {formatFecha(b.fecha_bloqueo)}</Text>
                      </View>
                      <TouchableOpacity style={s.btnDesbloquear} onPress={() => desbloquearCuenta(b.email)}>
                        <Text style={s.btnDesbloquearTexto}>Desbloquear</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
            }

            {/* Intentos fallidos recientes */}
            <Text style={[s.seccionTitulo, { marginTop: 20 }]}>❌ Intentos fallidos (24h)</Text>
            {intentosFallidos.length === 0
              ? <View style={s.sinAlertas}><Text style={s.sinAlertasTexto}>✅ Sin intentos fallidos recientes</Text></View>
              : intentosFallidos.map((item, i) => (
                  <View key={i} style={s.intentoCard}>
                    <Text style={s.intentoEmail}>{item.email}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={s.intentoNum}>{item.intentos} intentos</Text>
                      <Text style={s.intentoFecha}>Último: {formatFecha(item.ultimo)}</Text>
                    </View>
                    {/* Barra de peligro */}
                    <View style={{ height: 4, backgroundColor: tema.fondoSecundario, borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                      <View style={{
                        height: 4, borderRadius: 2,
                        width: `${Math.min(100, (item.intentos / 5) * 100)}%`,
                        backgroundColor: item.intentos >= 5 ? '#EF4444' : item.intentos >= 3 ? '#F97316' : '#F59E0B'
                      }} />
                    </View>
                  </View>
                ))
            }

            {/* Actividad sospechosa */}
            {resumen?.por_modulo?.length > 0 && (
              <>
                <Text style={[s.seccionTitulo, { marginTop: 20 }]}>📊 Actividad por módulo hoy</Text>
                {resumen.por_modulo.map((m, i) => (
                  <View key={i} style={s.moduloItem}>
                    <Text style={s.moduloNombre}>📦 {m.modulo}</Text>
                    <Text style={s.moduloTotal}>{m.total} acciones</Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* ── BACKUP ─────────────────────────────────────────────────────── */}
        {tab === 'backup' && (
          <View style={{ padding: 14 }}>
            {/* Info backup automático */}
            <View style={s.infoBackup}>
              <Text style={s.infoBackupTitulo}>⏰ Backup automático</Text>
              <Text style={s.infoBackupTexto}>
                El sistema genera un backup automático cada día a las 2:00 AM y lo envía al email configurado en las variables de entorno del servidor.
              </Text>
            </View>

            {/* Botones de acción */}
            <Text style={s.seccionTitulo}>Backup manual</Text>

            <TouchableOpacity
              style={[s.btnBackup, { backgroundColor: '#1a56db' }, descargando && { opacity: 0.6 }]}
              onPress={descargarBackup}
              disabled={descargando}
            >
              {descargando
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Text style={s.btnBackupEmoji}>📥</Text>
                    <View>
                      <Text style={s.btnBackupTitulo}>Descargar Backup</Text>
                      <Text style={s.btnBackupSub}>Genera y descarga archivo JSON completo</Text>
                    </View>
                  </>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.btnBackup, { backgroundColor: '#059669' }]}
              onPress={() => setModalEmail(true)}
            >
              <Text style={s.btnBackupEmoji}>📧</Text>
              <View>
                <Text style={s.btnBackupTitulo}>Enviar por Email</Text>
                <Text style={s.btnBackupSub}>Enviar backup a tu correo electrónico</Text>
              </View>
            </TouchableOpacity>

            {/* Historial de backups */}
            <Text style={[s.seccionTitulo, { marginTop: 20 }]}>Historial de backups</Text>
            {historialBackup.length === 0
              ? <Text style={s.vacio}>Sin backups registrados</Text>
              : historialBackup.map(b => (
                  <View key={b.id} style={s.backupCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <View style={[s.backupTipoBadge, { backgroundColor: b.tipo === 'automatico' ? '#1a56db22' : '#05966922' }]}>
                            <Text style={[s.backupTipoTexto, { color: b.tipo === 'automatico' ? '#1a56db' : '#059669' }]}>
                              {b.tipo === 'automatico' ? '⏰ Auto' : '👤 Manual'}
                            </Text>
                          </View>
                          {b.enviado_email && (
                            <View style={[s.backupTipoBadge, { backgroundColor: '#8B5CF622' }]}>
                              <Text style={[s.backupTipoTexto, { color: '#8B5CF6' }]}>📧 Email</Text>
                            </View>
                          )}
                        </View>
                        <Text style={s.backupInfo}>{b.registros} registros · {b.tablas} tablas</Text>
                        {b.creado_por_nombre && <Text style={s.backupCreador}>👤 {b.creado_por_nombre}</Text>}
                      </View>
                      <Text style={s.backupFecha}>{formatFecha(b.created_at)}</Text>
                    </View>
                  </View>
                ))
            }

            <View style={{ height: 40 }} />
          </View>
        )}

      </ScrollView>

      {/* Modal email backup */}
      <Modal visible={modalEmail} transparent animationType="slide">
        <View style={s.modalFondo}>
          <View style={s.modalCaja}>
            <Text style={s.modalTitulo}>Enviar backup por email</Text>
            <Text style={s.modalSub}>El archivo se enviará como adjunto al correo indicado</Text>
            <TextInput
              style={s.modalInput}
              value={emailDestino}
              onChangeText={setEmailDestino}
              placeholder="ejemplo@gmail.com"
              placeholderTextColor={tema.textoTerciario}
              keyboardType="email-address"
              autoCapitalize="none"
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[s.modalBtn, { borderWidth: 1, borderColor: tema.borde }]} onPress={() => setModalEmail(false)}>
                <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalBtn, { backgroundColor: '#059669', flex: 2 }, enviandoEmail && { opacity: 0.6 }]}
                onPress={enviarBackupEmail}
                disabled={enviandoEmail}
              >
                {enviandoEmail
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: '#fff', fontWeight: '700' }}>Enviar</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const estilos = (tema) => StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: tema.fondo },
  header: { backgroundColor: '#1e1b4b', padding: 20, paddingTop: 50 },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  subtitulo: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },

  tabs: { flexDirection: 'row', backgroundColor: tema.fondoCard, borderBottomWidth: 1, borderBottomColor: tema.borde },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActivo: { borderBottomWidth: 3, borderBottomColor: '#6366f1' },
  tabTexto: { fontSize: 12, color: tema.textoSecundario, fontWeight: '500' },
  tabTextoActivo: { color: '#6366f1', fontWeight: '700' },

  vacio: { textAlign: 'center', color: tema.textoSecundario, marginTop: 30, fontSize: 14 },
  seccionTitulo: { fontSize: 15, fontWeight: '700', color: tema.texto, marginBottom: 10 },

  resumenGrid: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  resumenCard: { flex: 1, backgroundColor: tema.fondoCard, borderRadius: 10, padding: 12, borderLeftWidth: 4, borderWidth: 1, borderColor: tema.borde },
  resumenNum: { fontSize: 22, fontWeight: '900' },
  resumenLabel: { fontSize: 10, color: tema.textoSecundario, marginTop: 2 },

  filtroChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: tema.fondoCard, borderWidth: 1, borderColor: tema.borde, marginRight: 8 },
  filtroChipActivo: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  filtroChipTexto: { color: tema.texto, fontSize: 12, fontWeight: '600' },

  toggleSospechosos: { backgroundColor: tema.fondoCard, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: tema.borde, marginBottom: 12 },
  toggleTexto: { color: tema.textoSecundario, fontWeight: '600', fontSize: 13 },

  actividadCard: { backgroundColor: tema.fondoCard, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: tema.borde },
  actividadCardAlerta: { borderColor: '#EF4444', borderLeftWidth: 3 },
  actividadAccion: { fontSize: 13, fontWeight: '700' },
  actividadUsuario: { fontSize: 12, color: tema.textoSecundario, marginTop: 2 },
  actividadModulo: { fontSize: 11, color: tema.textoTerciario },
  actividadDetalle: { fontSize: 11, color: tema.textoTerciario, marginTop: 3, fontStyle: 'italic' },
  actividadIp: { fontSize: 10, color: tema.textoTerciario, marginTop: 2 },
  actividadFecha: { fontSize: 10, color: tema.textoTerciario, marginLeft: 8, textAlign: 'right' },
  badgeAlerta: { backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  badgeAlertaTexto: { fontSize: 10, color: '#92400E', fontWeight: '700' },

  sinAlertas: { backgroundColor: '#d1fae5', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 10 },
  sinAlertasTexto: { color: '#059669', fontWeight: '600' },

  alertaCard: { backgroundColor: '#fee2e2', borderRadius: 10, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#fca5a5' },
  alertaEmail: { fontSize: 14, fontWeight: '700', color: '#991b1b' },
  alertaInfo: { fontSize: 12, color: '#b91c1c', marginTop: 2 },
  alertaFecha: { fontSize: 11, color: '#dc2626', marginTop: 2 },
  btnDesbloquear: { backgroundColor: '#059669', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnDesbloquearTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },

  intentoCard: { backgroundColor: tema.fondoCard, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: tema.borde },
  intentoEmail: { fontSize: 14, fontWeight: '600', color: tema.texto },
  intentoNum: { fontSize: 13, fontWeight: '700', color: '#F97316' },
  intentoFecha: { fontSize: 11, color: tema.textoSecundario },

  moduloItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tema.borde },
  moduloNombre: { fontSize: 13, color: tema.texto },
  moduloTotal: { fontSize: 13, fontWeight: '700', color: tema.primario },

  infoBackup: { backgroundColor: '#EEF2FF', borderRadius: 12, padding: 14, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: '#6366f1' },
  infoBackupTitulo: { fontSize: 14, fontWeight: '700', color: '#3730a3', marginBottom: 4 },
  infoBackupTexto: { fontSize: 12, color: '#4338ca', lineHeight: 18 },

  btnBackup: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 12, padding: 16, marginBottom: 12 },
  btnBackupEmoji: { fontSize: 28 },
  btnBackupTitulo: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnBackupSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },

  backupCard: { backgroundColor: tema.fondoCard, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: tema.borde },
  backupTipoBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  backupTipoTexto: { fontSize: 11, fontWeight: '700' },
  backupInfo: { fontSize: 12, color: tema.textoSecundario, marginTop: 4 },
  backupCreador: { fontSize: 11, color: tema.textoTerciario, marginTop: 2 },
  backupFecha: { fontSize: 11, color: tema.textoTerciario, textAlign: 'right' },

  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCaja: { backgroundColor: tema.fondoCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 4 },
  modalSub: { fontSize: 13, color: tema.textoSecundario, marginBottom: 14 },
  modalInput: { backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 14, color: tema.texto, fontSize: 15 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
})