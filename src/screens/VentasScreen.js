import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Modal, Alert
} from 'react-native'
import { ventasService, usuariosService } from '../services/api'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTema } from '../context/TemaContext'

export default function VentasScreen() {
  const { tema } = useTema()
  const [resumen, setResumen] = useState(null)
  const [ventas, setVentas] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [modalVenta, setModalVenta] = useState(null)
  const [vistaActual, setVistaActual] = useState('hoy')
  const [empleados, setEmpleados] = useState([])
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null)
  const [ventasEmpleado, setVentasEmpleado] = useState([])
  const [cargandoEmpleado, setCargandoEmpleado] = useState(false)
  const [rolUsuario, setRolUsuario] = useState('empleado')

  useEffect(() => { cargarDatos(); verificarRol() }, [])

  const verificarRol = async () => {
    const usuario = await AsyncStorage.getItem('usuario')
    if (usuario) setRolUsuario(JSON.parse(usuario).rol)
  }

const cargarDatos = async () => {
    try {
      const [resHoy, vHoy] = await Promise.all([
        ventasService.resumenHoy(),
        ventasService.obtenerTodas(),
      ])
      setResumen(resHoy.data)
      setVentas(vHoy.data)
    } catch (error) {
      console.log('Error ventas:', error)
    } finally {
      setRefreshing(false)
    }
    try {
      const respEmpleados = await usuariosService.listar()
      setEmpleados(respEmpleados.data)
    } catch (error) {
      console.log('Error empleados:', error)
    }
  }

  const cargarVentasEmpleado = async (empleado) => {
    setEmpleadoSeleccionado(empleado)
    setCargandoEmpleado(true)
    try {
      const hoy = new Date()
      const hace30 = new Date(hoy - 30 * 24 * 60 * 60 * 1000)
      const resp = await usuariosService.historialVentas(
        empleado.id,
        hace30.toISOString().split('T')[0],
        hoy.toISOString().split('T')[0]
      )
      setVentasEmpleado(resp.data)
    } catch {
      Alert.alert('Error', 'No se pudieron cargar las ventas')
    } finally {
      setCargandoEmpleado(false)
    }
  }

  const totalEfectivo = ventas.filter(v => v.metodo_pago === 'efectivo').reduce((s, v) => s + parseFloat(v.total || 0), 0)
  const totalTarjeta = ventas.filter(v => v.metodo_pago === 'tarjeta').reduce((s, v) => s + parseFloat(v.total || 0), 0)
  const totalTransferencia = ventas.filter(v => v.metodo_pago === 'transferencia' || v.metodo_pago === 'qr').reduce((s, v) => s + parseFloat(v.total || 0), 0)
  const totalVuelto = ventas.reduce((s, v) => s + parseFloat(v.vuelto || 0), 0)
  const totalGeneral = parseFloat(resumen?.total_ventas || 0)
  const totalVentasEmpleado = ventasEmpleado.reduce((s, v) => s + parseFloat(v.total || 0), 0)

  const formatHora = (iso) => iso ? new Date(iso).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) : ''
  const formatFechaCorta = (iso) => iso ? new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' }) : ''
  const metodoColor = (m) => m === 'efectivo' ? tema.success : m === 'tarjeta' ? tema.primario : '#7c3aed'
  const metodoEmoji = (m) => m === 'efectivo' ? '💵' : m === 'tarjeta' ? '💳' : '📱'

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>
      {/* HEADER */}
      <View style={{ backgroundColor: tema.fondoCard, padding: 20, borderBottomWidth: 1, borderColor: tema.borde }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: tema.texto, marginBottom: 12 }}>Ventas</Text>
        {rolUsuario === 'admin' && (
          <View style={{ flexDirection: 'row', backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 3 }}>
            {['hoy', 'empleados'].map(v => (
              <TouchableOpacity
                key={v}
                style={{ flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center', backgroundColor: vistaActual === v ? tema.primario : 'transparent' }}
                onPress={() => setVistaActual(v)}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: vistaActual === v ? '#fff' : tema.textoTerciario }}>
                  {v === 'hoy' ? 'Hoy' : 'Por Empleado'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* VISTA HOY */}
      {vistaActual === 'hoy' && (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarDatos() }} tintColor={tema.primario} />}>
          {/* RESUMEN */}
          <View style={{ backgroundColor: tema.primario, margin: 16, borderRadius: 16, padding: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {[
                { val: `Q${totalGeneral.toFixed(2)}`, label: 'Total', color: '#fff' },
                { val: ventas.length, label: 'Transacciones', color: '#fff' },
                { val: `Q${ventas.length > 0 ? (totalGeneral / ventas.length).toFixed(2) : '0.00'}`, label: 'Promedio', color: '#fff' },
              ].map(({ val, label, color }, i, arr) => (
                <React.Fragment key={label}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color }}>{val}</Text>
                    <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{label}</Text>
                  </View>
                  {i < arr.length - 1 && <View style={{ width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' }} />}
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* DESGLOSE */}
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 10 }}>Desglose por Metodo</Text>
            <View style={{ backgroundColor: tema.fondoCard, borderRadius: 14, borderWidth: 1, borderColor: tema.borde }}>
              {[
                { label: '💵 Efectivo', val: totalEfectivo, color: tema.success },
                { label: '💳 Tarjeta', val: totalTarjeta, color: tema.primario },
                { label: '📱 Transferencia', val: totalTransferencia, color: '#7c3aed' },
                { label: '🔄 Vuelto', val: totalVuelto, color: tema.danger, negativo: true },
              ].map(({ label, val, color, negativo }) => (
                <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: tema.borde }}>
                  <Text style={{ fontSize: 13, color: tema.textoSecundario }}>{label}</Text>
                  <Text style={{ fontSize: 14, fontWeight: '700', color }}>{negativo ? '-' : ''}Q{val.toFixed(2)}</Text>
                </View>
              ))}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#d1fae522', borderRadius: 8, margin: 4 }}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: tema.texto }}>💰 Efectivo Neto</Text>
                <Text style={{ fontSize: 15, fontWeight: '900', color: tema.success }}>Q{(totalEfectivo - totalVuelto).toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* LISTA VENTAS */}
          <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 10 }}>
              Transacciones ({ventas.length})
            </Text>
            {ventas.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 32 }}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🛒</Text>
                <Text style={{ fontSize: 14, color: tema.textoTerciario }}>Sin ventas hoy</Text>
              </View>
            ) : ventas.map(v => (
              <TouchableOpacity
                key={v.id}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.fondoCard, borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: tema.borde }}
                onPress={() => setModalVenta(v)}
              >
                <View style={{ width: 42, height: 42, borderRadius: 10, backgroundColor: metodoColor(v.metodo_pago) + '20', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <Text style={{ fontSize: 18 }}>{metodoEmoji(v.metodo_pago)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: tema.texto }}>{formatHora(v.created_at)}</Text>
                  <Text style={{ fontSize: 11, color: tema.textoTerciario, textTransform: 'capitalize' }}>{v.metodo_pago}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: tema.primario }}>Q{parseFloat(v.total).toFixed(2)}</Text>
                  {v.vuelto > 0 && <Text style={{ fontSize: 10, color: tema.warning }}>Vuelto: Q{parseFloat(v.vuelto).toFixed(2)}</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* VISTA EMPLEADOS */}
      {vistaActual === 'empleados' && (
        <View style={{ flex: 1, flexDirection: 'row' }}>
          <View style={{ width: 130, backgroundColor: tema.fondoCard, borderRightWidth: 1, borderColor: tema.borde }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', padding: 12, borderBottomWidth: 1, borderColor: tema.borde }}>Empleados</Text>
            <ScrollView>
              {empleados.map(emp => (
                <TouchableOpacity
                  key={emp.id}
                  style={{ padding: 10, borderBottomWidth: 1, borderColor: tema.borde, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: empleadoSeleccionado?.id === emp.id ? tema.primario + '20' : 'transparent' }}
                  onPress={() => cargarVentasEmpleado(emp)}
                >
                  <Text style={{ fontSize: 18 }}>{emp.rol === 'admin' ? '👑' : '👤'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: tema.texto }} numberOfLines={1}>{emp.nombre}</Text>
                    <Text style={{ fontSize: 9, color: tema.textoTerciario }}>{emp.rol}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={{ flex: 1 }}>
            {!empleadoSeleccionado ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>👈</Text>
                <Text style={{ fontSize: 14, color: tema.textoTerciario }}>Selecciona un empleado</Text>
              </View>
            ) : cargandoEmpleado ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 14, color: tema.textoTerciario }}>Cargando...</Text>
              </View>
            ) : (
              <ScrollView>
                <View style={{ backgroundColor: tema.fondoCard, padding: 16, borderBottomWidth: 1, borderColor: tema.borde }}>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: tema.texto }}>{empleadoSeleccionado.nombre}</Text>
                  <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 2, marginBottom: 10 }}>Ultimos 30 dias</Text>
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1, backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: tema.primario }}>Q{totalVentasEmpleado.toFixed(2)}</Text>
                      <Text style={{ fontSize: 9, color: tema.textoTerciario, marginTop: 2 }}>Total</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 10, alignItems: 'center' }}>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: '#7c3aed' }}>{ventasEmpleado.length}</Text>
                      <Text style={{ fontSize: 9, color: tema.textoTerciario, marginTop: 2 }}>Ventas</Text>
                    </View>
                  </View>
                </View>
                {ventasEmpleado.length === 0 ? (
                  <View style={{ alignItems: 'center', padding: 32 }}>
                    <Text style={{ fontSize: 14, color: tema.textoTerciario }}>Sin ventas en 30 dias</Text>
                  </View>
                ) : ventasEmpleado.map(v => (
                  <TouchableOpacity
                    key={v.id}
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.fondoCard, padding: 10, marginHorizontal: 8, marginTop: 6, borderRadius: 10, borderWidth: 1, borderColor: tema.borde }}
                    onPress={() => setModalVenta(v)}
                  >
                    <Text style={{ fontSize: 16 }}>{metodoEmoji(v.metodo_pago)}</Text>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: tema.texto }}>{formatFechaCorta(v.created_at)} {formatHora(v.created_at)}</Text>
                      <Text style={{ fontSize: 11, color: tema.textoTerciario, textTransform: 'capitalize' }}>{v.metodo_pago}</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: tema.primario }}>Q{parseFloat(v.total).toFixed(2)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      )}

      {/* MODAL DETALLE */}
      <Modal visible={!!modalVenta} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 16 }}>Detalle de Venta</Text>
            {modalVenta && [
              { label: 'Hora', val: formatHora(modalVenta.created_at) },
              { label: 'Metodo', val: `${metodoEmoji(modalVenta.metodo_pago)} ${modalVenta.metodo_pago}` },
              { label: 'Total', val: `Q${parseFloat(modalVenta.total).toFixed(2)}` },
              modalVenta.efectivo_recibido > 0 ? { label: 'Efectivo', val: `Q${parseFloat(modalVenta.efectivo_recibido).toFixed(2)}` } : null,
              modalVenta.vuelto > 0 ? { label: 'Vuelto', val: `Q${parseFloat(modalVenta.vuelto).toFixed(2)}` } : null,
            ].filter(Boolean).map(({ label, val }) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: tema.borde }}>
                <Text style={{ fontSize: 13, color: tema.textoTerciario }}>{label}</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: tema.texto }}>{val}</Text>
              </View>
            ))}
            <TouchableOpacity style={{ backgroundColor: tema.fondoSecundario, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 16 }} onPress={() => setModalVenta(null)}>
              <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15 }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}