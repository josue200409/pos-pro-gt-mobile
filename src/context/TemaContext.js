import React, { createContext, useContext, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

const TemaContext = createContext()

export const TEMAS = {
  oscuro: {
    nombre: 'oscuro',
    fondo: '#0d1117',
    fondoCard: '#161b22',
    fondoInput: '#0d1117',
    fondoSecundario: '#1e2530',
    borde: '#30363d',
    texto: '#ffffff',
    textoSecundario: '#9ca3af',
    textoTerciario: '#6b7280',
    primario: '#1a56db',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    fondoLista: '#0d1117',
    fondoItem: '#161b22',
    bordeItem: '#30363d',
  },
  claro: {
    nombre: 'claro',
    fondo: '#f0f2f5',
    fondoCard: '#ffffff',
    fondoInput: '#f8f9fb',
    fondoSecundario: '#e2e5eb',
    borde: '#e2e5eb',
    texto: '#111827',
    textoSecundario: '#374151',
    textoTerciario: '#6b7280',
    primario: '#1a56db',
    success: '#059669',
    warning: '#d97706',
    danger: '#dc2626',
    fondoLista: '#f0f2f5',
    fondoItem: '#ffffff',
    bordeItem: '#e2e5eb',
  }
}

export const TemaProvider = ({ children }) => {
  const [modoOscuro, setModoOscuro] = useState(true)

  useEffect(() => { cargarTema() }, [])

  const cargarTema = async () => {
    const guardado = await AsyncStorage.getItem('modo_oscuro')
    if (guardado !== null) setModoOscuro(guardado === 'true')
  }

  const toggleTema = async () => {
    const nuevo = !modoOscuro
    setModoOscuro(nuevo)
    await AsyncStorage.setItem('modo_oscuro', String(nuevo))
  }

  const tema = modoOscuro ? TEMAS.oscuro : TEMAS.claro

  return (
    <TemaContext.Provider value={{ tema, modoOscuro, toggleTema }}>
      {children}
    </TemaContext.Provider>
  )
}

export const useTema = () => useContext(TemaContext)