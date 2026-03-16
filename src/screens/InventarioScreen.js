import React, { useState, useEffect } from 'react'
import {
  View, Text, FlatList, Image, TouchableOpacity,
  Modal, TextInput, Alert, RefreshControl,
  ScrollView, ActivityIndicator, Switch
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system'
import { productosService, subirFoto } from '../services/api'
import EscanerBarcode from '../components/EscanerBarcode'
import { useTema } from '../context/TemaContext'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as XLSX from 'xlsx'

const BASE_URL = 'https://pos-pro-gt-backend.onrender.com/api'

async function getToken() { return await AsyncStorage.getItem('token') }
async function api(endpoint, method = 'GET', body = null) {
  const token = await getToken()
  const config = { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }
  if (body) config.body = JSON.stringify(body)
  const res = await fetch(`${BASE_URL}${endpoint}`, config)
  return res.json()
}

const TABS_ADMIN = [
  { id: 'productos', label: 'Productos', emoji: '📦' },
  { id: 'movimientos', label: 'Historial', emoji: '📋' },
  { id: 'lotes', label: 'Lotes', emoji: '🗓️' },
  { id: 'promociones', label: 'Promos', emoji: '🏷️' },
]

const TIPOS_PROMO = [
  { value: '2x1',            label: '2x1',              emoji: '🎁', desc: 'Pague 1 lleve 2' },
  { value: 'pague2lleve3',   label: 'Pague 2 Lleve 3',  emoji: '🛒', desc: 'Pague 2 lleve 3' },
  { value: 'descuento_pct',  label: 'Descuento %',      emoji: '💸', desc: 'Porcentaje de descuento' },
  { value: 'combo',          label: 'Combo',             emoji: '🍱', desc: 'Productos combinados' },
]

export default function InventarioScreen() {
  const { tema } = useTema()
  const [tab, setTab] = useState('productos')
  const [usuario, setUsuario] = useState(null)
  const [esAdmin, setEsAdmin] = useState(false)

  // Productos
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editando, setEditando] = useState(null)
  const [fotoUri, setFotoUri] = useState(null)
  const [modalEscaner, setModalEscaner] = useState(false)
  const [form, setForm] = useState({
    nombre: '', precio: '', costo: '', stock: '',
    stock_minimo: '5', emoji: '📦', codigo_barras: ''
  })

  // Importar Excel
  const [modalImportar, setModalImportar] = useState(false)
  const [productosExcel, setProductosExcel] = useState([])
  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState(null)

  // Movimientos
  const [movimientos, setMovimientos] = useState([])
  const [cargandoMov, setCargandoMov] = useState(false)
  const [filtroProdMov, setFiltroProdMov] = useState('')

  // Lotes
  const [lotes, setLotes] = useState([])
  const [alertasLotes, setAlertasLotes] = useState([])
  const [modalLote, setModalLote] = useState(false)
  const [loteForm, setLoteForm] = useState({
    producto_id: '', numero_lote: '', fecha_fabricacion: '',
    fecha_vencimiento: '', cantidad_inicial: '', nota: ''
  })
  const [productoLoteSel, setProductoLoteSel] = useState(null)
  const [modalBuscarProdLote, setModalBuscarProdLote] = useState(false)
  const [busquedaLote, setBusquedaLote] = useState('')

  // Promociones
  const [promociones, setPromociones] = useState([])
  const [modalPromo, setModalPromo] = useState(false)
  const [promoForm, setPromoForm] = useState({
    nombre: '', tipo: '2x1', descripcion: '',
    fecha_inicio: '', fecha_fin: '',
    descuento_pct: '', precio_combo: ''
  })
  const [promoProductos, setPromoProductos] = useState([]) // [{producto_id, rol, nombre}]
  const [modalBuscarProdPromo, setModalBuscarProdPromo] = useState(false)
  const [busquedaPromo, setBusquedaPromo] = useState('')

  useEffect(() => {
    obtenerUsuario()
    cargarProductos()
  }, [])

  useEffect(() => {
    if (tab === 'movimientos') cargarMovimientos()
    if (tab === 'lotes') { cargarLotes(); cargarAlertasLotes() }
    if (tab === 'promociones') cargarPromociones()
  }, [tab])

  async function obtenerUsuario() {
    const data = await AsyncStorage.getItem('usuario')
    if (data) { const u = JSON.parse(data); setUsuario(u); setEsAdmin(u.rol === 'admin') }
  }

  async function cargarProductos() {
    try {
      const response = await productosService.obtenerTodos()
      setProductos(response.data)
    } catch { Alert.alert('Error', 'No se pudieron cargar los productos') }
    finally { setCargando(false); setRefreshing(false) }
  }

  async function cargarMovimientos() {
    setCargandoMov(true)
    try {
      const data = await api('/inventario/movimientos?limite=100')
      setMovimientos(Array.isArray(data) ? data : [])
    } catch { setMovimientos([]) }
    setCargandoMov(false)
  }

  async function cargarLotes() {
    try {
      const data = await api('/inventario/lotes')
      setLotes(Array.isArray(data) ? data : [])
    } catch { setLotes([]) }
  }

  async function cargarAlertasLotes() {
    try {
      const data = await api('/inventario/lotes/alertas?dias=30')
      setAlertasLotes(Array.isArray(data) ? data : [])
    } catch { setAlertasLotes([]) }
  }

  async function cargarPromociones() {
    try {
      const data = await api('/inventario/promociones')
      setPromociones(Array.isArray(data) ? data : [])
    } catch { setPromociones([]) }
  }

  // ── IMPORTAR EXCEL ──────────────────────────────────────────────────────────
  async function seleccionarExcel() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
               'application/vnd.ms-excel', '*/*'],
        copyToCacheDirectory: true
      })
      if (result.canceled) return

      const fileUri = result.assets[0].uri
      const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 })
      const workbook = XLSX.read(base64, { type: 'base64' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(sheet)

      // Normalizar columnas (acepta nombres en español e inglés)
      const normalizados = jsonData.map((row, i) => ({
        nombre:       row['nombre'] || row['Nombre'] || row['NOMBRE'] || row['name'] || '',
        precio:       parseFloat(row['precio'] || row['Precio'] || row['precio_venta'] || 0),
        costo:        parseFloat(row['costo'] || row['Costo'] || row['precio_costo'] || 0),
        stock:        parseInt(row['stock'] || row['Stock'] || row['cantidad'] || 0),
        stock_minimo: parseInt(row['stock_minimo'] || row['Stock Minimo'] || 5),
        emoji:        row['emoji'] || row['Emoji'] || '📦',
        codigo_barras: String(row['codigo_barras'] || row['Codigo'] || row['barcode'] || ''),
      })).filter(p => p.nombre)

      setProductosExcel(normalizados)
      setResultadoImport(null)
      setModalImportar(true)
    } catch (e) {
      Alert.alert('Error', 'No se pudo leer el archivo Excel: ' + e.message)
    }
  }

  async function ejecutarImportacion() {
    if (productosExcel.length === 0) return
    setImportando(true)
    try {
      const res = await api('/inventario/importar', 'POST', { productos: productosExcel })
      setResultadoImport(res)
      if (res.ok) cargarProductos()
    } catch {
      Alert.alert('Error', 'No se pudo conectar al servidor')
    }
    setImportando(false)
  }

  // ── LOTES ───────────────────────────────────────────────────────────────────
  async function guardarLote() {
    if (!loteForm.producto_id || !loteForm.numero_lote || !loteForm.fecha_vencimiento || !loteForm.cantidad_inicial) {
      return Alert.alert('Error', 'Completa todos los campos requeridos')
    }
    const res = await api('/inventario/lotes', 'POST', loteForm)
    if (res.ok) {
      Alert.alert('Lote registrado', `Lote ${loteForm.numero_lote} guardado`)
      setModalLote(false)
      setLoteForm({ producto_id: '', numero_lote: '', fecha_fabricacion: '', fecha_vencimiento: '', cantidad_inicial: '', nota: '' })
      setProductoLoteSel(null)
      cargarLotes()
    } else {
      Alert.alert('Error', res.error)
    }
  }

  async function eliminarLote(id) {
    Alert.alert('Eliminar lote', '¿Eliminar este lote?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await api(`/inventario/lotes/${id}`, 'DELETE')
        cargarLotes()
      }}
    ])
  }

  // ── PROMOCIONES ─────────────────────────────────────────────────────────────
  async function guardarPromocion() {
    if (!promoForm.nombre || !promoForm.tipo) return Alert.alert('Error', 'Nombre y tipo son requeridos')
    if (promoProductos.length === 0) return Alert.alert('Error', 'Agrega al menos un producto')

    const res = await api('/inventario/promociones', 'POST', {
      ...promoForm,
      productos: promoProductos.map(p => ({ producto_id: p.id, rol: p.rol || 'principal' }))
    })
    if (res.ok) {
      Alert.alert('Promoción creada', promoForm.nombre)
      setModalPromo(false)
      resetPromoForm()
      cargarPromociones()
    } else {
      Alert.alert('Error', res.error)
    }
  }

  async function togglePromocion(id, activo) {
    await api(`/inventario/promociones/${id}`, 'PUT', { activo: !activo })
    cargarPromociones()
  }

  async function eliminarPromocion(id) {
    Alert.alert('Eliminar promoción', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await api(`/inventario/promociones/${id}`, 'DELETE')
        cargarPromociones()
      }}
    ])
  }

  function resetPromoForm() {
    setPromoForm({ nombre: '', tipo: '2x1', descripcion: '', fecha_inicio: '', fecha_fin: '', descuento_pct: '', precio_combo: '' })
    setPromoProductos([])
  }

  // ── PRODUCTO FORM (igual que antes) ─────────────────────────────────────────
  const abrirModal = (producto = null) => {
    if (producto) {
      setEditando(producto); setFotoUri(producto.foto_url || null)
      setForm({
        nombre: producto.nombre, precio: producto.precio.toString(),
        costo: (producto.costo || producto.precio_costo || 0).toString(),
        stock: producto.stock.toString(),
        stock_minimo: producto.stock_minimo.toString(),
        emoji: producto.emoji || '📦',
        codigo_barras: producto.codigo_barras || ''
      })
    } else {
      setEditando(null); setFotoUri(null)
      setForm({ nombre: '', precio: '', costo: '', stock: '', stock_minimo: '5', emoji: '📦', codigo_barras: '' })
    }
    setModalVisible(true)
  }

  const guardar = async () => {
    if (!form.nombre || !form.precio) { Alert.alert('Error', 'Nombre y precio son requeridos'); return }
    try {
      let urlFoto = editando?.foto_url || null
      if (fotoUri && fotoUri.startsWith('file')) {
        try { urlFoto = await subirFoto(fotoUri) } catch { urlFoto = null }
      } else if (fotoUri?.startsWith('http')) { urlFoto = fotoUri }

      const data = {
        nombre: form.nombre, precio: parseFloat(form.precio),
        costo: parseFloat(form.costo) || 0, stock: parseInt(form.stock) || 0,
        stock_minimo: parseInt(form.stock_minimo) || 5, emoji: form.emoji,
        codigo_barras: form.codigo_barras || `GT${Date.now()}`, foto_url: urlFoto
      }
      if (editando) { await productosService.actualizar(editando.id, data); Alert.alert('✅ Actualizado') }
      else { await productosService.crear(data); Alert.alert('✅ Creado') }
      setModalVisible(false); cargarProductos()
    } catch { Alert.alert('Error', 'No se pudo guardar') }
  }

  const eliminar = (producto) => {
    Alert.alert('Eliminar', `¿Eliminar "${producto.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await productosService.eliminar(producto.id); cargarProductos() } }
    ])
  }

  const tomarFoto = async () => {
    const permiso = await ImagePicker.requestCameraPermissionsAsync()
    if (!permiso.granted) { Alert.alert('Permiso requerido'); return }
    const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1,1], quality: 0.8 })
    if (!r.canceled) setFotoUri(r.assets[0].uri)
  }

  const elegirDeGaleria = async () => {
    const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permiso.granted) { Alert.alert('Permiso requerido'); return }
    const r = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1,1], quality: 0.8 })
    if (!r.canceled) setFotoUri(r.assets[0].uri)
  }

  const seleccionarFoto = () => Alert.alert('Foto', '¿Cómo agregar?', [
    { text: 'Cámara', onPress: tomarFoto },
    { text: 'Galería', onPress: elegirDeGaleria },
    fotoUri ? { text: 'Quitar foto', style: 'destructive', onPress: () => setFotoUri(null) } : null,
    { text: 'Cancelar', style: 'cancel' }
  ].filter(Boolean))

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.codigo_barras && p.codigo_barras.includes(busqueda))
  )

  const margen = (p) => {
    const c = p.costo || p.precio_costo || 0
    if (!c || c === 0) return 0
    return Math.round((p.precio - c) / c * 100)
  }

  function diasParaVencer(fecha) {
    const hoy = new Date(); const f = new Date(fecha)
    return Math.ceil((f - hoy) / (1000 * 60 * 60 * 24))
  }

  function colorVencimiento(dias) {
    if (dias <= 0) return '#EF4444'
    if (dias <= 7) return '#EF4444'
    if (dias <= 15) return '#F97316'
    if (dias <= 30) return '#F59E0B'
    return '#059669'
  }

  const movsFiltrados = filtroProdMov
    ? movimientos.filter(m => m.producto?.toLowerCase().includes(filtroProdMov.toLowerCase()))
    : movimientos

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>
      {/* Header */}
      <View style={{ backgroundColor: tema.fondoCard, padding: 16, paddingTop: 50, borderBottomWidth: 1, borderColor: tema.borde }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: tema.texto }}>Inventario</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {esAdmin && (
              <TouchableOpacity style={{ backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }} onPress={seleccionarExcel}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>📊 Excel</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={{ backgroundColor: tema.primario, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 }} onPress={() => abrirModal()}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ Agregar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs — solo admin ve todas */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          {(esAdmin ? TABS_ADMIN : [TABS_ADMIN[0]]).map(t => (
            <TouchableOpacity
              key={t.id}
              style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8,
                backgroundColor: tab === t.id ? tema.primario : tema.fondoSecundario,
                borderWidth: 1, borderColor: tab === t.id ? tema.primario : tema.borde }}
              onPress={() => setTab(t.id)}
            >
              <Text style={{ color: tab === t.id ? '#fff' : tema.texto, fontWeight: '700', fontSize: 13 }}>
                {t.emoji} {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── TAB PRODUCTOS ─────────────────────────────────────────────────── */}
      {tab === 'productos' && (
        <>
          <TextInput
            style={{ margin: 12, padding: 12, backgroundColor: tema.fondoCard, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, fontSize: 14, color: tema.texto }}
            placeholder="Buscar producto o código..."
            placeholderTextColor={tema.textoTerciario}
            value={busqueda} onChangeText={setBusqueda}
          />
          <View style={{ flexDirection: 'row', paddingHorizontal: 12, gap: 6, marginBottom: 8 }}>
            {[
              { label: 'Total', val: productos.length, color: tema.primario },
              { label: 'Stock Bajo', val: productos.filter(p => p.stock <= p.stock_minimo && p.stock > 0).length, color: tema.warning },
              { label: 'Agotados', val: productos.filter(p => p.stock === 0).length, color: tema.danger },
              { label: 'Con Foto', val: productos.filter(p => p.foto_url).length, color: tema.success },
            ].map(({ label, val, color }) => (
              <View key={label} style={{ flex: 1, backgroundColor: tema.fondoCard, borderRadius: 10, padding: 8, alignItems: 'center', borderWidth: 1, borderColor: tema.borde }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color }}>{val}</Text>
                <Text style={{ fontSize: 9, color: tema.textoTerciario }}>{label}</Text>
              </View>
            ))}
          </View>
          <FlatList
            data={productosFiltrados}
            keyExtractor={item => item.id.toString()}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarProductos() }} tintColor={tema.primario} />}
            renderItem={({ item }) => (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.fondoCard, marginHorizontal: 12, marginBottom: 8, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: tema.borde }}>
                {item.foto_url
                  ? <Image source={{ uri: item.foto_url }} style={{ width: 52, height: 52, borderRadius: 10, marginRight: 12 }} />
                  : <View style={{ width: 52, height: 52, borderRadius: 10, backgroundColor: tema.fondoSecundario, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <Text style={{ fontSize: 26 }}>{item.emoji || '📦'}</Text>
                    </View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: tema.texto }}>{item.nombre}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
                    <Text style={{ fontSize: 12, color: tema.primario, fontWeight: '700' }}>Q{parseFloat(item.precio).toFixed(2)}</Text>
                    {margen(item) > 0 && <Text style={{ fontSize: 12, color: tema.success, fontWeight: '600' }}>+{margen(item)}%</Text>}
                  </View>
                  {item.codigo_barras && <Text style={{ fontSize: 10, color: tema.textoTerciario }}>{item.codigo_barras}</Text>}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
                    backgroundColor: item.stock === 0 ? '#fee2e2' : item.stock <= item.stock_minimo ? '#fef3c7' : '#d1fae5' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700',
                      color: item.stock === 0 ? tema.danger : item.stock <= item.stock_minimo ? tema.warning : tema.success }}>
                      {item.stock === 0 ? 'Agotado' : `${item.stock} uds`}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity style={{ backgroundColor: tema.fondoSecundario, padding: 6, borderRadius: 8, borderWidth: 1, borderColor: tema.borde }} onPress={() => abrirModal(item)}>
                      <Text>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={{ backgroundColor: '#fee2e2', padding: 6, borderRadius: 8, borderWidth: 1, borderColor: tema.danger }} onPress={() => eliminar(item)}>
                      <Text>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          />
        </>
      )}

      {/* ── TAB MOVIMIENTOS ───────────────────────────────────────────────── */}
      {tab === 'movimientos' && (
        <View style={{ flex: 1 }}>
          <TextInput
            style={{ margin: 12, padding: 12, backgroundColor: tema.fondoCard, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, fontSize: 14, color: tema.texto }}
            placeholder="Filtrar por producto..."
            placeholderTextColor={tema.textoTerciario}
            value={filtroProdMov} onChangeText={setFiltroProdMov}
          />
          {cargandoMov
            ? <ActivityIndicator color={tema.primario} style={{ marginTop: 40 }} />
            : <FlatList
                data={movsFiltrados}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={{ paddingHorizontal: 12 }}
                renderItem={({ item }) => (
                  <View style={{ backgroundColor: tema.fondoCard, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: tema.borde }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ backgroundColor: item.tipo === 'entrada' ? '#d1fae5' : '#fee2e2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: item.tipo === 'entrada' ? '#059669' : '#EF4444' }}>
                            {item.tipo === 'entrada' ? '▲ Entrada' : '▼ Salida'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: tema.texto }}>{item.producto}</Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '900', color: item.tipo === 'entrada' ? '#059669' : '#EF4444' }}>
                        {item.tipo === 'entrada' ? '+' : '-'}{item.cantidad}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <Text style={{ fontSize: 11, color: tema.textoSecundario }}>
                        {item.cantidad_anterior} → {item.cantidad_nueva} uds
                      </Text>
                      <Text style={{ fontSize: 11, color: tema.textoSecundario }}>
                        👤 {item.nombre_usuario || 'N/A'}
                      </Text>
                    </View>
                    {item.motivo ? <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 4, fontStyle: 'italic' }}>"{item.motivo}"</Text> : null}
                    <Text style={{ fontSize: 10, color: tema.textoTerciario, marginTop: 4 }}>
                      {new Date(item.created_at).toLocaleDateString('es-GT')} {new Date(item.created_at).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                )}
                ListEmptyComponent={<Text style={{ textAlign: 'center', color: tema.textoSecundario, marginTop: 40 }}>Sin movimientos registrados</Text>}
              />
          }
        </View>
      )}

      {/* ── TAB LOTES ─────────────────────────────────────────────────────── */}
      {tab === 'lotes' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {/* Alertas de vencimiento */}
          {alertasLotes.length > 0 && (
            <View style={{ backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, marginBottom: 14, borderLeftWidth: 4, borderLeftColor: '#F59E0B' }}>
              <Text style={{ fontWeight: '700', color: '#92400E', marginBottom: 6 }}>⚠️ {alertasLotes.length} lote(s) por vencer en 30 días</Text>
              {alertasLotes.slice(0, 3).map(l => (
                <Text key={l.id} style={{ fontSize: 12, color: '#92400E' }}>
                  • {l.producto} — Lote {l.numero_lote} — vence {new Date(l.fecha_vencimiento).toLocaleDateString('es-GT')}
                </Text>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={{ backgroundColor: tema.primario, borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 14 }}
            onPress={() => setModalLote(true)}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+ Registrar nuevo lote</Text>
          </TouchableOpacity>

          {lotes.length === 0
            ? <Text style={{ textAlign: 'center', color: tema.textoSecundario, marginTop: 30 }}>No hay lotes registrados</Text>
            : lotes.map(l => {
                const dias = diasParaVencer(l.fecha_vencimiento)
                const color = colorVencimiento(dias)
                return (
                  <View key={l.id} style={{ backgroundColor: tema.fondoCard, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: tema.borde }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: tema.texto }}>{l.producto}</Text>
                      <View style={{ backgroundColor: color + '22', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color }}>
                          {dias <= 0 ? 'VENCIDO' : `${dias} días`}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: tema.textoSecundario, marginTop: 4 }}>Lote: {l.numero_lote}</Text>
                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
                      {l.fecha_fabricacion && (
                        <Text style={{ fontSize: 11, color: tema.textoTerciario }}>
                          Fab: {new Date(l.fecha_fabricacion).toLocaleDateString('es-GT')}
                        </Text>
                      )}
                      <Text style={{ fontSize: 11, color }}>
                        Vence: {new Date(l.fecha_vencimiento).toLocaleDateString('es-GT')}
                      </Text>
                      <Text style={{ fontSize: 11, color: tema.textoSecundario }}>
                        Qty: {l.cantidad_actual}/{l.cantidad_inicial}
                      </Text>
                    </View>
                    {l.nota && <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 4, fontStyle: 'italic' }}>{l.nota}</Text>}
                    {esAdmin && (
                      <TouchableOpacity style={{ marginTop: 8, alignSelf: 'flex-end' }} onPress={() => eliminarLote(l.id)}>
                        <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Eliminar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )
              })
          }
        </ScrollView>
      )}

      {/* ── TAB PROMOCIONES ───────────────────────────────────────────────── */}
      {tab === 'promociones' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12 }}>
          {esAdmin && (
            <TouchableOpacity
              style={{ backgroundColor: '#F97316', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 14 }}
              onPress={() => { resetPromoForm(); setModalPromo(true) }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>+ Nueva Promoción</Text>
            </TouchableOpacity>
          )}

          {promociones.length === 0
            ? <Text style={{ textAlign: 'center', color: tema.textoSecundario, marginTop: 30 }}>No hay promociones</Text>
            : promociones.map(p => {
                const tipoInfo = TIPOS_PROMO.find(t => t.value === p.tipo) || TIPOS_PROMO[0]
                const hoy = new Date()
                const vigente = (!p.fecha_fin || new Date(p.fecha_fin) >= hoy) && p.activo
                return (
                  <View key={p.id} style={{ backgroundColor: tema.fondoCard, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: vigente ? '#F97316' : tema.borde }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 22 }}>{tipoInfo.emoji}</Text>
                        <View>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: tema.texto }}>{p.nombre}</Text>
                          <Text style={{ fontSize: 11, color: tema.textoSecundario }}>{tipoInfo.label}</Text>
                        </View>
                      </View>
                      {esAdmin && (
                        <Switch
                          value={p.activo}
                          onValueChange={() => togglePromocion(p.id, p.activo)}
                          trackColor={{ false: tema.borde, true: '#F97316' }}
                          thumbColor={p.activo ? '#fff' : tema.textoTerciario}
                        />
                      )}
                    </View>

                    {p.descripcion && <Text style={{ fontSize: 12, color: tema.textoSecundario, marginTop: 6 }}>{p.descripcion}</Text>}

                    {p.tipo === 'descuento_pct' && (
                      <Text style={{ fontSize: 13, color: '#F97316', fontWeight: '700', marginTop: 4 }}>Descuento: {p.descuento_pct}%</Text>
                    )}
                    {p.tipo === 'combo' && p.precio_combo > 0 && (
                      <Text style={{ fontSize: 13, color: '#059669', fontWeight: '700', marginTop: 4 }}>Precio combo: Q{parseFloat(p.precio_combo).toFixed(2)}</Text>
                    )}

                    {/* Productos en la promo */}
                    {p.productos?.length > 0 && (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {p.productos.map(prod => (
                          <View key={prod.id} style={{ backgroundColor: tema.fondoSecundario, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ fontSize: 11, color: tema.texto }}>{prod.emoji || '📦'} {prod.nombre}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                      {p.fecha_fin && <Text style={{ fontSize: 10, color: tema.textoTerciario }}>Hasta: {new Date(p.fecha_fin).toLocaleDateString('es-GT')}</Text>}
                      <View style={{ backgroundColor: vigente ? '#d1fae5' : '#fee2e2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: vigente ? '#059669' : '#EF4444' }}>
                          {vigente ? 'Activa' : 'Inactiva'}
                        </Text>
                      </View>
                    </View>

                    {esAdmin && (
                      <TouchableOpacity style={{ marginTop: 8, alignSelf: 'flex-end' }} onPress={() => eliminarPromocion(p.id)}>
                        <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Eliminar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )
              })
          }
        </ScrollView>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODALES
      ══════════════════════════════════════════════════════════════════════ */}

      {/* Modal Agregar/Editar Producto (igual que antes) */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, marginTop: 60 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 16 }}>
                {editando ? 'Editar Producto' : 'Nuevo Producto'}
              </Text>
              <TouchableOpacity style={{ width: '100%', height: 140, borderRadius: 16, overflow: 'hidden', marginBottom: 16, borderWidth: 2, borderColor: tema.borde, borderStyle: 'dashed' }} onPress={seleccionarFoto}>
                {fotoUri
                  ? <Image source={{ uri: fotoUri }} style={{ width: '100%', height: '100%' }} />
                  : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: tema.fondoSecundario }}>
                      <Text style={{ fontSize: 32 }}>📷</Text>
                      <Text style={{ fontSize: 12, color: tema.textoTerciario, marginTop: 4 }}>Toca para agregar foto</Text>
                    </View>
                }
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                <TextInput style={{ flex: 3, borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: tema.fondoInput, color: tema.texto }} placeholder="Nombre del producto" placeholderTextColor={tema.textoTerciario} value={form.nombre} onChangeText={v => setForm({ ...form, nombre: v })} />
                <TextInput style={{ flex: 1, borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 22, textAlign: 'center', backgroundColor: tema.fondoInput, color: tema.texto }} placeholder="📦" value={form.emoji} onChangeText={v => setForm({ ...form, emoji: v })} />
              </View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 4 }}>Código de Barras</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TextInput style={{ flex: 1, borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: tema.fondoInput, color: tema.texto }} placeholder="Código" placeholderTextColor={tema.textoTerciario} value={form.codigo_barras} onChangeText={v => setForm({ ...form, codigo_barras: v })} keyboardType="numeric" />
                <TouchableOpacity style={{ backgroundColor: tema.fondoCard, borderRadius: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tema.borde }} onPress={() => { setModalVisible(false); setTimeout(() => setModalEscaner(true), 300) }}>
                  <Text style={{ fontSize: 20 }}>📷</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                {[{ key: 'precio', label: 'Precio Venta (Q)' }, { key: 'costo', label: 'Precio Costo (Q)' }].map(({ key, label }) => (
                  <View key={key} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 4 }}>{label}</Text>
                    <TextInput style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: tema.fondoInput, color: tema.texto }} placeholder="0.00" placeholderTextColor={tema.textoTerciario} value={form[key]} onChangeText={v => setForm({ ...form, [key]: v })} keyboardType="numeric" />
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                {[{ key: 'stock', label: 'Stock Actual' }, { key: 'stock_minimo', label: 'Stock Mínimo' }].map(({ key, label }) => (
                  <View key={key} style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 4 }}>{label}</Text>
                    <TextInput style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: tema.fondoInput, color: tema.texto }} placeholder="0" placeholderTextColor={tema.textoTerciario} value={form[key]} onChangeText={v => setForm({ ...form, [key]: v })} keyboardType="numeric" />
                  </View>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 20 }}>
                <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }} onPress={() => setModalVisible(false)}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: tema.textoTerciario }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: tema.primario, alignItems: 'center' }} onPress={guardar}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal Importar Excel */}
      <Modal visible={modalImportar} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 4 }}>Importar desde Excel</Text>
            <Text style={{ fontSize: 13, color: tema.textoSecundario, marginBottom: 14 }}>
              {productosExcel.length} productos encontrados en el archivo
            </Text>

            {resultadoImport ? (
              <View style={{ backgroundColor: resultadoImport.ok ? '#d1fae5' : '#fee2e2', borderRadius: 12, padding: 14, marginBottom: 14 }}>
                <Text style={{ fontWeight: '700', color: resultadoImport.ok ? '#059669' : '#EF4444', fontSize: 15 }}>
                  {resultadoImport.ok ? '✅ Importación completada' : '❌ Error'}
                </Text>
                {resultadoImport.ok && (
                  <>
                    <Text style={{ color: '#059669', marginTop: 4 }}>Creados: {resultadoImport.creados}</Text>
                    <Text style={{ color: '#059669' }}>Actualizados: {resultadoImport.actualizados}</Text>
                    {resultadoImport.errores?.length > 0 && (
                      <Text style={{ color: '#d97706', marginTop: 4 }}>Errores: {resultadoImport.errores.length}</Text>
                    )}
                  </>
                )}
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 280 }}>
                {productosExcel.slice(0, 20).map((p, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: tema.borde }}>
                    <Text style={{ fontSize: 13, color: tema.texto, flex: 1 }} numberOfLines={1}>{p.nombre}</Text>
                    <Text style={{ fontSize: 12, color: tema.primario, fontWeight: '600' }}>Q{p.precio}</Text>
                    <Text style={{ fontSize: 12, color: tema.textoSecundario, marginLeft: 8 }}>x{p.stock}</Text>
                  </View>
                ))}
                {productosExcel.length > 20 && (
                  <Text style={{ textAlign: 'center', color: tema.textoSecundario, paddingVertical: 8 }}>
                    ...y {productosExcel.length - 20} más
                  </Text>
                )}
              </ScrollView>
            )}

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 14 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }} onPress={() => setModalImportar(false)}>
                <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>{resultadoImport ? 'Cerrar' : 'Cancelar'}</Text>
              </TouchableOpacity>
              {!resultadoImport && (
                <TouchableOpacity
                  style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: '#059669', alignItems: 'center', opacity: importando ? 0.6 : 1 }}
                  onPress={ejecutarImportacion}
                  disabled={importando}
                >
                  {importando
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={{ color: '#fff', fontWeight: '700' }}>Importar {productosExcel.length} productos</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Nuevo Lote */}
      <Modal visible={modalLote} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 14 }}>Registrar Lote</Text>

              <Text style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 6 }}>Producto *</Text>
              <TouchableOpacity style={{ backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 12, marginBottom: 10 }} onPress={() => setModalBuscarProdLote(true)}>
                <Text style={{ color: productoLoteSel ? tema.texto : tema.textoTerciario, fontSize: 14 }}>
                  {productoLoteSel ? productoLoteSel.nombre : 'Toca para seleccionar producto...'}
                </Text>
              </TouchableOpacity>

              {[
                { key: 'numero_lote', label: 'Número de Lote *', placeholder: 'Ej: LOT-2025-001' },
                { key: 'fecha_fabricacion', label: 'Fecha Fabricación', placeholder: 'YYYY-MM-DD' },
                { key: 'fecha_vencimiento', label: 'Fecha Vencimiento *', placeholder: 'YYYY-MM-DD' },
                { key: 'cantidad_inicial', label: 'Cantidad *', placeholder: '0', keyboard: 'numeric' },
                { key: 'nota', label: 'Nota', placeholder: 'Opcional...' },
              ].map(f => (
                <View key={f.key} style={{ marginBottom: 10 }}>
                  <Text style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 4 }}>{f.label}</Text>
                  <TextInput
                    style={{ backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 12, color: tema.texto, fontSize: 14 }}
                    placeholder={f.placeholder} placeholderTextColor={tema.textoTerciario}
                    value={loteForm[f.key]}
                    onChangeText={v => setLoteForm(prev => ({ ...prev, [f.key]: v }))}
                    keyboardType={f.keyboard || 'default'}
                  />
                </View>
              ))}

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 20 }}>
                <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }} onPress={() => setModalLote(false)}>
                  <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: tema.primario, alignItems: 'center' }} onPress={guardarLote}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar Lote</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal buscar producto para lote */}
      <Modal visible={modalBuscarProdLote} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' }}>
            <TextInput style={{ backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 12, color: tema.texto, marginBottom: 12 }} placeholder="Buscar..." placeholderTextColor={tema.textoTerciario} value={busquedaLote} onChangeText={setBusquedaLote} autoFocus />
            <FlatList
              data={productos.filter(p => p.nombre.toLowerCase().includes(busquedaLote.toLowerCase())).slice(0, 30)}
              keyExtractor={i => i.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tema.borde }} onPress={() => {
                  setProductoLoteSel(item)
                  setLoteForm(prev => ({ ...prev, producto_id: item.id }))
                  setModalBuscarProdLote(false)
                  setBusquedaLote('')
                }}>
                  <Text style={{ fontSize: 14, color: tema.texto }}>{item.nombre}</Text>
                  <Text style={{ fontSize: 11, color: tema.textoSecundario }}>Stock: {item.stock}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={{ backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 10 }} onPress={() => setModalBuscarProdLote(false)}>
              <Text style={{ color: tema.texto, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal Nueva Promoción */}
      <Modal visible={modalPromo} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, marginTop: 60 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 14 }}>Nueva Promoción</Text>

              <Text style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 6 }}>Nombre *</Text>
              <TextInput style={{ backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 12, color: tema.texto, marginBottom: 12, fontSize: 14 }} placeholder="Ej: 2x1 Coca Cola" placeholderTextColor={tema.textoTerciario} value={promoForm.nombre} onChangeText={v => setPromoForm(p => ({ ...p, nombre: v }))} />

              <Text style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 8 }}>Tipo *</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {TIPOS_PROMO.map(t => (
                  <TouchableOpacity key={t.value} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 2,
                    backgroundColor: promoForm.tipo === t.value ? '#F97316' : tema.fondoCard,
                    borderColor: promoForm.tipo === t.value ? '#F97316' : tema.borde }}
                    onPress={() => setPromoForm(p => ({ ...p, tipo: t.value }))}>
                    <Text style={{ color: promoForm.tipo === t.value ? '#fff' : tema.texto, fontWeight: '700', fontSize: 13 }}>{t.emoji} {t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 6 }}>Descripción</Text>
              <TextInput style={{ backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 12, color: tema.texto, marginBottom: 12, fontSize: 14 }} placeholder="Descripción opcional..." placeholderTextColor={tema.textoTerciario} value={promoForm.descripcion} onChangeText={v => setPromoForm(p => ({ ...p, descripcion: v }))} />

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 4 }}>Fecha inicio</Text>
                  <TextInput style={{ backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 10, color: tema.texto, fontSize: 13 }} placeholder="YYYY-MM-DD" placeholderTextColor={tema.textoTerciario} value={promoForm.fecha_inicio} onChangeText={v => setPromoForm(p => ({ ...p, fecha_inicio: v }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 4 }}>Fecha fin</Text>
                  <TextInput style={{ backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 10, color: tema.texto, fontSize: 13 }} placeholder="YYYY-MM-DD" placeholderTextColor={tema.textoTerciario} value={promoForm.fecha_fin} onChangeText={v => setPromoForm(p => ({ ...p, fecha_fin: v }))} />
                </View>
              </View>

              {promoForm.tipo === 'descuento_pct' && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 4 }}>Descuento (%)</Text>
                  <TextInput style={{ backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 12, color: tema.texto, fontSize: 14 }} placeholder="Ej: 15" placeholderTextColor={tema.textoTerciario} value={promoForm.descuento_pct} onChangeText={v => setPromoForm(p => ({ ...p, descuento_pct: v }))} keyboardType="numeric" />
                </View>
              )}

              {promoForm.tipo === 'combo' && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 4 }}>Precio del combo (Q)</Text>
                  <TextInput style={{ backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 12, color: tema.texto, fontSize: 14 }} placeholder="Ej: 25.00" placeholderTextColor={tema.textoTerciario} value={promoForm.precio_combo} onChangeText={v => setPromoForm(p => ({ ...p, precio_combo: v }))} keyboardType="numeric" />
                </View>
              )}

              {/* Productos de la promo */}
              <Text style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 8 }}>Productos en la promoción *</Text>
              {promoProductos.map((p, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.fondoSecundario, borderRadius: 8, padding: 10, marginBottom: 6 }}>
                  <Text style={{ flex: 1, color: tema.texto, fontSize: 13 }}>{p.emoji || '📦'} {p.nombre}</Text>
                  <TouchableOpacity onPress={() => setPromoProductos(prev => prev.filter((_, j) => j !== i))}>
                    <Text style={{ color: '#EF4444', fontWeight: '700' }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={{ backgroundColor: tema.fondoCard, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#F97316', borderStyle: 'dashed', marginBottom: 14 }} onPress={() => setModalBuscarProdPromo(true)}>
                <Text style={{ color: '#F97316', fontWeight: '700' }}>+ Agregar producto</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }} onPress={() => setModalPromo(false)}>
                  <Text style={{ color: tema.textoSecundario, fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#F97316', alignItems: 'center' }} onPress={guardarPromocion}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Crear Promoción</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Modal buscar producto para promo */}
      <Modal visible={modalBuscarProdPromo} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' }}>
            <TextInput style={{ backgroundColor: tema.fondoInput, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, padding: 12, color: tema.texto, marginBottom: 12 }} placeholder="Buscar producto..." placeholderTextColor={tema.textoTerciario} value={busquedaPromo} onChangeText={setBusquedaPromo} autoFocus />
            <FlatList
              data={productos.filter(p => p.nombre.toLowerCase().includes(busquedaPromo.toLowerCase()) && !promoProductos.find(x => x.id === p.id)).slice(0, 30)}
              keyExtractor={i => i.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: tema.borde }} onPress={() => {
                  setPromoProductos(prev => [...prev, { ...item, rol: 'principal' }])
                  setModalBuscarProdPromo(false)
                  setBusquedaPromo('')
                }}>
                  <Text style={{ fontSize: 14, color: tema.texto }}>{item.emoji || '📦'} {item.nombre}</Text>
                  <Text style={{ fontSize: 11, color: tema.textoSecundario }}>Q{parseFloat(item.precio).toFixed(2)}</Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={{ backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 10 }} onPress={() => setModalBuscarProdPromo(false)}>
              <Text style={{ color: tema.texto, fontWeight: '600' }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <EscanerBarcode
        visible={modalEscaner}
        onScan={(codigo) => { setModalEscaner(false); setForm(prev => ({ ...prev, codigo_barras: codigo })); setTimeout(() => setModalVisible(true), 300) }}
        onCerrar={() => { setModalEscaner(false); setTimeout(() => setModalVisible(true), 300) }}
        titulo="Escanear Código del Producto"
      />
    </View>
  )
}