import axios from 'axios'

// Cambia esta IP por la IP de tu PC
// Para verla escribe "ipconfig" en PowerShell
const BASE_URL = 'http://192.168.1.5:3000/api'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Agregar token automáticamente a cada petición
api.interceptors.request.use(
  config => {
    const token = global.token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  error => Promise.reject(error)
)

export const productosService = {
  obtenerTodos: () => api.get('/productos'),
  crear: (data) => api.post('/productos', data),
  actualizar: (id, data) => api.put(`/productos/${id}`, data),
  eliminar: (id) => api.delete(`/productos/${id}`)
}

export const ventasService = {
  obtenerHoy: () => api.get('/ventas'),
  registrar: (data) => api.post('/ventas', data),
  resumenHoy: () => api.get('/ventas/resumen/hoy')
}

export const authService = {
  login: (data) => api.post('/auth/login', data),
  registro: (data) => api.post('/auth/registro', data)
}

export const dashboardService = {
  obtener: () => api.get('/dashboard')
}

export const clientesService = {
  obtenerTodos: () => api.get('/clientes'),
  crear: (data) => api.post('/clientes', data)
}

export default api