import { useContext } from 'react'
import { DemoDataContext } from './DemoDataContext'

export function useDemoData() {
  const context = useContext(DemoDataContext)
  if (!context) {
    throw new Error('useDemoData debe utilizarse dentro de DemoDataProvider.')
  }
  return context
}
