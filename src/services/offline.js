import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Network from 'expo-network'

const VENTAS_KEY = 'ventas_offline'
const PRODUCTOS_KEY = 'productos_cache'
const SYNC_KEY = 'ultima_sincronizacion'

// Verificar conexión
export async function hayConexion() {
  try {
    const estado = await Network.getNetworkStateAsync()
    return estado.isConnected && estado.isInternetReachable
  } catch { return false }
}

// Guardar venta offline
export async function guardarVentaOffline(venta) {
  try {
    const data = await AsyncStorage.getItem(VENTAS_KEY)
    const pendientes = data ? JSON.parse(data) : []
    const ventaConId = {
      ...venta,
      offline_id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      offline_timestamp: new Date().toISOString()
    }
    pendientes.push(ventaConId)
    await AsyncStorage.setItem(VENTAS_KEY, JSON.stringify(pendientes))
    return ventaConId
  } catch (e) {
    throw new Error('No se pudo guardar la venta offline: ' + e.message)
  }
}

// Obtener ventas pendientes
export async function obtenerVentasPendientes() {
  try {
    const data = await AsyncStorage.getItem(VENTAS_KEY)
    return data ? JSON.parse(data) : []
  } catch { return [] }
}

// Eliminar venta sincronizada
export async function eliminarVentaSincronizada(offline_id) {
  try {
    const data = await AsyncStorage.getItem(VENTAS_KEY)
    const pendientes = data ? JSON.parse(data) : []
    const restantes = pendientes.filter(v => v.offline_id !== offline_id)
    await AsyncStorage.setItem(VENTAS_KEY, JSON.stringify(restantes))
  } catch {}
}

// Guardar cache de productos
export async function guardarCacheProductos(productos) {
  try {
    await AsyncStorage.setItem(PRODUCTOS_KEY, JSON.stringify(productos))
    await AsyncStorage.setItem(SYNC_KEY, new Date().toISOString())
  } catch {}
}

// Obtener productos del cache
export async function obtenerProductosCache() {
  try {
    const data = await AsyncStorage.getItem(PRODUCTOS_KEY)
    return data ? JSON.parse(data) : []
  } catch { return [] }
}

// Sincronizar ventas pendientes
export async function sincronizarVentas(ventasService) {
  const pendientes = await obtenerVentasPendientes()
  if (pendientes.length === 0) return { exitosas: 0, fallidas: 0 }

  let exitosas = 0
  let fallidas = 0

  for (const venta of pendientes) {
    try {
      const { offline_id, offline_timestamp, ...ventaData } = venta
      await ventasService.crear(ventaData)
      await eliminarVentaSincronizada(offline_id)
      exitosas++
    } catch {
      fallidas++
    }
  }

  return { exitosas, fallidas }
}