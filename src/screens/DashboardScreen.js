import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, RefreshControl
} from 'react-native'
import { ventasService, productosService } from '../services/api'
import { useTema } from '../context/TemaContext'

export default function DashboardScreen() {
  const { tema } = useTema()
  const [resumenHoy, setResumenHoy] = useState(null)
  const [productos, setProductos] = useState([])
  const [historial, setHistorial] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [vista, setVista] = useState('hoy')

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    try {
      const hoy = new Date()
      const hace30 = new Date(hoy - 30 * 24 * 60 * 60 * 1000)
      const desde = hace30.toISOString().split('T')[0]
      const hasta = hoy.toISOString().split('T')[0]

      const [resHoy, prods, hist] = await Promise.all([
        ventasService.resumenHoy(),
        productosService.obtenerTodos(),
        ventasService.resumenRango(desde, hasta)
      ])
      setResumenHoy(resHoy.data)
      setProductos(prods.data)
      setHistorial(hist.data)
    } catch (error) {
      console.log('Error:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const stockBajo = productos.filter(p => p.stock <= p.stock_minimo && p.stock > 0)
  const agotados = productos.filter(p => p.stock === 0)
  const totalGlobal = historial.reduce((s, d) => s + parseFloat(d.total || 0), 0)
  const totalTxGlobal = historial.reduce((s, d) => s + parseInt(d.transacciones || 0), 0)

  const maxVenta = historial.length > 0
    ? Math.max(...historial.map(d => parseFloat(d.total || 0)))
    : 1

  const formatFecha = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' })
  }

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: tema.fondo },
    header: { backgroundColor: tema.fondoCard, padding: 20, paddingTop: 48, borderBottomWidth: 1, borderColor: tema.borde },
    titulo: { fontSize: 22, fontWeight: '900', color: tema.texto },
    tabs: { flexDirection: 'row', backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 3, marginTop: 12 },
    tab: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
    tabActivo: { backgroundColor: tema.primario },
    tabTexto: { fontSize: 13, fontWeight: '600', color: tema.textoTerciario },
    tabTextoActivo: { color: '#fff' },
    seccion: { paddingHorizontal: 16, marginBottom: 16 },
    seccionTitulo: { fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 10, marginTop: 16 },
    grid: { flexDirection: 'row', gap: 10 },
    statCard: { flex: 1, backgroundColor: tema.fondoCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: tema.borde },
    statVal: { fontSize: 20, fontWeight: '900', color: tema.primario },
    statLabel: { fontSize: 11, color: tema.textoTerciario, marginTop: 2 },
    alertaCard: { backgroundColor: tema.fondoCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: tema.borde, marginBottom: 8 },
    alertaTitulo: { fontSize: 13, fontWeight: '700', color: tema.texto, marginBottom: 8 },
    alertaItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: tema.borde },
    alertaNombre: { fontSize: 13, color: tema.textoSecundario },
    alertaStock: { fontSize: 13, fontWeight: '700' },
    graficaBar: { flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 4, paddingBottom: 4 },
    barra: { flex: 1, borderRadius: 4, minHeight: 4 },
    histRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: tema.fondoCard, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: tema.borde },
    histFecha: { fontSize: 13, fontWeight: '700', color: tema.texto, textTransform: 'capitalize' },
    histTx: { fontSize: 11, color: tema.textoTerciario, marginTop: 2 },
    histTotal: { fontSize: 15, fontWeight: '900', color: tema.primario },
    vacio: { alignItems: 'center', padding: 24 },
    vacioTexto: { fontSize: 14, color: tema.textoTerciario },
    resumenGlobal: { backgroundColor: tema.primario, borderRadius: 16, padding: 20, marginBottom: 16 },
    resumenGlobalTitulo: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '700', marginBottom: 12 },
    resumenGlobalGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    resumenGlobalItem: { alignItems: 'center' },
    resumenGlobalVal: { fontSize: 18, fontWeight: '900', color: '#fff' },
    resumenGlobalLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  })

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.titulo}>Dashboard</Text>
        <View style={s.tabs}>
          {['hoy', 'global'].map(v => (
            <TouchableOpacity
              key={v}
              style={[s.tab, vista === v && s.tabActivo]}
              onPress={() => setVista(v)}
            >
              <Text style={[s.tabTexto, vista === v && s.tabTextoActivo]}>
                {v === 'hoy' ? '📅 Hoy' : '📊 Global'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarDatos() }} tintColor={tema.primario} />}
      >
        {vista === 'hoy' ? (
          <View style={{ padding: 16 }}>
            {/* STATS HOY */}
            <Text style={s.seccionTitulo}>Resumen de Hoy</Text>
            <View style={s.grid}>
              <View style={s.statCard}>
                <Text style={s.statVal}>Q{parseFloat(resumenHoy?.total_ventas || 0).toFixed(2)}</Text>
                <Text style={s.statLabel}>Total Ventas</Text>
              </View>
              <View style={s.statCard}>
                <Text style={[s.statVal, { color: '#7c3aed' }]}>{resumenHoy?.total_transacciones || 0}</Text>
                <Text style={s.statLabel}>Transacciones</Text>
              </View>
            </View>

            <View style={[s.grid, { marginTop: 10 }]}>
              <View style={s.statCard}>
                <Text style={[s.statVal, { color: tema.warning }]}>{stockBajo.length}</Text>
                <Text style={s.statLabel}>Stock Bajo</Text>
              </View>
              <View style={s.statCard}>
                <Text style={[s.statVal, { color: tema.danger }]}>{agotados.length}</Text>
                <Text style={s.statLabel}>Agotados</Text>
              </View>
            </View>

            {/* ALERTAS STOCK */}
            {(stockBajo.length > 0 || agotados.length > 0) && (
              <>
                <Text style={s.seccionTitulo}>⚠️ Alertas de Stock</Text>
                <View style={s.alertaCard}>
                  {agotados.slice(0, 5).map(p => (
                    <View key={p.id} style={s.alertaItem}>
                      <Text style={s.alertaNombre}>{p.emoji || '📦'} {p.nombre}</Text>
                      <Text style={[s.alertaStock, { color: tema.danger }]}>AGOTADO</Text>
                    </View>
                  ))}
                  {stockBajo.slice(0, 5).map(p => (
                    <View key={p.id} style={s.alertaItem}>
                      <Text style={s.alertaNombre}>{p.emoji || '📦'} {p.nombre}</Text>
                      <Text style={[s.alertaStock, { color: tema.warning }]}>{p.stock} uds</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* ESTADO INVENTARIO */}
            <Text style={s.seccionTitulo}>Estado del Inventario</Text>
            <View style={s.grid}>
              <View style={s.statCard}>
                <Text style={[s.statVal, { color: tema.success }]}>{productos.length}</Text>
                <Text style={s.statLabel}>Productos</Text>
              </View>
              <View style={s.statCard}>
                <Text style={[s.statVal, { color: tema.primario }]}>
                  {productos.filter(p => p.stock > p.stock_minimo).length}
                </Text>
                <Text style={s.statLabel}>En Stock</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={{ padding: 16 }}>
            {/* RESUMEN GLOBAL */}
            <View style={s.resumenGlobal}>
              <Text style={s.resumenGlobalTitulo}>ULTIMOS 30 DIAS</Text>
              <View style={s.resumenGlobalGrid}>
                <View style={s.resumenGlobalItem}>
                  <Text style={s.resumenGlobalVal}>Q{totalGlobal.toFixed(2)}</Text>
                  <Text style={s.resumenGlobalLabel}>Total</Text>
                </View>
                <View style={s.resumenGlobalItem}>
                  <Text style={s.resumenGlobalVal}>{totalTxGlobal}</Text>
                  <Text style={s.resumenGlobalLabel}>Transacciones</Text>
                </View>
                <View style={s.resumenGlobalItem}>
                  <Text style={s.resumenGlobalVal}>{historial.length}</Text>
                  <Text style={s.resumenGlobalLabel}>Dias</Text>
                </View>
              </View>
            </View>

            {/* GRAFICA */}
            {historial.length > 0 && (
              <>
                <Text style={s.seccionTitulo}>Ventas por Dia</Text>
                <View style={[s.alertaCard, { padding: 16 }]}>
                  <View style={s.graficaBar}>
                    {historial.slice(-14).map((d, i) => (
                      <View
                        key={i}
                        style={[s.barra, {
                          height: `${Math.max(5, (parseFloat(d.total) / maxVenta) * 100)}%`,
                          backgroundColor: tema.primario,
                          opacity: 0.5 + (parseFloat(d.total) / maxVenta) * 0.5
                        }]}
                      />
                    ))}
                  </View>
                </View>
              </>
            )}

            {/* HISTORIAL */}
            <Text style={s.seccionTitulo}>Historial por Dia</Text>
            {historial.length === 0 ? (
              <View style={s.vacio}>
                <Text style={s.vacioTexto}>Sin datos en los ultimos 30 dias</Text>
              </View>
            ) : (
              historial.map((h, i) => (
                <View key={i} style={s.histRow}>
                  <View>
                    <Text style={s.histFecha}>{formatFecha(h.fecha)}</Text>
                    <Text style={s.histTx}>{h.transacciones} transacciones</Text>
                  </View>
                  <Text style={s.histTotal}>Q{parseFloat(h.total).toFixed(2)}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}
