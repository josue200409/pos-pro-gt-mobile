import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator
} from 'react-native'
import { dashboardService } from '../services/api'
import { useTema } from '../context/TemaContext'

export default function IAScreen() {
  const { tema } = useTema()
  const [mensajes, setMensajes] = useState([{
    id: 1, rol: 'bot',
    texto: '¡Hola! 👋 Soy tu asistente IA del negocio.\n\nPuedo ayudarte con:\n• 💰 Ventas del día\n• 📦 Estado del inventario\n• 📈 Márgenes de ganancia\n• 🏆 Productos más vendidos\n• 🛒 Qué comprar pronto\n\n¿En qué te puedo ayudar?'
  }])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [datos, setDatos] = useState(null)
  const scrollRef = useRef()

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    try {
      const response = await dashboardService.obtener()
      setDatos(response.data)
    } catch (error) { console.log('Error cargando datos actuales IA:', error) }
  }

  const generarRespuestaConDatos = (pregunta, datosActuales) => {
    if (!datos) return 'Estoy cargando los datos actuales del negocio... Intenta en un momento.'
    const q = pregunta.toLowerCase()
    const hoy = datos.hoy || {}
    const topProductos = datos.top_productos || []
    const stockBajo = datos.stock_bajo || []
    const porMetodo = datos.por_metodo_pago || []
    const totalVentas = parseFloat(hoy.total_ventas || 0)
    const totalTx = parseInt(hoy.total_transacciones || 0)
    const totalIva = parseFloat(hoy.total_iva || 0)

    if (q.includes('vend') || q.includes('hoy') || q.includes('día') || q.includes('cuanto')) {
      if (totalVentas === 0) return '📊 Hoy no hay ventas registradas todavía.\n\n💡 ¡Es un buen momento para revisar el inventario!'
      return `📊 Ventas de hoy:\n\n💰 Total: Q${totalVentas.toFixed(2)}\n🧾 Transacciones: ${totalTx}\n🏷️ IVA generado: Q${totalIva.toFixed(2)}\n📈 Promedio por venta: Q${totalTx > 0 ? (totalVentas/totalTx).toFixed(2) : '0.00'}\n\n${totalVentas > 1000 ? '🔥 ¡Excelente día de ventas!' : totalVentas > 500 ? '✅ Buen día de ventas' : '💡 Día con ventas moderadas'}`
    }
    if (q.includes('producto') || q.includes('top') || q.includes('estrella')) {
      if (topProductos.length === 0) return '🏆 Aún no hay productos vendidos hoy.'
      return `🏆 Productos más vendidos:\n\n${topProductos.slice(0,5).map((p,i) => `${i+1}. ${p.emoji || '📦'} ${p.nombre}\n   ${p.total_vendido} uds · Q${parseFloat(p.total_dinero).toFixed(2)}`).join('\n\n')}`
    }
    if (q.includes('stock') || q.includes('inventario') || q.includes('agotad') || q.includes('bajo')) {
      if (stockBajo.length === 0) return '📦 ¡Excelente! Todo el inventario está en buen estado.'
      const agotados = stockBajo.filter(p => p.stock === 0)
      const bajos = stockBajo.filter(p => p.stock > 0)
      return `📦 Estado del inventario:\n\n❌ Agotados (${agotados.length}):\n${agotados.map(p => `• ${p.emoji || '📦'} ${p.nombre}`).join('\n') || 'Ninguno'}\n\n⚠️ Stock bajo (${bajos.length}):\n${bajos.map(p => `• ${p.emoji || '📦'} ${p.nombre}: ${p.stock} uds`).join('\n') || 'Ninguno'}`
    }
    if (q.includes('comprar') || q.includes('pedir') || q.includes('reabast')) {
      if (stockBajo.length === 0) return '✅ No necesitas comprar nada urgente.'
      return `🛒 Lista de compras urgente:\n\n${stockBajo.map((p,i) => `${i+1}. ${p.emoji || '📦'} ${p.nombre}\n   Stock: ${p.stock} | Mínimo: ${p.stock_minimo}\n   ${p.stock === 0 ? '🚨 AGOTADO' : '⚠️ Stock bajo'}`).join('\n\n')}`
    }
    if (q.includes('pago') || q.includes('efectivo') || q.includes('tarjeta')) {
      if (porMetodo.length === 0) return '💳 No hay datos actuales de métodos de pago hoy.'
      return `💳 Ventas por método:\n\n${porMetodo.map(m => `${m.metodo_pago === 'efectivo' ? '💵' : m.metodo_pago === 'tarjeta' ? '💳' : '📱'} ${m.metodo_pago}\n   ${m.cantidad} ventas · Q${parseFloat(m.total).toFixed(2)}`).join('\n\n')}`
    }
    if (q.includes('margen') || q.includes('ganancia')) {
      return `📈 Análisis de ganancias:\n\n💰 Ventas: Q${totalVentas.toFixed(2)}\n📊 Ganancia estimada (~30%): Q${(totalVentas * 0.3).toFixed(2)}\n🏷️ IVA: Q${totalIva.toFixed(2)}`
    }
    if (q.includes('resumen') || q.includes('como va') || q.includes('cómo va')) {
      return `📊 Resumen del negocio:\n\n💰 Ventas: Q${totalVentas.toFixed(2)}\n🧾 Transacciones: ${totalTx}\n📦 Stock bajo: ${stockBajo.length} productos\n${topProductos.length > 0 ? `🏆 Producto estrella: ${topProductos[0]?.nombre}` : '🏆 Sin ventas aún'}\n\n${stockBajo.length > 0 ? `🚨 ${stockBajo.filter(p=>p.stock===0).length} productos agotados` : '✅ Inventario saludable'}`
    }
    if (q.includes('consejo') || q.includes('recomienda')) {
      const consejos = []
      if (stockBajo.filter(p=>p.stock===0).length > 0) consejos.push('🚨 Reabastece los productos agotados')
      if (stockBajo.length > 0) consejos.push('⚠️ Compra los productos con stock bajo')
      if (totalVentas === 0) consejos.push('💡 Registra tus ventas del día')
      if (totalTx > 0 && totalVentas/totalTx < 50) consejos.push('📈 Ticket promedio bajo, considera hacer combos')
      if (consejos.length === 0) consejos.push('✅ Todo va bien, sigue así!')
      return `💡 Recomendaciones:\n\n${consejos.map((c,i) => `${i+1}. ${c}`).join('\n\n')}`
    }
    return `🤖 Puedes preguntarme sobre:\n• Ventas de hoy\n• Productos más vendidos\n• Stock e inventario\n• Qué comprar\n• Métodos de pago\n• Márgenes de ganancia\n• Resumen del negocio`
  }

  const enviar = async () => {
    const texto = input.trim()
    if (!texto) return
    setMensajes(prev => [...prev, { id: Date.now(), rol: 'user', texto }])
    setInput('')
    setCargando(true)
    await new Promise(r => setTimeout(r, 600))
    const response = await dashboardService.obtener()
    setDatos(response.data)
    const respuesta = generarRespuestaConDatos(texto, response.data)
    setMensajes(prev => [...prev, { id: Date.now() + 1, rol: 'bot', texto: respuesta }])
    setCargando(false)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
  }

  const preguntasRapidas = ['💰 Ventas hoy', '🏆 Top productos', '📦 Stock bajo', '🛒 Qué comprar', '📊 Resumen', '💡 Consejos']

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: tema.fondo }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* MENSAJES */}
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {mensajes.map(msg => (
          <View key={msg.id} style={{ flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', justifyContent: msg.rol === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.rol === 'bot' && (
              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
                <Text>🤖</Text>
              </View>
            )}
            <View style={{
              maxWidth: '78%', borderRadius: 16, padding: 12,
              backgroundColor: msg.rol === 'user' ? tema.primario : tema.fondoCard,
              borderBottomRightRadius: msg.rol === 'user' ? 4 : 16,
              borderBottomLeftRadius: msg.rol === 'bot' ? 4 : 16,
              borderWidth: msg.rol === 'bot' ? 1 : 0,
              borderColor: tema.borde
            }}>
              <Text style={{ fontSize: 14, lineHeight: 20, color: msg.rol === 'user' ? '#fff' : tema.texto }}>{msg.texto}</Text>
            </View>
          </View>
        ))}
        {cargando && (
          <View style={{ flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end' }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#e8f0fe', alignItems: 'center', justifyContent: 'center', marginRight: 8 }}>
              <Text>🤖</Text>
            </View>
            <View style={{ borderRadius: 16, padding: 14, backgroundColor: tema.fondoCard, borderWidth: 1, borderColor: tema.borde }}>
              <ActivityIndicator size="small" color={tema.primario} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* PREGUNTAS RÁPIDAS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44, backgroundColor: tema.fondoCard, borderTopWidth: 1, borderColor: tema.borde }} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
        {preguntasRapidas.map((p, i) => (
          <TouchableOpacity key={i} style={{ backgroundColor: tema.primario + '20', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'center' }} onPress={() => setInput(p.replace(/[^\w\s¿?áéíóúñ]/gi, '').trim())}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: tema.primario }}>{p}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* INPUT */}
      <View style={{ flexDirection: 'row', padding: 12, backgroundColor: tema.fondoCard, borderTopWidth: 1, borderColor: tema.borde, gap: 8 }}>
        <TextInput
          style={{ flex: 1, borderWidth: 1, borderColor: tema.borde, borderRadius: 12, padding: 12, fontSize: 14, backgroundColor: tema.fondoInput, color: tema.texto }}
          placeholder="Pregúntame algo..."
          placeholderTextColor={tema.textoTerciario}
          value={input}
          onChangeText={setInput}
          onSubmitEditing={enviar}
          returnKeyType="send"
        />
        <TouchableOpacity
          style={{ backgroundColor: input.trim() ? tema.primario : tema.textoTerciario, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' }}
          onPress={enviar}
          disabled={!input.trim() || cargando}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Enviar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}