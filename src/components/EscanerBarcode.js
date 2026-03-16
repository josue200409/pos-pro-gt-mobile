import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'

export default function EscanerBarcode({ visible, onScan, onCerrar, titulo }) {
  const [permission, requestPermission] = useCameraPermissions()
  const [escaneado, setEscaneado] = useState(false)

  useEffect(() => {
    if (visible) {
      setEscaneado(false)
    }
  }, [visible])

  const handleScan = ({ data }) => {
    if (escaneado) return
    setEscaneado(true)
    onScan(data)
  }

  if (!visible) return null

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.titulo}>{titulo || 'Escanear Codigo'}</Text>
          <TouchableOpacity style={styles.btnCerrar} onPress={onCerrar}>
            <Text style={styles.btnCerrarTexto}>X Cerrar</Text>
          </TouchableOpacity>
        </View>

        {!permission ? (
          <View style={styles.centro}>
            <Text style={styles.mensajeTexto}>Solicitando permiso...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.centro}>
            <Text style={styles.errorEmoji}>📷</Text>
            <Text style={styles.errorTexto}>Sin acceso a la camara</Text>
            <Text style={styles.errorSub}>Necesitas permitir el acceso a la camara</Text>
            <TouchableOpacity style={styles.btnReintentar} onPress={requestPermission}>
              <Text style={styles.btnReintentarTexto}>Dar Permiso</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.scannerContainer}>
            <CameraView
              style={styles.scanner}
              facing="back"
              onBarcodeScanned={handleScan}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'ean13', 'ean8', 'upc_a', 'upc_e',
                  'code39', 'code128', 'qr', 'pdf417'
                ]
              }}
            />
            <View style={styles.overlay}>
              <View style={styles.overlayTop} />
              <View style={styles.overlayMiddle}>
                <View style={styles.overlaySide} />
                <View style={styles.scanArea}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <View style={styles.overlaySide} />
              </View>
              <View style={styles.overlayBottom}>
                <Text style={styles.instruccion}>
                  Apunta la camara al codigo de barras
                </Text>
                {escaneado && (
                  <TouchableOpacity
                    style={styles.btnNuevoScan}
                    onPress={() => setEscaneado(false)}
                  >
                    <Text style={styles.btnNuevoScanTexto}>Escanear otro</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 20, paddingTop: 56,
    backgroundColor: '#0d1117'
  },
  titulo: { fontSize: 18, fontWeight: '900', color: '#fff' },
  btnCerrar: {
    backgroundColor: '#1e2530', paddingHorizontal: 14,
    paddingVertical: 8, borderRadius: 10
  },
  btnCerrarTexto: { color: '#fff', fontWeight: '700', fontSize: 13 },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  mensajeTexto: { color: '#9ca3af', fontSize: 16 },
  errorEmoji: { fontSize: 60, marginBottom: 16 },
  errorTexto: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 8 },
  errorSub: { fontSize: 13, color: '#9ca3af', textAlign: 'center', marginBottom: 24 },
  btnReintentar: {
    backgroundColor: '#1a56db', paddingHorizontal: 24,
    paddingVertical: 12, borderRadius: 12
  },
  btnReintentarTexto: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scannerContainer: { flex: 1, position: 'relative' },
  scanner: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayMiddle: { flexDirection: 'row', height: 250 },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanArea: { width: 250, height: 250, position: 'relative' },
  overlayBottom: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center', paddingTop: 24
  },
  instruccion: { color: '#fff', fontSize: 14, fontWeight: '600' },
  corner: {
    position: 'absolute', width: 30, height: 30,
    borderColor: '#1a56db', borderWidth: 4
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
  btnNuevoScan: {
    backgroundColor: '#1a56db', paddingHorizontal: 24,
    paddingVertical: 12, borderRadius: 12, marginTop: 16
  },
  btnNuevoScanTexto: { color: '#fff', fontWeight: '700', fontSize: 14 }
})