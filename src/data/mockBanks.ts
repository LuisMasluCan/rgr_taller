export type BankAccountType = 'Efectivo' | 'Banco' | 'Tarjeta de crédito' | 'Billetera'

export type BankAccount = {
  id: string
  name: string
  number: string
  type: BankAccountType
  initialBalance: number
  currentBalance: number
}

export type BankMovement = {
  id: string
  date: string
  concept: string
  type: 'Ingreso' | 'Egreso'
  amount: number
}

export const mockBanks: BankAccount[] = [
  { id: 'bank-cash-pen', name: 'Caja - Efectivo Soles', number: 'CAJA-PEN', type: 'Efectivo', initialBalance: 0, currentBalance: 0 },
  { id: 'bank-cash-usd', name: 'Caja - Efectivo Dólares', number: 'CAJA-USD', type: 'Efectivo', initialBalance: 0, currentBalance: 0 },
  { id: 'bank-credit-card-pen', name: 'Banco - Tarjeta de Crédito Soles', number: 'TARJETA-CREDITO-PEN', type: 'Tarjeta de crédito', initialBalance: 0, currentBalance: 0 },
  { id: 'bank-debit-card-pen', name: 'Banco - Tarjeta de Débito Soles', number: 'TARJETA-DEBITO-PEN', type: 'Banco', initialBalance: 0, currentBalance: 0 },
  { id: 'bank-transfer', name: 'Banco - Transferencia', number: 'TRANSFERENCIA', type: 'Banco', initialBalance: 0, currentBalance: 0 },
  { id: 'wallet-yape', name: 'Billetera - Yape', number: 'YAPE', type: 'Billetera', initialBalance: 0, currentBalance: 0 },
  { id: 'wallet-plin', name: 'Billetera - Plin', number: 'PLIN', type: 'Billetera', initialBalance: 0, currentBalance: 0 },
]

export const mockBankMovements: Record<string, BankMovement[]> = Object.fromEntries(
  mockBanks.map((account) => [account.id, []]),
)
