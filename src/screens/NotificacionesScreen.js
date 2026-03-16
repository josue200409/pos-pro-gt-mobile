import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, Alert
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { productosService, ventasService } from '../services/api'
import { useTema } from '../context/TemaContext'

const TIPOS = {
  stock_agotado: { emoji: '🚨', color: '#dc2626', bg: '#fee2e2', label: 'Agotado' },
  stock_bajo: { emoji: '⚠️', color: '#d97706', bg: '#fef3c7', label: 'Stock Bajo' },
  venta_alta: { emoji: '🔥', color: '#059669', bg: '#d1fae5', label: 'Venta Alta' },
  info: { emoji: '💡', color: '#1a56db', bg: '#e8f0fe', label: 'Info' },
  exito: { emoji: '✅', color: '#059669', bg: '#d1fae5', label: 'Éxito' },
}

export default function NotificacionesScreen() {
  const { tema } = useTema()
  const [notificaciones, setNotificaciones] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [noLeidas, setNoLeidas] = useState(0)

  useEffect(() => {
    cargarNotificaciones()
    generarNotificacionesAutomaticas()
  }, [])

  const cargarNotificaciones = async () => {
    try {
      const data = await AsyncStorage.getItem('notificaciones')
      const lista = data ? JSON.parse(data) : []
      setNotificaciones(lista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)))
      setNoLeidas(lista.filter(n => !n.leida).length)
    } catch { setNotificaciones([]) }
    finally { setRefreshing(false) }
  }

  const generarNotificacionesAutomaticas = async () => {
    try {
      const [respProductos, respVentas] = await Promise.all([
        productosService.obtenerTodos(),
        ventasService.resumenHoy()
      ])

      const nuevas = []
      const ahora = new Date().toISOString()

      // Stock agotado
      const agotados = respProductos.data.filter(p => p.stock === 0)
      agotados.forEach(p => {
        nuevas.push({
          id: `agotado_${p.id}_${new Date().toDateString()}`,
          tipo: 'stock_agotado',
          titulo: `${p.emoji || '📦'} ${p.nombre} agotado`,
          descripcion: 'Este producto no tiene stock disponible. Reabastece pronto.',
          fecha: ahora,
          leida: false,
          accion: 'inventario'
        })
      })

      // Stock bajo
      const bajos = respProductos.data.filter(p => p.stock > 0 && p.stock <= p.stock_minimo)
      bajos.forEach(p => {
        nuevas.push({
          id: `bajo_${p.id}_${new Date().toDateString()}`,
          tipo: 'stock_bajo',
          titulo: `${p.emoji || '📦'} ${p.nombre} con stock bajo`,
          descripcion: `Solo quedan ${p.stock} unidades (mínimo: ${p.stock_minimo})`,
          fecha: ahora,
          leida: false,
          accion: 'inventario'
        })
      })

      // Ventas del día
      const totalVentas = parseFloat(respVentas.data?.total_ventas || 0)
      if (totalVentas > 1000) {
        nuevas.push({
          id: `venta_alta_${new Date().toDateString()}`,
          tipo: 'venta_alta',
          titulo: '🔥 Excelente día de ventas',
          descripcion: `Has vendido Q${totalVentas.toFixed(2)} hoy. ¡Sigue así!`,
          fecha: ahora,
          leida: false,
          accion: 'ventas'
        })
      }

      if (nuevas.length === 0) return

      // Filtrar duplicados por ID
      const existentes = await AsyncStorage.getItem('notificaciones')
      const lista = existentes ? JSON.parse(existentes) : []
      const idsExistentes = new Set(lista.map(n => n.id))
      const sinDuplicados = nuevas.filter(n => !idsExistentes.has(n.id))

      if (sinDuplicados.length > 0) {
        const nueva = [...sinDuplicados, ...lista].slice(0, 50)
        await AsyncStorage.setItem('notificaciones', JSON.stringify(nueva))
        setNotificaciones(nueva.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)))
        setNoLeidas(nueva.filter(n => !n.leida).length)
      }
    } catch (e) { console.log('Error generando notificaciones:', e) }
  }

  const marcarLeida = async (id) => {
    const nuevas = notificaciones.map(n => n.id === id ? { ...n, leida: true } : n)
    setNotificaciones(nuevas)
    setNoLeidas(nuevas.filter(n => !n.leida).length)
    await AsyncStorage.setItem('notificaciones', JSON.stringify(nuevas))
  }

  const marcarTodasLeidas = async () => {
    const nuevas = notificaciones.map(n => ({ ...n, leida: true }))
    setNotificaciones(nuevas)
    setNoLeidas(0)
    await AsyncStorage.setItem('notificaciones', JSON.stringify(nuevas))
  }

  const eliminarNotificacion = async (id) => {
    const nuevas = notificaciones.filter(n => n.id !== id)
    setNotificaciones(nuevas)
    setNoLeidas(nuevas.filter(n => !n.leida).length)
    await AsyncStorage.setItem('notificaciones', JSON.stringify(nuevas))
  }

  const limpiarTodas = () => {
    Alert.alert('Limpiar notificaciones', '¿Eliminar todas las notificaciones?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await AsyncStorage.setItem('notificaciones', JSON.stringify([]))
          setNotificaciones([])
          setNoLeidas(0)
        }
      }
    ])
  }

  const formatFecha = (iso) => {
    if (!iso) return ''
    const fecha = new Date(iso)
    const ahora = new Date()
    const diff = ahora - fecha
    const mins = Math.floor(diff / 60000)
    const horas = Math.floor(diff / 3600000)
    const dias = Math.floor(diff / 86400000)
    if (mins < 1) return 'Ahora'
    if (mins < 60) return `Hace ${mins} min`
    if (horas < 24) return `Hace ${horas}h`
    if (dias === 1) return 'Ayer'
    return fecha.toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })
  }

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>
      {/* RESUMEN */}
      <View style={{ backgroundColor: tema.fondoCard, padding: 16, borderBottomWidth: 1, borderColor: tema.borde }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: noLeidas > 0 ? tema.danger : tema.success }}>{noLeidas}</Text>
              <Text style={{ fontSize: 10, color: tema.textoTerciario, fontWeight: '600' }}>No leídas</Text>
            </View>
            <View style={{ width: 1, backgroundColor: tema.borde }} />
            <View style={{ alignItems: 'center' }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: tema.primario }}>{notificaciones.length}</Text>
              <Text style={{ fontSize: 10, color: tema.textoTerciario, fontWeight: '600' }}>Total</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {noLeidas > 0 && (
              <TouchableOpacity
                style={{ backgroundColor: tema.primario + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: tema.primario }}
                onPress={marcarTodasLeidas}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: tema.primario }}>✓ Leer todas</Text>
              </TouchableOpacity>
            )}
            {notificaciones.length > 0 && (
              <TouchableOpacity
                style={{ backgroundColor: '#fee2e2', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: tema.danger }}
                onPress={limpiarTodas}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: tema.danger }}>🗑️ Limpiar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarNotificaciones(); generarNotificacionesAutomaticas() }} tintColor={tema.primario} />}>
        {notificaciones.length === 0 ? (
          <View style={{ alignItems: 'center', padding: 60 }}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>🔔</Text>
            <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 8 }}>Sin notificaciones</Text>
            <Text style={{ fontSize: 14, color: tema.textoTerciario, textAlign: 'center' }}>Las alertas de stock y ventas apareceran aqui automaticamente</Text>
          </View>
        ) : (
          <View style={{ padding: 12 }}>
            {notificaciones.map(n => {
              const tipo = TIPOS[n.tipo] || TIPOS.info
              return (
                <TouchableOpacity
                  key={n.id}
                  style={{
                    flexDirection: 'row', backgroundColor: n.leida ? tema.fondoCard : tipo.bg,
                    borderRadius: 14, padding: 14, marginBottom: 8,
                    borderWidth: 1, borderColor: n.leida ? tema.borde : tipo.color + '40',
                    opacity: n.leida ? 0.8 : 1
                  }}
                  onPress={() => marcarLeida(n.id)}
                >
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: tipo.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: tipo.color + '30' }}>
                    <Text style={{ fontSize: 22 }}>{tipo.emoji}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: n.leida ? '600' : '800', color: tema.texto, flex: 1, marginRight: 8 }} numberOfLines={2}>{n.titulo}</Text>
                      {!n.leida && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tipo.color, marginTop: 4 }} />}
                    </View>
                    <Text style={{ fontSize: 12, color: tema.textoTerciario, lineHeight: 16 }} numberOfLines={2}>{n.descripcion}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                      <View style={{ backgroundColor: tipo.color + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: tipo.color }}>{tipo.label}</Text>
                      </View>
                      <Text style={{ fontSize: 11, color: tema.textoTerciario }}>{formatFecha(n.fecha)}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={{ padding: 4, marginLeft: 8 }}
                    onPress={() => eliminarNotificacion(n.id)}
                  >
                    <Text style={{ fontSize: 16, color: tema.textoTerciario }}>✕</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              )
            })}
          </View>
        )}
      </ScrollView>
    </View>
  )
}