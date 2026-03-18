import React, { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useTema } from '../context/TemaContext'

const SECCIONES = [
  {
    id: 'inicio',
    titulo: '🚀 Inicio Rápido',
    contenido: [
      { subtitulo: '¿Cómo iniciar sesión?', texto: 'Ingresa tu email y contraseña en la pantalla de login. Si tienes 5 intentos fallidos, tu cuenta se bloqueará automáticamente.' },
      { subtitulo: '¿Cómo cerrar sesión?', texto: 'Abre el menú lateral deslizando desde la izquierda y presiona el botón rojo "Cerrar Sesión" al final del menú.' },
      { subtitulo: 'Roles de usuario', texto: 'Admin: acceso total al sistema.\nEmpleado: solo puede cobrar, ver sus ventas, dashboard y notificaciones.' },
    ]
  },
  {
    id: 'pos',
    titulo: '🛒 Módulo POS (Cobrar)',
    contenido: [
      { subtitulo: '¿Cómo realizar una venta?', texto: '1. Busca el producto por nombre o escanea su código de barras.\n2. Ajusta la cantidad si es necesario.\n3. Selecciona el método de pago (efectivo, tarjeta, transferencia o mixto).\n4. Presiona "Confirmar".\n5. Elige si deseas generar factura FEL, ticket simple o ninguno.' },
      { subtitulo: '¿Cómo aplicar un descuento?', texto: 'Presiona el botón "%" en la pantalla de cobro e ingresa el porcentaje de descuento.' },
      { subtitulo: '¿Cómo asociar un cliente?', texto: 'Presiona el botón "👤 Cliente" y busca por nombre, NIT o membresía.' },
      { subtitulo: 'Pago mixto', texto: 'Selecciona múltiples métodos de pago presionando cada uno y asigna el monto correspondiente a cada método.' },
      { subtitulo: '¿Qué es el ticket simple?', texto: 'Es un comprobante básico en PDF con el detalle de la venta, sin datos fiscales. Ideal para ventas rápidas.' },
    ]
  },
  {
    id: 'caja',
    titulo: '💰 Módulo Caja',
    contenido: [
      { subtitulo: '¿Cómo funciona la caja?', texto: 'Cada día debes abrir la caja con el efectivo inicial disponible. Durante el día se registran las ventas automáticamente. Al final del día cuentas el efectivo físico y cierras la caja.' },
      { subtitulo: '¿Cómo abrir la caja?', texto: 'Presiona "🔓 Abrir Caja" e ingresa el monto de efectivo inicial que tienes físicamente.' },
      { subtitulo: '¿Cómo cerrar la caja?', texto: 'Presiona "🔒 Cerrar" e ingresa el efectivo que contaste físicamente. El sistema calculará si hay sobrante o faltante.' },
      { subtitulo: '¿Cómo registrar un gasto?', texto: 'En la pestaña "Gastos" presiona "+ Gasto", ingresa la descripción, monto y categoría.' },
      { subtitulo: 'La caja muestra Q0', texto: 'Debes abrir la caja del día primero. Cada día se resetea y necesita una nueva apertura.' },
    ]
  },
  {
    id: 'inventario',
    titulo: '📦 Módulo Inventario',
    contenido: [
      { subtitulo: '¿Cómo agregar un producto?', texto: 'Presiona "+ Agregar", completa nombre, precio, costo, stock y emoji. Puedes agregar una foto desde cámara o galería.' },
      { subtitulo: '¿Cómo importar productos desde Excel?', texto: 'Presiona "📊 Excel" y selecciona un archivo .xlsx. Las columnas deben llamarse: nombre, precio, costo, stock, codigo_barras.' },
      { subtitulo: 'Categorías', texto: 'Puedes asignar categorías a los productos para organizarlos mejor en el inventario y en el POS.' },
      { subtitulo: 'Lotes y vencimientos', texto: 'En la pestaña "Lotes" puedes registrar lotes de productos con fecha de vencimiento. El sistema alertará cuando un lote esté próximo a vencer.' },
      { subtitulo: 'Promociones', texto: 'En la pestaña "Promos" puedes crear promociones 2x1, pague 2 lleve 3, descuento porcentaje o combo.' },
    ]
  },
  {
    id: 'usuarios',
    titulo: '👥 Módulo Administración',
    contenido: [
      { subtitulo: '¿Cómo crear un usuario?', texto: 'Ve a Administración, presiona "+ Nuevo", completa nombre, email, contraseña y rol (admin o empleado).' },
      { subtitulo: '¿Cómo eliminar un usuario?', texto: 'Presiona el botón "🗑️ Eliminar" en la tarjeta del usuario. Esta acción es permanente.' },
      { subtitulo: '¿Cómo cambiar la contraseña?', texto: 'Presiona "🔑 Password" en la tarjeta del usuario e ingresa la nueva contraseña.' },
      { subtitulo: 'Sesiones activas', texto: 'Presiona "📱 Sesiones" para ver desde qué dispositivos están conectados los usuarios. Puedes cerrar sesiones remotamente.' },
      { subtitulo: 'Configuración de empresa', texto: 'Desplázate hacia abajo en Administración para encontrar la configuración de nombre, NIT, dirección y teléfono de la empresa.' },
    ]
  },
  {
    id: 'offline',
    titulo: '📵 Modo Offline',
    contenido: [
      { subtitulo: '¿Cómo funciona el modo offline?', texto: 'Cuando no hay internet, las ventas se guardan automáticamente en el dispositivo. Al recuperar la conexión, sincroniza las ventas desde la pantalla Offline.' },
      { subtitulo: '¿Cómo actualizar el cache?', texto: 'Con internet disponible, ve a Offline y presiona "💾 Actualizar Cache" para guardar los productos localmente.' },
      { subtitulo: '¿Cómo sincronizar ventas pendientes?', texto: 'Ve a Offline y presiona "☁️ Sincronizar". Las ventas pendientes se enviarán al servidor.' },
      { subtitulo: 'Importante', texto: 'Sincroniza las ventas offline antes de cerrar la app para no perder información.' },
    ]
  },
  {
    id: 'seguridad',
    titulo: '🔒 Seguridad',
    contenido: [
      { subtitulo: 'Bloqueo de cuenta', texto: 'Después de 5 intentos fallidos de login, la cuenta se bloquea automáticamente. Solo un administrador puede desbloquearla.' },
      { subtitulo: 'Backup automático', texto: 'El sistema genera un backup automático todos los días a las 2:00 AM y lo envía al email configurado.' },
      { subtitulo: 'Backup manual', texto: 'En Seguridad > Backup puedes generar y descargar un backup completo en cualquier momento.' },
      { subtitulo: 'Monitor del sistema', texto: 'En Seguridad > Monitor puedes ver el estado del servidor, base de datos, memoria y estadísticas en tiempo real.' },
      { subtitulo: 'Alertas automáticas', texto: 'El sistema envía alertas por email si detecta intentos de acceso sospechosos o errores críticos.' },
    ]
  },
  {
    id: 'sucursales',
    titulo: '🏪 Sucursales',
    contenido: [
      { subtitulo: '¿Cómo crear una sucursal?', texto: 'Ve a Sucursales y presiona "+ Nueva". Ingresa nombre, dirección, teléfono y encargado.' },
      { subtitulo: 'Sucursal principal', texto: 'La sucursal principal no puede eliminarse. Todas las ventas se asignan a la sucursal del usuario que las realiza.' },
      { subtitulo: 'Reporte por sucursal', texto: 'Presiona "📊 Ver Reporte" en cualquier sucursal para ver ventas y productos más vendidos por período.' },
    ]
  },
]

export default function AyudaScreen() {
  const { tema } = useTema()
  const [seccionAbierta, setSeccionAbierta] = useState(null)

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>
      <View style={{ backgroundColor: tema.fondoCard, padding: 20, borderBottomWidth: 1, borderColor: tema.borde }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: tema.texto }}>📖 Ayuda y Documentación</Text>
        <Text style={{ fontSize: 12, color: tema.textoTerciario, marginTop: 4 }}>Manual de uso del sistema POS Pro GT</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {SECCIONES.map(seccion => (
          <View key={seccion.id} style={{ marginBottom: 10 }}>
            <TouchableOpacity
              style={{ backgroundColor: seccionAbierta === seccion.id ? tema.primario : tema.fondoCard, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: seccionAbierta === seccion.id ? tema.primario : tema.borde, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              onPress={() => setSeccionAbierta(seccionAbierta === seccion.id ? null : seccion.id)}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: seccionAbierta === seccion.id ? '#fff' : tema.texto }}>{seccion.titulo}</Text>
              <Text style={{ fontSize: 18, color: seccionAbierta === seccion.id ? '#fff' : tema.textoTerciario }}>
                {seccionAbierta === seccion.id ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {seccionAbierta === seccion.id && (
              <View style={{ backgroundColor: tema.fondoCard, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: tema.borde, borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
                {seccion.contenido.map((item, i) => (
                  <View key={i} style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: tema.primario, marginBottom: 4 }}>❓ {item.subtitulo}</Text>
                    <Text style={{ fontSize: 13, color: tema.textoSecundario, lineHeight: 20 }}>{item.texto}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}