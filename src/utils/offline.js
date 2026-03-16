import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Network from 'expo-network'

// ==========================================
// VERIFICAR CONEXIÓN
// ==========================================
export const estaConectado = async () => {
  try {
    const state = await Network.getNetworkStateAsync()
    return state.isConnected && state.isInternetReachable
  } catch {
    return false
  }
}

// ==========================================
// GUARDAR DATOS LOCALMENTE
// ==========================================
export const guardarLocal = async (clave, datos) => {
  try {
    await AsyncStorage.setItem(clave, JSON.stringify(datos))
    return true
  } catch {
    return false
  }
}

export const leerLocal = async (clave) => {
  try {
    const datos = await AsyncStorage.getItem(clave)
    return datos ? JSON.parse(datos) : null
  } catch {
    return null
  }
}

export const eliminarLocal = async (clave) => {
  try {
    await AsyncStorage.removeItem(clave)
    return true
  } catch {
    return false
  }
}

// ==========================================
// COLA DE VENTAS PENDIENTES
// ==========================================
export const agregarVentaPendiente = async (venta) => {
  try {
    const pendientes = await leerLocal('ventas_pendientes') || []
    const nuevaVenta = {
      ...venta,
      id_temp: 'temp_' + Date.now(),
      created_at: new Date().toISOString(),
      pendiente: true
    }
    pendientes.push(nuevaVenta)
    await guardarLocal('ventas_pendientes', pendientes)
    return nuevaVenta
  } catch {
    return null
  }
}

export const obtenerVentasPendientes = async () => {
  return await leerLocal('ventas_pendientes') || []
}

export const limpiarVentasPendientes = async () => {
  await eliminarLocal('ventas_pendientes')
}

export const contarVentasPendientes = async () => {
  const pendientes = await leerLocal('ventas_pendientes') || []
  return pendientes.length
}

// ==========================================
// CACHE DE PRODUCTOS
// ==========================================
export const cachearProductos = async (productos) => {
  await guardarLocal('cache_productos', {
    datos: productos,
    timestamp: Date.now()
  })
}

export const obtenerProductosCacheados = async () => {
  const cache = await leerLocal('cache_productos')
  if (!cache) return null
  // Cache válido por 24 horas
  const veinticuatroHoras = 24 * 60 * 60 * 1000
  if (Date.now() - cache.timestamp > veinticuatroHoras) return null
  return cache.datos
}

// ==========================================
// SINCRONIZAR CON SERVIDOR
// ==========================================
export const sincronizar = async (ventasService) => {
  const conectado = await estaConectado()
  if (!conectado) return { exito: false, mensaje: 'Sin conexión' }

  const pendientes = await obtenerVentasPendientes()
  if (pendientes.length === 0) return { exito: true, sincronizadas: 0 }

  let sincronizadas = 0
  let errores = 0

  for (const venta of pendientes) {
    try {
      const { id_temp, pendiente, ...ventaLimpia } = venta
      await ventasService.registrar(ventaLimpia)
      sincronizadas++
    } catch {
      errores++
    }
  }

  if (sincronizadas > 0) {
    await limpiarVentasPendientes()
  }

  return {
    exito: errores === 0,
    sincronizadas,
    errores,
    mensaje: `${sincronizadas} ventas sincronizadas${errores > 0 ? `, ${errores} errores` : ''}`
  }
}