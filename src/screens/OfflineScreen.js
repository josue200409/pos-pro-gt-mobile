import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView,
  Alert, FlatList
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Network from 'expo-network'
import { useTema } from '../context/TemaContext'
import { ventasService, productosService } from '../services/api'

export default function OfflineScreen() {
  const { tema } = useTema()
  const [conectado, setConectado] = useState(true)
  const [ventasPendientes, setVentasPendientes] = useState([])
  const [sincronizando, setSincronizando] = useState(false)
  const [ultimaSync, setUltimaSync] = useState(null)
  const [productos, setProductos] = useState([])

  useEffect(() => {
    verificarConexion()
    cargarPendientes()
    cargarProductosCache()
    cargarUltimaSync()
    const intervalo = setInterval(verificarConexion, 10000)
    return () => clearInterval(intervalo)
  }, [])

  const verificarConexion = async () => {
    try {
      const estado = await Network.getNetworkStateAsync()
      setConectado(estado.isConnected && estado.isInternetReachable)
    } catch { setConectado(false) }
  }

  const cargarPendientes = async () => {
    try {
      const data = await AsyncStorage.getItem('ventas_offline')
      setVentasPendientes(data ? JSON.parse(data) : [])
    } catch { setVentasPendientes([]) }
  }

  const cargarProductosCache = async () => {
    try {
      const data = await AsyncStorage.getItem('productos_cache')
      if (data) setProductos(JSON.parse(data))
    } catch {}
  }

  const cargarUltimaSync = async () => {
    try {
      const fecha = await AsyncStorage.getItem('ultima_sincronizacion')
      setUltimaSync(fecha)
    } catch {}
  }

  const guardarCache = async () => {
    try {
      const resp = await productosService.obtenerTodos()
      await AsyncStorage.setItem('productos_cache', JSON.stringify(resp.data))
      const ahora = new Date().toISOString()
      await AsyncStorage.setItem('ultima_sincronizacion', ahora)
      setUltimaSync(ahora)
      setProductos(resp.data)
      Alert.alert('✅ Cache actualizado', `${resp.data.length} productos guardados para uso offline`)
    } catch { Alert.alert('Error', 'No se pudo actualizar el cache') }
  }

  const sincronizarVentas = async () => {
    if (!conectado) { Alert.alert('Sin conexión', 'Necesitas internet para sincronizar'); return }
    if (ventasPendientes.length === 0) { Alert.alert('Info', 'No hay ventas pendientes de sincronizar'); return }
    setSincronizando(true)
    let exitosas = 0
    let fallidas = 0
    const pendientesRestantes = []
    for (const venta of ventasPendientes) {
      try {
        await ventasService.crear(venta)
        exitosas++
      } catch {
        fallidas++
        pendientesRestantes.push(venta)
      }
    }
    await AsyncStorage.setItem('ventas_offline', JSON.stringify(pendientesRestantes))
    setVentasPendientes(pendientesRestantes)
    setSincronizando(false)
    Alert.alert('Sincronización completada', `✅ ${exitosas} ventas subidas\n${fallidas > 0 ? `❌ ${fallidas} fallidas` : ''}`)
  }

  const limpiarPendientes = () => {
    Alert.alert('Eliminar pendientes', `¿Eliminar ${ventasPendientes.length} ventas pendientes? Esta acción no se puede deshacer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await AsyncStorage.setItem('ventas_offline', JSON.stringify([]))
          setVentasPendientes([])
        }
      }
    ])
  }

  const formatFecha = (iso) => {
    if (!iso) return 'Nunca'
    return new Date(iso).toLocaleString('es-GT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>
      <ScrollView>
        {/* ESTADO CONEXION */}
        <View style={{ backgroundColor: conectado ? '#059669' : '#dc2626', padding: 20, margin: 16, borderRadius: 16, alignItems: 'center' }}>
          <Text style={{ fontSize: 48, marginBottom: 8 }}>{conectado ? '🌐' : '📵'}</Text>
          <Text style={{ fontSize: 20, fontWeight: '900', color: '#fff' }}>{conectado ? 'Conectado' : 'Sin Conexión'}</Text>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 4 }}>
            {conectado ? 'El sistema está funcionando normalmente' : 'Trabajando en modo offline'}
          </Text>
          <TouchableOpacity
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, marginTop: 12 }}
            onPress={verificarConexion}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>🔄 Verificar conexión</Text>
          </TouchableOpacity>
        </View>

        {/* VENTAS PENDIENTES */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 10 }}>Ventas Pendientes de Sincronizar</Text>
          <View style={{ backgroundColor: tema.fondoCard, borderRadius: 14, borderWidth: 1, borderColor: tema.borde, overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', padding: 16, borderBottomWidth: 1, borderColor: tema.borde }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '900', color: ventasPendientes.length > 0 ? tema.warning : tema.success }}>
                  {ventasPendientes.length}
                </Text>
                <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 2 }}>Pendientes</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 28, fontWeight: '900', color: tema.primario }}>
                  Q{ventasPendientes.reduce((s, v) => s + parseFloat(v.total || 0), 0).toFixed(2)}
                </Text>
                <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 2 }}>Total</Text>
              </View>
            </View>

            {ventasPendientes.length > 0 && (
              <View style={{ maxHeight: 200 }}>
                {ventasPendientes.slice(0, 5).map((v, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: tema.borde }}>
                    <View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: tema.texto }}>Venta #{i + 1}</Text>
                      <Text style={{ fontSize: 11, color: tema.textoTerciario }}>{v.items?.length || 0} productos • {v.metodo_pago}</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: tema.primario }}>Q{parseFloat(v.total || 0).toFixed(2)}</Text>
                  </View>
                ))}
                {ventasPendientes.length > 5 && (
                  <View style={{ padding: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: tema.textoTerciario }}>+{ventasPendientes.length - 5} más...</Text>
                  </View>
                )}
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, padding: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: conectado ? tema.primario : tema.fondoSecundario, borderRadius: 10, padding: 12, alignItems: 'center', opacity: sincronizando ? 0.6 : 1 }}
                onPress={sincronizarVentas}
                disabled={sincronizando || !conectado}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: conectado ? '#fff' : tema.textoTerciario }}>
                  {sincronizando ? '⏳ Sincronizando...' : '☁️ Sincronizar'}
                </Text>
              </TouchableOpacity>
              {ventasPendientes.length > 0 && (
                <TouchableOpacity
                  style={{ backgroundColor: '#fee2e2', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: tema.danger }}
                  onPress={limpiarPendientes}
                >
                  <Text style={{ fontSize: 13, fontWeight: '700', color: tema.danger }}>🗑️ Limpiar</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* CACHE */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 10 }}>Cache de Productos</Text>
          <View style={{ backgroundColor: tema.fondoCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: tema.borde }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: tema.texto }}>Productos guardados</Text>
                <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 2 }}>
                  Ultima sync: {formatFecha(ultimaSync)}
                </Text>
              </View>
              <View style={{ backgroundColor: tema.fondoSecundario, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: tema.primario }}>{productos.length}</Text>
              </View>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: conectado ? tema.success : tema.fondoSecundario, borderRadius: 10, padding: 12, alignItems: 'center' }}
              onPress={guardarCache}
              disabled={!conectado}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: conectado ? '#fff' : tema.textoTerciario }}>
                {conectado ? '💾 Actualizar Cache' : '⚠️ Sin conexión para actualizar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* INFO */}
        <View style={{ paddingHorizontal: 16, marginBottom: 32 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 10 }}>¿Cómo funciona el modo offline?</Text>
          <View style={{ backgroundColor: tema.fondoCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: tema.borde }}>
            {[
              { emoji: '📵', titulo: 'Sin internet', desc: 'Las ventas se guardan localmente en el dispositivo' },
              { emoji: '💾', titulo: 'Cache de productos', desc: 'Actualiza el cache cuando tengas internet para usarlo offline' },
              { emoji: '☁️', titulo: 'Sincronización', desc: 'Cuando vuelva el internet, sincroniza las ventas pendientes' },
              { emoji: '⚠️', titulo: 'Importante', desc: 'Sincroniza antes de cerrar la app para no perder ventas' },
            ].map(({ emoji, titulo, desc }) => (
              <View key={titulo} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                <Text style={{ fontSize: 24 }}>{emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: tema.texto }}>{titulo}</Text>
                  <Text style={{ fontSize: 12, color: tema.textoTerciario, marginTop: 2 }}>{desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}