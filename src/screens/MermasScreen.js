import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  Modal, StyleSheet, Alert, ActivityIndicator, FlatList
} from 'react-native'
import { useTema } from '../context/TemaContext'
import { productosService } from '../services/api'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = 'https://pos-pro-gt-backend.onrender.com/api'

const TIPOS = [
  { value: 'vencido',      label: 'Vencido',     emoji: '📅', color: '#EF4444' },
  { value: 'danado',       label: 'Dañado',       emoji: '💥', color: '#F97316' },
  { value: 'robo_perdida', label: 'Robo/Pérdida', emoji: '🔍', color: '#8B5CF6' },
]

async function getToken() {
  return await AsyncStorage.getItem('token')
}

async function apiMermas(endpoint, method = 'GET', body = null) {
  const token = await getToken()
  const config = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
  }
  if (body) config.body = JSON.stringify(body)
  const res = await fetch(`${BASE_URL}/mermas${endpoint}`, config)
  return res.json()
}

export default function MermasScreen() {
  const { tema } = useTema()
  const s = estilos(tema)

  const [vista, setVista] = useState('registro')
  const [cargando, setCargando] = useState(false)

  const [productos, setProductos] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [productoSel, setProductoSel] = useState(null)
  const [mostrarProductos, setMostrarProductos] = useState(false)
  const [tipo, setTipo] = useState('vencido')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')

  const [mermas, setMermas] = useState([])
  const [filtroTipo, setFiltroTipo] = useState('')

  const [resumen, setResumen] = useState(null)
  const [fechaDesde, setFechaDesde] = useState(
    new Date(new Date().setDate(1)).toISOString().split('T')[0]
  )
  const [fechaHasta, setFechaHasta] = useState(
    new Date().toISOString().split('T')[0]
  )

  const [usuario, setUsuario] = useState(null)

  useEffect(() => {
    cargarProductos()
    obtenerUsuario()
  }, [])

  useEffect(() => {
    if (vista === 'historial') cargarMermas()
    if (vista === 'reporte') cargarResumen()
  }, [vista])

  async function obtenerUsuario() {
    const data = await AsyncStorage.getItem('usuario')
    if (data) setUsuario(JSON.parse(data))
  }

  async function cargarProductos() {
    try {
      const data = await productosService.listar()
      setProductos(Array.isArray(data) ? data : [])
    } catch { setProductos([]) }
  }

  async function cargarMermas() {
    setCargando(true)
    try {
      const url = filtroTipo ? `?tipo=${filtroTipo}` : ''
      const data = await apiMermas(url)
      setMermas(Array.isArray(data) ? data : [])
    } catch { setMermas([]) }
    setCargando(false)
  }

  async function cargarResumen() {
    setCargando(true)
    try {
      const data = await apiMermas(`/resumen?fecha_inicio=${fechaDesde}&fecha_fin=${fechaHasta}`)
      setResumen(data)
    } catch { setResumen(null) }
    setCargando(false)
  }

  async function registrarMerma() {
    if (!productoSel) return Alert.alert('Error', 'Selecciona un producto')
    if (!cantidad || parseFloat(cantidad) <= 0) return Alert.alert('Error', 'Ingresa una cantidad válida')
    if (parseFloat(cantidad) > productoSel.stock) {
      return Alert.alert('Error', `Stock disponible: ${productoSel.stock}`)
    }
    setCargando(true)
    try {
      const res = await apiMermas('', 'POST', {
        producto_id: productoSel.id,
        tipo,
        cantidad: parseFloat(cantidad),
        motivo
      })
      if (res.ok) {
        Alert.alert('Merma registrada', `Se registró la pérdida de ${cantidad} unidades de ${productoSel.nombre}`)
        setProductoSel(null)
        setBusqueda('')
        setCantidad('')
        setMotivo('')
        cargarProductos()
      } else {
        Alert.alert('Error', res.error || 'No se pudo registrar')
      }
    } catch {
      Alert.alert('Error', 'No se pudo conectar al servidor')
    }
    setCargando(false)
  }

  async function eliminarMerma(id) {
    if (usuario?.rol !== 'admin') {
      return Alert.alert('Sin permiso', 'Solo administradores pueden eliminar mermas')
    }
    Alert.alert('Eliminar merma', '¿Restaurar stock y eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          const res = await apiMermas(`/${id}`, 'DELETE')
          if (res.ok) { Alert.alert('Listo', res.mensaje); cargarMermas() }
          else Alert.alert('Error', res.error)
        }
      }
    ])
  }

  const productosFiltrados = productos.filter(p =>
    p.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigo_barras?.includes(busqueda)
  )

  function tipoInfo(t) {
    return TIPOS.find(x => x.value === t) || TIPOS[0]
  }

  function formatQ(n) {
    return `Q ${parseFloat(n || 0).toFixed(2)}`
  }

  function formatFecha(f) {
    if (!f) return ''
    const d = new Date(f)
    return d.toLocaleDateString('es-GT') + ' ' + d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <View style={s.contenedor}>
      <View style={s.header}>
        <Text style={s.titulo}>Control de Mermas</Text>
        <Text style={s.subtitulo}>Registro de pérdidas de inventario</Text>
      </View>

      <View style={s.tabs}>
        {[
          { id: 'registro',  label: 'Registrar', emoji: '➕' },
          { id: 'historial', label: 'Historial',  emoji: '📋' },
          { id: 'reporte',   label: 'Reporte',    emoji: '📊' },
        ].map(tab => (
          <TouchableOpacity
            key={tab.id}
            style={[s.tab, vista === tab.id && s.tabActivo]}
            onPress={() => setVista(tab.id)}
          >
            <Text style={[s.tabTexto, vista === tab.id && s.tabTextoActivo]}>
              {tab.emoji} {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.contenido} showsVerticalScrollIndicator={false}>

        {/* REGISTRO */}
        {vista === 'registro' && (
          <View>
            <View style={s.seccion}>
              <Text style={s.label}>Producto</Text>
              <TouchableOpacity style={s.selectorProducto} onPress={() => setMostrarProductos(true)}>
                <Text style={productoSel ? s.textoProductoSel : s.textoPlaceholder}>
                  {productoSel ? productoSel.nombre : 'Toca para buscar producto...'}
                </Text>
                {productoSel && <Text style={s.stockTexto}>Stock: {productoSel.stock}</Text>}
              </TouchableOpacity>
            </View>

            <View style={s.seccion}>
              <Text style={s.label}>Tipo de merma</Text>
              <View style={s.tiposGrid}>
                {TIPOS.map(t => (
                  <TouchableOpacity
                    key={t.value}
                    style={[s.tipoBton, tipo === t.value && { backgroundColor: t.color, borderColor: t.color }]}
                    onPress={() => setTipo(t.value)}
                  >
                    <Text style={s.tipoEmoji}>{t.emoji}</Text>
                    <Text style={[s.tipoLabel, tipo === t.value && { color: '#fff' }]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.seccion}>
              <Text style={s.label}>Cantidad</Text>
              <TextInput
                style={s.input}
                value={cantidad}
                onChangeText={setCantidad}
                placeholder="Ej: 5"
                placeholderTextColor={tema.textoTerciario}
                keyboardType="numeric"
              />
              {productoSel && parseFloat(cantidad) > 0 && (
                <Text style={s.perdidaEstimada}>
                  Pérdida estimada: {formatQ((productoSel.precio_costo || productoSel.precio_venta || productoSel.precio || 0) * parseFloat(cantidad))}
                </Text>
              )}
            </View>

            <View style={s.seccion}>
              <Text style={s.label}>Motivo / Descripción (opcional)</Text>
              <TextInput
                style={[s.input, { height: 80, textAlignVertical: 'top' }]}
                value={motivo}
                onChangeText={setMotivo}
                placeholder="Describe la causa de la merma..."
                placeholderTextColor={tema.textoTerciario}
                multiline
              />
            </View>

            <TouchableOpacity
              style={[s.btnRegistrar, cargando && { opacity: 0.6 }]}
              onPress={registrarMerma}
              disabled={cargando}
            >
              {cargando
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnRegistrarTexto}>Registrar Merma</Text>
              }
            </TouchableOpacity>

            <View style={s.aviso}>
              <Text style={s.avisoTexto}>
                Al registrar una merma, el stock del producto se descuenta automáticamente del inventario.
              </Text>
            </View>
          </View>
        )}

        {/* HISTORIAL */}
        {vista === 'historial' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filtrosRow}>
              {[{ value: '', label: 'Todos', emoji: '📋' }, ...TIPOS].map(t => (
                <TouchableOpacity
                  key={t.value}
                  style={[s.filtroChip, filtroTipo === t.value && s.filtroChipActivo]}
                  onPress={() => { setFiltroTipo(t.value); setTimeout(cargarMermas, 100) }}
                >
                  <Text style={[s.filtroChipTexto, filtroTipo === t.value && s.filtroChipTextoActivo]}>
                    {t.emoji} {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {cargando
              ? <ActivityIndicator color={tema.primario} style={{ marginTop: 40 }} />
              : mermas.length === 0
                ? <Text style={s.vacio}>No hay registros de mermas</Text>
                : mermas.map(m => {
                    const t = tipoInfo(m.tipo)
                    return (
                      <View key={m.id} style={s.card}>
                        <View style={s.cardHeader}>
                          <View style={[s.tipoBadge, { backgroundColor: t.color + '22' }]}>
                            <Text style={[s.tipoBadgeTexto, { color: t.color }]}>{t.emoji} {t.label}</Text>
                          </View>
                          <Text style={s.cardFecha}>{formatFecha(m.fecha)}</Text>
                        </View>
                        <Text style={s.cardProducto}>{m.nombre_producto}</Text>
                        <View style={s.cardRow}>
                          <View style={s.cardDato}>
                            <Text style={s.cardDatoLabel}>Cantidad</Text>
                            <Text style={s.cardDatoVal}>{m.cantidad}</Text>
                          </View>
                          <View style={s.cardDato}>
                            <Text style={s.cardDatoLabel}>Costo unit.</Text>
                            <Text style={s.cardDatoVal}>{formatQ(m.costo_unitario)}</Text>
                          </View>
                          <View style={s.cardDato}>
                            <Text style={s.cardDatoLabel}>Pérdida total</Text>
                            <Text style={[s.cardDatoVal, { color: '#EF4444', fontWeight: 'bold' }]}>{formatQ(m.total_perdida)}</Text>
                          </View>
                        </View>
                        {m.motivo ? <Text style={s.cardMotivo}>"{m.motivo}"</Text> : null}
                        <View style={s.cardFooter}>
                          <Text style={s.cardEmpleado}>Por: {m.nombre_usuario || 'N/A'}</Text>
                          {usuario?.rol === 'admin' && (
                            <TouchableOpacity onPress={() => eliminarMerma(m.id)}>
                              <Text style={s.btnEliminar}>Eliminar</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )
                  })
            }
          </View>
        )}

        {/* REPORTE */}
        {vista === 'reporte' && (
          <View>
            <View style={s.seccion}>
              <Text style={s.label}>Periodo</Text>
              <View style={s.fechasRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.labelPequeno}>Desde</Text>
                  <TextInput
                    style={s.inputFecha}
                    value={fechaDesde}
                    onChangeText={setFechaDesde}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={tema.textoTerciario}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.labelPequeno}>Hasta</Text>
                  <TextInput
                    style={s.inputFecha}
                    value={fechaHasta}
                    onChangeText={setFechaHasta}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={tema.textoTerciario}
                  />
                </View>
              </View>
              <TouchableOpacity style={s.btnBuscar} onPress={cargarResumen}>
                <Text style={s.btnBuscarTexto}>Generar reporte</Text>
              </TouchableOpacity>
            </View>

            {cargando
              ? <ActivityIndicator color={tema.primario} style={{ marginTop: 40 }} />
              : resumen && (
                <View>
                  <Text style={s.seccionTitulo}>Resumen general</Text>
                  <View style={s.totalGrid}>
                    <View style={[s.totalCard, { borderLeftColor: '#EF4444' }]}>
                      <Text style={s.totalLabel}>Pérdida total</Text>
                      <Text style={[s.totalVal, { color: '#EF4444' }]}>{formatQ(resumen.total?.total_quetzales)}</Text>
                    </View>
                    <View style={[s.totalCard, { borderLeftColor: '#F97316' }]}>
                      <Text style={s.totalLabel}>Unidades perdidas</Text>
                      <Text style={[s.totalVal, { color: '#F97316' }]}>{parseFloat(resumen.total?.total_unidades || 0).toFixed(0)}</Text>
                    </View>
                    <View style={[s.totalCard, { borderLeftColor: '#8B5CF6' }]}>
                      <Text style={s.totalLabel}>Registros</Text>
                      <Text style={[s.totalVal, { color: '#8B5CF6' }]}>{resumen.total?.total_registros || 0}</Text>
                    </View>
                  </View>

                  {resumen.por_tipo?.length > 0 && (
                    <View style={s.seccion}>
                      <Text style={s.seccionTitulo}>Por tipo de merma</Text>
                      {resumen.por_tipo.map((t, i) => {
                        const info = tipoInfo(t.tipo)
                        return (
                          <View key={i} style={s.reporteItem}>
                            <Text style={s.reporteItemLabel}>{info.emoji} {info.label}</Text>
                            <View style={s.reporteItemDatos}>
                              <Text style={s.reporteItemSub}>{t.unidades} uds.</Text>
                              <Text style={[s.reporteItemVal, { color: info.color }]}>{formatQ(t.quetzales)}</Text>
                            </View>
                          </View>
                        )
                      })}
                    </View>
                  )}

                  {resumen.por_producto?.length > 0 && (
                    <View style={s.seccion}>
                      <Text style={s.seccionTitulo}>Top productos con más merma</Text>
                      {resumen.por_producto.map((p, i) => (
                        <View key={i} style={s.reporteItem}>
                          <Text style={s.reporteItemLabel}>{i + 1}. {p.nombre_producto}</Text>
                          <View style={s.reporteItemDatos}>
                            <Text style={s.reporteItemSub}>{p.unidades} uds.</Text>
                            <Text style={[s.reporteItemVal, { color: '#EF4444' }]}>{formatQ(p.quetzales)}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {resumen.por_empleado?.length > 0 && (
                    <View style={s.seccion}>
                      <Text style={s.seccionTitulo}>Por empleado</Text>
                      {resumen.por_empleado.map((e, i) => (
                        <View key={i} style={s.reporteItem}>
                          <Text style={s.reporteItemLabel}>{e.nombre_usuario || 'N/A'}</Text>
                          <View style={s.reporteItemDatos}>
                            <Text style={s.reporteItemSub}>{e.registros} registros</Text>
                            <Text style={[s.reporteItemVal, { color: '#EF4444' }]}>{formatQ(e.quetzales)}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )
            }
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Modal buscar producto */}
      <Modal visible={mostrarProductos} animationType="slide" transparent>
        <View style={s.modalFondo}>
          <View style={s.modalCaja}>
            <Text style={s.modalTitulo}>Seleccionar producto</Text>
            <TextInput
              style={s.modalBusqueda}
              value={busqueda}
              onChangeText={setBusqueda}
              placeholder="Buscar por nombre o código..."
              placeholderTextColor={tema.textoTerciario}
              autoFocus
            />
            <FlatList
              data={productosFiltrados.slice(0, 50)}
              keyExtractor={item => item.id.toString()}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.productoItem}
                  onPress={() => {
                    setProductoSel(item)
                    setMostrarProductos(false)
                    setBusqueda('')
                  }}
                >
                  <Text style={s.productoItemNombre}>{item.nombre}</Text>
                  <Text style={s.productoItemInfo}>
                    Stock: {item.stock}  |  Q{parseFloat(item.precio_venta || item.precio || 0).toFixed(2)}
                  </Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: tema.borde }} />}
            />
            <TouchableOpacity style={s.modalCerrar} onPress={() => setMostrarProductos(false)}>
              <Text style={s.modalCerrarTexto}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const estilos = (tema) => StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: tema.fondo },
  header: { backgroundColor: '#DC2626', padding: 20, paddingTop: 50 },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  subtitulo: { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  tabs: { flexDirection: 'row', backgroundColor: tema.fondoCard, borderBottomWidth: 1, borderBottomColor: tema.borde },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActivo: { borderBottomWidth: 3, borderBottomColor: '#DC2626' },
  tabTexto: { fontSize: 12, color: tema.textoSecundario, fontWeight: '500' },
  tabTextoActivo: { color: '#DC2626', fontWeight: '700' },

  contenido: { flex: 1, padding: 16 },
  seccion: { marginBottom: 16 },
  seccionTitulo: { fontSize: 15, fontWeight: '700', color: tema.texto, marginBottom: 10, marginTop: 8 },
  label: { fontSize: 13, fontWeight: '600', color: tema.textoSecundario, marginBottom: 6 },
  labelPequeno: { fontSize: 11, color: tema.textoSecundario, marginBottom: 4 },

  selectorProducto: { backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 14 },
  textoProductoSel: { color: tema.texto, fontSize: 15, fontWeight: '600' },
  textoPlaceholder: { color: tema.textoTerciario, fontSize: 14 },
  stockTexto: { color: tema.textoSecundario, fontSize: 12, marginTop: 4 },

  tiposGrid: { flexDirection: 'row', gap: 10 },
  tipoBton: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10, borderWidth: 2, borderColor: tema.borde, backgroundColor: tema.fondoCard },
  tipoEmoji: { fontSize: 22 },
  tipoLabel: { fontSize: 12, fontWeight: '600', color: tema.texto, marginTop: 4 },

  input: { backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 12, color: tema.texto, fontSize: 15 },
  perdidaEstimada: { color: '#EF4444', fontSize: 13, marginTop: 6, fontWeight: '600' },

  btnRegistrar: { backgroundColor: '#DC2626', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnRegistrarTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },

  aviso: { backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginTop: 16, borderLeftWidth: 4, borderLeftColor: '#F59E0B' },
  avisoTexto: { color: '#92400E', fontSize: 12, lineHeight: 18 },

  filtrosRow: { marginBottom: 12 },
  filtroChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: tema.fondoCard, borderWidth: 1, borderColor: tema.borde, marginRight: 8 },
  filtroChipActivo: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  filtroChipTexto: { color: tema.texto, fontSize: 13 },
  filtroChipTextoActivo: { color: '#fff', fontWeight: '600' },

  vacio: { textAlign: 'center', color: tema.textoSecundario, marginTop: 40, fontSize: 15 },

  card: { backgroundColor: tema.fondoCard, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: tema.borde },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tipoBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tipoBadgeTexto: { fontSize: 12, fontWeight: '700' },
  cardFecha: { fontSize: 11, color: tema.textoSecundario },
  cardProducto: { fontSize: 16, fontWeight: '700', color: tema.texto, marginBottom: 10 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardDato: { alignItems: 'center' },
  cardDatoLabel: { fontSize: 10, color: tema.textoSecundario },
  cardDatoVal: { fontSize: 14, fontWeight: '600', color: tema.texto },
  cardMotivo: { color: tema.textoSecundario, fontSize: 13, fontStyle: 'italic', marginBottom: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: tema.borde, paddingTop: 8 },
  cardEmpleado: { fontSize: 12, color: tema.textoSecundario },
  btnEliminar: { color: '#EF4444', fontSize: 12, fontWeight: '600' },

  fechasRow: { flexDirection: 'row' },
  inputFecha: { backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 10, color: tema.texto, fontSize: 14 },
  btnBuscar: { backgroundColor: tema.primario, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 10 },
  btnBuscarTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },

  totalGrid: { gap: 10, marginBottom: 10 },
  totalCard: { backgroundColor: tema.fondoCard, borderRadius: 10, padding: 14, borderLeftWidth: 4, borderWidth: 1, borderColor: tema.borde },
  totalLabel: { fontSize: 12, color: tema.textoSecundario },
  totalVal: { fontSize: 22, fontWeight: '800', marginTop: 4 },

  reporteItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: tema.borde },
  reporteItemLabel: { fontSize: 14, color: tema.texto, flex: 1 },
  reporteItemDatos: { alignItems: 'flex-end' },
  reporteItemSub: { fontSize: 11, color: tema.textoSecundario },
  reporteItemVal: { fontSize: 15, fontWeight: '700' },

  modalFondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCaja: { backgroundColor: tema.fondoCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '85%' },
  modalTitulo: { fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 12 },
  modalBusqueda: { backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 12, color: tema.texto, fontSize: 14, marginBottom: 12 },
  productoItem: { paddingVertical: 12, paddingHorizontal: 4 },
  productoItemNombre: { fontSize: 15, fontWeight: '600', color: tema.texto },
  productoItemInfo: { fontSize: 12, color: tema.textoSecundario, marginTop: 2 },
  modalCerrar: { backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 12 },
  modalCerrarTexto: { color: tema.texto, fontWeight: '600' },
})