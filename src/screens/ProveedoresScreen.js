import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, Alert, Modal, FlatList
} from 'react-native'
import { proveedoresService, productosService } from '../services/api'
import { useTema } from '../context/TemaContext'

export default function ProveedoresScreen() {
  const { tema } = useTema()
  const [proveedores, setProveedores] = useState([])
  const [productos, setProductos] = useState([])
  const [stockBajo, setStockBajo] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState('proveedores') // proveedores | pedidos
  const [busqueda, setBusqueda] = useState('')

  // Modales
  const [modalProveedor, setModalProveedor] = useState(false)
  const [modalCompra, setModalCompra] = useState(false)
  const [modalDetalle, setModalDetalle] = useState(false)
  const [proveedorActivo, setProveedorActivo] = useState(null)
  const [comprasProveedor, setComprasProveedor] = useState([])
  const [editando, setEditando] = useState(null)

  // Form proveedor
  const [form, setForm] = useState({ nombre: '', contacto: '', telefono: '', email: '', direccion: '', notas: '' })

  // Form compra
  const [itemsCompra, setItemsCompra] = useState([])
  const [notasCompra, setNotasCompra] = useState('')
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [proveedorCompra, setProveedorCompra] = useState(null)

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    try {
      const [r1, r2, r3] = await Promise.all([
        proveedoresService.obtenerTodos(),
        productosService.obtenerTodos(),
        proveedoresService.stockBajo(),
      ])
      setProveedores(r1.data)
      setProductos(r2.data)
      setStockBajo(r3.data)
    } catch (e) { console.log('Error proveedores:', e) }
    finally { setRefreshing(false) }
  }

  const abrirModalProveedor = (p = null) => {
    if (p) {
      setEditando(p)
      setForm({ nombre: p.nombre, contacto: p.contacto || '', telefono: p.telefono || '', email: p.email || '', direccion: p.direccion || '', notas: p.notas || '' })
    } else {
      setEditando(null)
      setForm({ nombre: '', contacto: '', telefono: '', email: '', direccion: '', notas: '' })
    }
    setModalProveedor(true)
  }

  const guardarProveedor = async () => {
    if (!form.nombre.trim()) { Alert.alert('Error', 'El nombre es requerido'); return }
    try {
      if (editando) await proveedoresService.actualizar(editando.id, form)
      else await proveedoresService.crear(form)
      setModalProveedor(false)
      cargarDatos()
    } catch (e) { Alert.alert('Error', 'No se pudo guardar') }
  }

  const eliminarProveedor = (p) => {
    Alert.alert('Eliminar', `¿Eliminar "${p.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await proveedoresService.eliminar(p.id); cargarDatos() } }
    ])
  }

  const verDetalle = async (p) => {
    setProveedorActivo(p)
    try {
      const r = await proveedoresService.compras(p.id)
      setComprasProveedor(r.data)
      setModalDetalle(true)
    } catch (e) { Alert.alert('Error', 'No se pudo cargar el historial') }
  }

  const abrirCompra = (p) => {
    setProveedorCompra(p)
    setItemsCompra([])
    setNotasCompra('')
    setBusquedaProducto('')
    setModalCompra(true)
  }

  const agregarItemCompra = (producto) => {
    const existe = itemsCompra.find(i => i.producto_id === producto.id)
    if (existe) {
      setItemsCompra(prev => prev.map(i => i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i))
    } else {
      setItemsCompra(prev => [...prev, {
        producto_id: producto.id,
        nombre: producto.nombre,
        cantidad: 1,
        precio_unitario: producto.costo > 0 ? producto.costo.toString() : '',
        actualizar_costo: true
      }])
    }
    setBusquedaProducto('')
  }

  const cambiarCantidadItem = (id, delta) => {
    setItemsCompra(prev => prev.map(i => i.producto_id === id ? { ...i, cantidad: Math.max(1, i.cantidad + delta) } : i))
  }

  const cambiarPrecioItem = (id, precio) => {
    setItemsCompra(prev => prev.map(i => i.producto_id === id ? { ...i, precio_unitario: precio } : i))
  }

  const quitarItem = (id) => {
    setItemsCompra(prev => prev.filter(i => i.producto_id !== id))
  }

  const registrarCompra = async () => {
    if (itemsCompra.length === 0) { Alert.alert('Error', 'Agrega productos a la compra'); return }
    const sinPrecio = itemsCompra.find(i => !i.precio_unitario || parseFloat(i.precio_unitario) <= 0)
    if (sinPrecio) { Alert.alert('Error', `Ingresa el precio de "${sinPrecio.nombre}"`); return }
    try {
      await proveedoresService.registrarCompra(proveedorCompra.id, {
        items: itemsCompra.map(i => ({
          producto_id: i.producto_id,
          cantidad: i.cantidad,
          precio_unitario: parseFloat(i.precio_unitario),
          actualizar_costo: i.actualizar_costo
        })),
        notas: notasCompra
      })
      setModalCompra(false)
      cargarDatos()
      Alert.alert('✅ Compra registrada', 'El stock fue actualizado automáticamente')
    } catch (e) { Alert.alert('Error', 'No se pudo registrar la compra') }
  }

  const totalCompra = itemsCompra.reduce((s, i) => s + (parseFloat(i.precio_unitario) || 0) * i.cantidad, 0)

  const productosFiltrados = busquedaProducto.length >= 2
    ? productos.filter(p => p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase())).slice(0, 5)
    : []

  const proveedoresFiltrados = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (p.contacto && p.contacto.toLowerCase().includes(busqueda.toLowerCase()))
  )

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>

      {/* HEADER */}
      <View style={{ backgroundColor: tema.fondoCard, padding: 20, borderBottomWidth: 1, borderColor: tema.borde }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: tema.texto }}>🏭 Proveedores</Text>
          <TouchableOpacity
            style={{ backgroundColor: tema.primario, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
            onPress={() => abrirModalProveedor()}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>+ Agregar</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          {[
            { label: 'Proveedores', val: proveedores.length, color: tema.primario },
            { label: 'Stock bajo', val: stockBajo.length, color: tema.warning },
            { label: 'Agotados', val: stockBajo.filter(p => p.stock === 0).length, color: tema.danger },
          ].map(({ label, val, color }) => (
            <View key={label} style={{ flex: 1, backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: tema.borde }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color }}>{val}</Text>
              <Text style={{ fontSize: 9, color: tema.textoTerciario, fontWeight: '600' }}>{label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* TABS */}
      <View style={{ flexDirection: 'row', backgroundColor: tema.fondoCard, borderBottomWidth: 1, borderColor: tema.borde }}>
        {[
          { id: 'proveedores', label: '🏭 Proveedores' },
          { id: 'pedidos', label: `⚠️ Pedir (${stockBajo.length})` },
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

      {/* TAB PROVEEDORES */}
      {tab === 'proveedores' && (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarDatos() }} tintColor={tema.primario} />}>
          <View style={{ padding: 12 }}>
            <TextInput
              style={{ backgroundColor: tema.fondoCard, borderRadius: 10, padding: 12, fontSize: 14, color: tema.texto, borderWidth: 1, borderColor: tema.borde, marginBottom: 12 }}
              placeholder="Buscar proveedor..."
              placeholderTextColor={tema.textoTerciario}
              value={busqueda}
              onChangeText={setBusqueda}
            />

            {proveedoresFiltrados.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 48 }}>
                <Text style={{ fontSize: 48, marginBottom: 8 }}>🏭</Text>
                <Text style={{ fontSize: 14, color: tema.textoTerciario, marginBottom: 16 }}>Sin proveedores registrados</Text>
                <TouchableOpacity style={{ backgroundColor: tema.primario, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 }} onPress={() => abrirModalProveedor()}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Agregar primer proveedor</Text>
                </TouchableOpacity>
              </View>
            ) : proveedoresFiltrados.map(p => (
              <View key={p.id} style={{ backgroundColor: tema.fondoCard, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: tema.borde }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: tema.primario + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <Text style={{ fontSize: 20 }}>🏭</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: tema.texto }}>{p.nombre}</Text>
                    {p.contacto ? <Text style={{ fontSize: 12, color: tema.textoSecundario, marginTop: 1 }}>👤 {p.contacto}</Text> : null}
                    {p.telefono ? <Text style={{ fontSize: 12, color: tema.textoSecundario }}>📞 {p.telefono}</Text> : null}
                    {p.email ? <Text style={{ fontSize: 12, color: tema.primario }}>✉️ {p.email}</Text> : null}
                  </View>
                </View>

                {/* Stats del proveedor */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: tema.borde }}>
                  <View style={{ flex: 1, backgroundColor: tema.fondoSecundario, borderRadius: 8, padding: 8, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: tema.primario }}>{p.total_compras || 0}</Text>
                    <Text style={{ fontSize: 9, color: tema.textoTerciario }}>Compras</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: tema.fondoSecundario, borderRadius: 8, padding: 8, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: tema.success }}>Q{parseFloat(p.total_gastado || 0).toFixed(0)}</Text>
                    <Text style={{ fontSize: 9, color: tema.textoTerciario }}>Total</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: tema.fondoSecundario, borderRadius: 8, padding: 8, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: tema.textoSecundario }}>
                      {p.ultima_compra ? new Date(p.ultima_compra).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit' }) : 'Sin compras'}
                    </Text>
                    <Text style={{ fontSize: 9, color: tema.textoTerciario }}>Última</Text>
                  </View>
                </View>

                {/* Acciones */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, backgroundColor: tema.success, borderRadius: 10, padding: 10, alignItems: 'center' }}
                    onPress={() => abrirCompra(p)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>🛒 Registrar Compra</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: tema.borde }}
                    onPress={() => verDetalle(p)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoSecundario }}>📋 Historial</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: tema.borde }}
                    onPress={() => abrirModalProveedor(p)}
                  >
                    <Text style={{ fontSize: 14 }}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ backgroundColor: '#fee2e2', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: tema.danger }}
                    onPress={() => eliminarProveedor(p)}
                  >
                    <Text style={{ fontSize: 14 }}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* TAB PEDIDOS */}
      {tab === 'pedidos' && (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarDatos() }} tintColor={tema.primario} />}>
          <View style={{ padding: 12 }}>
            {stockBajo.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 48 }}>
                <Text style={{ fontSize: 48, marginBottom: 8 }}>✅</Text>
                <Text style={{ fontSize: 14, color: tema.textoTerciario }}>Todo el inventario está bien</Text>
                <Text style={{ fontSize: 12, color: tema.textoTerciario, marginTop: 4 }}>No hay productos que necesiten reabastecimiento</Text>
              </View>
            ) : (
              <>
                <View style={{ backgroundColor: tema.warning + '20', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: tema.warning }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: tema.warning }}>
                    ⚠️ {stockBajo.length} producto{stockBajo.length > 1 ? 's' : ''} necesita{stockBajo.length === 1 ? '' : 'n'} reabastecimiento
                  </Text>
                </View>

                {stockBajo.map(p => (
                  <View key={p.id} style={{ backgroundColor: tema.fondoCard, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: p.stock === 0 ? tema.danger : tema.warning }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: p.stock === 0 ? '#fee2e2' : '#fef3c7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <Text style={{ fontSize: 20 }}>{p.stock === 0 ? '❌' : '⚠️'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: tema.texto }}>{p.nombre}</Text>
                        <Text style={{ fontSize: 11, color: p.stock === 0 ? tema.danger : tema.warning, fontWeight: '700' }}>
                          {p.stock === 0 ? 'AGOTADO' : `Stock: ${p.stock} / Mínimo: ${p.stock_minimo}`}
                        </Text>
                        {p.ultimo_proveedor && (
                          <Text style={{ fontSize: 11, color: tema.textoTerciario }}>🏭 {p.ultimo_proveedor}</Text>
                        )}
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: tema.textoSecundario }}>
                          {p.costo > 0 ? `Q${parseFloat(p.costo).toFixed(2)}` : 'Sin precio'}
                        </Text>
                        <Text style={{ fontSize: 9, color: tema.textoTerciario }}>Costo unit.</Text>
                      </View>
                    </View>

                    {proveedores.length > 0 && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={{ fontSize: 10, color: tema.textoTerciario, marginBottom: 6, fontWeight: '700' }}>PEDIR A:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                          <View style={{ flexDirection: 'row', gap: 6 }}>
                            {proveedores.slice(0, 4).map(prov => (
                              <TouchableOpacity
                                key={prov.id}
                                style={{ backgroundColor: tema.primario + '20', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: tema.primario + '40' }}
                                onPress={() => abrirCompra(prov)}
                              >
                                <Text style={{ fontSize: 11, fontWeight: '700', color: tema.primario }}>{prov.nombre}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </ScrollView>
                      </View>
                    )}
                  </View>
                ))}
              </>
            )}
          </View>
        </ScrollView>
      )}

      {/* MODAL PROVEEDOR */}
      <Modal visible={modalProveedor} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, marginTop: 60 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: tema.texto, marginBottom: 20 }}>
                {editando ? '✏️ Editar Proveedor' : '🏭 Nuevo Proveedor'}
              </Text>

              {[
                { key: 'nombre', label: 'Nombre del Proveedor *', placeholder: 'Ej: Distribuidora López' },
                { key: 'contacto', label: 'Nombre del Contacto', placeholder: 'Ej: Juan López' },
                { key: 'telefono', label: 'Teléfono', placeholder: 'Ej: 5555-5555', keyboard: 'phone-pad' },
                { key: 'email', label: 'Email', placeholder: 'Ej: ventas@proveedor.com', keyboard: 'email-address' },
                { key: 'direccion', label: 'Dirección', placeholder: 'Dirección del proveedor' },
                { key: 'notas', label: 'Notas', placeholder: 'Condiciones de pago, días de entrega...' },
              ].map(({ key, label, placeholder, keyboard }) => (
                <View key={key} style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 4 }}>{label}</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: tema.fondoInput, color: tema.texto }}
                    placeholder={placeholder}
                    placeholderTextColor={tema.textoTerciario}
                    value={form[key]}
                    onChangeText={v => setForm(prev => ({ ...prev, [key]: v }))}
                    keyboardType={keyboard || 'default'}
                    multiline={key === 'notas'}
                  />
                </View>
              ))}

              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 20 }}>
                <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }} onPress={() => setModalProveedor(false)}>
                  <Text style={{ color: tema.textoTerciario, fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: tema.primario, alignItems: 'center' }} onPress={guardarProveedor}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>💾 Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL COMPRA */}
      <Modal visible={modalCompra} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: tema.texto }}>🛒 Registrar Compra</Text>
              <TouchableOpacity onPress={() => setModalCompra(false)}>
                <Text style={{ fontSize: 18, color: tema.textoTerciario }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: tema.primario, fontWeight: '700', marginBottom: 16 }}>
              🏭 {proveedorCompra?.nombre}
            </Text>

            {/* Buscar producto */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 6 }}>Agregar Producto</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: tema.fondoInput, color: tema.texto, marginBottom: 4 }}
              placeholder="Buscar producto..."
              placeholderTextColor={tema.textoTerciario}
              value={busquedaProducto}
              onChangeText={setBusquedaProducto}
            />

            {productosFiltrados.length > 0 && (
              <View style={{ backgroundColor: tema.fondoSecundario, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: tema.borde, overflow: 'hidden' }}>
                {productosFiltrados.map(p => (
                  <TouchableOpacity key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: tema.borde }} onPress={() => agregarItemCompra(p)}>
                    <Text style={{ fontSize: 13, color: tema.texto, flex: 1 }}>{p.nombre}</Text>
                    <Text style={{ fontSize: 11, color: tema.textoTerciario }}>Stock: {p.stock}</Text>
                    <View style={{ backgroundColor: tema.primario, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 }}>
                      <Text style={{ fontSize: 11, color: '#fff', fontWeight: '700' }}>+ Agregar</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Items de la compra */}
            <ScrollView style={{ maxHeight: 280 }}>
              {itemsCompra.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 24, backgroundColor: tema.fondoSecundario, borderRadius: 12, marginBottom: 12 }}>
                  <Text style={{ color: tema.textoTerciario, fontSize: 13 }}>Busca y agrega productos a la compra</Text>
                </View>
              ) : itemsCompra.map(item => (
                <View key={item.producto_id} style={{ backgroundColor: tema.fondoSecundario, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: tema.borde }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: tema.texto, flex: 1 }}>{item.nombre}</Text>
                    <TouchableOpacity onPress={() => quitarItem(item.producto_id)}>
                      <Text style={{ color: tema.danger, fontSize: 16, fontWeight: '700' }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: tema.fondoCard, borderRadius: 8, padding: 6, borderWidth: 1, borderColor: tema.borde }}>
                      <TouchableOpacity onPress={() => cambiarCantidadItem(item.producto_id, -1)}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: tema.texto, paddingHorizontal: 4 }}>−</Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 15, fontWeight: '900', color: tema.texto, minWidth: 24, textAlign: 'center' }}>{item.cantidad}</Text>
                      <TouchableOpacity onPress={() => cambiarCantidadItem(item.producto_id, 1)}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: tema.texto, paddingHorizontal: 4 }}>+</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 9, color: tema.textoTerciario, marginBottom: 2 }}>PRECIO COSTO (Q)</Text>
                      <TextInput
                        style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 8, padding: 8, fontSize: 15, fontWeight: '700', textAlign: 'center', backgroundColor: tema.fondoCard, color: tema.texto }}
                        placeholder="0.00"
                        placeholderTextColor={tema.textoTerciario}
                        value={item.precio_unitario}
                        onChangeText={v => cambiarPrecioItem(item.producto_id, v)}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={{ fontSize: 9, color: tema.textoTerciario }}>SUBTOTAL</Text>
                      <Text style={{ fontSize: 14, fontWeight: '900', color: tema.success }}>
                        Q{((parseFloat(item.precio_unitario) || 0) * item.cantidad).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Total y notas */}
            {itemsCompra.length > 0 && (
              <View style={{ backgroundColor: tema.primario + '15', borderRadius: 12, padding: 12, marginTop: 8, borderWidth: 1, borderColor: tema.primario + '30' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: tema.texto }}>Total Compra</Text>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: tema.primario }}>Q{totalCompra.toFixed(2)}</Text>
                </View>
              </View>
            )}

            <TextInput
              style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 13, backgroundColor: tema.fondoInput, color: tema.texto, marginTop: 10, marginBottom: 12 }}
              placeholder="Notas de la compra (opcional)..."
              placeholderTextColor={tema.textoTerciario}
              value={notasCompra}
              onChangeText={setNotasCompra}
            />

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }} onPress={() => setModalCompra(false)}>
                <Text style={{ color: tema.textoTerciario, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: tema.success, alignItems: 'center' }} onPress={registrarCompra}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>✅ Registrar Compra</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL DETALLE / HISTORIAL */}
      <Modal visible={modalDetalle} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '900', color: tema.texto }}>📋 Historial de Compras</Text>
                <Text style={{ fontSize: 13, color: tema.primario, fontWeight: '700' }}>🏭 {proveedorActivo?.nombre}</Text>
              </View>
              <TouchableOpacity onPress={() => setModalDetalle(false)}>
                <Text style={{ fontSize: 18, color: tema.textoTerciario }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              {comprasProveedor.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 32 }}>
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>📋</Text>
                  <Text style={{ color: tema.textoTerciario }}>Sin compras registradas</Text>
                </View>
              ) : comprasProveedor.map(c => (
                <View key={c.id} style={{ backgroundColor: tema.fondoSecundario, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: tema.borde }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: tema.texto }}>
                      {new Date(c.fecha).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: tema.success }}>Q{parseFloat(c.total).toFixed(2)}</Text>
                  </View>
                  {(c.detalle || []).filter(d => d.producto).map((d, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderTopWidth: i === 0 ? 1 : 0, borderColor: tema.borde }}>
                      <Text style={{ fontSize: 12, color: tema.textoSecundario, flex: 1 }}>{d.producto}</Text>
                      <Text style={{ fontSize: 12, color: tema.textoTerciario }}>{d.cantidad} × Q{parseFloat(d.precio).toFixed(2)}</Text>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: tema.texto, marginLeft: 8 }}>Q{parseFloat(d.subtotal).toFixed(2)}</Text>
                    </View>
                  ))}
                  {c.notas ? <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 6 }}>📝 {c.notas}</Text> : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  )
}