import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

const BASE_URL = 'https://pos-pro-gt-backend.onrender.com/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(
  async config => {
    const token = await AsyncStorage.getItem('token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  error => Promise.reject(error)
)

// AUTH
export const authService = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  crearUsuario: (data) => api.post('/auth/crear-usuario', data),
}

// PRODUCTOS
export const productosService = {
  historialPrecios: (id) => api.get(`/productos/${id}/historial-precios`),
  obtenerTodos: () => api.get('/productos'),
  crear: (data) => api.post('/productos', data),
  actualizar: (id, data) => api.put(`/productos/${id}`, data),
  eliminar: (id) => api.delete(`/productos/${id}`)
}

// VENTAS
export const ventasService = {
  cancelar: (id, data) => api.put(`/ventas/${id}/cancelar`, data),
  obtenerTodas: () => api.get('/ventas'),
  crear: (data) => api.post('/ventas', data),
  resumenHoy: () => api.get('/ventas/resumen/hoy'),
  historialFecha: (fecha) => api.get(`/ventas/historial/${fecha}`),
  resumenRango: (desde, hasta) => api.get(`/ventas/resumen/rango?desde=${desde}&hasta=${hasta}`)
  
}

// CLIENTES
export const clientesService = {
  obtenerTodos: () => api.get('/clientes'),
  crear: (data) => api.post('/clientes', data),
  actualizar: (id, data) => api.put(`/clientes/${id}`, data),
  eliminar: (id) => api.delete(`/clientes/${id}`),
  buscarPorMembresia: (id) => api.get(`/clientes/membresia/${id}`),
  actualizarPuntos: (id, data) => api.put(`/clientes/${id}/puntos`, data),
  canjearPuntos: (id, data) => api.put(`/clientes/${id}/canjear`, data),
}

// USUARIOS
export const usuariosService = {
  listar: () => api.get('/auth/usuarios'),
  crear: (data) => api.post('/auth/crear-usuario', data),
  toggleActivo: (id) => api.put(`/auth/usuarios/${id}/toggle`),
  cambiarPassword: (id, password) => api.put(`/auth/usuarios/${id}/password`, { password }),
  historialVentas: (id) => api.get(`/auth/usuarios/${id}/ventas`),
  eliminar: (id) => api.delete(`/auth/usuarios/${id}`),
  actualizarFoto: (id, foto_url) => api.put(`/auth/usuarios/${id}/foto`, { foto_url }),
  sesionesActivas: () => api.get('/auth/sesiones-activas'),
  cerrarSesion: (id) => api.delete(`/auth/sesiones-activas/${id}`),
}

// DASHBOARD
export const dashboardService = {
  obtener: () => api.get('/dashboard'),
}

// CLOUDINARY
const CLOUDINARY_CLOUD = 'dpwlzl4lv'
const CLOUDINARY_UPLOAD_PRESET = 'pos_pro_gt'

export const subirFoto = async (uri) => {
  const formData = new FormData()
  formData.append('file', { uri, type: 'image/jpeg', name: 'producto.jpg' })
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)
  formData.append('folder', 'productos')
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
    { method: 'POST', body: formData }
  )
  const data = await response.json()
  if (!data.secure_url) throw new Error('Error al subir foto')
  return data.secure_url
}

export const cajaService = {
  obtenerHoy: () => api.get('/caja/hoy'),
  abrir: (data) => api.post('/caja/abrir', data),
  agregarGasto: (data) => api.post('/caja/gasto', data),
  eliminarGasto: (id) => api.delete(`/caja/gasto/${id}`),
  cerrar: (data) => api.post('/caja/cerrar', data),
  historial: () => api.get('/caja/historial'),
}

export const turnosService = {
  activo: () => api.get('/turnos/activo'),
  historial: () => api.get('/turnos/historial'),
  abrir: (data) => api.post('/turnos/abrir', data),
  cerrar: (id, data) => api.post(`/turnos/cerrar/${id}`, data),
}
export const inventarioService = {
  movimientos: (params) => api.get('/inventario/movimientos', { params }),
  registrarMovimiento: (data) => api.post('/inventario/movimiento', data),
}

export const proveedoresService = {
  obtenerTodos: () => api.get('/proveedores'),
  crear: (data) => api.post('/proveedores', data),
  actualizar: (id, data) => api.put(`/proveedores/${id}`, data),
  eliminar: (id) => api.delete(`/proveedores/${id}`),
  compras: (id) => api.get(`/proveedores/${id}/compras`),
  registrarCompra: (id, data) => api.post(`/proveedores/${id}/compra`, data),
  stockBajo: () => api.get('/proveedores/alertas/stock-bajo'),
}

// CATEGORIAS
export const categoriasService = {
  obtenerTodas: () => api.get('/productos/categorias/todas'),
  crear: (data) => api.post('/productos/categorias', data),
  actualizar: (id, data) => api.put(`/productos/categorias/${id}`, data),
  eliminar: (id) => api.delete(`/productos/categorias/${id}`),
}
 
// MONITOR
export const monitorService = {
  health: () => api.get('/monitor/health'),
  stats: () => api.get('/monitor/stats'),
}

// SUCURSALES
export const sucursalesService = {
  obtenerTodas: () => api.get('/sucursales'),
  crear: (data) => api.post('/sucursales', data),
  actualizar: (id, data) => api.put(`/sucursales/${id}`, data),
  eliminar: (id) => api.delete(`/sucursales/${id}`),
  reporte: (id, desde, hasta) => api.get(`/sucursales/${id}/reporte?desde=${desde}&hasta=${hasta}`),
}

export default api
