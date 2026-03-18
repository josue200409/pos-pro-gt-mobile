import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, RefreshControl
} from 'react-native'
import { sucursalesService } from '../services/api'
import { useTema } from '../context/TemaContext'

export default function SucursalesScreen() {
  const { tema } = useTema()
  const [sucursales, setSucursales] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [modalForm, setModalForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', direccion: '', telefono: '', encargado: '' })
  const [modalReporte, setModalReporte] = useState(null)
  const [reporte, setReporte] = useState(null)
  const [fechaDesde, setFechaDesde] = useState(new Date().toISOString().split('T')[0])
  const [fechaHasta, setFechaHasta] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => { cargarSucursales() }, [])

  const cargarSucursales = async () => {
    try {
      const r = await sucursalesService.obtenerTodas()
      setSucursales(r.data || [])
    } catch { Alert.alert('Error', 'No se pudieron cargar las sucursales') }
    finally { setRefreshing(false) }
  }

  const abrirModal = (s = null) => {
    if (s) {
      setEditando(s)
      setForm({ nombre: s.nombre, direccion: s.direccion || '', telefono: s.telefono || '', encargado: s.encargado || '' })
    } else {
      setEditando(null)
      setForm({ nombre: '', direccion: '', telefono: '', encargado: '' })
    }
    setModalForm(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { Alert.alert('Error', 'Nombre requerido'); return }
    try {
      if (editando) await sucursalesService.actualizar(editando.id, form)
      else await sucursalesService.crear(form)
      setModalForm(false)
      cargarSucursales()
      Alert.alert('✅', editando ? 'Sucursal actualizada' : 'Sucursal creada')
    } catch (e) { Alert.alert('Error', e.response?.data?.error || 'No se pudo guardar') }
  }

  const eliminar = (s) => {
    if (s.id === 1) { Alert.alert('Error', 'No puedes eliminar la sucursal principal'); return }
    Alert.alert('Eliminar', `¿Eliminar "${s.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await sucursalesService.eliminar(s.id)
        cargarSucursales()
      }}
    ])
  }

  const verReporte = async (s) => {
    setModalReporte(s)
    try {
      const r = await sucursalesService.reporte(s.id, fechaDesde, fechaHasta)
      setReporte(r.data)
    } catch { setReporte(null) }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>
      <View style={{ backgroundColor: tema.fondoCard, padding: 20, borderBottomWidth: 1, borderColor: tema.borde }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: tema.texto }}>🏪 Sucursales</Text>
          <TouchableOpacity
            style={{ backgroundColor: tema.primario, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}
            onPress={() => abrirModal()}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>+ Nueva</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarSucursales() }} tintColor={tema.primario} />}
        contentContainerStyle={{ padding: 16 }}
      >
        {sucursales.map(s => (
          <View key={s.id} style={{ backgroundColor: tema.fondoCard, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: s.id === 1 ? tema.primario : tema.borde }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 24 }}>🏪</Text>
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '900', color: tema.texto }}>{s.nombre}</Text>
                  {s.id === 1 && <Text style={{ fontSize: 10, color: tema.primario, fontWeight: '700' }}>PRINCIPAL</Text>}
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  style={{ backgroundColor: tema.fondoSecundario, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: tema.borde }}
                  onPress={() => abrirModal(s)}
                >
                  <Text>✏️</Text>
                </TouchableOpacity>
                {s.id !== 1 && (
                  <TouchableOpacity
                    style={{ backgroundColor: '#fee2e2', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#fca5a5' }}
                    onPress={() => eliminar(s)}
                  >
                    <Text>🗑️</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {s.direccion && <Text style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 4 }}>📍 {s.direccion}</Text>}
            {s.telefono && <Text style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 4 }}>📞 {s.telefono}</Text>}
            {s.encargado && <Text style={{ fontSize: 12, color: tema.textoSecundario, marginBottom: 8 }}>👤 {s.encargado}</Text>}

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
              <View style={{ flex: 1, backgroundColor: tema.fondoSecundario, borderRadius: 8, padding: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: tema.primario }}>{s.total_usuarios || 0}</Text>
                <Text style={{ fontSize: 9, color: tema.textoTerciario }}>Usuarios</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: tema.fondoSecundario, borderRadius: 8, padding: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: tema.success }}>{s.ventas_hoy || 0}</Text>
                <Text style={{ fontSize: 9, color: tema.textoTerciario }}>Ventas hoy</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: tema.fondoSecundario, borderRadius: 8, padding: 8, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '900', color: '#7c3aed' }}>Q{parseFloat(s.monto_hoy || 0).toFixed(0)}</Text>
                <Text style={{ fontSize: 9, color: tema.textoTerciario }}>Monto hoy</Text>
              </View>
            </View>

            <TouchableOpacity
              style={{ marginTop: 10, backgroundColor: tema.fondoSecundario, borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: tema.borde }}
              onPress={() => verReporte(s)}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: tema.texto }}>📊 Ver Reporte</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      {/* MODAL FORM */}
      <Modal visible={modalForm} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: tema.texto, marginBottom: 16 }}>
              {editando ? '✏️ Editar Sucursal' : '🏪 Nueva Sucursal'}
            </Text>
            {[
              { key: 'nombre', label: 'Nombre *', placeholder: 'Ej: Sucursal Norte' },
              { key: 'direccion', label: 'Dirección', placeholder: 'Dirección completa' },
              { key: 'telefono', label: 'Teléfono', placeholder: 'Ej: 55551234' },
              { key: 'encargado', label: 'Encargado', placeholder: 'Nombre del encargado' },
            ].map(f => (
              <View key={f.key} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 4 }}>{f.label}</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: tema.fondoInput, color: tema.texto }}
                  placeholder={f.placeholder}
                  placeholderTextColor={tema.textoTerciario}
                  value={form[f.key]}
                  onChangeText={v => setForm({ ...form, [f.key]: v })}
                />
              </View>
            ))}
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }} onPress={() => setModalForm(false)}>
                <Text style={{ color: tema.textoTerciario, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: tema.primario, alignItems: 'center' }} onPress={guardar}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL REPORTE */}
      <Modal visible={!!modalReporte} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: tema.texto }}>📊 {modalReporte?.nombre}</Text>
              <TouchableOpacity onPress={() => { setModalReporte(null); setReporte(null) }}>
                <Text style={{ fontSize: 16, color: tema.textoTerciario, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: tema.textoTerciario, marginBottom: 4 }}>Desde</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 8, padding: 8, color: tema.texto, fontSize: 12 }}
                  value={fechaDesde}
                  onChangeText={setFechaDesde}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, color: tema.textoTerciario, marginBottom: 4 }}>Hasta</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 8, padding: 8, color: tema.texto, fontSize: 12 }}
                  value={fechaHasta}
                  onChangeText={setFechaHasta}
                  placeholder="YYYY-MM-DD"
                />
              </View>
              <TouchableOpacity
                style={{ backgroundColor: tema.primario, borderRadius: 8, padding: 8, alignSelf: 'flex-end', paddingHorizontal: 12 }}
                onPress={() => verReporte(modalReporte)}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Buscar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              {reporte ? (
                <>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: tema.texto, marginBottom: 8 }}>Ventas por método de pago</Text>
                  {reporte.ventas.map((v, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: tema.fondoSecundario, borderRadius: 8, marginBottom: 6 }}>
                      <Text style={{ fontSize: 13, color: tema.texto, textTransform: 'capitalize' }}>{v.metodo_pago}</Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: tema.primario }}>Q{parseFloat(v.monto_total).toFixed(2)}</Text>
                        <Text style={{ fontSize: 10, color: tema.textoTerciario }}>{v.total_ventas} ventas</Text>
                      </View>
                    </View>
                  ))}

                  {reporte.top_productos.length > 0 && (
                    <>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: tema.texto, marginTop: 12, marginBottom: 8 }}>Top productos</Text>
                      {reporte.top_productos.map((p, i) => (
                        <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: tema.fondoSecundario, borderRadius: 8, marginBottom: 6 }}>
                          <Text style={{ fontSize: 13, color: tema.texto }}>{p.emoji} {p.nombre}</Text>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: tema.success }}>{p.total_vendido} uds</Text>
                        </View>
                      ))}
                    </>
                  )}
                </>
              ) : (
                <Text style={{ textAlign: 'center', color: tema.textoSecundario, marginTop: 20 }}>Cargando reporte...</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}