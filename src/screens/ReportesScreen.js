import React, { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  RefreshControl, Alert, Modal, TextInput
} from 'react-native'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { ventasService } from '../services/api'
import { useTema } from '../context/TemaContext'

export default function ReportesScreen() {
  const { tema } = useTema()
  const [resumenHoy, setResumenHoy] = useState(null)
  const [ventasHoy, setVentasHoy] = useState([])
  const [historial, setHistorial] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [modalFecha, setModalFecha] = useState(false)
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  useEffect(() => { cargarDatos() }, [])

  const cargarDatos = async () => {
    try {
      const hoy = new Date()
      const hace7 = new Date(hoy - 7 * 24 * 60 * 60 * 1000)
      const [resHoy, vHoy, hist] = await Promise.all([
        ventasService.resumenHoy(),
        ventasService.obtenerTodas(),
        ventasService.resumenRango(hace7.toISOString().split('T')[0], hoy.toISOString().split('T')[0])
      ])
      setResumenHoy(resHoy.data)
      setVentasHoy(vHoy.data)
      setHistorial(hist.data)
    } catch (e) { console.log('Error:', e) }
    finally { setRefreshing(false) }
  }

  const totalEfectivo = ventasHoy.filter(v => v.metodo_pago === 'efectivo').reduce((s, v) => s + parseFloat(v.total || 0), 0)
  const totalTarjeta = ventasHoy.filter(v => v.metodo_pago === 'tarjeta').reduce((s, v) => s + parseFloat(v.total || 0), 0)
  const totalTransferencia = ventasHoy.filter(v => v.metodo_pago === 'transferencia' || v.metodo_pago === 'qr').reduce((s, v) => s + parseFloat(v.total || 0), 0)
  const totalVuelto = ventasHoy.reduce((s, v) => s + parseFloat(v.vuelto || 0), 0)
  const totalGeneral = parseFloat(resumenHoy?.total_ventas || 0)
  const efectivoNeto = totalEfectivo - totalVuelto

  const formatFecha = (iso) => iso ? new Date(iso).toLocaleDateString('es-GT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : ''
  const formatFechaCorta = (iso) => iso ? new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
  const formatHora = (iso) => iso ? new Date(iso).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' }) : ''

  const generarHTMLDia = () => {
    const filas = ventasHoy.map((v, i) => `
      <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center">${i + 1}</td>
        <td style="padding:8px;border:1px solid #e5e7eb">${formatHora(v.created_at)}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center">${v.metodo_pago}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right">Q${parseFloat(v.total).toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right;color:#d97706">${v.vuelto > 0 ? `Q${parseFloat(v.vuelto).toFixed(2)}` : '-'}</td>
      </tr>`).join('')

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#111827}
      .header{background:#0d1117;color:white;padding:24px;border-radius:12px;margin-bottom:24px}
      .header h1{margin:0;font-size:24px}.header p{margin:4px 0 0;color:#9ca3af;font-size:13px}
      .grid{display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap}
      .card{flex:1;min-width:120px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px;text-align:center}
      .card .val{font-size:22px;font-weight:900;color:#1a56db}.card .lbl{font-size:11px;color:#6b7280;margin-top:4px}
      .cuadre{background:#f0fdf4;border:2px solid #059669;border-radius:10px;padding:16px;margin-bottom:24px}
      .cuadre-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #d1fae5}
      .cuadre-total{display:flex;justify-content:space-between;padding:10px 0;font-weight:900;font-size:18px;color:#059669}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#0d1117;color:white;padding:10px;text-align:left}
      h2{font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;border-bottom:2px solid #e5e7eb;padding-bottom:6px}
      .footer{text-align:center;color:#9ca3af;font-size:11px;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb}
    </style></head><body>
    <div class="header">
      <h1>POS Pro GT - Reporte de Caja</h1>
      <p>${formatFecha(new Date())}</p>
      <p>Generado: ${new Date().toLocaleString('es-GT')}</p>
    </div>
    <h2>Resumen del Dia</h2>
    <div class="grid">
      <div class="card"><div class="val">Q${totalGeneral.toFixed(2)}</div><div class="lbl">Total Ventas</div></div>
      <div class="card"><div class="val" style="color:#7c3aed">${ventasHoy.length}</div><div class="lbl">Transacciones</div></div>
      <div class="card"><div class="val" style="color:#059669">Q${ventasHoy.length > 0 ? (totalGeneral / ventasHoy.length).toFixed(2) : '0.00'}</div><div class="lbl">Promedio</div></div>
    </div>
    <h2>Cuadre de Caja</h2>
    <div class="cuadre">
      <div class="cuadre-row"><span>Ventas en Efectivo</span><span>Q${totalEfectivo.toFixed(2)}</span></div>
      <div class="cuadre-row" style="color:#dc2626"><span>Vuelto Entregado</span><span>- Q${totalVuelto.toFixed(2)}</span></div>
      <div class="cuadre-row"><span>Tarjeta</span><span>Q${totalTarjeta.toFixed(2)}</span></div>
      <div class="cuadre-row"><span>Transferencia / QR</span><span>Q${totalTransferencia.toFixed(2)}</span></div>
      <div class="cuadre-total"><span>EFECTIVO NETO EN CAJA</span><span>Q${efectivoNeto.toFixed(2)}</span></div>
    </div>
    <h2>Detalle de Transacciones (${ventasHoy.length})</h2>
    <table>
      <thead><tr><th style="text-align:center">#</th><th>Hora</th><th style="text-align:center">Metodo</th><th style="text-align:right">Total</th><th style="text-align:right">Vuelto</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr style="background:#0d1117;color:white;font-weight:900">
        <td colspan="3" style="padding:10px;border:1px solid #374151">TOTAL</td>
        <td style="padding:10px;border:1px solid #374151;text-align:right">Q${totalGeneral.toFixed(2)}</td>
        <td style="padding:10px;border:1px solid #374151;text-align:right">Q${totalVuelto.toFixed(2)}</td>
      </tr></tfoot>
    </table>
    <div class="footer">POS Pro GT - Guatemala | Reporte generado automaticamente</div>
    </body></html>`
  }

  const generarHTMLRango = (desde, hasta, datos) => {
    const totalRango = datos.reduce((s, d) => s + parseFloat(d.total || 0), 0)
    const totalTxRango = datos.reduce((s, d) => s + parseInt(d.transacciones || 0), 0)
    const filas = datos.map((d, i) => `
      <tr style="background:${i % 2 === 0 ? '#f9fafb' : '#fff'}">
        <td style="padding:8px;border:1px solid #e5e7eb">${formatFechaCorta(d.fecha)}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:center">${d.transacciones}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right">Q${parseFloat(d.total).toFixed(2)}</td>
        <td style="padding:8px;border:1px solid #e5e7eb;text-align:right">Q${parseFloat(d.promedio || 0).toFixed(2)}</td>
      </tr>`).join('')

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
    <style>
      body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#111827}
      .header{background:#0d1117;color:white;padding:24px;border-radius:12px;margin-bottom:24px}
      .header h1{margin:0;font-size:24px}.header p{margin:4px 0 0;color:#9ca3af;font-size:13px}
      .grid{display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap}
      .card{flex:1;min-width:120px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px;text-align:center}
      .card .val{font-size:22px;font-weight:900;color:#1a56db}.card .lbl{font-size:11px;color:#6b7280;margin-top:4px}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th{background:#0d1117;color:white;padding:10px;text-align:left}
      h2{font-size:14px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;border-bottom:2px solid #e5e7eb;padding-bottom:6px}
      .footer{text-align:center;color:#9ca3af;font-size:11px;margin-top:32px;padding-top:16px;border-top:1px solid #e5e7eb}
    </style></head><body>
    <div class="header">
      <h1>POS Pro GT - Reporte de Ventas</h1>
      <p>Periodo: ${formatFechaCorta(desde)} al ${formatFechaCorta(hasta)}</p>
      <p>Generado: ${new Date().toLocaleString('es-GT')}</p>
    </div>
    <div class="grid">
      <div class="card"><div class="val">Q${totalRango.toFixed(2)}</div><div class="lbl">Total Vendido</div></div>
      <div class="card"><div class="val" style="color:#7c3aed">${totalTxRango}</div><div class="lbl">Transacciones</div></div>
      <div class="card"><div class="val" style="color:#059669">${datos.length}</div><div class="lbl">Dias con Ventas</div></div>
      <div class="card"><div class="val" style="color:#d97706">Q${datos.length > 0 ? (totalRango / datos.length).toFixed(2) : '0.00'}</div><div class="lbl">Promedio por Dia</div></div>
    </div>
    <h2>Ventas por Dia</h2>
    <table>
      <thead><tr><th>Fecha</th><th style="text-align:center">Transacciones</th><th style="text-align:right">Total</th><th style="text-align:right">Promedio</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr style="background:#0d1117;color:white;font-weight:900">
        <td style="padding:10px;border:1px solid #374151">TOTAL ${datos.length} dias</td>
        <td style="padding:10px;border:1px solid #374151;text-align:center">${totalTxRango}</td>
        <td style="padding:10px;border:1px solid #374151;text-align:right">Q${totalRango.toFixed(2)}</td>
        <td style="padding:10px;border:1px solid #374151;text-align:right">Q${datos.length > 0 ? (totalRango / datos.length).toFixed(2) : '0.00'}</td>
      </tr></tfoot>
    </table>
    <div class="footer">POS Pro GT - Guatemala | Reporte generado automaticamente</div>
    </body></html>`
  }

  const exportarDia = async () => {
    try {
      setGenerando(true)
      const { uri } = await Print.printToFileAsync({ html: generarHTMLDia(), base64: false })
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Reporte de Hoy', UTI: 'com.adobe.pdf' })
    } catch { Alert.alert('Error', 'No se pudo generar el reporte') }
    finally { setGenerando(false) }
  }

  const imprimirDia = async () => {
    try {
      setGenerando(true)
      await Print.printAsync({ html: generarHTMLDia() })
    } catch { Alert.alert('Error', 'No se pudo imprimir') }
    finally { setGenerando(false) }
  }

  const exportarRango = async () => {
    if (!fechaDesde || !fechaHasta) { Alert.alert('Error', 'Ingresa las fechas'); return }
    try {
      setGenerando(true)
      const response = await ventasService.resumenRango(fechaDesde, fechaHasta)
      const { uri } = await Print.printToFileAsync({ html: generarHTMLRango(fechaDesde, fechaHasta, response.data), base64: false })
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Reporte ${fechaDesde} al ${fechaHasta}`, UTI: 'com.adobe.pdf' })
      setModalFecha(false)
    } catch { Alert.alert('Error', 'No se pudo generar el reporte') }
    finally { setGenerando(false) }
  }

  return (
    <View style={{ flex: 1, backgroundColor: tema.fondo }}>
      <View style={{ backgroundColor: tema.fondoCard, padding: 20, borderBottomWidth: 1, borderColor: tema.borde }}>
        <Text style={{ fontSize: 22, fontWeight: '900', color: tema.texto }}>Reportes</Text>
        <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 2, textTransform: 'capitalize' }}>{formatFecha(new Date())}</Text>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargarDatos() }} tintColor={tema.primario} />}>

        {/* RESUMEN */}
        <View style={{ backgroundColor: tema.primario, margin: 16, borderRadius: 16, padding: 20 }}>
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '700', marginBottom: 12 }}>RESUMEN DE HOY</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {[
              { val: `Q${totalGeneral.toFixed(2)}`, label: 'Total' },
              { val: ventasHoy.length, label: 'Transacciones' },
              { val: `Q${totalVuelto.toFixed(2)}`, label: 'Vuelto' },
            ].map(({ val, label }) => (
              <View key={label} style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>{val}</Text>
                <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* DESGLOSE */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 10 }}>Desglose por Metodo</Text>
          <View style={{ backgroundColor: tema.fondoCard, borderRadius: 14, borderWidth: 1, borderColor: tema.borde, overflow: 'hidden' }}>
            {[
              { label: '💵 Efectivo', val: totalEfectivo, color: tema.success },
              { label: '💳 Tarjeta', val: totalTarjeta, color: tema.primario },
              { label: '📱 Transferencia/QR', val: totalTransferencia, color: '#7c3aed' },
              { label: '🔄 Vuelto Entregado', val: totalVuelto, color: tema.danger, negativo: true },
            ].map(({ label, val, color, negativo }) => (
              <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderColor: tema.borde }}>
                <Text style={{ fontSize: 13, color: tema.textoSecundario }}>{label}</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color }}>{negativo ? '-' : ''}Q{val.toFixed(2)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#d1fae522' }}>
              <Text style={{ fontSize: 14, fontWeight: '900', color: tema.texto }}>💰 Efectivo Neto</Text>
              <Text style={{ fontSize: 15, fontWeight: '900', color: tema.success }}>Q{efectivoNeto.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* EXPORTAR */}
        <View style={{ paddingHorizontal: 16, marginBottom: 16 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 10 }}>Exportar Reportes</Text>
          {[
            { label: 'Reporte de Hoy (PDF)', sub: 'Cuadre de caja + transacciones', emoji: '📄', color: tema.primario, onPress: exportarDia },
            { label: 'Imprimir Directo', sub: 'Enviar a impresora o guardar', emoji: '🖨️', color: '#7c3aed', onPress: imprimirDia },
            { label: 'Reporte por Rango (PDF)', sub: 'Selecciona fechas de inicio y fin', emoji: '📊', color: tema.success, onPress: () => { const hoy = new Date(); const hace7 = new Date(hoy - 7 * 24 * 60 * 60 * 1000); setFechaDesde(hace7.toISOString().split('T')[0]); setFechaHasta(hoy.toISOString().split('T')[0]); setModalFecha(true) } },
          ].map(({ label, sub, emoji, color, onPress }) => (
            <TouchableOpacity key={label} style={{ backgroundColor: color, borderRadius: 14, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 10 }} onPress={onPress} disabled={generando}>
              <Text style={{ fontSize: 24, marginRight: 12 }}>{emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{label}</Text>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{sub}</Text>
              </View>
              <Text style={{ fontSize: 18, color: '#fff', fontWeight: '700' }}>→</Text>
            </TouchableOpacity>
          ))}
          {generando && (
            <View style={{ backgroundColor: tema.fondoSecundario, borderRadius: 10, padding: 14, alignItems: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: tema.primario }}>Generando PDF...</Text>
            </View>
          )}
        </View>

        {/* HISTORIAL 7 DIAS */}
        <View style={{ paddingHorizontal: 16, marginBottom: 24 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 10 }}>Ultimos 7 Dias</Text>
          {historial.length === 0 ? (
            <View style={{ alignItems: 'center', padding: 24 }}>
              <Text style={{ fontSize: 14, color: tema.textoTerciario }}>Sin datos en los ultimos 7 dias</Text>
            </View>
          ) : historial.map((h, i) => (
            <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: tema.fondoCard, borderRadius: 10, padding: 14, marginBottom: 6, borderWidth: 1, borderColor: tema.borde }}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: tema.texto, textTransform: 'capitalize' }}>
                  {new Date(h.fecha).toLocaleDateString('es-GT', { weekday: 'short', day: '2-digit', month: 'short' })}
                </Text>
                <Text style={{ fontSize: 11, color: tema.textoTerciario, marginTop: 2 }}>{h.transacciones} transacciones</Text>
              </View>
              <Text style={{ fontSize: 15, fontWeight: '900', color: tema.primario }}>Q{parseFloat(h.total).toFixed(2)}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* MODAL RANGO */}
      <Modal visible={modalFecha} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: tema.fondoCard, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: tema.texto, marginBottom: 4 }}>Reporte por Rango</Text>
            <Text style={{ fontSize: 12, color: tema.textoTerciario, marginBottom: 16 }}>Formato: AAAA-MM-DD (ej: 2025-01-15)</Text>
            {[{ label: 'Fecha Inicio', val: fechaDesde, set: setFechaDesde, ph: '2025-01-01' }, { label: 'Fecha Fin', val: fechaHasta, set: setFechaHasta, ph: '2025-01-31' }].map(({ label, val, set, ph }) => (
              <View key={label} style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: tema.textoTerciario, textTransform: 'uppercase', marginBottom: 4 }}>{label}</Text>
                <TextInput style={{ borderWidth: 1, borderColor: tema.borde, borderRadius: 10, padding: 12, fontSize: 14, backgroundColor: tema.fondoInput, color: tema.texto }} placeholder={ph} placeholderTextColor={tema.textoTerciario} value={val} onChangeText={set} />
              </View>
            ))}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {[{ label: 'Hoy', dias: 0 }, { label: '7 dias', dias: 7 }, { label: '15 dias', dias: 15 }, { label: '30 dias', dias: 30 }].map(({ label, dias }) => (
                <TouchableOpacity key={label} style={{ backgroundColor: tema.fondoSecundario, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 }} onPress={() => { const hoy = new Date(); setFechaDesde(new Date(hoy - dias * 24 * 60 * 60 * 1000).toISOString().split('T')[0]); setFechaHasta(hoy.toISOString().split('T')[0]) }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: tema.texto }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: tema.borde, alignItems: 'center' }} onPress={() => setModalFecha(false)}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: tema.textoTerciario }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: tema.success, alignItems: 'center' }} onPress={exportarRango} disabled={generando}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{generando ? 'Generando...' : 'Generar PDF'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}