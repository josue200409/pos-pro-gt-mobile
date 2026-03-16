import React, { useState, useEffect } from 'react'
import {
  View, Text, FlatList, TouchableOpacity,
  Modal, TextInput, Alert, RefreshControl, ScrollView
} from 'react-native'
import { clientesService } from '../services/api'
import { useTema } from '../context/TemaContext'

const NIVELES = {
  bronce: { color: '#cd7f32', bg: '#fde8d8', emoji: '🥉', desc: 'Bronce', descuento: 2 },
  plata: { color: '#9ca3af', bg: '#f0f0f0', emoji: '🥈', desc: 'Plata', descuento: 5 },
  oro: { color: '#d97706', bg: '#fef3c7', emoji: '🥇', desc: 'Oro', descuento: 8 },
  platino: { color: '#7c3aed', bg: '#ede9fe', emoji: '💎', desc: 'Platino', descuento: 12 },
}

export default function ClientesScreen() {
  const { tema } = useTema()
  const [clientes, setClientes] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [modalForm, setModalForm] = useState(false)
  const [modalDetalle, setModalDetalle] = useState(null)
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', nit: '', direccion: '' })

  useEffect(() => { cargarClientes() }, [])

  const cargarClientes = async () => {
    try {
      const r = await clientesService.obtenerTodos()
      setClientes(r.data)
    } catch { Alert.alert('Error', 'No se pudieron cargar los clientes') }
    finally { setRefreshing(false) }
  }

  const abrirNuevo = () => {
    setEditando(null)
    setForm({ nombre: '', telefono: '', email: '', nit: '', direccion: '' })
    setModalForm(true)
  }

  const abrirEditar = (cliente) => {
    setEditando(cliente)
    setForm({
      nombre: cliente.nombre || '', telefono: cliente.telefono || '',
      email: cliente.email || '', nit: cliente.nit || '', direccion: cliente.direccion || ''
    })
    setModalDetalle(null)
    setModalForm(true)
  }

  const guardar = async () => {
    if (!form.nombre.trim()) { Alert.alert('Error', 'El nombre es requerido'); return }
    try {
      if (editando) { await clientesService.actualizar(editando.id, form); Alert.alert('✅ Cliente actualizado') }
      else { await clientesService.crear(form); Alert.alert('✅ Cliente creado') }
      setModalForm(false)
      cargarClientes()
    } catch (e) { Alert.alert('Error', e.response?.data?.error || 'No se pudo guardar') }
  }

  const eliminar = (cliente) => {
    Alert.alert('Eliminar cliente', `¿Eliminar a "${cliente.nombre}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await clientesService.eliminar(cliente.id); setModalDetalle(null); cargarClientes() } }
    ])
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.telefono?.includes(busqueda) ||
    c.nit?.includes(busqueda) ||
    c.membresia_id?.toLowerCase().includes(busqueda.toLowerCase())
  )

  const proximoNivel = (cliente) => {
    const puntos = cliente.puntos_acumulados || 0
    return [{ nombre: 'plata', puntos: 500 }, { nombre: 'oro', puntos: 1500 }, { nombre: 'platino', puntos: 5000 }].find(n => puntos < n.puntos)
  }

  const nivelInfo = (nivel) => NIVELES[nivel] || NIVELES.bronce

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>
      {/* HEADER */}
      <View style={{ backgroundColor: tema.fondoCard, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: tema.borde }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: tema.texto }}>Clientes</Text>
        <TouchableOpacity style={{ backgroundColor: tema.primario, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }} onPress={abrirNuevo}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>+ Nuevo</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={{ margin: 12, padding: 12, backgroundColor: tema.fondoCard, borderRadius: 10, borderWidth: 1, borderColor: tema.borde, fontSize: 14, color: tema.texto }}
        placeholder="Buscar por nombre, NIT, telefono o membresia..."
        placeholderTextColor={tema.textoTerciario}
        value={busqueda}
        onChangeText={setBusqueda}
      />

      {/* STATS */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 12, gap: 6, marginBottom: 8 }}>
        {Object.entries(NIVELES).map(([nivel, info]) => (
          <View key={nivel} style={{ flex: 1, borderRadius: 10, padding: 8, alignItems: 'center', backgroundColor: tema.fondoCard, borderWidth: 1, borderColor: tema.borde }}>
            <Text style={{ fontSize: 18 }}>{info.emoji}</Text>
            <Text style={{ fontSize: 16, fontWeight: '900', color: info.color }}>{clientes.filter(c => c.nivel === nivel).length}</Text>
            <Text style={{ fontSize: 9, color: tema.textoTerciario, fontWeight: '600' }}>{info.desc}</Text>
          </View>
        ))}
      </View>

      <FlatList
        data={clientesFiltrados}
        keyExtractor={c => c.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarClientes() }} tintColor={tema.primario} />}
        renderItem={({ item }) => {
          const info = nivelInfo(item.nivel)
          return (
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: tema.fondoCard, marginHorizontal: 12, marginBottom: 8, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: tema.borde }}
              onPress={() => setModalDetalle(item)}
            >
              <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: info.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 22 }}>{info.emoji}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: tema.texto, marginBottom: 4 }}>{item.nombre}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {item.membresia_id && <Text style={{ fontSize: 10, fontWeight: '600', backgroundColor: tema.fondoSecundario, color: tema.textoTerciario, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>{item.membresia_id}</Text>}
                  {item.nit && <Text style={{ fontSize: 10, fontWeight: '600', backgroundColor: '#e8f0fe', color: tema.primario, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>NIT: {item.nit}</Text>}
                  {item.telefono && <Text style={{ fontSize: 10, fontWeight: '600', backgroundColor: '#f0fdf4', color: tema.success, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>{item.telefono}</Text>}
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: info.color, textTransform: 'uppercase' }}>{info.desc}</Text>
                <Text style={{ fontSize: 12, color: tema.textoTerciario, marginTop: 2 }}>{item.puntos_acumulados || 0} pts</Text>
              </View>
            </TouchableOpacity>
          )
        }}
      />

      {/* MODAL DETALLE */}
      {modalDetalle && (
        <Modal visible={true} transparent animationType="slide">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <ScrollView>
              <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, marginTop: 60 }}>
                {/* CABECERA */}
                <View style={{ borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 16, backgroundColor: nivelInfo(modalDetalle.nivel).bg }}>
                  <Text style={{ fontSize: 48, marginBottom: 8 }}>{nivelInfo(modalDetalle.nivel).emoji}</Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: '#111827' }}>{modalDetalle.nombre}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: nivelInfo(modalDetalle.nivel).color, textTransform: 'uppercase', marginTop: 2 }}>{nivelInfo(modalDetalle.nivel).desc}</Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{modalDetalle.membresia_id}</Text>
                </View>

                {/* PUNTOS */}
                <View style={{ backgroundColor: tema.fondoSecundario, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: tema.borde }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 }}>
                    {[
                      { val: modalDetalle.puntos_acumulados || 0, label: 'Puntos', color: tema.primario },
                      { val: `${nivelInfo(modalDetalle.nivel).descuento}%`, label: 'Descuento', color: tema.success },
                      { val: `Q${Math.floor((modalDetalle.puntos_acumulados || 0) / 100) * 10}`, label: 'Canjeable', color: tema.warning },
                    ].map(({ val, label, color }) => (
                      <View key={label} style={{ alignItems: 'center' }}>
                        <Text style={{ fontSize: 20, fontWeight: '900', color }}>{val}</Text>
                        <Text style={{ fontSize: 10, color: tema.textoTerciario, marginTop: 2 }}>{label}</Text>
                      </View>
                    ))}
                  </View>
                  {proximoNivel(modalDetalle) && (
                    <View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: tema.texto }}>
                          Siguiente: {NIVELES[proximoNivel(modalDetalle).nombre].emoji} {proximoNivel(modalDetalle).nombre}
                        </Text>
                        <Text style={{ fontSize: 11, color: tema.textoTerciario }}>
                          Faltan {proximoNivel(modalDetalle).puntos - (modalDetalle.puntos_acumulados || 0)} pts
                        </Text>
                      </View>
                      <View style={{ height: 8, backgroundColor: tema.borde, borderRadius: 4, overflow: 'hidden' }}>
                        <View style={{ height: '100%', borderRadius: 4, backgroundColor: nivelInfo(modalDetalle.nivel).color, width: `${Math.min(100, ((modalDetalle.puntos_acumulados || 0) / proximoNivel(modalDetalle).puntos) * 100)}%` }} />
                      </View>
                    </View>
                  )}
                </View>

                {/* DATOS */}
                <View style={{ backgroundColor: tema.fondoSecundario, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: tema.borde }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 12 }}>Información</Text>
                  {[
                    { label: 'NIT', val: modalDetalle.nit, emoji: '🏛️' },
                    { label: 'Teléfono', val: modalDetalle.telefono, emoji: '📞' },
                    { label: 'Email', val: modalDetalle.email, emoji: '✉️' },
                    { label: 'Dirección', val: modalDetalle.direccion, emoji: '📍' },
                  ].filter(d => d.val).map(({ label, val, emoji }) => (
                    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <Text style={{ fontSize: 20 }}>{emoji}</Text>
                      <View>
                        <Text style={{ fontSize: 10, color: tema.textoTerciario, fontWeight: '600' }}>{label}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: tema.texto }}>{val}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* ACCIONES */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                  <TouchableOpacity style={{ flex: 1, backgroundColor: '#e8f0fe', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: tema.primario }} onPress={() => abrirEditar(modalDetalle)}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: tema.primario }}>✏️ Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ flex: 1, backgroundColor: '#fee2e2', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: tema.danger }} onPress={() => eliminar(modalDetalle)}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: tema.danger }}>🗑️ Eliminar</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={{ backgroundColor: tema.fondoSecundario, borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 20 }} onPress={() => setModalDetalle(null)}>
                  <Text style={{ color: tema.texto, fontWeight: '700', fontSize: 15 }}>Cerrar</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>
      )}

      {/* MODAL FORMULARIO */}
      <Modal visible={modalForm} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, marginTop: 60 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 20 }}>
                {editando ? '✏️ Editar Cliente' : '👤 Nuevo Cliente'}
              </Text>
              {[
                { key: 'nombre', label: '👤 Nombre Completo *', placeholder: 'Juan Garcia' },
                { key: 'nit', label: '🏛️ NIT', placeholder: '12345678-9 o CF' },
                { key: 'telefono', label: '📞 Teléfono', placeholder: '5555-1234', keyboard: 'phone-pad' },
                { key: 'email', label: '✉️ Email', placeholder: 'correo@ejemplo.com', keyboard: 'email-address' },
                { key: 'direccion', label: '📍 Dirección', placeholder: 'Ciudad, Zona...', multiline: true },
              ].map(({ key, label, placeholder, keyboard, multiline }) => (
                <View key={key} style={{ marginBottom: 14 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoSecundario, marginBottom: 6 }}>{label}</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: tema.fondoInput, color: tema.texto, height: multiline ? 80 : undefined, textAlignVertical: multiline ? 'top' : undefined }}
                    placeholder={placeholder}
                    placeholderTextColor={tema.textoTerciario}
                    value={form[key]}
                    onChangeText={v => setForm({ ...form, [key]: v })}
                    keyboardType={keyboard || 'default'}
                    autoCapitalize={key === 'email' ? 'none' : 'words'}
                    multiline={multiline}
                  />
                </View>
              ))}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, marginBottom: 20 }}>
                <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }} onPress={() => setModalForm(false)}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: tema.textoTerciario }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: tema.primario, alignItems: 'center' }} onPress={guardar}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{editando ? 'Actualizar' : 'Crear Cliente'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}
