import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  Modal, TextInput, Alert, Switch, Image
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { usuariosService, configuracionService } from '../services/api'
import { subirFoto } from '../services/api'
import { useTema } from '../context/TemaContext'

export default function AdminScreen() {
  const { tema, modoOscuro, toggleTema } = useTema()
  const [usuarios, setUsuarios] = useState([])
  const [modalUsuario, setModalUsuario] = useState(false)
  const [modalPassword, setModalPassword] = useState(null)
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'empleado' })
  const [nuevaPassword, setNuevaPassword] = useState('')
  const [configEmpresa, setConfigEmpresa] = useState({})
  const [configCargando, setConfigCargando] = useState(true)
  const [guardandoConfig, setGuardandoConfig] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState(null)

  useEffect(() => { cargarUsuarios(); cargarConfig() }, [])

  const cargarConfig = async () => {
    try {
      const r = await configuracionService.obtener()
      setConfigEmpresa(r.data)
    } catch { Alert.alert('Error', 'No se pudo cargar la configuración') }
    finally { setConfigCargando(false) }
  }

  const guardarConfig = async () => {
    setGuardandoConfig(true)
    try {
      await configuracionService.actualizar(configEmpresa)
      Alert.alert('✅ Configuración guardada')
    } catch { Alert.alert('Error', 'No se pudo guardar') }
    finally { setGuardandoConfig(false) }
  }

  const cargarUsuarios = async () => {
    try {
      const r = await usuariosService.listar()
      setUsuarios(r.data)
    } catch { Alert.alert('Error', 'No se pudieron cargar los usuarios') }
  }

  const crearUsuario = async () => {
    if (!form.nombre || !form.email || !form.password) { Alert.alert('Error', 'Todos los campos son requeridos'); return }
    try {
      await usuariosService.crear(form)
      Alert.alert('✅ Usuario creado')
      setModalUsuario(false)
      setForm({ nombre: '', email: '', password: '', rol: 'empleado' })
      cargarUsuarios()
    } catch (e) { Alert.alert('Error', e.response?.data?.error || 'No se pudo crear') }
  }

  const toggleActivo = async (usuario) => {
    try {
      await usuariosService.toggleActivo(usuario.id)
      cargarUsuarios()
    } catch { Alert.alert('Error', 'No se pudo cambiar el estado') }
  }

  const eliminarUsuario = (u) => {
    Alert.alert(
      '🗑️ Eliminar Usuario',
      `¿Eliminar permanentemente a "${u.nombre}"?\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive', onPress: async () => {
            try {
              await usuariosService.eliminar(u.id)
              Alert.alert('✅ Usuario eliminado')
              cargarUsuarios()
            } catch { Alert.alert('Error', 'No se pudo eliminar') }
          }
        }
      ]
    )
  }

  const cambiarPassword = async () => {
    if (!nuevaPassword || nuevaPassword.length < 6) { Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres'); return }
    try {
      await usuariosService.cambiarPassword(modalPassword.id, nuevaPassword)
      Alert.alert('✅ Contraseña actualizada')
      setModalPassword(null)
      setNuevaPassword('')
    } catch { Alert.alert('Error', 'No se pudo cambiar la contraseña') }
  }

  const cambiarFotoUsuario = async (usuario) => {
    Alert.alert('Foto del trabajador', '¿Cómo quieres agregar la foto?', [
      {
        text: '📷 Tomar foto', onPress: async () => {
          const permiso = await ImagePicker.requestCameraPermissionsAsync()
          if (!permiso.granted) { Alert.alert('Permiso requerido', 'Necesitas permitir acceso a la cámara'); return }
          const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
          if (!r.canceled) subirFotoUsuario(usuario, r.assets[0].uri)
        }
      },
      {
        text: '🖼️ Elegir de galería', onPress: async () => {
          const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync()
          if (!permiso.granted) { Alert.alert('Permiso requerido', 'Necesitas permitir acceso a la galería'); return }
          const r = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8 })
          if (!r.canceled) subirFotoUsuario(usuario, r.assets[0].uri)
        }
      },
      { text: 'Cancelar', style: 'cancel' }
    ])
  }

  const subirFotoUsuario = async (usuario, uri) => {
    setSubiendoFoto(usuario.id)
    try {
      const url = await subirFoto(uri)
      await usuariosService.actualizarFoto(usuario.id, url)
      cargarUsuarios()
      Alert.alert('✅ Foto actualizada')
    } catch { Alert.alert('Error', 'No se pudo subir la foto') }
    finally { setSubiendoFoto(null) }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>
      <View style={{ backgroundColor: tema.fondoCard, padding: 20, borderBottomWidth: 1, borderColor: tema.borde }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: tema.texto }}>⚙️ Administración</Text>
      </View>

      <ScrollView>

        {/* APARIENCIA */}
        <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 10 }}>Apariencia</Text>
          <View style={{ backgroundColor: tema.fondoCard, borderRadius: 14, borderWidth: 1, borderColor: tema.borde }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 24 }}>{modoOscuro ? '🌙' : '☀️'}</Text>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: tema.texto }}>Modo Oscuro</Text>
                  <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 2 }}>{modoOscuro ? 'Tema oscuro activo' : 'Tema claro activo'}</Text>
                </View>
              </View>
              <Switch value={modoOscuro} onValueChange={toggleTema} trackColor={{ false: tema.borde, true: tema.primario }} thumbColor={modoOscuro ? '#fff' : '#f4f3f4'} />
            </View>
          </View>
        </View>

        {/* USUARIOS */}
        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase' }}>Usuarios ({usuarios.length})</Text>
            <TouchableOpacity style={{ backgroundColor: tema.primario, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }} onPress={() => setModalUsuario(true)}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#fff' }}>+ Nuevo</Text>
            </TouchableOpacity>
          </View>

          {usuarios.map(u => (
            <View key={u.id} style={{ backgroundColor: tema.fondoCard, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: tema.borde }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                {/* FOTO DEL USUARIO */}
                <TouchableOpacity onPress={() => cambiarFotoUsuario(u)} style={{ marginRight: 12 }}>
                  {u.foto_url ? (
                    <Image source={{ uri: u.foto_url }} style={{ width: 52, height: 52, borderRadius: 14, borderWidth: 2, borderColor: tema.primario }} />
                  ) : (
                    <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: u.rol === 'admin' ? '#fef3c7' : tema.fondoSecundario, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: tema.borde, borderStyle: 'dashed' }}>
                      {subiendoFoto === u.id
                        ? <Text style={{ fontSize: 10, color: tema.textoTerciario }}>...</Text>
                        : <Text style={{ fontSize: 22 }}>{u.rol === 'admin' ? '👑' : '👤'}</Text>
                      }
                    </View>
                  )}
                  <View style={{ position: 'absolute', bottom: -4, right: -4, backgroundColor: tema.primario, borderRadius: 8, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, color: '#fff' }}>📷</Text>
                  </View>
                </TouchableOpacity>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: tema.texto }}>{u.nombre}</Text>
                  <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 1 }}>{u.email}</Text>
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: u.rol === 'admin' ? '#fef3c7' : tema.fondoSecundario }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: u.rol === 'admin' ? '#d97706' : tema.textoTerciario, textTransform: 'capitalize' }}>{u.rol}</Text>
                    </View>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: u.activo ? '#d1fae5' : '#fee2e2' }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: u.activo ? tema.success : tema.danger }}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: u.activo ? '#fef3c7' : '#d1fae5', borderRadius: 10, padding: 9, alignItems: 'center', borderWidth: 1, borderColor: u.activo ? '#d97706' : tema.success }}
                  onPress={() => Alert.alert(u.activo ? 'Desactivar' : 'Activar', `¿${u.activo ? 'Desactivar' : 'Activar'} a ${u.nombre}?`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Confirmar', onPress: () => toggleActivo(u) }])}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: u.activo ? '#d97706' : tema.success }}>
                    {u.activo ? '⏸️ Desactivar' : '▶️ Activar'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 9, alignItems: 'center', borderWidth: 1, borderColor: tema.borde }}
                  onPress={() => { setModalPassword(u); setNuevaPassword('') }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoSecundario }}>🔑 Password</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: '#fee2e2', borderRadius: 10, padding: 9, alignItems: 'center', borderWidth: 1, borderColor: tema.danger, paddingHorizontal: 12 }}
                  onPress={() => eliminarUsuario(u)}
                >
                  <Text style={{ fontSize: 14 }}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* CONFIGURACION EMPRESA */}
        <View style={{ paddingHorizontal: 16, marginTop: 20 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 10 }}>Datos de la Empresa (Factura FEL)</Text>
          <View style={{ backgroundColor: tema.fondoCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: tema.borde }}>
            {configCargando ? (
              <Text style={{ color: tema.textoTerciario, textAlign: 'center' }}>Cargando...</Text>
            ) : (
              <>
                {[
                  { key: 'empresa_nombre', label: '🏪 Nombre de la Empresa' },
                  { key: 'empresa_nit', label: '🏛️ NIT de la Empresa' },
                  { key: 'empresa_direccion', label: '📍 Dirección' },
                  { key: 'empresa_telefono', label: '📞 Teléfono' },
                  { key: 'empresa_serie_factura', label: '🔢 Serie de Factura' },
                ].map(({ key, label }) => (
                  <View key={key} style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 4 }}>{label}</Text>
                    <TextInput
                      style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: tema.fondoInput, color: tema.texto }}
                      value={configEmpresa[key] || ''}
                      onChangeText={v => setConfigEmpresa(prev => ({ ...prev, [key]: v }))}
                      placeholderTextColor={tema.textoTerciario}
                    />
                  </View>
                ))}
                <TouchableOpacity
                  style={{ backgroundColor: tema.primario, borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 4 }}
                  onPress={guardarConfig}
                  disabled={guardandoConfig}
                >
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
                    {guardandoConfig ? 'Guardando...' : '💾 Guardar Configuración'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* INFO APP */}
        <View style={{ paddingHorizontal: 16, marginTop: 20, marginBottom: 32 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 10 }}>Información</Text>
          <View style={{ backgroundColor: tema.fondoCard, borderRadius: 14, borderWidth: 1, borderColor: tema.borde, overflow: 'hidden' }}>
            {[
              { label: 'Versión', val: '1.0.0', emoji: '📱' },
              { label: 'Backend', val: 'Render (Online)', emoji: '☁️' },
              { label: 'Base de Datos', val: 'PostgreSQL 16', emoji: '🗄️' },
              { label: 'Desarrollado en', val: 'Guatemala 🇬🇹', emoji: '📍' },
            ].map(({ label, val, emoji }) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderColor: tema.borde }}>
                <Text style={{ fontSize: 13, color: tema.textoSecundario }}>{emoji} {label}</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: tema.texto }}>{val}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* MODAL CREAR USUARIO */}
      <Modal visible={modalUsuario} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 20 }}>👤 Nuevo Usuario</Text>
            {[
              { key: 'nombre', label: '👤 Nombre', placeholder: 'Juan Garcia' },
              { key: 'email', label: '✉️ Email', placeholder: 'juan@ejemplo.com', keyboard: 'email-address' },
              { key: 'password', label: '🔑 Contraseña', placeholder: 'Min. 6 caracteres', secure: true },
            ].map(({ key, label, placeholder, keyboard, secure }) => (
              <View key={key} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 6 }}>{label}</Text>
                <TextInput
                  style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: tema.fondoInput, color: tema.texto }}
                  placeholder={placeholder}
                  placeholderTextColor={tema.textoTerciario}
                  value={form[key]}
                  onChangeText={v => setForm({ ...form, [key]: v })}
                  keyboardType={keyboard || 'default'}
                  secureTextEntry={secure}
                  autoCapitalize={key === 'email' ? 'none' : 'words'}
                />
              </View>
            ))}
            <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 8 }}>Rol</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {['empleado', 'admin'].map(r => (
                <TouchableOpacity key={r} style={{ flex: 1, padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 2, borderColor: form.rol === r ? tema.primario : tema.borde, backgroundColor: form.rol === r ? tema.primario + '15' : tema.fondoInput }} onPress={() => setForm({ ...form, rol: r })}>
                  <Text style={{ fontSize: 20, marginBottom: 4 }}>{r === 'admin' ? '👑' : '👤'}</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: form.rol === r ? tema.primario : tema.textoTerciario, textTransform: 'capitalize' }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }} onPress={() => setModalUsuario(false)}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: tema.textoTerciario }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: tema.primario, alignItems: 'center' }} onPress={crearUsuario}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Crear Usuario</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL CAMBIAR PASSWORD */}
      <Modal visible={!!modalPassword} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 4 }}>🔑 Cambiar Contraseña</Text>
            <Text style={{ fontSize: 13, color: tema.textoTerciario, marginBottom: 20 }}>{modalPassword?.nombre}</Text>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 8 }}>Nueva Contraseña</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: tema.fondoInput, color: tema.texto, marginBottom: 20 }}
              placeholder="Min. 6 caracteres"
              placeholderTextColor={tema.textoTerciario}
              value={nuevaPassword}
              onChangeText={setNuevaPassword}
              secureTextEntry
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }} onPress={() => setModalPassword(null)}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: tema.textoTerciario }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: tema.primario, alignItems: 'center' }} onPress={cambiarPassword}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}