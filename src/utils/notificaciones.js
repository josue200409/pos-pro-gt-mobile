import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import { guardarLocal, leerLocal } from './offline'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export const pedirPermisos = async () => {
  try {
    const { status } = await Notifications.requestPermissionsAsync()
    return status === 'granted'
  } catch {
    return false
  }
}

export const notificarVenta = async (total, metodo) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💰 ¡Venta Registrada!',
        body: `Q${parseFloat(total).toFixed(2)} · ${metodo}`,
        sound: true,
      },
      trigger: null
    })
  } catch (e) { console.log('notif error:', e) }
}

export const notificarStockBajo = async (producto, stock) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚠️ Stock Bajo',
        body: `${producto} solo tiene ${stock} unidades`,
        sound: true,
      },
      trigger: null
    })
  } catch (e) { console.log('notif error:', e) }
}

export const notificarProductoAgotado = async (producto) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚨 Producto Agotado',
        body: `¡${producto} se ha agotado!`,
        sound: true,
      },
      trigger: null
    })
  } catch (e) { console.log('notif error:', e) }
}

export const notificarSincronizacion = async (cantidad) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '☁️ Sincronización Completa',
        body: `${cantidad} ventas subidas al servidor`,
        sound: false,
      },
      trigger: null
    })
  } catch (e) { console.log('notif error:', e) }
}

export const notificarMeta = async (total, meta) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 ¡Meta Alcanzada!',
        body: `¡Alcanzaste Q${parseFloat(total).toFixed(2)} de tu meta de Q${meta}!`,
        sound: true,
      },
      trigger: null
    })
  } catch (e) { console.log('notif error:', e) }
}

export const programarResumenDiario = async (hora = 20, minuto = 0) => {
  try {
    await cancelarResumenDiario()
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '📊 Resumen del Día',
        body: 'Toca para ver tus ventas de hoy',
        sound: true,
      },
      trigger: { hour: hora, minute: minuto, repeats: true }
    })
    await guardarLocal('notif_resumen_id', id)
    return id
  } catch (e) { console.log('notif error:', e) }
}

export const cancelarResumenDiario = async () => {
  try {
    const id = await leerLocal('notif_resumen_id')
    if (id) await Notifications.cancelScheduledNotificationAsync(id)
  } catch (e) {}
}

export const programarAbrirCaja = async (hora = 8, minuto = 0) => {
  try {
    await cancelarAbrirCaja()
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🏦 ¡Buenos días!',
        body: 'No olvides abrir la caja',
        sound: true,
      },
      trigger: { hour: hora, minute: minuto, repeats: true }
    })
    await guardarLocal('notif_caja_id', id)
    return id
  } catch (e) { console.log('notif error:', e) }
}

export const cancelarAbrirCaja = async () => {
  try {
    const id = await leerLocal('notif_caja_id')
    if (id) await Notifications.cancelScheduledNotificationAsync(id)
  } catch (e) {}
}

export const guardarNotificacion = async (notif) => {
  try {
    const historial = await leerLocal('historial_notif') || []
    historial.unshift({
      ...notif,
      id: Date.now(),
      leida: false,
      fecha: new Date().toISOString()
    })
    await guardarLocal('historial_notif', historial.slice(0, 50))
  } catch (e) {}
}

export const obtenerHistorial = async () => {
  return await leerLocal('historial_notif') || []
}

export const marcarTodasLeidas = async () => {
  try {
    const historial = await obtenerHistorial()
    const actualizadas = historial.map(n => ({ ...n, leida: true }))
    await guardarLocal('historial_notif', actualizadas)
  } catch (e) {}
}