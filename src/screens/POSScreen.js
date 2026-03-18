import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, FlatList,
  Modal, TextInput, Alert, Image, Vibration, ScrollView
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { productosService, ventasService, clientesService, configuracionService } from '../services/api'
import { hayConexion, guardarVentaOffline, guardarCacheProductos } from '../services/offline'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTema } from '../context/TemaContext'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

export default function POSScreen() {
  const { tema } = useTema()
  const [permission, requestPermission] = useCameraPermissions()
  const [ultimoScan, setUltimoScan] = useState('')
  const [tiempoUltimoScan, setTiempoUltimoScan] = useState(0)
  const [productos, setProductos] = useState([])
  const [carrito, setCarrito] = useState([])
  const [clienteActivo, setClienteActivo] = useState(null)
  const [descuento, setDescuento] = useState(0)
  const [procesando, setProcesando] = useState(false)
  const [modalCobrar, setModalCobrar] = useState(false)
  const [modalCliente, setModalCliente] = useState(false)
  const [modalDescuento, setModalDescuento] = useState(false)
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [clientes, setClientes] = useState([])
  const [descuentoInput, setDescuentoInput] = useState('')
  const [mensajeScan, setMensajeScan] = useState(null)
  const [usuario, setUsuario] = useState(null)
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [modalFEL, setModalFEL] = useState(false)
  const [felNIT, setFelNIT] = useState('')
  const [felNombre, setFelNombre] = useState('')
  const [configEmpresa, setConfigEmpresa] = useState({})
  const [generandoPDF, setGenerandoPDF] = useState(false)
  const [ventaCompletada, setVentaCompletada] = useState(null)
  const mensajeTimer = useRef(null)

  // ── PAGO MIXTO ────────────────────────────────────────────────────────────
  // Cada método tiene su propio monto
  const [pagos, setPagos] = useState({
    efectivo: '',
    tarjeta: '',
    transferencia: '',
  })
  const [metodosActivos, setMetodosActivos] = useState(['efectivo']) // métodos seleccionados

  useEffect(() => { cargarDatos(); cargarConfig() }, [])

  const cargarConfig = async () => {
    try {
      const r = await configuracionService.obtener()
      setConfigEmpresa(r.data)
    } catch (e) { console.log('Error config:', e) }
  }

  const cargarDatos = async () => {
    try {
      const [respProductos, respClientes, u] = await Promise.all([
        productosService.obtenerTodos(),
        clientesService.obtenerTodos(),
        AsyncStorage.getItem('usuario')
      ])
      setProductos(respProductos.data)
      setClientes(respClientes.data)
      if (u) setUsuario(JSON.parse(u))
    } catch (e) { console.log('Error cargando datos:', e) }
      // Guardar cache para offline
      guardarCacheProductos(resp.data).catch(() => {})
  }


  const mostrarMensaje = (texto, tipo = 'success') => {
    if (mensajeTimer.current) clearTimeout(mensajeTimer.current)
    setMensajeScan({ texto, tipo })
    mensajeTimer.current = setTimeout(() => setMensajeScan(null), 2000)
  }

  const agregarProducto = (producto) => {
    if (producto.stock <= 0) { mostrarMensaje(`⚠️ ${producto.nombre} agotado`, 'warning'); return }
    const existe = carrito.find(i => i.id === producto.id)
    const cantidadActual = existe ? existe.cantidad : 0
    if (cantidadActual + 1 > producto.stock) { mostrarMensaje(`⚠️ Stock maximo: ${producto.stock} uds`, 'warning'); return }
    if (existe) {
      setCarrito(prev => prev.map(i => i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i))
    } else {
      setCarrito(prev => [{ ...producto, cantidad: 1 }, ...prev])
    }
    Vibration.vibrate(50)
    mostrarMensaje(`✅ ${producto.nombre} — Q${parseFloat(producto.precio).toFixed(2)}`, 'success')
    setBusquedaProducto('')
  }

  const handleScan = ({ data }) => {
    const ahora = Date.now()
    if (data === ultimoScan && ahora - tiempoUltimoScan < 1500) return
    setUltimoScan(data)
    setTiempoUltimoScan(ahora)
    const producto = productos.find(p => p.codigo_barras === data || p.codigo_barras === data.trim())
    if (!producto) { Vibration.vibrate(200); mostrarMensaje(`❌ Codigo no encontrado: ${data}`, 'error'); return }
    agregarProducto(producto)
  }

  const cambiarCantidad = (id, delta) => {
    setCarrito(prev => prev.map(i => i.id === id ? { ...i, cantidad: i.cantidad + delta } : i).filter(i => i.cantidad > 0))
  }

  const limpiarCarrito = () => {
    Alert.alert('Limpiar factura', '¿Seguro que quieres limpiar todo?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Limpiar', style: 'destructive', onPress: () => { setCarrito([]); setDescuento(0); setClienteActivo(null); resetPagos() } }
    ])
  }

  const seleccionarCliente = (cliente) => {
    setClienteActivo(cliente)
    const descMap = { plata: 5, oro: 8, platino: 12 }
    const desc = descMap[cliente.nivel] || 0
    if (desc > 0) setDescuento(desc)
    setModalCliente(false)
    mostrarMensaje(`👤 Cliente: ${cliente.nombre}`, 'info')
  }

  const productosFiltrados = busquedaProducto.length >= 2
    ? productos.filter(p =>
        p.nombre.toLowerCase().includes(busquedaProducto.toLowerCase()) ||
        (p.codigo_barras && p.codigo_barras.includes(busquedaProducto))
      ).slice(0, 5)
    : []

  const clientesFiltrados = clientes.filter(c =>
    c.nombre?.toLowerCase().includes(busquedaCliente.toLowerCase()) ||
    c.nit?.includes(busquedaCliente) ||
    c.membresia_id?.toLowerCase().includes(busquedaCliente.toLowerCase())
  )

  const subtotal = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0)
  const montoDescuento = subtotal * descuento / 100
  const total = subtotal - montoDescuento

  // ── LÓGICA PAGO MIXTO ─────────────────────────────────────────────────────
  const resetPagos = () => {
    setPagos({ efectivo: '', tarjeta: '', transferencia: '' })
    setMetodosActivos(['efectivo'])
  }

  const toggleMetodo = (metodo) => {
    setMetodosActivos(prev => {
      if (prev.includes(metodo)) {
        if (prev.length === 1) return prev // al menos 1 método
        setPagos(p => ({ ...p, [metodo]: '' }))
        return prev.filter(m => m !== metodo)
      }
      return [...prev, metodo]
    })
  }

  const totalPagado = metodosActivos.reduce((s, m) => s + (parseFloat(pagos[m]) || 0), 0)
  const pendiente = total - totalPagado
  const vuelto = metodosActivos.includes('efectivo') && totalPagado > total
    ? totalPagado - total
    : 0
  const pagoValido = totalPagado >= total

  // Auto-completar el monto restante en el campo activo al ingresar en otro
  const setPago = (metodo, valor) => {
    setPagos(prev => ({ ...prev, [metodo]: valor }))
  }

  // Método de pago para el backend (simplificado)
  const metodoPagoBackend = () => {
    if (metodosActivos.length === 1) return metodosActivos[0]
    return metodosActivos.join('+')
  }

  const procesarVenta = async () => {
    if (carrito.length === 0) { Alert.alert('Error', 'La factura está vacía'); return }
    if (!pagoValido) {
      Alert.alert('Pago incompleto', `Faltan Q${pendiente.toFixed(2)} por cubrir`)
      return
    }
    setProcesando(true)
    try {
      const efectivoMonto = parseFloat(pagos.efectivo) || 0
      const tarjetaMonto = parseFloat(pagos.tarjeta) || 0
      const transferenciaMonto = parseFloat(pagos.transferencia) || 0

      const ventaData = {
        items: carrito.map(i => ({ producto_id: i.id, cantidad: i.cantidad, precio: parseFloat(i.precio) })),
        subtotal,
        descuento: montoDescuento,
        total,
        metodo_pago: metodoPagoBackend(),
        cliente_id: clienteActivo?.id || null,
        efectivo_recibido: efectivoMonto + tarjetaMonto + transferenciaMonto,
        vuelto: vuelto,
        pagos_detalle: {
          efectivo: efectivoMonto,
          tarjeta: tarjetaMonto,
          transferencia: transferenciaMonto,
        }
      }

      const online = await hayConexion()
      if (online) {
        await ventasService.crear(ventaData)
      } else {
        await guardarVentaOffline(ventaData)
        Alert.alert('⚠️ Sin conexión', 'La venta se guardó localmente y se sincronizará cuando haya internet.')
      }
      
      setVentaCompletada({
        carrito: [...carrito],
        subtotal, montoDescuento, total,
        pagos: { ...pagos },
        metodosActivos: [...metodosActivos],
        totalPagado,
        vuelto,
        clienteActivo
      })
      setModalCobrar(false)
      setModalFEL(true)
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'No se pudo procesar')
    } finally { setProcesando(false) }
  }

  const finalizarSinFactura = () => {
    setModalFEL(false)
    limpiarTodo()
    mostrarMensaje('✅ Venta completada!', 'success')
    cargarDatos()
  }

  const generarTicketSimple = async () => {
    if (!ventaCompletada) return
    setGenerandoPDF(true)
    try {
      const empresa = configEmpresa
      const fecha = new Date().toLocaleString('es-GT')
      const items = ventaCompletada.carrito.map(i =>
        `<tr>
          <td>${i.nombre}</td>
          <td style="text-align:center">${i.cantidad}</td>
          <td style="text-align:right">Q${parseFloat(i.precio).toFixed(2)}</td>
          <td style="text-align:right">Q${(parseFloat(i.precio) * i.cantidad).toFixed(2)}</td>
        </tr>`
      ).join('')

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; font-size: 12px; width: 280px; margin: 0 auto; padding: 8px; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        table { width: 100%; border-collapse: collapse; }
        th { font-size: 10px; border-bottom: 1px solid #000; padding: 2px 0; }
        td { padding: 2px 0; font-size: 11px; }
        .total-row { font-weight: bold; font-size: 13px; border-top: 1px solid #000; padding-top: 4px; }
      </style>
      </head><body>
        <div class="center bold" style="font-size:14px">${empresa.empresa_nombre || 'POS Pro GT'}</div>
        <div class="center" style="font-size:10px">${empresa.empresa_direccion || ''}</div>
        <div class="center" style="font-size:10px">Tel: ${empresa.empresa_telefono || ''}</div>
        <div class="center" style="font-size:10px">NIT: ${empresa.empresa_nit || ''}</div>
        <div class="divider"></div>
        <div style="font-size:10px">Fecha: ${fecha}</div>
        <div style="font-size:10px">Cajero: ${usuario?.nombre || 'N/A'}</div>
        ${ventaCompletada.clienteActivo ? `<div style="font-size:10px">Cliente: ${ventaCompletada.clienteActivo.nombre}</div>` : ''}
        <div class="divider"></div>
        <table>
          <tr>
            <th style="text-align:left">Producto</th>
            <th>Cant</th>
            <th style="text-align:right">Precio</th>
            <th style="text-align:right">Total</th>
          </tr>
          ${items}
        </table>
        <div class="divider"></div>
        <table>
          ${ventaCompletada.montoDescuento > 0 ? `
          <tr><td>Subtotal</td><td style="text-align:right">Q${ventaCompletada.subtotal.toFixed(2)}</td></tr>
          <tr><td>Descuento</td><td style="text-align:right">-Q${ventaCompletada.montoDescuento.toFixed(2)}</td></tr>
          ` : ''}
          <tr class="total-row"><td>TOTAL</td><td style="text-align:right">Q${ventaCompletada.total.toFixed(2)}</td></tr>
          ${ventaCompletada.vuelto > 0 ? `<tr><td>Vuelto</td><td style="text-align:right">Q${ventaCompletada.vuelto.toFixed(2)}</td></tr>` : ''}
        </table>
        <div class="divider"></div>
        <div class="center" style="font-size:10px; margin-top:4px">¡Gracias por su compra!</div>
        <div class="center" style="font-size:10px">Vuelva pronto 😊</div>
      </body></html>`

      const { uri } = await Print.printToFileAsync({ html, base64: false })
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Ticket de Venta', UTI: 'com.adobe.pdf' })
    } catch {
      Alert.alert('Error', 'No se pudo generar el ticket')
    }
    setGenerandoPDF(false)
  }

  const limpiarTodo = () => {
    setCarrito([])
    setDescuento(0)
    setClienteActivo(null)
    setFelNIT('')
    setFelNombre('')
    setVentaCompletada(null)
    resetPagos()
  }

  const buscarClientePorNIT = (nit) => {
    if (!nit || nit === 'CF') { setFelNombre('Consumidor Final'); return }
    const cliente = clientes.find(c => c.nit === nit)
    if (cliente) setFelNombre(cliente.nombre)
  }

  const generarFacturaPDF = async () => {
    if (!ventaCompletada) return
    setGenerandoPDF(true)
    try {
      const numeroFactura = await configuracionService.incrementarFactura()
      const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16).toUpperCase()
      })
      const serie = configEmpresa.empresa_serie_factura || 'A'
      const numFact = numeroFactura.data?.numero || '1'
      const ahora = new Date()
      const fechaStr = ahora.toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' })
      const horaStr = ahora.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' })
      const nitCliente = felNIT || 'CF'
      const nombreCliente = felNombre || 'Consumidor Final'
      const v = ventaCompletada

      const nombresMetodos = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' }

      const filas = v.carrito.map(item => `
        <tr>
          <td style="padding:6px 4px;border-bottom:1px solid #eee;font-size:12px">${item.nombre}</td>
          <td style="padding:6px 4px;border-bottom:1px solid #eee;font-size:12px;text-align:center">${item.cantidad}</td>
          <td style="padding:6px 4px;border-bottom:1px solid #eee;font-size:12px;text-align:right">Q${parseFloat(item.precio).toFixed(2)}</td>
          <td style="padding:6px 4px;border-bottom:1px solid #eee;font-size:12px;text-align:right">Q${(item.precio * item.cantidad).toFixed(2)}</td>
        </tr>`).join('')

      // Filas de pagos para el PDF
      const filasPagos = v.metodosActivos.map(m => {
        const monto = parseFloat(v.pagos[m]) || 0
        if (monto <= 0) return ''
        return `<div class="total-row"><span>${nombresMetodos[m]}:</span><span>Q${monto.toFixed(2)}</span></div>`
      }).join('')

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        * { margin:0; padding:0; box-sizing:border-box }
        body { font-family: Arial, sans-serif; width: 80mm; padding: 8px; font-size: 12px; color: #000 }
        .center { text-align: center }
        .bold { font-weight: bold }
        .empresa-nombre { font-size: 16px; font-weight: 900; text-align: center; margin-bottom: 2px }
        .linea { border-top: 1px dashed #000; margin: 6px 0 }
        .fel-badge { background: #000; color: #fff; text-align: center; padding: 4px; font-size: 10px; font-weight: bold; border-radius: 4px; margin: 6px 0 }
        .dato-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px }
        .dato-label { color: #666 }
        table { width: 100%; border-collapse: collapse; margin: 6px 0 }
        th { font-size: 11px; text-align: left; padding: 4px; border-bottom: 2px solid #000 }
        .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px }
        .total-final { font-size: 16px; font-weight: 900; border-top: 2px solid #000; padding-top: 6px; margin-top: 4px }
        .uuid { font-size: 8px; word-break: break-all; color: #444; margin: 4px 0 }
        .leyenda { font-size: 9px; text-align: center; margin-top: 8px; color: #444; line-height: 1.4 }
        .pago-mixto { background:#f0fdf4; border-radius:4px; padding:6px; margin:4px 0; font-size:11px }
      </style></head><body>
      <div class="empresa-nombre">${configEmpresa.empresa_nombre || 'MI EMPRESA'}</div>
      <div class="center" style="font-size:10px;color:#444;margin-bottom:2px">${configEmpresa.empresa_direccion || ''}</div>
      <div class="center" style="font-size:10px;color:#444">Tel: ${configEmpresa.empresa_telefono || ''}</div>
      <div class="center" style="font-size:10px;color:#444">NIT: ${configEmpresa.empresa_nit || ''}</div>
      <div class="fel-badge">DOCUMENTO TRIBUTARIO ELECTRÓNICO — FACTURA FEL</div>
      <div class="dato-row"><span class="dato-label">Serie:</span><span class="bold">${serie}</span></div>
      <div class="dato-row"><span class="dato-label">No. Factura:</span><span class="bold">${numFact}</span></div>
      <div class="dato-row"><span class="dato-label">Fecha:</span><span>${fechaStr} ${horaStr}</span></div>
      <div class="dato-row"><span class="dato-label">Cajero:</span><span>${usuario?.nombre || 'N/A'}</span></div>
      <div class="linea"></div>
      <div class="dato-row"><span class="dato-label">NIT Cliente:</span><span class="bold">${nitCliente}</span></div>
      <div class="dato-row"><span class="dato-label">Nombre:</span><span>${nombreCliente}</span></div>
      <div class="linea"></div>
      <table>
        <thead><tr>
          <th>Producto</th>
          <th style="text-align:center">Cant</th>
          <th style="text-align:right">Precio</th>
          <th style="text-align:right">Total</th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
      <div class="linea"></div>
      ${v.montoDescuento > 0 ? `
      <div class="total-row"><span>Subtotal:</span><span>Q${v.subtotal.toFixed(2)}</span></div>
      <div class="total-row" style="color:#d97706"><span>Descuento:</span><span>-Q${v.montoDescuento.toFixed(2)}</span></div>
      ` : ''}
      <div class="total-row total-final"><span>TOTAL:</span><span>Q${v.total.toFixed(2)}</span></div>
      <div class="linea"></div>
      ${v.metodosActivos.length > 1 ? `<div style="font-size:10px;font-weight:bold;margin-bottom:4px">FORMA DE PAGO:</div>` : ''}
      ${filasPagos}
      ${v.vuelto > 0 ? `<div class="total-row" style="color:#059669"><span>Cambio:</span><span>Q${v.vuelto.toFixed(2)}</span></div>` : ''}
      <div class="linea"></div>
      <div class="uuid">UUID: ${uuid}</div>
      <div class="linea"></div>
      <div class="leyenda">
        SUJETO A PAGOS TRIMESTRALES<br>
        AGENTE DE RETENCIÓN DE IVA<br>
        GRACIAS POR SU COMPRA<br>
        ES UN PLACER SERVIRLE
      </div>
      </body></html>`

      const { uri } = await Print.printToFileAsync({ html, base64: false })
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Factura FEL', UTI: 'com.adobe.pdf' })
      setModalFEL(false)
      limpiarTodo()
      cargarDatos()
    } catch (e) {
      Alert.alert('Error', 'No se pudo generar la factura')
    } finally { setGenerandoPDF(false) }
  }

  const colorMensaje = (tipo) => {
    if (tipo === 'error') return '#ef4444'
    if (tipo === 'warning') return '#f59e0b'
    if (tipo === 'info') return '#60a5fa'
    return '#22c55e'
  }

  const METODOS = [
    { id: 'efectivo', emoji: '💵', label: 'Efectivo' },
    { id: 'tarjeta', emoji: '💳', label: 'Tarjeta' },
    { id: 'transferencia', emoji: '📱', label: 'Transfer' },
  ]

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <View style={{ flex: 1, backgroundColor: '#0d1117' }}>

      {/* BARRA BUSQUEDA */}
      <View style={{ backgroundColor: '#0d1117', paddingHorizontal: 12, paddingBottom: 8 }}>
        <View style={{ position: 'relative' }}>
          <TextInput
            style={{ backgroundColor: '#1e2530', borderRadius: 12, padding: 12, paddingLeft: 40, fontSize: 14, color: '#fff', borderWidth: 1, borderColor: '#30363d' }}
            placeholder="🔍 Buscar producto por nombre o código..."
            placeholderTextColor="#6b7280"
            value={busquedaProducto}
            onChangeText={setBusquedaProducto}
          />
          {busquedaProducto.length > 0 && (
            <TouchableOpacity style={{ position: 'absolute', right: 12, top: 12 }} onPress={() => setBusquedaProducto('')}>
              <Text style={{ color: '#6b7280', fontSize: 16, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {productosFiltrados.length > 0 && (
          <View style={{ backgroundColor: '#1e2530', borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: '#30363d', overflow: 'hidden' }}>
            {productosFiltrados.map(p => (
              <TouchableOpacity key={p.id} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: '#30363d' }} onPress={() => agregarProducto(p)}>
                <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#0d1117', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  {p.foto_url
                    ? <Image source={{ uri: p.foto_url }} style={{ width: 36, height: 36, borderRadius: 8 }} />
                    : <Text style={{ fontSize: 18 }}>{p.emoji || '📦'}</Text>
                  }
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }} numberOfLines={1}>{p.nombre}</Text>
                  <Text style={{ fontSize: 10, color: '#6b7280' }}>Stock: {p.stock} uds</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#1a56db' }}>Q{parseFloat(p.precio).toFixed(2)}</Text>
                  <View style={{ backgroundColor: '#1a56db', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginTop: 2 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>+ Agregar</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {busquedaProducto.length >= 2 && productosFiltrados.length === 0 && (
          <View style={{ backgroundColor: '#1e2530', borderRadius: 12, marginTop: 4, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#30363d' }}>
            <Text style={{ color: '#6b7280', fontSize: 13 }}>No se encontraron productos</Text>
          </View>
        )}
      </View>

      {/* CAMARA */}
      <View style={{ height: 140, backgroundColor: '#000', position: 'relative' }}>
        {!permission ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#9ca3af', fontSize: 14 }}>Solicitando camara...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 36, marginBottom: 8 }}>📷</Text>
            <Text style={{ fontSize: 14, color: '#9ca3af', marginBottom: 12 }}>Sin acceso a la camara</Text>
            <TouchableOpacity style={{ backgroundColor: '#1a56db', padding: 12, borderRadius: 10 }} onPress={requestPermission}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Dar Permiso</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <CameraView style={{ flex: 1 }} facing="back" onBarcodeScanned={handleScan} barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code39', 'code128', 'qr'] }}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 220, height: 2, backgroundColor: '#1a56db', opacity: 0.8, position: 'absolute' }} />
              {[{ top: '10%', left: '20%', borderRightWidth: 0, borderBottomWidth: 0 },
                { top: '10%', right: '20%', borderLeftWidth: 0, borderBottomWidth: 0 },
                { bottom: '10%', left: '20%', borderRightWidth: 0, borderTopWidth: 0 },
                { bottom: '10%', right: '20%', borderLeftWidth: 0, borderTopWidth: 0 }
              ].map((style, i) => (
                <View key={i} style={{ position: 'absolute', width: 20, height: 20, borderColor: '#1a56db', borderWidth: 3, ...style }} />
              ))}
            </View>
            {mensajeScan && (
              <View style={{ position: 'absolute', bottom: 8, left: 16, right: 16, borderRadius: 10, padding: 10, alignItems: 'center', backgroundColor: colorMensaje(mensajeScan.tipo) + 'ee' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{mensajeScan.texto}</Text>
              </View>
            )}
          </CameraView>
        )}
      </View>

      {/* FACTURA */}
      <View style={{ flex: 1, backgroundColor: tema.fondo, borderTopLeftRadius: 16, borderTopRightRadius: 16, marginTop: -8, overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, paddingHorizontal: 16, backgroundColor: tema.fondoCard, borderBottomWidth: 1, borderColor: tema.borde }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: tema.texto }}>
            Factura {carrito.length > 0 ? `(${carrito.reduce((s, i) => s + i.cantidad, 0)} items)` : ''}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {clienteActivo && <Text style={{ fontSize: 11, color: '#60a5fa' }}>👤 {clienteActivo.nombre}</Text>}
            {descuento > 0 && <View style={{ backgroundColor: '#d97706', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}><Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>-{descuento}%</Text></View>}
            <TouchableOpacity style={{ backgroundColor: tema.fondoSecundario, width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tema.borde }} onPress={() => setModalCliente(true)}>
              <Text style={{ fontSize: 14 }}>👤</Text>
            </TouchableOpacity>
            <TouchableOpacity style={{ backgroundColor: tema.fondoSecundario, width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tema.borde }} onPress={() => setModalDescuento(true)}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: tema.texto }}>%</Text>
            </TouchableOpacity>
            {carrito.length > 0 && (
              <TouchableOpacity style={{ backgroundColor: '#fee2e2', width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fca5a5' }} onPress={limpiarCarrito}>
                <Text style={{ fontSize: 14 }}>🗑️</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {carrito.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>📷</Text>
            <Text style={{ fontSize: 14, color: tema.textoTerciario, textAlign: 'center' }}>Escanea o busca un producto para comenzar</Text>
          </View>
        ) : (
          <FlatList
            data={carrito}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.fondoCard, marginHorizontal: 10, marginTop: 6, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: tema.borde }}>
                {item.foto_url
                  ? <Image source={{ uri: item.foto_url }} style={{ width: 44, height: 44, borderRadius: 8, marginRight: 10 }} />
                  : <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: tema.fondoSecundario, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}><Text style={{ fontSize: 18 }}>{item.emoji || '📦'}</Text></View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: tema.texto }} numberOfLines={1}>{item.nombre}</Text>
                  <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 1 }}>Q{parseFloat(item.precio).toFixed(2)} c/u</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 8 }}>
                  <TouchableOpacity style={{ backgroundColor: tema.fondoSecundario, width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tema.borde }} onPress={() => cambiarCantidad(item.id, -1)}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: tema.texto }}>−</Text>
                  </TouchableOpacity>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: tema.texto, minWidth: 20, textAlign: 'center' }}>{item.cantidad}</Text>
                  <TouchableOpacity style={{ backgroundColor: tema.fondoSecundario, width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tema.borde }} onPress={() => cambiarCantidad(item.id, 1)}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: tema.texto }}>+</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: 14, fontWeight: '900', color: tema.primario, minWidth: 60, textAlign: 'right' }}>Q{(item.precio * item.cantidad).toFixed(2)}</Text>
              </View>
            )}
          />
        )}
      </View>

      {/* BARRA TOTAL */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0d1117', padding: 16, borderTopWidth: 1, borderColor: '#1e2530' }}>
        <View>
          {descuento > 0 && <Text style={{ fontSize: 11, color: '#9ca3af' }}>Sub: Q{subtotal.toFixed(2)}</Text>}
          <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>Total: Q{total.toFixed(2)}</Text>
        </View>
        <TouchableOpacity
          style={{ backgroundColor: carrito.length === 0 ? '#1e2530' : '#1a56db', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}
          onPress={() => carrito.length > 0 && setModalCobrar(true)}
          disabled={carrito.length === 0}
        >
          <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>💳 Cobrar</Text>
        </TouchableOpacity>
      </View>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL COBRAR — CON PAGO MIXTO
      ══════════════════════════════════════════════════════════════════════ */}
      <Modal visible={modalCobrar} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <ScrollView style={{ maxHeight: '92%' }} keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>

              {/* Resumen */}
              <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 12 }}>Confirmar Cobro</Text>
              <View style={{ backgroundColor: tema.fondoSecundario, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: tema.borde }}>
                {descuento > 0 && (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 13, color: tema.textoTerciario }}>Subtotal</Text>
                      <Text style={{ fontSize: 13, color: tema.texto }}>Q{subtotal.toFixed(2)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ fontSize: 13, color: '#d97706' }}>Descuento {descuento}%</Text>
                      <Text style={{ fontSize: 13, color: '#d97706' }}>-Q{montoDescuento.toFixed(2)}</Text>
                    </View>
                  </>
                )}
                {clienteActivo && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 13, color: tema.textoTerciario }}>👤 Cliente</Text>
                    <Text style={{ fontSize: 13, color: tema.texto }}>{clienteActivo.nombre}</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: tema.borde, paddingTop: 8, marginTop: 4 }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: tema.texto }}>TOTAL A COBRAR</Text>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: tema.primario }}>Q{total.toFixed(2)}</Text>
                </View>
              </View>

              {/* Selección de métodos */}
              <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 8 }}>
                Método(s) de Pago
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {METODOS.map(m => {
                  const activo = metodosActivos.includes(m.id)
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={{
                        flex: 1, borderRadius: 10, padding: 10, alignItems: 'center',
                        backgroundColor: activo ? tema.primario : tema.fondoSecundario,
                        borderWidth: 2, borderColor: activo ? tema.primario : tema.borde
                      }}
                      onPress={() => toggleMetodo(m.id)}
                    >
                      <Text style={{ fontSize: 22 }}>{m.emoji}</Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: activo ? '#fff' : tema.textoTerciario, marginTop: 2 }}>
                        {m.label}
                      </Text>
                      {activo && (
                        <View style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#22c55e', borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  )
                })}
              </View>

              {/* Campos de monto por método */}
              {metodosActivos.map((metodoId, idx) => {
                const m = METODOS.find(x => x.id === metodoId)
                const esUnico = metodosActivos.length === 1
                return (
                  <View key={metodoId} style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 6 }}>
                      {m.emoji} {m.label} (Q)
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TextInput
                        style={{
                          flex: 1, borderWidth: 1, borderColor: tema.borde, borderRadius: 12,
                          padding: 14, fontSize: 20, fontWeight: '700', textAlign: 'center',
                          backgroundColor: tema.fondoInput, color: tema.texto
                        }}
                        placeholder={esUnico ? `Q${total.toFixed(2)}` : 'Q 0.00'}
                        placeholderTextColor={tema.textoTerciario}
                        value={pagos[metodoId]}
                        onChangeText={v => setPago(metodoId, v)}
                        keyboardType="numeric"
                      />
                      {/* Botón "Poner restante" */}
                      {!esUnico && (
                        <TouchableOpacity
                          style={{ backgroundColor: '#1e40af', borderRadius: 12, paddingHorizontal: 12, justifyContent: 'center' }}
                          onPress={() => {
                            const otrosPagados = metodosActivos
                              .filter(x => x !== metodoId)
                              .reduce((s, x) => s + (parseFloat(pagos[x]) || 0), 0)
                            const restante = Math.max(0, total - otrosPagados)
                            setPago(metodoId, restante.toFixed(2))
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>
                            {'Resto\nQ' + Math.max(0, total - metodosActivos.filter(x => x !== metodoId).reduce((s, x) => s + (parseFloat(pagos[x]) || 0), 0)).toFixed(2)}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )
              })}

              {/* Barra de progreso del pago */}
              <View style={{ marginBottom: 14 }}>
                <View style={{ height: 8, backgroundColor: tema.fondoSecundario, borderRadius: 4, overflow: 'hidden' }}>
                  <View style={{
                    height: 8, borderRadius: 4,
                    width: `${Math.min(100, (totalPagado / total) * 100)}%`,
                    backgroundColor: pagoValido ? '#22c55e' : '#3b82f6'
                  }} />
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
                  <Text style={{ fontSize: 11, color: tema.textoSecundario }}>
                    Pagado: Q{totalPagado.toFixed(2)}
                  </Text>
                  {!pagoValido
                    ? <Text style={{ fontSize: 11, color: '#ef4444', fontWeight: '700' }}>Faltan: Q{pendiente.toFixed(2)}</Text>
                    : vuelto > 0
                      ? <Text style={{ fontSize: 11, color: '#22c55e', fontWeight: '700' }}>Vuelto: Q{vuelto.toFixed(2)}</Text>
                      : <Text style={{ fontSize: 11, color: '#22c55e', fontWeight: '700' }}>Pago exacto ✓</Text>
                  }
                </View>
              </View>

              {/* Vuelto destacado si hay efectivo */}
              {vuelto > 0 && (
                <View style={{ backgroundColor: '#d1fae5', borderRadius: 10, padding: 12, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#059669' }}>💵 Cambio a entregar</Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#059669' }}>Q{vuelto.toFixed(2)}</Text>
                </View>
              )}

              {/* Botones */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }}
                  onPress={() => { setModalCobrar(false); resetPagos() }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: tema.textoTerciario }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: pagoValido ? '#059669' : '#374151', alignItems: 'center', opacity: procesando ? 0.6 : 1 }}
                  onPress={procesarVenta}
                  disabled={procesando || !pagoValido}
                >
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>
                    {procesando ? 'Procesando...' : '✅ Confirmar'}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ height: 20 }} />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL CLIENTE */}
      <Modal visible={modalCliente} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 12 }}>Seleccionar Cliente</Text>
            <TextInput style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 10, backgroundColor: tema.fondoInput, color: tema.texto }} placeholder="Buscar por nombre, NIT o membresia..." placeholderTextColor={tema.textoTerciario} value={busquedaCliente} onChangeText={setBusquedaCliente} autoFocus />
            {clienteActivo && (
              <TouchableOpacity style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 10 }} onPress={() => { setClienteActivo(null); setDescuento(0); setModalCliente(false) }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#dc2626' }}>✕ Quitar cliente activo</Text>
              </TouchableOpacity>
            )}
            <FlatList
              data={clientesFiltrados.slice(0, 6)}
              keyExtractor={c => c.id.toString()}
              style={{ maxHeight: 260 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderBottomWidth: 1, borderColor: tema.borde, gap: 10 }} onPress={() => seleccionarCliente(item)}>
                  <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: item.nivel === 'oro' ? '#fef3c7' : item.nivel === 'platino' ? '#ede9fe' : tema.fondoSecundario, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 16 }}>{item.nivel === 'platino' ? '💎' : item.nivel === 'oro' ? '🥇' : item.nivel === 'plata' ? '🥈' : '🥉'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: tema.texto }}>{item.nombre}</Text>
                    <Text style={{ fontSize: 11, color: tema.textoTerciario }}>{item.nit ? `NIT: ${item.nit}` : item.membresia_id}</Text>
                  </View>
                  {item.nivel !== 'bronce' && <Text style={{ fontSize: 13, fontWeight: '900', color: '#059669' }}>-{item.nivel === 'plata' ? 5 : item.nivel === 'oro' ? 8 : 12}%</Text>}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={{ backgroundColor: '#0d1117', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 10 }} onPress={() => setModalCliente(false)}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL FEL */}
      <Modal visible={modalFEL} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: tema.texto, marginBottom: 4 }}>✅ Venta Registrada</Text>
            <Text style={{ fontSize: 13, color: tema.textoTerciario, marginBottom: 20 }}>¿Deseas emitir factura FEL?</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 6 }}>NIT del Cliente</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              <TextInput
                style={{ flex: 1, borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 16, backgroundColor: tema.fondoInput, color: tema.texto }}
                placeholder="Ej: 12345678-9"
                placeholderTextColor={tema.textoTerciario}
                value={felNIT}
                onChangeText={v => { setFelNIT(v); buscarClientePorNIT(v) }}
                keyboardType="default"
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={{ backgroundColor: tema.fondoSecundario, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center', borderWidth: 1, borderColor: tema.borde }}
                onPress={() => { setFelNIT('CF'); setFelNombre('Consumidor Final') }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoSecundario }}>C/F</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 6 }}>Nombre del Cliente</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: tema.fondoInput, color: tema.texto, marginBottom: 20 }}
              placeholder="Nombre completo"
              placeholderTextColor={tema.textoTerciario}
              value={felNombre}
              onChangeText={setFelNombre}
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={{ backgroundColor: tema.primario, borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10, opacity: generandoPDF ? 0.6 : 1 }}
              onPress={generarFacturaPDF}
              disabled={generandoPDF}
            >
              <Text style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>
                {generandoPDF ? '⏳ Generando...' : '🧾 Generar Factura FEL'}
              </Text>
            </TouchableOpacity>
          <TouchableOpacity
              style={{ backgroundColor: '#059669', borderRadius: 14, padding: 16, alignItems: 'center', marginBottom: 10, opacity: generandoPDF ? 0.6 : 1 }}
              onPress={generarTicketSimple}
              disabled={generandoPDF}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>🧾 Ticket Simple</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{ backgroundColor: tema.fondoSecundario, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: tema.borde }}
              onPress={finalizarSinFactura}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: tema.textoSecundario }}>Sin comprobante</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL DESCUENTO */}
      <Modal visible={modalDescuento} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 16 }}>Aplicar Descuento</Text>
            <TextInput style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 12, padding: 14, fontSize: 20, fontWeight: '700', textAlign: 'center', backgroundColor: tema.fondoInput, color: tema.texto, marginBottom: 16 }} placeholder="Ej: 10 (para 10%)" placeholderTextColor={tema.textoTerciario} value={descuentoInput} onChangeText={setDescuentoInput} keyboardType="numeric" autoFocus />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }} onPress={() => { setModalDescuento(false); setDescuentoInput('') }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: tema.textoTerciario }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: tema.primario, alignItems: 'center' }} onPress={() => {
                const pct = parseFloat(descuentoInput)
                if (!isNaN(pct) && pct >= 0 && pct <= 100) { setDescuento(pct); setModalDescuento(false); setDescuentoInput('') }
                else Alert.alert('Error', 'Ingresa un porcentaje entre 0 y 100')
              }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  )
}