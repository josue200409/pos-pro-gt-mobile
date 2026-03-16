import React, { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  Alert, RefreshControl, Modal, ScrollView
} from 'react-native'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { productosService } from '../services/api'
import { useTema } from '../context/TemaContext'

const generarBarrasSVG = (codigo) => {
  const patron = []
  let seed = 0
  for (let i = 0; i < codigo.length; i++) seed += codigo.charCodeAt(i) * (i + 1)
  for (let i = 0; i < 60; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    patron.push(seed % 3 === 0 ? 3 : seed % 2 === 0 ? 2 : 1)
  }
  let svgBars = ''
  let x = 10
  patron.forEach(ancho => {
    const esNegro = (x % 5) < 3
    svgBars += `<rect x="${x}" y="10" width="${ancho}" height="50" fill="${esNegro ? '#000' : '#fff'}"/>`
    x += ancho
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80" style="background:white">
    <rect width="200" height="80" fill="white"/>
    ${svgBars}
    <text x="100" y="76" text-anchor="middle" font-size="9" font-family="monospace">${codigo}</text>
  </svg>`
}

export default function BarcodesScreen() {
  const { tema } = useTema()
  const [productos, setProductos] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [seleccionados, setSeleccionados] = useState([])
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [modalOpciones, setModalOpciones] = useState(null)
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => { cargarProductos() }, [])

  const cargarProductos = async () => {
    try {
      const r = await productosService.obtenerTodos()
      setProductos(r.data)
    } catch { Alert.alert('Error', 'No se pudieron cargar los productos') }
    finally { setRefreshing(false) }
  }

  const asignarCodigo = async (producto) => {
    const codigo = `GT${Date.now()}${Math.floor(Math.random() * 100)}`
    try {
      await productosService.actualizar(producto.id, { ...producto, codigo_barras: codigo })
      await cargarProductos()
      Alert.alert('✅ Codigo asignado', codigo)
    } catch { Alert.alert('Error', 'No se pudo asignar el codigo') }
  }

  const asignarTodos = async () => {
    const sinCodigo = productos.filter(p => !p.codigo_barras)
    if (sinCodigo.length === 0) { Alert.alert('Info', 'Todos los productos ya tienen codigo'); return }
    Alert.alert('Asignar Codigos', `Se asignaran codigos a ${sinCodigo.length} productos`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Asignar', onPress: async () => {
          try {
            await Promise.all(sinCodigo.map(p => productosService.actualizar(p.id, { ...p, codigo_barras: `GT${Date.now()}${Math.floor(Math.random() * 1000)}` })))
            await cargarProductos()
            Alert.alert('✅ Listo', `${sinCodigo.length} codigos asignados`)
          } catch { Alert.alert('Error', 'No se pudieron asignar todos los codigos') }
        }
      }
    ])
  }

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const productosFiltrados = productos.filter(p => {
    if (filtro === 'con') return !!p.codigo_barras
    if (filtro === 'sin') return !p.codigo_barras
    return true
  })

  const exportarEtiquetas = async (lista) => {
    if (lista.length === 0) { Alert.alert('Error', 'Selecciona al menos un producto'); return }
    try {
      setGenerando(true)
      const etiquetas = lista.map(p => {
        const svg = generarBarrasSVG(p.codigo_barras || p.id.toString())
        const svgBase64 = btoa(unescape(encodeURIComponent(svg)))
        return `
          <div class="etiqueta">
            <div class="nombre">${p.nombre}</div>
            <img src="data:image/svg+xml;base64,${svgBase64}" width="180" height="70"/>
            <div class="precio">Q${parseFloat(p.precio).toFixed(2)}</div>
            <div class="codigo">${p.codigo_barras || 'Sin codigo'}</div>
          </div>`
      }).join('')

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        body{margin:0;padding:10px;font-family:Arial,sans-serif;background:#f5f5f5}
        .grid{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-start}
        .etiqueta{background:white;border:1px solid #ddd;border-radius:8px;padding:10px;width:200px;text-align:center;page-break-inside:avoid}
        .nombre{font-size:11px;font-weight:700;margin-bottom:6px;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .precio{font-size:16px;font-weight:900;color:#1a56db;margin-top:4px}
        .codigo{font-size:9px;color:#6b7280;margin-top:2px;font-family:monospace}
        @media print{body{background:white}.etiqueta{box-shadow:none}}
      </style></head><body>
      <h2 style="font-size:14px;color:#6b7280;margin-bottom:12px">POS Pro GT - Etiquetas de Codigos de Barras (${lista.length} productos)</h2>
      <div class="grid">${etiquetas}</div>
      </body></html>`

      const { uri } = await Print.printToFileAsync({ html, base64: false })
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Etiquetas de Codigos', UTI: 'com.adobe.pdf' })
      setModoSeleccion(false)
      setSeleccionados([])
    } catch { Alert.alert('Error', 'No se pudo generar el PDF') }
    finally { setGenerando(false) }
  }

  const imprimirEtiquetas = async (lista) => {
    if (lista.length === 0) { Alert.alert('Error', 'Selecciona al menos un producto'); return }
    try {
      setGenerando(true)
      const etiquetas = lista.map(p => {
        const svg = generarBarrasSVG(p.codigo_barras || p.id.toString())
        const svgBase64 = btoa(unescape(encodeURIComponent(svg)))
        return `<div class="etiqueta"><div class="nombre">${p.nombre}</div><img src="data:image/svg+xml;base64,${svgBase64}" width="180" height="70"/><div class="precio">Q${parseFloat(p.precio).toFixed(2)}</div><div class="codigo">${p.codigo_barras || 'Sin codigo'}</div></div>`
      }).join('')
      await Print.printAsync({ html: `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:10px;font-family:Arial}.grid{display:flex;flex-wrap:wrap;gap:8px}.etiqueta{background:white;border:1px solid #ddd;border-radius:8px;padding:10px;width:200px;text-align:center;page-break-inside:avoid}.nombre{font-size:11px;font-weight:700;margin-bottom:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.precio{font-size:16px;font-weight:900;color:#1a56db;margin-top:4px}.codigo{font-size:9px;color:#6b7280;font-family:monospace}</style></head><body><div class="grid">${etiquetas}</div></body></html>` })
    } catch { Alert.alert('Error', 'No se pudo imprimir') }
    finally { setGenerando(false) }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>
      {/* HEADER */}
      <View style={{ backgroundColor: tema.fondoCard, padding: 20, borderBottomWidth: 1, borderColor: tema.borde }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: tema.texto }}>Codigos de Barras</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {modoSeleccion ? (
              <>
                <TouchableOpacity style={{ backgroundColor: tema.fondoSecundario, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: tema.borde }} onPress={() => { setModoSeleccion(false); setSeleccionados([]) }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: tema.textoTerciario }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ backgroundColor: tema.primario, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }} onPress={() => exportarEtiquetas(productos.filter(p => seleccionados.includes(p.id)))} disabled={generando}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>PDF ({seleccionados.length})</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={{ backgroundColor: tema.primario, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }} onPress={() => setModoSeleccion(true)}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>Seleccionar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* STATS */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Total', val: productos.length, color: tema.texto },
            { label: 'Con Codigo', val: productos.filter(p => p.codigo_barras).length, color: tema.success },
            { label: 'Sin Codigo', val: productos.filter(p => !p.codigo_barras).length, color: tema.warning },
          ].map(({ label, val, color }) => (
            <View key={label} style={{ flex: 1, backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color }}>{val}</Text>
              <Text style={{ fontSize: 9, color: tema.textoTerciario, fontWeight: '600' }}>{label}</Text>
            </View>
          ))}
        </View>

        {/* FILTROS */}
        <View style={{ flexDirection: 'row', backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 3, marginBottom: 10 }}>
          {['todos', 'con', 'sin'].map(f => (
            <TouchableOpacity key={f} style={{ flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center', backgroundColor: filtro === f ? tema.primario : 'transparent' }} onPress={() => setFiltro(f)}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: filtro === f ? '#fff' : tema.textoTerciario }}>
                {f === 'todos' ? 'Todos' : f === 'con' ? 'Con Codigo' : 'Sin Codigo'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ACCIONES MASIVAS */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: tema.warning + '20', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: tema.warning }} onPress={asignarTodos}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tema.warning }}>⚡ Asignar Todos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, backgroundColor: tema.success + '20', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: tema.success }} onPress={() => exportarEtiquetas(productos.filter(p => p.codigo_barras))} disabled={generando}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tema.success }}>📄 Exportar Todos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1, backgroundColor: '#7c3aed20', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#7c3aed' }} onPress={() => imprimirEtiquetas(productos.filter(p => p.codigo_barras))} disabled={generando}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#7c3aed' }}>🖨️ Imprimir</Text>
          </TouchableOpacity>
        </View>
      </View>

      {generando && (
        <View style={{ backgroundColor: tema.primario, padding: 10, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Generando PDF...</Text>
        </View>
      )}

      <FlatList
        data={productosFiltrados}
        keyExtractor={p => p.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarProductos() }} tintColor={tema.primario} />}
        renderItem={({ item }) => {
          const seleccionado = seleccionados.includes(item.id)
          return (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: seleccionado ? tema.primario + '15' : tema.fondoCard, marginHorizontal: 12, marginBottom: 6, borderRadius: 12, padding: 12, borderWidth: seleccionado ? 2 : 1, borderColor: seleccionado ? tema.primario : tema.borde }}
              onPress={() => modoSeleccion ? toggleSeleccion(item.id) : setModalOpciones(item)}
              onLongPress={() => { setModoSeleccion(true); toggleSeleccion(item.id) }}
            >
              {modoSeleccion && (
                <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: seleccionado ? tema.primario : tema.borde, backgroundColor: seleccionado ? tema.primario : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  {seleccionado && <Text style={{ color: '#fff', fontSize: 14, fontWeight: '900' }}>✓</Text>}
                </View>
              )}
              <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: tema.fondoSecundario, alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <Text style={{ fontSize: 22 }}>{item.emoji || '📦'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: tema.texto, marginBottom: 2 }}>{item.nombre}</Text>
                {item.codigo_barras ? (
                  <Text style={{ fontSize: 11, fontFamily: 'monospace', color: tema.textoTerciario }}>{item.codigo_barras}</Text>
                ) : (
                  <Text style={{ fontSize: 11, color: tema.warning, fontWeight: '600' }}>Sin codigo de barras</Text>
                )}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: tema.primario }}>Q{parseFloat(item.precio).toFixed(2)}</Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, backgroundColor: item.codigo_barras ? '#d1fae5' : '#fef3c7' }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: item.codigo_barras ? tema.success : tema.warning }}>
                    {item.codigo_barras ? '✓ OK' : '⚠ Sin cod'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )
        }}
      />

      {/* MODAL OPCIONES */}
      <Modal visible={!!modalOpciones} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            {modalOpciones && (
              <>
                <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 4 }}>{modalOpciones.nombre}</Text>
                <Text style={{ fontSize: 13, color: tema.textoTerciario, fontFamily: 'monospace', marginBottom: 16 }}>
                  {modalOpciones.codigo_barras || 'Sin codigo asignado'}
                </Text>
                {[
                  { label: '⚡ Asignar Codigo Nuevo', color: tema.warning, show: true, onPress: () => { setModalOpciones(null); asignarCodigo(modalOpciones) } },
                  { label: '📄 Exportar Etiqueta PDF', color: tema.primario, show: !!modalOpciones.codigo_barras, onPress: () => { setModalOpciones(null); exportarEtiquetas([modalOpciones]) } },
                  { label: '🖨️ Imprimir Etiqueta', color: '#7c3aed', show: !!modalOpciones.codigo_barras, onPress: () => { setModalOpciones(null); imprimirEtiquetas([modalOpciones]) } },
                ].filter(a => a.show).map(({ label, color, onPress }) => (
                  <TouchableOpacity key={label} style={{ backgroundColor: color + '20', borderRadius: 12, padding: 14, marginBottom: 10, alignItems: 'center', borderWidth: 1, borderColor: color }} onPress={onPress}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color }}>{label}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={{ backgroundColor: tema.fondoSecundario, borderRadius: 12, padding: 14, alignItems: 'center' }} onPress={() => setModalOpciones(null)}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: tema.textoTerciario }}>Cancelar</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}