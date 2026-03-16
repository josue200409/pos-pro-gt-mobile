import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, TextInput, Alert, Modal
} from 'react-native'
import { cajaService, ventasService } from '../services/api'
import { useTema } from '../context/TemaContext'

export default function CajaScreen() {
  const { tema } = useTema()
  const [datos, setDatos] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [tab, setTab] = useState('resumen') // resumen | gastos | movimientos | historial

  // Modales
  const [modalApertura, setModalApertura] = useState(false)
  const [modalGasto, setModalGasto] = useState(false)
  const [modalCierre, setModalCierre] = useState(false)
  const [modalHistorial, setModalHistorial] = useState(false)

  // Forms
  const [efectivoInicial, setEfectivoInicial] = useState('')
  const [gastoDesc, setGastoDesc] = useState('')
  const [gastoMonto, setGastoMonto] = useState('')
  const [gastoCategoria, setGastoCategoria] = useState('general')
  const [efectivoContado, setEfectivoContado] = useState('')
  const [notasCierre, setNotasCierre] = useState('')
  const [historial, setHistorial] = useState([])

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    try {
      const r = await cajaService.obtenerHoy()
      setDatos(r.data)
    } catch (e) { console.log('Error caja:', e) }
    finally { setCargando(false); setRefreshing(false) }
  }

  const cargarHistorial = async () => {
    try {
      const r = await cajaService.historial()
      setHistorial(r.data)
      setModalHistorial(true)
    } catch (e) { Alert.alert('Error', 'No se pudo cargar el historial') }
  }

  // Calculos
  const ventasPorMetodo = (metodo) => {
    if (!datos?.ventas) return 0
    const v = datos.ventas.find(v => v.metodo_pago === metodo)
    return parseFloat(v?.total || 0)
  }
  const vueltoPorMetodo = () => {
    if (!datos?.ventas) return 0
    const v = datos.ventas.find(v => v.metodo_pago === 'efectivo')
    return parseFloat(v?.vuelto || 0)
  }
  const cantidadPorMetodo = (metodo) => {
    if (!datos?.ventas) return 0
    const v = datos.ventas.find(v => v.metodo_pago === metodo)
    return parseInt(v?.cantidad || 0)
  }

  const totalEfectivo = ventasPorMetodo('efectivo')
  const totalTarjeta = ventasPorMetodo('tarjeta')
  const totalTransferencia = ventasPorMetodo('transferencia')
  const totalVuelto = vueltoPorMetodo()
  const efectivoNeto = totalEfectivo - totalVuelto
  const totalGastos = (datos?.gastos || []).reduce((s, g) => s + parseFloat(g.monto || 0), 0)
  const totalVentas = totalEfectivo + totalTarjeta + totalTransferencia
  const efectivoInCaja = parseFloat(datos?.apertura?.efectivo_inicial || 0) + efectivoNeto - totalGastos
  const cajaCerrada = !!datos?.cierre

  const diferenciaCierre = efectivoContado
    ? parseFloat(efectivoContado) - efectivoInCaja
    : null

  const abrirCaja = async () => {
    try {
      await cajaService.abrir({ efectivo_inicial: parseFloat(efectivoInicial) || 0 })
      setModalApertura(false)
      setEfectivoInicial('')
      cargarDatos()
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'No se pudo abrir la caja')
    }
  }

  const agregarGasto = async () => {
    if (!gastoDesc.trim() || !gastoMonto) { Alert.alert('Error', 'Completa descripción y monto'); return }
    try {
      await cajaService.agregarGasto({ descripcion: gastoDesc, monto: parseFloat(gastoMonto), categoria: gastoCategoria })
      setModalGasto(false)
      setGastoDesc(''); setGastoMonto(''); setGastoCategoria('general')
      cargarDatos()
    } catch (e) { Alert.alert('Error', 'No se pudo registrar el gasto') }
  }

  const eliminarGasto = (id, desc) => {
    Alert.alert('Eliminar gasto', `¿Eliminar "${desc}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await cajaService.eliminarGasto(id)
        cargarDatos()
      }}
    ])
  }

  const cerrarCaja = async () => {
    if (!efectivoContado) { Alert.alert('Error', 'Ingresa el efectivo contado'); return }
    Alert.alert('Cerrar Caja', '¿Confirmas el cierre de caja del día?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar Caja', style: 'destructive', onPress: async () => {
        try {
          await cajaService.cerrar({ efectivo_contado: parseFloat(efectivoContado), notas: notasCierre })
          setModalCierre(false)
          setEfectivoContado(''); setNotasCierre('')
          cargarDatos()
          Alert.alert('✅ Caja cerrada', 'El cierre se guardó correctamente')
        } catch (e) { Alert.alert('Error', e.response?.data?.error || 'No se pudo cerrar la caja') }
      }}
    ])
  }

  const categorias = [
    { id: 'general', label: '📦 General' },
    { id: 'compras', label: '🛒 Compras' },
    { id: 'servicios', label: '🔧 Servicios' },
    { id: 'transporte', label: '🚗 Transporte' },
    { id: 'limpieza', label: '🧹 Limpieza' },
    { id: 'otros', label: '📝 Otros' },
  ]

  const categoriaEmoji = (c) => categorias.find(x => x.id === c)?.label.split(' ')[0] || '📦'

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>

      {/* HEADER */}
      <View style={{ backgroundColor: tema.fondoCard, padding: 20, borderBottomWidth: 1, borderColor: tema.borde }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: '900', color: tema.texto }}>💰 Caja</Text>
            <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 2 }}>
              {new Date().toLocaleDateString('es-GT', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={{ backgroundColor: tema.fondoSecundario, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: tema.borde }}
              onPress={cargarHistorial}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoSecundario }}>📋 Historial</Text>
            </TouchableOpacity>
            {!datos?.apertura && !cajaCerrada && (
              <TouchableOpacity
                style={{ backgroundColor: tema.success, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
                onPress={() => setModalApertura(true)}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>🔓 Abrir Caja</Text>
              </TouchableOpacity>
            )}
            {datos?.apertura && !cajaCerrada && (
              <TouchableOpacity
                style={{ backgroundColor: tema.danger, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
                onPress={() => setModalCierre(true)}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>🔒 Cerrar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Estado de caja */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <View style={{
            flex: 1, borderRadius: 10, padding: 10, alignItems: 'center',
            backgroundColor: cajaCerrada ? '#fee2e2' : datos?.apertura ? '#d1fae5' : '#fef3c7'
          }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: cajaCerrada ? tema.danger : datos?.apertura ? tema.success : tema.warning }}>
              {cajaCerrada ? '🔒 CERRADA' : datos?.apertura ? '🟢 ABIERTA' : '⚪ SIN APERTURA'}
            </Text>
            {datos?.apertura && (
              <Text style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                Inicio: Q{parseFloat(datos.apertura.efectivo_inicial).toFixed(2)}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* TABS */}
      <View style={{ flexDirection: 'row', backgroundColor: tema.fondoCard, borderBottomWidth: 1, borderColor: tema.borde }}>
        {[
          { id: 'resumen', label: '📊 Resumen' },
          { id: 'gastos', label: `💸 Gastos (${(datos?.gastos || []).length})` },
          { id: 'movimientos', label: '🧾 Ventas' },
        ].map(t => (
          <TouchableOpacity
            key={t.id}
            style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderColor: tab === t.id ? tema.primario : 'transparent' }}
            onPress={() => setTab(t.id)}
          >
            <Text style={{ fontSize: 11, fontWeight: '700', color: tab === t.id ? tema.primario : tema.textoTerciario }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarDatos() }} tintColor={tema.primario} />}>

        {/* TAB RESUMEN */}
        {tab === 'resumen' && (
          <View style={{ padding: 16 }}>

            {/* Total del día */}
            <View style={{ backgroundColor: tema.primario, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '700', marginBottom: 4 }}>TOTAL VENTAS DEL DÍA</Text>
              <Text style={{ fontSize: 40, fontWeight: '900', color: '#fff' }}>Q{totalVentas.toFixed(2)}</Text>
              <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{cantidadPorMetodo('efectivo') + cantidadPorMetodo('tarjeta') + cantidadPorMetodo('transferencia')} ventas</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>Gastos: Q{totalGastos.toFixed(2)}</Text>
              </View>
            </View>

            {/* Tarjetas por método */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Efectivo', val: totalEfectivo, cant: cantidadPorMetodo('efectivo'), emoji: '💵', color: tema.success },
                { label: 'Tarjeta', val: totalTarjeta, cant: cantidadPorMetodo('tarjeta'), emoji: '💳', color: tema.primario },
                { label: 'Transfer', val: totalTransferencia, cant: cantidadPorMetodo('transferencia'), emoji: '📱', color: '#7c3aed' },
              ].map(({ label, val, cant, emoji, color }) => (
                <View key={label} style={{ flex: 1, backgroundColor: tema.fondoCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>{emoji}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '900', color }}>{val > 0 ? `Q${val.toFixed(0)}` : 'Q0'}</Text>
                  <Text style={{ fontSize: 9, color: tema.textoTerciario, fontWeight: '600' }}>{label}</Text>
                  <Text style={{ fontSize: 9, color: tema.textoTerciario }}>{cant} ventas</Text>
                </View>
              ))}
            </View>

            {/* Desglose efectivo */}
            <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 8 }}>Desglose de Efectivo</Text>
            <View style={{ backgroundColor: tema.fondoCard, borderRadius: 14, borderWidth: 1, borderColor: tema.borde, overflow: 'hidden', marginBottom: 16 }}>
              {[
                { label: '🔓 Efectivo inicial', val: parseFloat(datos?.apertura?.efectivo_inicial || 0), color: tema.textoSecundario },
                { label: '💵 Ventas efectivo', val: totalEfectivo, color: tema.success },
                { label: '🔄 Vuelto entregado', val: -totalVuelto, color: tema.danger },
                { label: '💸 Gastos del día', val: -totalGastos, color: tema.warning },
              ].map(({ label, val, color }) => (
                <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: tema.borde }}>
                  <Text style={{ fontSize: 13, color: tema.textoSecundario }}>{label}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color }}>{val < 0 ? `-Q${Math.abs(val).toFixed(2)}` : `Q${val.toFixed(2)}`}</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, backgroundColor: tema.success + '15' }}>
                <Text style={{ fontSize: 15, fontWeight: '900', color: tema.texto }}>💰 Efectivo en Caja</Text>
                <Text style={{ fontSize: 20, fontWeight: '900', color: tema.success }}>Q{efectivoInCaja.toFixed(2)}</Text>
              </View>
            </View>

            {/* Cuadre rápido */}
            {cajaCerrada && datos?.cierre ? (
              <View style={{ backgroundColor: datos.cierre.diferencia === 0 ? '#d1fae5' : datos.cierre.diferencia > 0 ? '#e8f0fe' : '#fee2e2', borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: tema.texto, marginBottom: 8 }}>🔒 Resumen del Cierre</Text>
                {[
                  { label: 'Efectivo esperado', val: `Q${parseFloat(datos.cierre.efectivo_esperado).toFixed(2)}` },
                  { label: 'Efectivo contado', val: `Q${parseFloat(datos.cierre.efectivo_contado).toFixed(2)}` },
                  { label: datos.cierre.diferencia >= 0 ? '📈 Sobrante' : '📉 Faltante', val: `Q${Math.abs(parseFloat(datos.cierre.diferencia)).toFixed(2)}`, bold: true },
                ].map(({ label, val, bold }) => (
                  <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, color: tema.textoSecundario }}>{label}</Text>
                    <Text style={{ fontSize: 13, fontWeight: bold ? '900' : '600', color: tema.texto }}>{val}</Text>
                  </View>
                ))}
                {datos.cierre.notas ? <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 8 }}>📝 {datos.cierre.notas}</Text> : null}
              </View>
            ) : datos?.apertura ? (
              <TouchableOpacity
                style={{ backgroundColor: tema.fondoCard, borderRadius: 14, padding: 16, borderWidth: 2, borderColor: tema.primario, borderStyle: 'dashed', alignItems: 'center', marginBottom: 16 }}
                onPress={() => setModalCierre(true)}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: tema.primario }}>🔒 Realizar Cierre de Caja</Text>
                <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 4 }}>Cuenta el efectivo y cierra el día</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={{ backgroundColor: tema.fondoCard, borderRadius: 14, padding: 16, borderWidth: 2, borderColor: tema.success, borderStyle: 'dashed', alignItems: 'center', marginBottom: 16 }}
                onPress={() => setModalApertura(true)}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: tema.success }}>🔓 Abrir Caja del Día</Text>
                <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 4 }}>Registra el efectivo inicial</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* TAB GASTOS */}
        {tab === 'gastos' && (
          <View style={{ padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: tema.textoSecundario }}>
                Total gastos: <Text style={{ color: tema.danger }}>Q{totalGastos.toFixed(2)}</Text>
              </Text>
              {!cajaCerrada && (
                <TouchableOpacity
                  style={{ backgroundColor: tema.danger, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
                  onPress={() => setModalGasto(true)}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>+ Gasto</Text>
                </TouchableOpacity>
              )}
            </View>

            {(datos?.gastos || []).length === 0 ? (
              <View style={{ alignItems: 'center', padding: 48 }}>
                <Text style={{ fontSize: 48, marginBottom: 8 }}>💸</Text>
                <Text style={{ fontSize: 14, color: tema.textoTerciario }}>Sin gastos registrados hoy</Text>
                {!cajaCerrada && (
                  <TouchableOpacity
                    style={{ backgroundColor: tema.danger, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10, marginTop: 16 }}
                    onPress={() => setModalGasto(true)}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Registrar gasto</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (datos?.gastos || []).map(g => (
              <View key={g.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.fondoCard, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: tema.borde }}>
                <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Text style={{ fontSize: 18 }}>{categoriaEmoji(g.categoria)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: tema.texto }}>{g.descripcion}</Text>
                  <Text style={{ fontSize: 11, color: tema.textoTerciario, textTransform: 'capitalize' }}>{g.categoria}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: tema.danger }}>-Q{parseFloat(g.monto).toFixed(2)}</Text>
                  {!cajaCerrada && (
                    <TouchableOpacity onPress={() => eliminarGasto(g.id, g.descripcion)}>
                      <Text style={{ fontSize: 10, color: tema.danger }}>Eliminar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* TAB MOVIMIENTOS */}
        {tab === 'movimientos' && (
          <View style={{ padding: 16 }}>
            {(datos?.ventas || []).length === 0 ? (
              <View style={{ alignItems: 'center', padding: 48 }}>
                <Text style={{ fontSize: 48, marginBottom: 8 }}>🧾</Text>
                <Text style={{ fontSize: 14, color: tema.textoTerciario }}>Sin ventas hoy</Text>
              </View>
            ) : (datos?.ventas || []).map((v, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.fondoCard, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: tema.borde }}>
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: v.metodo_pago === 'efectivo' ? '#d1fae5' : v.metodo_pago === 'tarjeta' ? '#e8f0fe' : '#ede9fe', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <Text style={{ fontSize: 20 }}>{v.metodo_pago === 'efectivo' ? '💵' : v.metodo_pago === 'tarjeta' ? '💳' : '📱'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: tema.texto, textTransform: 'capitalize' }}>{v.metodo_pago}</Text>
                  <Text style={{ fontSize: 11, color: tema.textoTerciario }}>{v.cantidad} venta{v.cantidad > 1 ? 's' : ''}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: v.metodo_pago === 'efectivo' ? tema.success : v.metodo_pago === 'tarjeta' ? tema.primario : '#7c3aed' }}>Q{parseFloat(v.total).toFixed(2)}</Text>
                  {v.metodo_pago === 'efectivo' && parseFloat(v.vuelto) > 0 && (
                    <Text style={{ fontSize: 10, color: tema.warning }}>Vuelto: -Q{parseFloat(v.vuelto).toFixed(2)}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* MODAL APERTURA */}
      <Modal visible={modalApertura} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: tema.texto, marginBottom: 4 }}>🔓 Apertura de Caja</Text>
            <Text style={{ fontSize: 13, color: tema.textoTerciario, marginBottom: 20 }}>¿Cuánto efectivo hay en caja al inicio del día?</Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 8 }}>Efectivo Inicial</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 12, padding: 16, fontSize: 28, fontWeight: '900', textAlign: 'center', backgroundColor: tema.fondoInput, color: tema.texto, marginBottom: 20 }}
              placeholder="Q0.00"
              placeholderTextColor={tema.textoTerciario}
              value={efectivoInicial}
              onChangeText={setEfectivoInicial}
              keyboardType="numeric"
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }} onPress={() => { setModalApertura(false); setEfectivoInicial('') }}>
                <Text style={{ color: tema.textoTerciario, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: tema.success, alignItems: 'center' }} onPress={abrirCaja}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>🔓 Abrir Caja</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL GASTO */}
      <Modal visible={modalGasto} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '900', color: tema.texto, marginBottom: 20 }}>💸 Registrar Gasto</Text>

            <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 6 }}>Descripción</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 15, backgroundColor: tema.fondoInput, color: tema.texto, marginBottom: 12 }}
              placeholder="Ej: Compra de bolsas"
              placeholderTextColor={tema.textoTerciario}
              value={gastoDesc}
              onChangeText={setGastoDesc}
              autoFocus
            />

            <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 6 }}>Monto (Q)</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 22, fontWeight: '700', textAlign: 'center', backgroundColor: tema.fondoInput, color: tema.texto, marginBottom: 12 }}
              placeholder="0.00"
              placeholderTextColor={tema.textoTerciario}
              value={gastoMonto}
              onChangeText={setGastoMonto}
              keyboardType="numeric"
            />

            <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 8 }}>Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {categorias.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={{ backgroundColor: gastoCategoria === c.id ? tema.primario : tema.fondoSecundario, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: gastoCategoria === c.id ? tema.primario : tema.borde }}
                    onPress={() => setGastoCategoria(c.id)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: gastoCategoria === c.id ? '#fff' : tema.textoSecundario }}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }} onPress={() => { setModalGasto(false); setGastoDesc(''); setGastoMonto('') }}>
                <Text style={{ color: tema.textoTerciario, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: tema.danger, alignItems: 'center' }} onPress={agregarGasto}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>💸 Registrar Gasto</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL CIERRE */}
      <Modal visible={modalCierre} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, marginTop: 100 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: tema.texto, marginBottom: 4 }}>🔒 Cierre de Caja</Text>
              <Text style={{ fontSize: 13, color: tema.textoTerciario, marginBottom: 20 }}>Cuenta el efectivo físico en caja</Text>

              {/* Resumen */}
              <View style={{ backgroundColor: tema.fondoSecundario, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: tema.borde }}>
                {[
                  { label: 'Efectivo inicial', val: `Q${parseFloat(datos?.apertura?.efectivo_inicial || 0).toFixed(2)}` },
                  { label: 'Ventas efectivo', val: `Q${totalEfectivo.toFixed(2)}` },
                  { label: 'Vuelto entregado', val: `-Q${totalVuelto.toFixed(2)}` },
                  { label: 'Gastos del día', val: `-Q${totalGastos.toFixed(2)}` },
                ].map(({ label, val }) => (
                  <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 12, color: tema.textoTerciario }}>{label}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: tema.texto }}>{val}</Text>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: tema.borde, paddingTop: 8, marginTop: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: tema.texto }}>Esperado en caja</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: tema.success }}>Q{efectivoInCaja.toFixed(2)}</Text>
                </View>
              </View>

              <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 6 }}>Efectivo Contado Físicamente</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 12, padding: 16, fontSize: 28, fontWeight: '900', textAlign: 'center', backgroundColor: tema.fondoInput, color: tema.texto, marginBottom: 12 }}
                placeholder="Q0.00"
                placeholderTextColor={tema.textoTerciario}
                value={efectivoContado}
                onChangeText={setEfectivoContado}
                keyboardType="numeric"
                autoFocus
              />

              {diferenciaCierre !== null && (
                <View style={{
                  borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 12,
                  backgroundColor: diferenciaCierre === 0 ? '#d1fae5' : diferenciaCierre > 0 ? '#e8f0fe' : '#fee2e2'
                }}>
                  <Text style={{ fontSize: 22, marginBottom: 4 }}>
                    {diferenciaCierre === 0 ? '✅' : diferenciaCierre > 0 ? '📈' : '📉'}
                  </Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: diferenciaCierre === 0 ? tema.success : diferenciaCierre > 0 ? tema.primario : tema.danger }}>
                    {diferenciaCierre === 0 ? 'CAJA CUADRADA' : diferenciaCierre > 0 ? `SOBRANTE: Q${diferenciaCierre.toFixed(2)}` : `FALTANTE: Q${Math.abs(diferenciaCierre).toFixed(2)}`}
                  </Text>
                </View>
              )}

              <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 6 }}>Notas (opcional)</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: tema.fondoInput, color: tema.texto, marginBottom: 20, minHeight: 60 }}
                placeholder="Observaciones del cierre..."
                placeholderTextColor={tema.textoTerciario}
                value={notasCierre}
                onChangeText={setNotasCierre}
                multiline
              />

              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }} onPress={() => { setModalCierre(false); setEfectivoContado('') }}>
                  <Text style={{ color: tema.textoTerciario, fontWeight: '600' }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: tema.danger, alignItems: 'center' }} onPress={cerrarCaja}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 15 }}>🔒 Cerrar Caja</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL HISTORIAL */}
      <Modal visible={modalHistorial} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: tema.texto }}>📋 Historial de Cierres</Text>
              <TouchableOpacity onPress={() => setModalHistorial(false)}>
                <Text style={{ fontSize: 16, color: tema.textoTerciario, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {historial.length === 0 ? (
                <View style={{ alignItems: 'center', padding: 32 }}>
                  <Text style={{ fontSize: 40, marginBottom: 8 }}>📋</Text>
                  <Text style={{ color: tema.textoTerciario }}>Sin cierres registrados</Text>
                </View>
              ) : historial.map(c => (
                <View key={c.id} style={{ backgroundColor: tema.fondoSecundario, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: tema.borde }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: tema.texto }}>
                      {new Date(c.fecha).toLocaleDateString('es-GT', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </Text>
                    <View style={{ backgroundColor: parseFloat(c.diferencia) === 0 ? '#d1fae5' : parseFloat(c.diferencia) > 0 ? '#e8f0fe' : '#fee2e2', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, fontWeight: '900', color: parseFloat(c.diferencia) === 0 ? tema.success : parseFloat(c.diferencia) > 0 ? tema.primario : tema.danger }}>
                        {parseFloat(c.diferencia) === 0 ? '✅ Cuadrada' : parseFloat(c.diferencia) > 0 ? `+Q${parseFloat(c.diferencia).toFixed(2)}` : `-Q${Math.abs(parseFloat(c.diferencia)).toFixed(2)}`}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: tema.textoTerciario }}>Ventas: Q{parseFloat(c.total_ventas).toFixed(2)}</Text>
                    <Text style={{ fontSize: 12, color: tema.textoTerciario }}>Gastos: Q{parseFloat(c.total_gastos).toFixed(2)}</Text>
                    <Text style={{ fontSize: 12, color: tema.success, fontWeight: '700' }}>Efectivo: Q{parseFloat(c.efectivo_contado).toFixed(2)}</Text>
                  </View>
                  {c.notas ? <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 4 }}>📝 {c.notas}</Text> : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  )
}