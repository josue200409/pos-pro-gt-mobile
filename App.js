import 'react-native-gesture-handler'
import React, { useState, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, Alert, Image
} from 'react-native'
import { NavigationContainer, DrawerActions } from '@react-navigation/native'
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { TemaProvider, useTema } from './src/context/TemaContext'

import LoginScreen from './src/screens/LoginScreen'
import POSScreen from './src/screens/POSScreen'
import DashboardScreen from './src/screens/DashboardScreen'
import InventarioScreen from './src/screens/InventarioScreen'
import VentasScreen from './src/screens/VentasScreen'
import ClientesScreen from './src/screens/ClientesScreen'
import CajaScreen from './src/screens/CajaScreen'
import ReportesScreen from './src/screens/ReportesScreen'
import BarcodesScreen from './src/screens/BarcodesScreen'
import AdminScreen from './src/screens/AdminScreen'
import IAScreen from './src/screens/IAScreen'
import OfflineScreen from './src/screens/OfflineScreen'
import NotificacionesScreen from './src/screens/NotificacionesScreen'
import ProveedoresScreen from './src/screens/ProveedoresScreen'
import TurnosScreen from './src/screens/TurnosScreen'
import MermasScreen from './src/screens/MermasScreen'
import EmpleadosScreen from './src/screens/EmpleadosScreen'
import SeguridadScreen from './src/screens/SeguridadScreen' 
import SucursalesScreen from './src/screens/SucursalesScreen'

const Drawer = createDrawerNavigator()
const Stack = createNativeStackNavigator()

const MENU_ADMIN = [
  { name: 'POS', label: 'Cobrar', emoji: '🛒', color: '#10b981' },
  { name: 'Dashboard', label: 'Dashboard', emoji: '📊', color: '#1a56db' },
  { name: 'Inventario', label: 'Inventario', emoji: '📦', color: '#f59e0b' },
  { name: 'Ventas', label: 'Ventas', emoji: '💰', color: '#10b981' },
  { name: 'Clientes', label: 'Clientes', emoji: '👥', color: '#7c3aed' },
  { name: 'Caja', label: 'Caja', emoji: '🏧', color: '#0891b2' },
  { name: 'Reportes', label: 'Reportes', emoji: '📄', color: '#dc2626' },
  { name: 'Barcodes', label: 'Codigos de Barras', emoji: '📷', color: '#374151' },
  { name: 'Admin', label: 'Administracion', emoji: '⚙️', color: '#6b7280' },
  { name: 'IA', label: 'Asistente IA', emoji: '🧠', color: '#1a56db' },
  { name: 'Offline', label: 'Modo Offline', emoji: '📵', color: '#6b7280' },
  { name: 'Notificaciones', label: 'Notificaciones', emoji: '🔔', color: '#dc2626' },
  { name: 'Proveedores', label: 'Proveedores', emoji: '🏭', color: '#2563EB' },
  { name: 'Turnos', label: 'Turnos', emoji: '🕒', color: '#F59E0B' },
  { name: 'Mermas', label: 'Mermas', emoji: '📉', color: '#FF9800' },
  { name: 'Seguridad', label: 'Seguridad', emoji: '🔐', color: '#6366f1' }
  { name: 'Sucursales', label: 'Sucursales', emoji: '🏪', color: '#0891b2' },

]

const MENU_EMPLEADO = [
  { name: 'POS', label: 'Cobrar', emoji: '🛒', color: '#10b981' },
  { name: 'Ventas', label: 'Mis Ventas', emoji: '💰', color: '#10b981' },
  { name: 'Dashboard', label: 'Dashboard', emoji: '📊', color: '#1a56db' },
  { name: 'Notificaciones', label: 'Notificaciones', emoji: '🔔', color: '#dc2626' },
  { name: 'Empleados', label: 'Empleados', emoji: '👥', color: '#7C3AED' }
]

function MenuLateral({ navigation, state, onLogout }) {
  const { tema } = useTema()
  const [usuario, setUsuario] = useState(null)
  const rutaActual = state?.routes[state.index]?.name

  useEffect(() => {
    AsyncStorage.getItem('usuario').then(u => { if (u) setUsuario(JSON.parse(u)) })
  }, [])

  const cerrarSesion = () => {
    Alert.alert('Cerrar Sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive', onPress: async () => {
          await AsyncStorage.multiRemove(['token', 'usuario'])
          navigation.dispatch(DrawerActions.closeDrawer())
          // Navegar al stack principal para mostrar login
        if (onLogout) onLogout()
        }
      }
    ])
  }

  const menu = usuario?.rol === 'admin' ? MENU_ADMIN : MENU_EMPLEADO

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>
      {/* PERFIL */}
      <View style={{ backgroundColor: tema.primario, padding: 24, paddingTop: 56 }}>
        <View style={{ width: 60, height: 60, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 28 }}>{usuario?.rol === 'admin' ? '👑' : '👤'}</Text>
        </View>
        <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>{usuario?.nombre || 'Usuario'}</Text>
        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{usuario?.email || ''}</Text>
        <View style={{ marginTop: 8, backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, alignSelf: 'flex-start' }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff', textTransform: 'uppercase' }}>{usuario?.rol || 'empleado'}</Text>
        </View>
      </View>

      {/* MENU */}
      <DrawerContentScrollView scrollEnabled={true} contentContainerStyle={{ paddingTop: 8 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', paddingHorizontal: 16, paddingVertical: 8 }}>Menu Principal</Text>
        {menu.map(item => {
          const activo = rutaActual === item.name
          return (
            <TouchableOpacity
              key={item.name}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 14,
                marginHorizontal: 10, marginBottom: 4, borderRadius: 12, padding: 12,
                backgroundColor: activo ? item.color + '20' : 'transparent',
                borderWidth: activo ? 1 : 0,
                borderColor: activo ? item.color + '40' : 'transparent',
              }}
              onPress={() => {
                navigation.navigate(item.name)
                navigation.dispatch(DrawerActions.closeDrawer())
              }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: activo ? item.color : tema.fondoSecundario, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 20 }}>{item.emoji}</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: activo ? '800' : '600', color: activo ? item.color : tema.texto, flex: 1 }}>{item.label}</Text>
              {activo && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.color }} />}
            </TouchableOpacity>
          )
        })}
      </DrawerContentScrollView>

      {/* CERRAR SESION */}
      <View style={{ padding: 16, borderTopWidth: 1, borderColor: tema.borde }}>
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fca5a5' }}
          onPress={cerrarSesion}
        >
          <Text style={{ fontSize: 20 }}>🚪</Text>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#dc2626' }}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

function AppDrawer({ onLogout }) {
  const { tema } = useTema()

  return (
    <Drawer.Navigator
      drawerContent={(props) => <MenuLateral {...props} onLogout={onLogout} />}
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerStyle: { backgroundColor: tema.fondoCard, elevation: 0, shadowOpacity: 0, borderBottomWidth: 1, borderBottomColor: tema.borde },
        headerTintColor: tema.texto,
        headerTitleStyle: { fontWeight: '900', fontSize: 18, color: tema.texto },
        drawerStyle: { width: 280, backgroundColor: tema.fondo },
        headerLeft: () => (
          <TouchableOpacity
            style={{ marginLeft: 16, width: 38, height: 38, borderRadius: 10, backgroundColor: tema.fondoSecundario, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: tema.borde }}
            onPress={() => navigation.dispatch(DrawerActions.toggleDrawer())}
          >
            <Text style={{ fontSize: 18 }}>☰</Text>
          </TouchableOpacity>
        ),
        headerRight: () => (
          <View style={{ marginRight: 16 }}>
            <Image source={require('./assets/logo.png')} style={{ width: 32, height: 32, borderRadius: 8 }} resizeMode="contain" />
          </View>
        ),
      })}
    >
      <Drawer.Screen name="POS" component={POSScreen} options={{ title: '🛒 Cobrar' }} />
      <Drawer.Screen name="Dashboard" component={DashboardScreen} options={{ title: '📊 Dashboard' }} />
      <Drawer.Screen name="Inventario" component={InventarioScreen} options={{ title: '📦 Inventario' }} />
      <Drawer.Screen name="Ventas" component={VentasScreen} options={{ title: '💰 Ventas' }} />
      <Drawer.Screen name="Clientes" component={ClientesScreen} options={{ title: '👥 Clientes' }} />
      <Drawer.Screen name="Caja" component={CajaScreen} options={{ title: '🏧 Caja' }} />
      <Drawer.Screen name="Reportes" component={ReportesScreen} options={{ title: '📄 Reportes' }} />
      <Drawer.Screen name="Barcodes" component={BarcodesScreen} options={{ title: '📷 Codigos de Barras' }} />
      <Drawer.Screen name="Notificaciones" component={NotificacionesScreen} options={{ title: '🔔 Notificaciones' }} />
      <Drawer.Screen name="Offline" component={OfflineScreen} options={{ title: '📵 Modo Offline' }} />
      <Drawer.Screen name="Admin" component={AdminScreen} options={{ title: '⚙️ Administracion' }} />
      <Drawer.Screen name="IA" component={IAScreen} options={{ title: '🧠 Asistente IA' }} />
      <Drawer.Screen name="Proveedores" component={ProveedoresScreen} options={{ title: '🏭 Proveedores' }} />
      <Drawer.Screen name="Turnos" component={TurnosScreen} options={{ title: '⏱️ Turnos' }} />
      <Drawer.Screen name="Mermas" component={MermasScreen} options={{ title: '📉 Control de Mermas' }} />
      <Drawer.Screen name="Empleados" component={EmpleadosScreen} options={{ title: '👥 Empleados' }} />
      <Drawer.Screen name="Seguridad" component={SeguridadScreen} options={{ title: '🔐 Seguridad' }} />
      <Drawer.Screen name="Sucursales" component={SucursalesScreen} options={{ title: '🏪 Sucursales' }} />
    </Drawer.Navigator>
  )
}

function RootNavigator() {
  const [logueado, setLogueado] = useState(false)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    AsyncStorage.getItem('token').then(token => {
      setLogueado(!!token)
      setCargando(false)
    })
  }, [])

  if (cargando) return null

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!logueado ? (
        <Stack.Screen name="Login">
          {props => <LoginScreen {...props} onLogin={() => setLogueado(true)} />}
        </Stack.Screen>
      ) : (
        <Stack.Screen name="App">
          {props => <AppDrawer {...props} onLogout={() => setLogueado(false)} />}
        </Stack.Screen>
      )}
    </Stack.Navigator>
  )
}

export default function App() {
  return (
    <TemaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </TemaProvider>
  )
}
