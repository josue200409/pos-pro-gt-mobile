import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Image, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform
} from 'react-native'
import { authService } from '../services/api'
import AsyncStorage from '@react-native-async-storage/async-storage'

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [cargando, setCargando] = useState(false)
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)      // mensaje de error inline
  const [intentosRestantes, setIntentosRestantes] = useState(null)
  const [bloqueada, setBloqueada] = useState(false)

  const handleLogin = async () => {
    const emailLimpio = email.trim().toLowerCase()
    const passLimpio = password.trim()

    if (!emailLimpio || !passLimpio) {
      setErrorMsg('Ingresa tu correo y contraseña')
      return
    }

    setErrorMsg(null)
    setIntentosRestantes(null)
    setCargando(true)

    try {
      const response = await authService.login(emailLimpio, passLimpio)
      const { token, usuario } = response.data
      await AsyncStorage.setItem('token', token)
      await AsyncStorage.setItem('usuario', JSON.stringify(usuario))
      setBloqueada(false)
      onLogin(usuario)
    } catch (error) {
      const data = error.response?.data
      const msg = data?.error || 'No se pudo conectar al servidor'

      if (data?.bloqueada) {
        setBloqueada(true)
        setErrorMsg(msg)
        setIntentosRestantes(null)
      } else if (data?.intentos_restantes !== undefined) {
        setIntentosRestantes(data.intentos_restantes)
        setErrorMsg(msg)
      } else {
        setErrorMsg(msg)
      }
    } finally {
      setCargando(false)
    }
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          {/* FONDO */}
          <View style={styles.fondoSuperior}>
            <View style={styles.circulo1} />
            <View style={styles.circulo2} />
          </View>

          {/* LOGO */}
          <View style={styles.logoContainer}>
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.appNombre}>POS Pro GT</Text>
            <Text style={styles.appSlogan}>Sistema de Punto de Venta</Text>
          </View>

          {/* CARD */}
          <View style={styles.card}>
            <Text style={styles.cardTitulo}>Iniciar Sesión</Text>
            <Text style={styles.cardSub}>Ingresa tus credenciales para continuar</Text>

            {/* BANNER DE ERROR */}
            {errorMsg && (
              <View style={[
                styles.errorBanner,
                bloqueada && styles.errorBannerBloqueado
              ]}>
                <Text style={styles.errorBannerEmoji}>
                  {bloqueada ? '🔒' : '❌'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorBannerTexto}>{errorMsg}</Text>
                  {intentosRestantes !== null && intentosRestantes > 0 && (
                    <View style={styles.intentosRow}>
                      {[...Array(5)].map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.intentoBullet,
                            i < intentosRestantes
                              ? styles.intentoBulletActivo
                              : styles.intentoBulletUsado
                          ]}
                        />
                      ))}
                      <Text style={styles.intentosTexto}>
                        {intentosRestantes} intentos restantes
                      </Text>
                    </View>
                  )}
                  {bloqueada && (
                    <Text style={styles.bloqueadoSub}>
                      Contacta al administrador para desbloquear tu cuenta
                    </Text>
                  )}
                </View>
              </View>
            )}

            {/* EMAIL */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Correo Electrónico</Text>
              <View style={[
                styles.inputWrapper,
                bloqueada && { borderColor: '#EF4444' }
              ]}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput
                  style={styles.input}
                  placeholder="correo@ejemplo.com"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={(v) => { setEmail(v); setErrorMsg(null); setBloqueada(false) }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  editable={!bloqueada}
                />
              </View>
            </View>

            {/* PASSWORD */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Contraseña</Text>
              <View style={[
                styles.inputWrapper,
                bloqueada && { borderColor: '#EF4444' }
              ]}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Tu contraseña"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={(v) => { setPassword(v); setErrorMsg(null) }}
                  secureTextEntry={!mostrarPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!bloqueada}
                />
                <TouchableOpacity
                  style={styles.btnMostrar}
                  onPress={() => setMostrarPassword(!mostrarPassword)}
                >
                  <Text style={styles.btnMostrarTexto}>
                    {mostrarPassword ? '🙈' : '👁️'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* BOTON */}
            <TouchableOpacity
              style={[
                styles.btnLogin,
                (cargando || bloqueada) && styles.btnLoginDisabled
              ]}
              onPress={handleLogin}
              disabled={cargando || bloqueada}
            >
              {cargando ? (
                <View style={styles.btnLoginContent}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.btnLoginTexto}>Conectando...</Text>
                </View>
              ) : bloqueada ? (
                <Text style={styles.btnLoginTexto}>🔒 Cuenta Bloqueada</Text>
              ) : (
                <Text style={styles.btnLoginTexto}>Iniciar Sesión →</Text>
              )}
            </TouchableOpacity>

            <View style={styles.hint}>
              <Text style={styles.hintTexto}>
                {bloqueada
                  ? '🛡️ Por seguridad, contacta al administrador del sistema'
                  : '¿Problemas para ingresar? Contacta al administrador'
                }
              </Text>
            </View>
          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerTexto}>POS Pro GT © 2025</Text>
            <Text style={styles.footerSub}>Hecho para Guatemala 🇬🇹</Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d1117' },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  fondoSuperior: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 350, overflow: 'hidden'
  },
  circulo1: {
    position: 'absolute', width: 300, height: 300,
    borderRadius: 150, backgroundColor: '#1a56db22', top: -100, left: -50
  },
  circulo2: {
    position: 'absolute', width: 200, height: 200,
    borderRadius: 100, backgroundColor: '#7c3aed22', top: -50, right: -30
  },
  logoContainer: { alignItems: 'center', paddingTop: 80, paddingBottom: 32 },
  logoWrapper: {
    width: 110, height: 110, borderRadius: 28,
    backgroundColor: '#fff', alignItems: 'center',
    justifyContent: 'center', marginBottom: 16,
    shadowColor: '#1a56db', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16, elevation: 10
  },
  logo: { width: 85, height: 85 },
  appNombre: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  appSlogan: { fontSize: 13, color: '#9ca3af', marginTop: 4 },

  card: {
    backgroundColor: '#161b22', marginHorizontal: 20,
    borderRadius: 24, padding: 24,
    borderWidth: 1, borderColor: '#30363d'
  },
  cardTitulo: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 4 },
  cardSub: { fontSize: 13, color: '#9ca3af', marginBottom: 20 },

  // Banner de error
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#1f1215', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#EF4444', marginBottom: 16
  },
  errorBannerBloqueado: {
    backgroundColor: '#1a0a0a', borderColor: '#DC2626'
  },
  errorBannerEmoji: { fontSize: 20, marginTop: 2 },
  errorBannerTexto: { fontSize: 13, color: '#fca5a5', fontWeight: '600', lineHeight: 18 },
  bloqueadoSub: { fontSize: 11, color: '#f87171', marginTop: 4, lineHeight: 16 },

  intentosRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  intentoBullet: { width: 8, height: 8, borderRadius: 4 },
  intentoBulletActivo: { backgroundColor: '#22c55e' },
  intentoBulletUsado: { backgroundColor: '#EF4444' },
  intentosTexto: { fontSize: 11, color: '#fca5a5', marginLeft: 4 },

  inputGroup: { marginBottom: 16 },
  inputLabel: {
    fontSize: 12, fontWeight: '700', color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0d1117', borderRadius: 14,
    borderWidth: 1, borderColor: '#30363d', paddingHorizontal: 12
  },
  inputIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#fff' },
  btnMostrar: { padding: 4 },
  btnMostrarTexto: { fontSize: 18 },

  btnLogin: {
    backgroundColor: '#1a56db', borderRadius: 14,
    padding: 16, alignItems: 'center', marginTop: 8,
    shadowColor: '#1a56db', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6
  },
  btnLoginDisabled: { backgroundColor: '#1e2530' },
  btnLoginContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnLoginTexto: { fontSize: 16, fontWeight: '900', color: '#fff' },

  hint: { alignItems: 'center', marginTop: 16 },
  hintTexto: { fontSize: 12, color: '#9ca3af', textAlign: 'center' },

  footer: { alignItems: 'center', padding: 24, marginTop: 8 },
  footerTexto: { fontSize: 12, color: '#9ca3af' },
  footerSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 }
})