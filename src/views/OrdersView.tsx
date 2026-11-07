import {
  Archive,
  ArrowLeft,
  ArrowRight,
  Camera,
  CalendarDays,
  Check,
  CircleDollarSign,
  Eye,
  FileText,
  KeyRound,
  MessageCircle,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  UserRound,
  Wrench,
  X,
  Package,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useDemoData } from '../contexts/useDemoData'
import NumericInput from '../components/NumericInput'
import OrderActionsDropdown, { type OrderDocumentKind } from '../components/OrderActionsDropdown'
import WorkOrderPDFTemplate from '../components/WorkOrderPDFTemplate'
import { orderStages } from '../data/orderStages'
import { elapsedMinutes, formatDuration, orderWorkshopMinutes } from '../data/mockReports'
import type { Order, OrderPhoto, OrderQualityControl, OrderServiceItem } from '../types'

type OrderDraft = {
  customerId: string
  vehicleId: string
  quotationId: string
  dateISO: string
  mileage: string
  status: string
  reason: string
  technician: string
  comments: string
  arrivalPhotos: OrderPhoto[]
}

type QualityControlDraft = {
  fuelLevel: '' | 'Vacío' | '1/4' | '1/2' | '3/4' | 'Lleno'
  mileage: string
  resolution: string
  vehicleChecklist: string[]
  fluidsChecklist: string[]
  observations: string
  approved: boolean | null
}

const todayISO = () => {
  const localDate = new Date()
  localDate.setMinutes(localDate.getMinutes() - localDate.getTimezoneOffset())
  return localDate.toISOString().slice(0, 10)
}
const currentTimestamp = () => new Date().toISOString()
const blankDraft = (): OrderDraft => ({
  customerId: '',
  vehicleId: '',
  quotationId: '',
  dateISO: todayISO(),
  mileage: '',
  status: 'Recepción',
  reason: '',
  technician: '',
  comments: '',
  arrivalPhotos: [],
})

const maxArrivalPhotos = 10
const maxPhotoSize = 12 * 1024 * 1024
const maxOptimizedPhotoSize = 480 * 1024
const qualityResolutions = [
  'Falla resuelta',
  'Motor armado',
  'Motor limpio',
  'Tren motriz armado',
  'Vehículo listo para entrega',
]
const vehicleConditionChecks = [
  'Carrocería limpia',
  'Cabina limpia',
  'Cabina libre de herramienta',
  'Compartimiento de motor libre de herramienta',
]
const fluidChecks = [
  'Aceite de Motor',
  'Líquido de Frenos',
  'Líquido de Embrague',
  'Refrigerante',
  'Aceite Hidráulico',
  'Limpia Parabrisas',
]
const itemTypes: OrderServiceItem['type'][] = ['Mano de obra', 'Repuesto', 'Insumo', 'Servicio Compuesto', 'Adicional']
const stageIcons: Record<string, LucideIcon> = {
  Recepción: UserRound,
  Diagnóstico: Eye,
  Repuestos: Package,
  Aprobación: Check,
  Reparación: Wrench,
  Control: ShieldCheck,
  Entrega: FileText,
  Archivados: Archive,
}
const statusTimestampKeys: Record<string, 'fechaIngreso' | 'fechaDiagnostico' | 'fechaRepuestos' | 'fechaAprobacion' | 'fechaInicioReparacion' | 'fechaControl' | 'fechaEntrega' | 'fechaArchivado'> = {
  Recepción: 'fechaIngreso',
  Diagnóstico: 'fechaDiagnostico',
  Repuestos: 'fechaRepuestos',
  Aprobación: 'fechaAprobacion',
  Reparación: 'fechaInicioReparacion',
  Control: 'fechaControl',
  Entrega: 'fechaEntrega',
  Archivados: 'fechaArchivado',
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error(`No se pudo leer la fotografía ${file.name}.`))
    }
    reader.onerror = () => reject(new Error(`No se pudo leer la fotografía ${file.name}.`))
    reader.readAsDataURL(file)
  })
}

async function optimizePhoto(file: File): Promise<OrderPhoto> {
  if (!file.type.startsWith('image/')) throw new Error(`${file.name} no es una imagen válida.`)
  if (file.size > maxPhotoSize) throw new Error(`${file.name} supera el límite de 12 MB.`)

  const source = await readAsDataUrl(file)
  const image = new Image()
  image.src = source
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error(`No se pudo procesar la fotografía ${file.name}.`))
  })

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('El navegador no pudo preparar la fotografía.')

  let scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight))
  for (let attempt = 0; attempt < 8; attempt += 1) {
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.78, 0.68, 0.58, 0.48]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
      const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
      if (Math.floor(base64.length * 3 / 4) - padding <= maxOptimizedPhotoSize) {
        return { name: file.name, dataUrl }
      }
    }
    scale *= 0.8
  }
  throw new Error(`No se pudo reducir ${file.name} al tamaño permitido.`)
}

async function savePhoto(photo: OrderPhoto): Promise<OrderPhoto> {
  const response = await fetch('/api/photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(photo),
  })
  let result: unknown
  try {
    result = await response.json()
  } catch {
    throw new Error(`No se pudo guardar ${photo.name}: la API devolvió una respuesta inválida.`)
  }
  if (!response.ok) {
    const message = typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
      ? result.error
      : `La API respondió con el estado ${response.status}.`
    throw new Error(`No se pudo guardar ${photo.name}: ${message}`)
  }
  if (typeof result !== 'object' || result === null || !('dataUrl' in result) || typeof result.dataUrl !== 'string') {
    throw new Error(`No se pudo guardar ${photo.name}: la API devolvió datos inválidos.`)
  }
  return { name: photo.name, dataUrl: result.dataUrl }
}

function OrdersView() {
  const { orders, setOrders, clients, inventory, settings } = useDemoData()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeStage = orderStages.find((stage) => stage.name === searchParams.get('stage'))?.name ?? 'Entrega'
  const [search, setSearch] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [orderSubmitting, setOrderSubmitting] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null)
  const [draft, setDraft] = useState<OrderDraft>(blankDraft())
  const [photoError, setPhotoError] = useState('')
  const [photosProcessing, setPhotosProcessing] = useState(false)
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null)
  const [itemOrderId, setItemOrderId] = useState<string | null>(null)
  const [whatsAppOrderId, setWhatsAppOrderId] = useState<string | null>(null)
  const [pdfOrderId, setPdfOrderId] = useState<string | null>(null)
  const [pdfDocumentKind, setPdfDocumentKind] = useState<OrderDocumentKind>('service')
  const [advanceOrderId, setAdvanceOrderId] = useState<string | null>(null)
  const [approvalReviewOrderId, setApprovalReviewOrderId] = useState<string | null>(null)
  const [revertOrderId, setRevertOrderId] = useState<string | null>(null)
  const [inventoryOrderId, setInventoryOrderId] = useState<string | null>(null)
  const [diagnosisOrderId, setDiagnosisOrderId] = useState<string | null>(null)
  const [approvalOrderId, setApprovalOrderId] = useState<string | null>(null)
  const [qualityOrderId, setQualityOrderId] = useState<string | null>(null)
  const [diagnosisFindings, setDiagnosisFindings] = useState('')
  const [diagnosisPlan, setDiagnosisPlan] = useState('')
  const [diagnosisAdvancesOrder, setDiagnosisAdvancesOrder] = useState(false)
  const [approvalConfirmed, setApprovalConfirmed] = useState(false)
  const [qualityDraft, setQualityDraft] = useState<QualityControlDraft>({
    fuelLevel: '',
    mileage: '',
    resolution: '',
    vehicleChecklist: [],
    fluidsChecklist: [],
    observations: '',
    approved: null,
  })
  const [workflowError, setWorkflowError] = useState<{ orderId: string; message: string } | null>(null)
  const [orderItemSearch, setOrderItemSearch] = useState('')
  const [orderItemId, setOrderItemId] = useState('')
  const [orderItemQuantity, setOrderItemQuantity] = useState('1')
  const [activeOrderItemDescriptionId, setActiveOrderItemDescriptionId] = useState<string | null>(null)
  const [whatsAppSent, setWhatsAppSent] = useState(false)
  const [renderedAt, setRenderedAt] = useState(() => new Date().toISOString())
  const orderSequence = useRef(0)
  const orderSubmissionStarted = useRef(false)
  const navigate = useNavigate()

  const openNewOrder = () => {
    orderSubmissionStarted.current = false
    setOrderSubmitting(false)
    setEditingOrderId(null)
    setDraft(blankDraft())
    setPhotoError('')
    setModalOpen(true)
  }

  useEffect(() => {
    const handleCreateOrder = () => openNewOrder()
    window.addEventListener('rgr-taller:create-order', handleCreateOrder)
    return () => window.removeEventListener('rgr-taller:create-order', handleCreateOrder)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => setRenderedAt(new Date().toISOString()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const selectedClient = clients.find((client) => client.id === draft.customerId)
  const availableVehicles = selectedClient?.vehicles ?? []
  const selectedVehicle = availableVehicles.find((vehicle) => vehicle.id === draft.vehicleId)
  const availableQuotations = orders.filter((order) =>
    !editingOrderId &&
    !order.invoiced &&
    !order.convertedToOrderId &&
    order.quoteSaved &&
    Boolean(order.quoteItems?.length) &&
    order.customer === selectedClient?.name &&
    order.vehicle.plate === selectedVehicle?.plate,
  )
  const selectedQuotation = availableQuotations.find((order) => order.id === draft.quotationId)
  const detailOrder = orders.find((order) => order.id === detailOrderId) ?? null
  const diagnosisOrder = orders.find((order) => order.id === diagnosisOrderId) ?? null
  const approvalOrder = orders.find((order) => order.id === approvalOrderId) ?? null
  const qualityOrder = orders.find((order) => order.id === qualityOrderId) ?? null
  const itemOrder = orders.find((order) => order.id === itemOrderId) ?? null
  const whatsAppOrder = orders.find((order) => order.id === whatsAppOrderId) ?? null
  const pdfOrder = orders.find((order) => order.id === pdfOrderId) ?? null
  const advanceOrder = orders.find((order) => order.id === advanceOrderId) ?? null
  const revertOrder = orders.find((order) => order.id === revertOrderId) ?? null
  const inventoryOrder = orders.find((order) => order.id === inventoryOrderId) ?? null
  const canViewOrderItems = orderStages.findIndex((stage) => stage.name === itemOrder?.status) >=
    orderStages.findIndex((stage) => stage.name === 'Repuestos')
  const canEditOrderItems = ['Repuestos', 'Aprobación', 'Reparación', 'Entrega'].includes(itemOrder?.status ?? '')
  const itemAllowedInCurrentStage = (type: OrderServiceItem['type']) =>
    itemOrder?.status !== 'Repuestos' || type === 'Repuesto' || type === 'Insumo' || type === 'Adicional'
  const selectedOrderItem = inventory.find((item) => item.id === orderItemId)
  const filteredOrderInventory = inventory.filter((item) =>
    (itemOrder?.status !== 'Repuestos' || item.type === 'Repuesto' || item.type === 'Insumo' || item.id.startsWith('REP') || item.id.startsWith('INS')) &&
    `${item.description} ${item.reference}`.toLowerCase().includes(orderItemSearch.toLowerCase()),
  )

  const serviceOrders = useMemo(() => orders.filter((order) => !order.convertedToOrderId), [orders])
  const stages = orderStages.map((stage) => ({
    ...stage,
    count: serviceOrders.filter((order) => order.status === stage.name).length,
  }))

  const visibleOrders = useMemo(
    () =>
      serviceOrders.filter((order) => {
        const terms = `${order.id} ${order.customer} ${order.vehicle.make} ${order.vehicle.model} ${order.vehicle.plate} ${order.reason}`.toLowerCase()
        const date = order.dateISO ?? ''
        return (
          order.status === activeStage &&
          terms.includes(appliedSearch.toLowerCase()) &&
          order.customer.toLowerCase().includes(clientSearch.toLowerCase()) &&
          `${order.vehicle.make} ${order.vehicle.model} ${order.vehicle.plate}`.toLowerCase().includes(vehicleSearch.toLowerCase()) &&
          (!dateFrom || date >= dateFrom) &&
          (!dateTo || date <= dateTo)
        )
      }),
    [activeStage, appliedSearch, clientSearch, dateFrom, dateTo, serviceOrders, vehicleSearch],
  )

  const openEditOrder = (order: Order) => {
    orderSubmissionStarted.current = false
    setOrderSubmitting(false)
    const client = clients.find((entry) => entry.name === order.customer)
    const vehicle = client?.vehicles.find((entry) => entry.plate === order.vehicle.plate)
    setEditingOrderId(order.id)
    setDraft({
      customerId: client?.id ?? '',
      vehicleId: vehicle?.id ?? '',
      quotationId: '',
      dateISO: order.dateISO ?? todayISO(),
      mileage: String(order.mileage),
      status: order.status,
      reason: order.reason,
      technician: order.technician,
      comments: order.comments,
      arrivalPhotos: order.arrivalPhotos ?? [],
    })
    setPhotoError('')
    setModalOpen(true)
  }

  const openDiagnosis = (order: Order, advancesOrder = false) => {
    setDiagnosisFindings(order.diagnosis?.findings ?? '')
    setDiagnosisPlan(order.diagnosis?.proposedWork ?? '')
    setDiagnosisAdvancesOrder(advancesOrder)
    setDiagnosisOrderId(order.id)
  }

  const openQualityControl = (order: Order) => {
    const savedControl = order.qualityControl
    setQualityDraft({
      fuelLevel: savedControl?.fuelLevel ?? '',
      mileage: String(savedControl?.actualMileage ?? order.mileage),
      resolution: savedControl?.resolution ?? '',
      vehicleChecklist: savedControl?.vehicleChecklist ?? [],
      fluidsChecklist: savedControl?.fluidsChecklist ?? [],
      observations: savedControl?.observations ?? '',
      approved: savedControl?.approved ?? (savedControl ? savedControl.satisfactory : null),
    })
    setQualityOrderId(order.id)
  }

  const openOrderItems = (order: Order, reviewForApproval = false) => {
    setApprovalReviewOrderId(reviewForApproval ? order.id : null)
    setItemOrderId(order.id)
    setOrderItemSearch('')
    setOrderItemId('')
  }

  const saveDiagnosis = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!diagnosisOrder) return
    const savedAt = currentTimestamp()
    const advancesOrder = diagnosisAdvancesOrder
    const nextStage = 'Repuestos'
    const timestampKey = statusTimestampKeys[nextStage]
    setOrders((current) => current.map((order) => order.id === diagnosisOrder.id
      ? {
          ...order,
          ...(advancesOrder ? {
            status: nextStage,
            timestamps: { ...order.timestamps, [timestampKey]: savedAt },
          } : {}),
          diagnosis: {
            findings: diagnosisFindings.trim(),
            proposedWork: diagnosisPlan.trim(),
            technician: order.technician,
            createdAt: savedAt,
          },
        }
      : order))
    setWorkflowError(null)
    setDiagnosisAdvancesOrder(false)
    setDiagnosisOrderId(null)
  }

  const closeDiagnosis = () => {
    setDiagnosisAdvancesOrder(false)
    setDiagnosisOrderId(null)
  }

  const saveCustomerApproval = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!approvalOrder || !approvalOrder.quoteItems?.length) return
    const approvedAt = currentTimestamp()
    const nextStage = 'Reparación'
    const timestampKey = statusTimestampKeys[nextStage]
    setOrders((current) => current.map((order) => order.id === approvalOrder.id
      ? {
          ...order,
          status: nextStage,
          customerApproval: { approvedAt },
          quoteItems: (order.quoteItems ?? []).map((item) => ({ ...item, status: 'Aprobado' })),
          timestamps: { ...order.timestamps, [timestampKey]: approvedAt },
        }
      : order))
    setWorkflowError(null)
    setApprovalOrderId(null)
  }

  const saveQualityControl = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!qualityOrder) return
    const inspectedAt = currentTimestamp()
    const passed = qualityDraft.approved === true
    const checksComplete = vehicleConditionChecks.every((item) => qualityDraft.vehicleChecklist.includes(item))
    const qualityControl: OrderQualityControl = {
      workVerified: Boolean(qualityDraft.resolution),
      roadTest: false,
      vehicleCondition: checksComplete ? 'Correcto' : 'Con observaciones',
      satisfactory: passed,
      fuelLevel: qualityDraft.fuelLevel || undefined,
      actualMileage: Number(qualityDraft.mileage),
      resolution: qualityDraft.resolution,
      vehicleChecklist: qualityDraft.vehicleChecklist,
      fluidsChecklist: qualityDraft.fluidsChecklist,
      approved: qualityDraft.approved ?? false,
      observations: qualityDraft.observations.trim(),
      inspector: qualityOrder.technician,
      inspectedAt,
    }
    const nextStage = 'Entrega'
    const timestampKey = statusTimestampKeys[nextStage]
    setOrders((current) => current.map((order) => order.id === qualityOrder.id
      ? {
        ...order,
        ...(passed ? { status: nextStage, timestamps: { ...order.timestamps, [timestampKey]: inspectedAt } } : {}),
        qualityControl,
      }
      : order))
    setWorkflowError(passed
      ? null
      : { orderId: qualityOrder.id, message: 'El control quedó registrado, pero la orden permanece en Control. Aprueba el control para autorizar la entrega.' })
    setQualityOrderId(null)
  }

  const handlePhotoSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (!files.length) return

    const remaining = maxArrivalPhotos - draft.arrivalPhotos.length
    if (files.length > remaining) {
      setPhotoError(`Puedes adjuntar hasta ${maxArrivalPhotos} fotografías por orden. Quedan ${remaining} espacios.`)
      return
    }

    setPhotosProcessing(true)
    setPhotoError('')
    try {
      for (const file of files) {
        const optimized = await optimizePhoto(file)
        const uploaded = await savePhoto(optimized)
        setDraft((current) => ({ ...current, arrivalPhotos: [...current.arrivalPhotos, uploaded] }))
      }
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'No se pudieron procesar las fotografías.')
    } finally {
      setPhotosProcessing(false)
    }
  }

  const saveOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedClient || photosProcessing || orderSubmissionStarted.current) return
    const selectedVehicle = selectedClient.vehicles.find((vehicle) => vehicle.id === draft.vehicleId)
    if (!selectedVehicle) return
    const mileage = Number(draft.mileage)
    if (!Number.isFinite(mileage) || mileage < 0) return
    orderSubmissionStarted.current = true
    setOrderSubmitting(true)

    const arrivalPhotos: OrderPhoto[] = []
    try {
      for (const photo of draft.arrivalPhotos) {
        arrivalPhotos.push(photo.dataUrl.startsWith('data:image/') ? await savePhoto(photo) : photo)
      }
    } catch (error) {
      orderSubmissionStarted.current = false
      setOrderSubmitting(false)
      setPhotoError(error instanceof Error ? error.message : 'No se pudieron guardar las fotografías.')
      return
    }

    const existing = orders.find((order) => order.id === editingOrderId)
    const changedAt = currentTimestamp()
    let id = editingOrderId
    if (!id) {
      const datePart = draft.dateISO.replaceAll('-', '')
      let suffix = String(orderSequence.current++ % 10000).padStart(4, '0')
      id = `${datePart}${suffix}`
      while (orders.some((order) => order.id === id)) {
        suffix = String((Number(suffix) + 1) % 10000).padStart(4, '0')
        id = `${datePart}${suffix}`
      }
    }

    const importedItems = selectedQuotation?.quoteItems?.map((item, index) => ({
      ...item,
      id: `${id}-quote-${index + 1}`,
      status: 'Aprobado' as const,
    }))
    const newOrder: Order = {
      ...existing,
      id,
      status: draft.status,
      timestamps: {
        ...existing?.timestamps,
        fechaIngreso: existing?.timestamps?.fechaIngreso ?? new Date(`${draft.dateISO}T12:00:00`).toISOString(),
        [statusTimestampKeys[draft.status]]: changedAt,
      },
      invoiced: existing?.invoiced ?? false,
      invoiceTotal: existing?.invoiceTotal,
      dateISO: draft.dateISO,
      quoteItems: editingOrderId ? existing?.quoteItems : importedItems ?? [],
      quoteInitialized: editingOrderId ? existing?.quoteInitialized : Boolean(selectedQuotation),
      quoteDiscountPercent: editingOrderId ? existing?.quoteDiscountPercent : selectedQuotation?.quoteDiscountPercent ?? 0,
      quoteSaved: editingOrderId ? existing?.quoteSaved : Boolean(selectedQuotation),
      payments: editingOrderId ? existing?.payments : [],
      sourceQuoteId: editingOrderId ? existing?.sourceQuoteId : selectedQuotation?.id,
      mileage,
      arrivalPhotos,
      date: new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${draft.dateISO}T12:00:00`)),
      customer: selectedClient.name,
      email: selectedClient.email,
      phone: selectedClient.phone,
      vehicle: {
        make: selectedVehicle.make,
        model: selectedVehicle.model,
        year: selectedVehicle.year,
        plate: selectedVehicle.plate,
        vin: selectedVehicle.vin,
      },
      reason: draft.reason.trim(),
      technician: draft.technician.trim(),
      comments: draft.comments.trim(),
    }

    setOrders((current) => {
      if (editingOrderId) {
        return current.map((order) => (order.id === editingOrderId ? newOrder : order))
      }
      if (
        current.some((order) => order.id === id) ||
        (selectedQuotation && current.some((order) => order.id === selectedQuotation.id && order.convertedToOrderId))
      ) return current
      return [
        newOrder,
        ...current.map((order) => order.id === selectedQuotation?.id
          ? { ...order, convertedToOrderId: id }
          : order),
      ]
    })
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('stage', draft.status)
      return next
    }, { replace: true })
    setModalOpen(false)
    setOrderSubmitting(false)
  }

  const confirmAdvanceStage = (orderId: string, sendWhatsApp = false) => {
    const order = orders.find((candidate) => candidate.id === orderId)
    if (!order) return
    if (order.status === 'Control') {
      setAdvanceOrderId(null)
      openQualityControl(order)
      return
    }
    const currentIndex = orderStages.findIndex((stage) => stage.name === order.status)
    const nextStage = orderStages[currentIndex + 1]
    if (!nextStage) return
    const timestampKey = statusTimestampKeys[nextStage.name]
    const changedAt = currentTimestamp()
    if (sendWhatsApp) {
      const phone = order.phone.replace(/\D/g, '')
      const internationalPhone = phone.startsWith('51') ? phone : `51${phone}`
      const message = `Hola ${order.customer}, le enviamos el reporte de su vehículo ${order.vehicle.plate}. Ingrese aquí para ver el estado: [LinkFalso]`
      window.open(`https://wa.me/${internationalPhone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
    }
    setOrders((current) => current.map((candidate) => candidate.id === orderId
      ? {
          ...candidate,
          status: nextStage.name,
          timestamps: timestampKey
            ? { ...candidate.timestamps, [timestampKey]: changedAt }
            : candidate.timestamps,
        }
      : candidate))
    setWorkflowError(null)
    setAdvanceOrderId(null)
  }

  const requestAdvance = (order: Order) => {
    const currentIndex = orderStages.findIndex((stage) => stage.name === order.status)
    if (order.status === 'Control') {
      openQualityControl(order)
    } else if (orderStages[currentIndex + 1]?.name === 'Control') {
      confirmAdvanceStage(order.id)
    } else {
      setAdvanceOrderId(order.id)
    }
  }

  const confirmRevertStage = (orderId: string) => {
    const order = orders.find((candidate) => candidate.id === orderId)
    if (!order) return
    const currentIndex = orderStages.findIndex((stage) => stage.name === order.status)
    const previousStage = orderStages[currentIndex - 1]
    if (!previousStage) return
    const timestampKey = statusTimestampKeys[previousStage.name]
    const changedAt = currentTimestamp()
    setOrders((current) => current.map((candidate) => candidate.id === orderId
      ? {
          ...candidate,
          status: previousStage.name,
          timestamps: timestampKey
            ? { ...candidate.timestamps, [timestampKey]: changedAt }
            : candidate.timestamps,
        }
      : candidate))
    setWorkflowError(null)
    setRevertOrderId(null)
  }

  const addItemToOrder = () => {
    if (!itemOrder || !selectedOrderItem || !canEditOrderItems) return
    const isSparePartOrSupply = selectedOrderItem.type === 'Repuesto' || selectedOrderItem.type === 'Insumo' ||
      selectedOrderItem.id.startsWith('REP') || selectedOrderItem.id.startsWith('INS')
    if (itemOrder.status === 'Repuestos' && !isSparePartOrSupply) return
    const quantity = Math.max(1, Number(orderItemQuantity) || 1)
    const type = selectedOrderItem.type === 'Mano de Obra' || selectedOrderItem.id.startsWith('SRV')
      ? 'Mano de obra'
      : selectedOrderItem.type === 'Servicio Compuesto'
        ? 'Servicio Compuesto'
        : selectedOrderItem.type === 'Insumo' || selectedOrderItem.id.startsWith('INS')
          ? 'Insumo'
          : 'Repuesto'
    setOrders((current) => current.map((order) => order.id === itemOrder.id
      ? {
          ...order,
          quoteItems: [...(order.quoteItems ?? []), {
            id: `${selectedOrderItem.id}-${Date.now()}`,
            type,
            description: selectedOrderItem.description,
            reference: selectedOrderItem.reference,
            cost: selectedOrderItem.cost,
            marginPercent: selectedOrderItem.marginPercent,
            price: selectedOrderItem.price,
            discount: 0,
            taxRate: selectedOrderItem.taxRate,
            quantity,
            status: 'Pendiente',
            laborHours: selectedOrderItem.laborHours,
          }],
        }
      : order))
    setOrderItemSearch('')
    setOrderItemId('')
    setOrderItemQuantity('1')
  }

  const removeOrderItem = (orderId: string, itemId: string) => {
    setOrders((current) => current.map((order) => order.id === orderId
      ? { ...order, quoteItems: (order.quoteItems ?? []).filter((item) => item.id !== itemId) }
      : order))
  }

  const addBlankOrderItem = () => {
    if (!itemOrder || !canEditOrderItems) return
    setOrders((current) => current.map((order) => order.id === itemOrder.id
      ? {
          ...order,
          quoteItems: [...(order.quoteItems ?? []), {
            id: `manual-${Date.now()}`,
            type: 'Adicional',
            description: '',
            reference: '',
            cost: 0,
            marginPercent: 30,
            price: 0,
            discount: 0,
            taxRate: 0,
            quantity: 1,
            status: 'Pendiente',
          }],
        }
      : order))
  }

  const updateOrderItem = (itemId: string, patch: Partial<OrderServiceItem>) => {
    if (!itemOrder || !canEditOrderItems) return
    setOrders((current) => current.map((order) => order.id === itemOrder.id
      ? {
          ...order,
          quoteItems: (order.quoteItems ?? []).map((item) => {
            if (item.id !== itemId) return item
            const updated = { ...item, ...patch }
            if ('cost' in patch && !('price' in patch)) {
              const margin = item.marginPercent ?? (item.cost > 0 ? (item.price / item.cost - 1) * 100 : 30)
              updated.marginPercent = margin
              updated.price = updated.cost * (1 + margin / 100)
            } else if ('marginPercent' in patch) {
              updated.price = updated.cost * (1 + (updated.marginPercent ?? 0) / 100)
            } else if ('price' in patch) {
              updated.marginPercent = updated.cost > 0 ? (updated.price / updated.cost - 1) * 100 : 0
            }
            return updated
          }),
        }
      : order))
  }

  const applyFilters = () => setAppliedSearch(search.trim())

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-lg">
        <div className="overflow-x-auto border-b border-slate-700 px-2 sm:px-4">
          <div className="flex min-w-max items-center justify-between gap-2">
            {stages.map(({ name, count }) => {
              const active = name === activeStage
              const StageIcon = stageIcons[name]
              return (
                <button
                  key={name}
                  onClick={() => setSearchParams((current) => {
                    const next = new URLSearchParams(current)
                    next.set('stage', name)
                    return next
                  }, { replace: true })}
                  className={`flex items-center gap-1.5 rounded-b-xl px-3 py-4 text-[11px] font-bold uppercase transition ${active ? 'bg-lime-400 text-black' : 'bg-transparent text-white hover:bg-lime-400/10'}`}
                >
                  <StageIcon size={13} className={active ? 'text-black' : 'text-lime-400'} />
                  {name}
                  <span className={`text-[10px] font-extrabold ${active ? 'text-black/70' : 'text-slate-400'}`}>{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid gap-3 border-b border-slate-800 bg-slate-900 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[1fr_1.2fr_1.2fr_auto]">
          <div className="grid grid-cols-2 gap-2">
            <span className="col-span-2 text-[10px] font-bold uppercase tracking-wide text-white">Filtrar por fechas</span>
            <input aria-label="Ingresos desde" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} type="date" className="h-10 w-full rounded-lg border border-slate-700 bg-transparent px-2 text-[10px] text-white outline-none focus:border-lime-400" />
            <input aria-label="Ingresos hasta" value={dateTo} onChange={(event) => setDateTo(event.target.value)} type="date" className="h-10 w-full rounded-lg border border-slate-700 bg-transparent px-2 text-[10px] text-white outline-none focus:border-lime-400" />
          </div>
          <label className="relative">
            <span className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-white">Búsqueda rápida <span className="rounded bg-lime-400 px-1.5 py-0.5 text-[8px] font-extrabold normal-case text-black">Nuevo</span></span>
            <Search size={15} className="absolute bottom-3 left-3 text-lime-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && applyFilters()} type="search" placeholder="Orden, placa o palabra clave" className="h-10 w-full rounded-lg border border-slate-700 bg-transparent pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-lime-400" />
          </label>
          <label>
            <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-white">Buscar por cliente</span>
            <input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} type="search" placeholder="Nombre del cliente" className="h-10 w-full rounded-lg border border-slate-700 bg-transparent px-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-lime-400" />
          </label>
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 xl:w-[170px]">
              <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-white">Buscar vehículo</span>
              <input value={vehicleSearch} onChange={(event) => setVehicleSearch(event.target.value)} type="search" placeholder="Marca, modelo o placa" className="h-10 w-full rounded-lg border border-slate-700 bg-transparent px-3 text-xs text-white outline-none placeholder:text-slate-500 focus:border-lime-400" />
            </label>
            <button type="button" aria-label="Limpiar fechas" title="Limpiar fechas" onClick={() => { setDateFrom(''); setDateTo('') }} className="flex h-10 shrink-0 items-center gap-1 rounded-lg border border-slate-700 bg-transparent px-2.5 text-[10px] font-semibold text-lime-400 hover:bg-lime-400/20">
              <CalendarDays size={14} /><X size={12} />
            </button>
            <button onClick={applyFilters} className="flex h-10 shrink-0 items-center gap-2 rounded-lg bg-lime-400 px-4 text-xs font-extrabold text-black shadow-lg transition hover:bg-lime-300">
              <SlidersHorizontal size={14} /> Filtrar
            </button>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-800 px-4 pb-5 sm:px-6">
          {visibleOrders.length ? visibleOrders.map((order) => (
            <article key={order.id} className="rounded-xl border border-slate-700 bg-slate-900 transition hover:border-slate-500 hover:shadow-lg">
              <div className="flex flex-col gap-4 p-4 sm:p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-700 pb-3">
                    <span className="text-sm font-extrabold tracking-tight text-white">#{order.id}</span>
                    <span className={`rounded px-2 py-1 text-[10px] font-bold ${order.invoiced ? 'bg-lime-300 text-slate-950' : 'bg-slate-700 text-slate-100'}`}>{order.invoiced ? 'Facturada' : 'No facturada'}</span>
                    <span className="text-xs font-medium text-slate-300">{order.date}</span>
                  </div>

                  <div className="grid gap-4 pt-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="min-w-0">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">Cliente</p>
                      <p className="truncate text-sm font-semibold text-white">{order.customer}</p>
                      {order.phone && <p className="mt-1 text-xs text-slate-300">{order.phone}</p>}
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">Vehículo</p>
                      <p className="text-sm font-semibold text-white">{order.vehicle.make} {order.vehicle.model}{order.vehicle.year ? ` · ${order.vehicle.year}` : ''}</p>
                      <p className="mt-1 text-xs text-slate-200">Año: {order.vehicle.year || 'No registrado'}</p>
                      <p className="text-xs text-slate-200">Placa: {order.vehicle.plate}</p>
                      <p className="break-all text-xs text-slate-200">VIN: {order.vehicle.vin || 'No registrado'}</p>
                      <p className="text-xs text-slate-200">Kilometraje: {order.mileage.toLocaleString('es-PE')} km</p>
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">Motivo de ingreso</p>
                      <p className="text-sm leading-relaxed text-white">{order.reason}</p>
                      {order.technician && <p className="mt-1 text-xs text-slate-300">Técnico: {order.technician}</p>}
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-300">Tiempo en taller</p>
                      <p className="text-sm font-semibold text-lime-200">{formatDuration(orderWorkshopMinutes(order, renderedAt))}</p>
                    </div>
                  </div>
                </div>

                <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-3">
                  <ActionButton label="Devolver ODS" icon={<ArrowLeft size={15} />} disabled={order.status === orderStages[0].name} onClick={() => setRevertOrderId(order.id)} />
                  <ActionButton label="Ver Orden de Servicio" icon={<FileText size={15} />} onClick={() => { setPdfDocumentKind('service'); setPdfOrderId(order.id) }} />
                  <ActionButton label="Ver detalle completo" icon={<KeyRound size={15} />} onClick={() => setDetailOrderId(order.id)} />
                  <ActionButton label="Editar orden" icon={<Pencil size={15} />} tone="neutral" onClick={() => openEditOrder(order)} />
                  {order.status === 'Entrega' && (order.invoiced ? (
                    <span className="ml-1 flex h-9 items-center gap-1.5 rounded-lg bg-lime-400 px-3 text-[10px] font-bold text-black"><Check size={14} /> Facturado</span>
                  ) : (
                    <ActionButton label="Facturar" icon={<CircleDollarSign size={15} />} onClick={() => navigate(`/orders/${order.id}/invoice`)} />
                  ))}
                  <OrderActionsDropdown onSelect={(kind) => { setPdfDocumentKind(kind); setPdfOrderId(order.id) }} />
                  {orderStages.findIndex((stage) => stage.name === order.status) >= orderStages.findIndex((stage) => stage.name === 'Repuestos') && (
                    <ActionButton label={['Control', 'Archivados'].includes(order.status) ? 'Ver ítems y precios de la orden' : 'Ver y agregar ítems y precios'} icon={<NotebookPen size={15} />} onClick={() => openOrderItems(order)} />
                  )}
                  <ActionButton label="Simular WhatsApp" icon={<Eye size={15} />} onClick={() => { setWhatsAppOrderId(order.id); setWhatsAppSent(false) }} />
                  <ActionButton label="Avanzar" icon={<ArrowRight size={15} />} disabled={order.status === orderStages[orderStages.length - 1].name} onClick={() => requestAdvance(order)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 bg-slate-900 px-4 py-2.5 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400"><Check size={13} className="text-lime-300" /> Etapa actual: <strong className="font-semibold text-slate-300">{order.status}</strong></div>
                  {order.status === 'Diagnóstico' && <button onClick={() => openDiagnosis(order)} className="rounded-md border border-violet-900/50 bg-slate-900 px-2.5 py-1.5 text-[10px] font-bold text-violet-200 hover:bg-violet-950/30">{order.diagnosis ? 'Editar diagnóstico' : 'Registrar diagnóstico'}</button>}
                </div>
                <div className="flex flex-col items-end gap-1">
                  {workflowError?.orderId === order.id && <p role="alert" className="max-w-[360px] text-right text-[10px] font-medium text-amber-300">{workflowError.message}</p>}
                </div>
              </div>
            </article>
          )) : (
            <div className="rounded-xl border border-dashed border-slate-700 py-12 text-center">
              <Archive size={24} className="mx-auto text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-300">No encontramos órdenes</p>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-800 px-5 py-3 text-[11px] text-slate-400 sm:px-6">
          <span>Mostrando {visibleOrders.length} de {serviceOrders.length} órdenes</span>
          <span>Etapa: {activeStage}</span>
        </div>
      </section>

      {diagnosisOrder && (
        <Modal title={`Diagnóstico técnico · Orden #${diagnosisOrder.id}`} onClose={closeDiagnosis} wide>
          <form onSubmit={saveDiagnosis}>
            <p className="mb-4 text-xs leading-relaxed text-slate-400">Registra los hallazgos del vehículo y el procedimiento recomendado.{diagnosisAdvancesOrder ? ' Al guardar, la orden pasará a Repuestos.' : ''}</p>
            <label className="mb-4 block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Hallazgos del diagnóstico</span><textarea required minLength={5} rows={4} value={diagnosisFindings} onChange={(event) => setDiagnosisFindings(event.target.value)} placeholder="Describe fallas, mediciones y resultados de la inspección..." className="w-full resize-y rounded-lg border border-slate-700 px-3 py-2.5 text-xs leading-relaxed outline-none focus:border-slate-700" /></label>
            <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Trabajo recomendado / procedimiento</span><textarea required minLength={5} rows={3} value={diagnosisPlan} onChange={(event) => setDiagnosisPlan(event.target.value)} placeholder="Describe cómo se recomienda proceder y qué reparar..." className="w-full resize-y rounded-lg border border-slate-700 px-3 py-2.5 text-xs leading-relaxed outline-none focus:border-slate-700" /></label>
            <div className="mt-5 flex justify-end"><button type="submit" className="rounded-lg bg-lime-300 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-lime-400">{diagnosisAdvancesOrder ? 'Guardar diagnóstico y avanzar' : 'Guardar diagnóstico'}</button></div>
          </form>
        </Modal>
      )}

      {approvalOrder && (
        <Modal title={`Aprobación del cliente · Orden #${approvalOrder.id}`} onClose={() => setApprovalOrderId(null)} wide>
          <form onSubmit={saveCustomerApproval}>
            <p className="mb-4 text-xs leading-relaxed text-slate-400">Revisa el presupuesto y confirma que el cliente lo aceptó antes de iniciar la reparación. Los ítems incluidos se marcarán como aprobados.</p>
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-700 p-3">
              {approvalOrder.quoteItems?.map((item) => {
                const subtotal = item.price * item.quantity
                const discount = subtotal * item.discount / 100
                const tax = (subtotal - discount) * item.taxRate / 100
                return <div key={item.id} className="grid gap-1 border-b border-slate-800 pb-2 text-xs last:border-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <span className="min-w-0"><strong className="text-slate-200">{item.type} · {item.description}</strong><span className="ml-1 text-slate-400">({item.reference || 'Sin referencia'}) × {item.quantity}</span></span>
                  <span className="text-slate-300">Unit. S/ {item.price.toFixed(2)} · Desc. {item.discount}% · Imp. S/ {tax.toFixed(2)} · Total <strong className="text-white">S/ {(subtotal - discount + tax).toFixed(2)}</strong></span>
                </div>
              })}
            </div>
            <p className="mt-3 text-right text-xs font-bold text-white">Total del presupuesto: S/ {(approvalOrder.quoteItems ?? []).reduce((total, item) => {
              const subtotal = item.price * item.quantity
              return total + subtotal - subtotal * item.discount / 100 + (subtotal - subtotal * item.discount / 100) * item.taxRate / 100
            }, 0).toFixed(2)}</p>
            <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg bg-emerald-950/30 p-3 text-xs text-emerald-900"><input required type="checkbox" checked={approvalConfirmed} onChange={(event) => setApprovalConfirmed(event.target.checked)} className="mt-0.5 accent-emerald-600" /><span>Confirmo que el cliente aprobó estos trabajos y sus costos. La orden pasará a Reparación.</span></label>
            <div className="mt-5 flex justify-end"><button type="submit" disabled={!approvalConfirmed} className="rounded-lg bg-lime-300 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-lime-400 disabled:cursor-not-allowed disabled:opacity-50">ACEPTAR Y PASAR A REPARACIÓN</button></div>
          </form>
        </Modal>
      )}

      {qualityOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="quality-control-title">
          <form onSubmit={saveQualityControl} className="grid max-h-[96vh] w-full max-w-[1440px] grid-cols-1 overflow-hidden rounded-2xl border border-slate-700 shadow-2xl md:grid-cols-[0.88fr_1.12fr]">
            <aside className="max-h-[36vh] space-y-4 overflow-y-auto bg-slate-800 p-4 sm:p-6 md:max-h-[92vh]">
              <h2 className="text-sm font-extrabold uppercase tracking-wide text-lime-300">Orden #{qualityOrder.id}</h2>
              <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-200">Datos de la orden</h3>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
                  <DetailField label="Consecutivo" value={qualityOrder.id} />
                  <DetailField label="Cliente" value={qualityOrder.customer} />
                  <DetailField label="Vehículo" value={`${qualityOrder.vehicle.make} ${qualityOrder.vehicle.model}`} />
                  <DetailField label="Placa" value={qualityOrder.vehicle.plate} />
                  <DetailField label="VIN" value={qualityOrder.vehicle.vin || 'No registrado'} />
                  <DetailField label="Fecha de ingreso" value={qualityOrder.date} />
                  <DetailField label="Técnico" value={qualityOrder.technician} />
                </dl>
              </section>
              <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-200">Diagnóstico</h3>
                <p className="text-[10px] font-semibold uppercase text-slate-400">Motivo</p>
                <p className="mt-1 text-xs text-slate-200">{qualityOrder.reason}</p>
                <p className="mt-3 text-[10px] font-semibold uppercase text-slate-400">Procedimientos</p>
                <p className="mt-1 whitespace-pre-wrap text-xs text-slate-200">{qualityOrder.diagnosis?.proposedWork || 'Sin procedimientos registrados.'}</p>
                <p className="mt-3 text-[10px] font-semibold uppercase text-slate-400">Mano de obra asignada</p>
                <div className="mt-1 space-y-1 text-xs text-slate-200">
                  {(qualityOrder.quoteItems ?? []).filter((item) => item.type === 'Mano de obra' || item.type === 'Servicio Compuesto').length
                    ? (qualityOrder.quoteItems ?? []).filter((item) => item.type === 'Mano de obra' || item.type === 'Servicio Compuesto').map((item) => <p key={item.id}>{item.description} × {item.quantity}</p>)
                    : <p>Sin mano de obra registrada.</p>}
                </div>
              </section>
              <section className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-200">Repuestos e insumos utilizados</h3>
                <div className="space-y-2 text-xs text-slate-200">
                  {(qualityOrder.quoteItems ?? []).filter((item) => item.type === 'Repuesto' || item.type === 'Insumo').length
                    ? (qualityOrder.quoteItems ?? []).filter((item) => item.type === 'Repuesto' || item.type === 'Insumo').map((item) => <p key={item.id}>{item.type}: {item.description} × {item.quantity}</p>)
                    : <p className="text-slate-400">Sin repuestos ni insumos registrados.</p>}
                </div>
              </section>
            </aside>

            <section className="flex min-h-0 max-h-[58vh] flex-col bg-slate-900 md:max-h-[92vh]">
              <header className="flex shrink-0 items-center justify-between border-b border-slate-700 px-5 py-4 sm:px-7">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-lime-300">Control de calidad</p>
                  <h2 id="quality-control-title" className="mt-1 text-xl font-extrabold text-white">Control</h2>
                </div>
                <button type="button" aria-label="Cerrar control de calidad" onClick={() => setQualityOrderId(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"><X size={19} /></button>
              </header>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className="mb-1.5 block text-xs font-semibold text-slate-200">Nivel de combustible</span>
                    <select required value={qualityDraft.fuelLevel} onChange={(event) => setQualityDraft((current) => ({ ...current, fuelLevel: event.target.value as QualityControlDraft['fuelLevel'] }))} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs text-white outline-none focus:border-lime-400">
                      <option value="">Selecciona el nivel</option>
                      {(['Vacío', '1/4', '1/2', '3/4', 'Lleno'] as const).map((level) => <option key={level} value={level}>{level}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="mb-1.5 block text-xs font-semibold text-slate-200">Kilometraje actual del vehículo</span>
                    <NumericInput required min="0" step="1" value={qualityDraft.mileage} onChange={(value) => setQualityDraft((current) => ({ ...current, mileage: value }))} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs text-white outline-none focus:border-lime-400" />
                  </label>
                </div>

                <fieldset>
                  <legend className="mb-2 text-xs font-bold text-white">Resolución de la avería</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {qualityResolutions.map((resolution) => <label key={resolution} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2.5 text-xs text-slate-200">
                      <input required type="radio" name="quality-resolution" checked={qualityDraft.resolution === resolution} onChange={() => setQualityDraft((current) => ({ ...current, resolution }))} className="accent-lime-400" />
                      {resolution}
                    </label>)}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-2 text-xs font-bold text-white">Estado del vehículo para la entrega</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {vehicleConditionChecks.map((check) => <label key={check} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2.5 text-xs text-slate-200">
                      <input type="checkbox" checked={qualityDraft.vehicleChecklist.includes(check)} onChange={(event) => setQualityDraft((current) => ({ ...current, vehicleChecklist: event.target.checked ? [...current.vehicleChecklist, check] : current.vehicleChecklist.filter((item) => item !== check) }))} className="accent-lime-400" />
                      {check}
                    </label>)}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-2 text-xs font-bold text-white">Fluidos a nivel adecuado</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {fluidChecks.map((check) => <label key={check} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-2.5 text-xs text-slate-200">
                      <input type="checkbox" checked={qualityDraft.fluidsChecklist.includes(check)} onChange={(event) => setQualityDraft((current) => ({ ...current, fluidsChecklist: event.target.checked ? [...current.fluidsChecklist, check] : current.fluidsChecklist.filter((item) => item !== check) }))} className="accent-lime-400" />
                      {check}
                    </label>)}
                  </div>
                </fieldset>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-200">Observaciones</span>
                  <textarea rows={3} value={qualityDraft.observations} onChange={(event) => setQualityDraft((current) => ({ ...current, observations: event.target.value }))} placeholder="Agrega observaciones del control de calidad..." className="w-full resize-y rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-lime-400" />
                </label>

                <fieldset>
                  <legend className="mb-2 text-xs font-bold text-white">¿Aprueba control de calidad?</legend>
                  <div className="flex gap-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs text-slate-200">
                      <input required type="radio" name="quality-approved" checked={qualityDraft.approved === true} onChange={() => setQualityDraft((current) => ({ ...current, approved: true }))} className="accent-lime-400" /> Sí
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs text-slate-200">
                      <input required type="radio" name="quality-approved" checked={qualityDraft.approved === false} onChange={() => setQualityDraft((current) => ({ ...current, approved: false }))} className="accent-red-400" /> No
                    </label>
                  </div>
                </fieldset>
              </div>
              <footer className="flex shrink-0 justify-end gap-2 border-t border-slate-700 bg-slate-900 px-5 py-4 sm:px-7">
                <button type="submit" className="rounded-lg bg-lime-400 px-5 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300">FINALIZAR</button>
              </footer>
            </section>
          </form>
        </div>
      )}

      {revertOrder && (
        <Modal title="Devolver ODS" onClose={() => setRevertOrderId(null)}>
          <p className="text-sm text-slate-400">¿Estás seguro de devolver la ODS?</p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => confirmRevertStage(revertOrder.id)} className="rounded-lg bg-lime-300 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-lime-400">SÍ, DEVOLVER</button>
          </div>
        </Modal>
      )}

      {advanceOrder && (
        <Modal title={`Avanzar · ${advanceOrder.status}`} onClose={() => setAdvanceOrderId(null)}>
          {advanceOrder.status === 'Repuestos' ? (
            <>
              <p className="text-sm leading-relaxed text-slate-300">En esta fase, tienes la opción de incluir los precios de los repuestos e insumos. ¿Qué deseas hacer?</p>
              <div className="mt-6 flex flex-col justify-end gap-2 sm:flex-row sm:flex-wrap">
                <button type="button" onClick={() => { setAdvanceOrderId(null); openOrderItems(advanceOrder) }} className="rounded-lg bg-lime-400 px-4 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300">INCLUIR PRECIOS</button>
                <button type="button" onClick={() => confirmAdvanceStage(advanceOrder.id)} className="rounded-lg bg-lime-400 px-4 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300">AVANZAR SIN INCLUIR PRECIOS</button>
              </div>
            </>
          ) : advanceOrder.status === 'Diagnóstico' ? (
            <>
              <p className="text-sm leading-relaxed text-slate-300">En esta fase tienes la opción de realizar el diagnóstico. ¿Qué deseas hacer?</p>
              <div className="mt-6 flex flex-col justify-end gap-2 sm:flex-row sm:flex-wrap">
                <button type="button" onClick={() => { setAdvanceOrderId(null); openDiagnosis(advanceOrder, true) }} className="rounded-lg bg-lime-400 px-4 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300">REALIZAR DIAGNÓSTICO</button>
                <button type="button" onClick={() => confirmAdvanceStage(advanceOrder.id)} className="rounded-lg bg-lime-400 px-4 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300">AVANZAR SIN REALIZAR DIAGNÓSTICO</button>
              </div>
            </>
          ) : advanceOrder.status === 'Aprobación' ? (
            <>
              <p className="text-sm leading-relaxed text-slate-300">En esta fase puedes revisar los costos del servicio y enviar el presupuesto al cliente para su aprobación. ¿Qué deseas hacer?</p>
              <div className="mt-6 flex flex-col justify-end gap-2 sm:flex-row sm:flex-wrap">
                <button type="button" onClick={() => { setAdvanceOrderId(null); openOrderItems(advanceOrder, true) }} className="rounded-lg bg-lime-400 px-4 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300">REVISAR Y ENVIAR</button>
                <button type="button" onClick={() => confirmAdvanceStage(advanceOrder.id)} className="rounded-lg bg-lime-400 px-4 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300">AVANZAR SIN ENVIAR PRESUPUESTO</button>
              </div>
            </>
          ) : advanceOrder.status === 'Recepción' ? (
            <>
              <p className="text-sm leading-relaxed text-slate-300">El vehículo ingresará a tu taller, tu cliente debe aprobar el estado en el que ingresa. ¿Cómo deseas solicitar su aprobación?</p>
              <div className="mt-6 flex flex-col justify-end gap-2 sm:flex-row sm:flex-wrap">
                <button type="button" onClick={() => confirmAdvanceStage(advanceOrder.id, true)} className="rounded-lg bg-lime-400 px-4 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300">VÍA WHATSAPP</button>
                <button type="button" onClick={() => confirmAdvanceStage(advanceOrder.id)} className="rounded-lg bg-lime-400 px-4 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300">VÍA SMS</button>
                <button type="button" onClick={() => confirmAdvanceStage(advanceOrder.id)} className="rounded-lg bg-lime-400 px-4 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300">VERBALMENTE APROBADO</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-slate-300">¿Deseas avanzar la orden a la siguiente fase?</p>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" onClick={() => confirmAdvanceStage(advanceOrder.id)} className="rounded-lg bg-lime-400 px-4 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300">AVANZAR</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {detailOrder && (
        <Modal title={`Detalle de orden #${detailOrder.id}`} onClose={() => setDetailOrderId(null)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <DetailField label="Cliente" value={detailOrder.customer} />
            <DetailField label="Contacto" value={`${detailOrder.phone} · ${detailOrder.email}`} />
            <DetailField label="Vehículo" value={`${detailOrder.vehicle.make} ${detailOrder.vehicle.model} ${detailOrder.vehicle.year}`} />
            <DetailField label="Placa / VIN" value={`${detailOrder.vehicle.plate} · ${detailOrder.vehicle.vin || 'Sin VIN'}`} />
            <DetailField label="Kilometraje de ingreso" value={`${detailOrder.mileage.toLocaleString('es-PE')} km`} />
            <DetailField label="Fecha / estado" value={`${detailOrder.date} · ${detailOrder.status}`} />
            <DetailField label="Motivo de ingreso" value={detailOrder.reason} />
            <DetailField label="Técnico" value={detailOrder.technician} />
            <DetailField label="Comentarios" value={detailOrder.comments || 'Sin comentarios'} />
            {detailOrder.diagnosis && <DetailField label="Diagnóstico técnico" value={detailOrder.diagnosis.findings} />}
            {detailOrder.diagnosis && <DetailField label="Trabajo recomendado" value={detailOrder.diagnosis.proposedWork} />}
            {detailOrder.customerApproval && <DetailField label="Aprobación del cliente" value={`Aceptada el ${new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(detailOrder.customerApproval.approvedAt))}`} />}
            {detailOrder.qualityControl && <DetailField label="Control de calidad" value={`${detailOrder.qualityControl.satisfactory ? 'Aprobado' : 'Con observaciones'} · Vehículo: ${detailOrder.qualityControl.vehicleCondition}`} />}
            {detailOrder.qualityControl && <DetailField label="Observaciones de control" value={detailOrder.qualityControl.observations || 'Sin observaciones'} />}
            {detailOrder.timestamps?.fechaInicioReparacion && <DetailField label="Tiempo de reparación" value={formatDuration(elapsedMinutes(detailOrder.timestamps.fechaInicioReparacion, detailOrder.timestamps.fechaControl ?? renderedAt))} />}
          </div>
          <div className="mt-5 border-t border-slate-800 pt-4">
            <h3 className="text-xs font-bold text-slate-200">Ítems asociados ({detailOrder.quoteItems?.length ?? 0})</h3>
            {detailOrder.quoteItems?.length ? <div className="mt-2 space-y-2">{detailOrder.quoteItems.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-slate-400">{item.type} · {item.description} × {item.quantity}</span><span className="font-semibold text-slate-200">S/ {(item.price * item.quantity).toFixed(2)}</span></div>)}</div> : <p className="mt-2 text-[11px] text-slate-400">Aún no se han agregado ítems.</p>}
          </div>
          {detailOrder.arrivalPhotos?.length > 0 && <PhotoGallery photos={detailOrder.arrivalPhotos} plate={detailOrder.vehicle.plate} />}
          <div className="mt-5 flex justify-end"><button onClick={() => { setDetailOrderId(null); openEditOrder(detailOrder) }} className="rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700">Editar orden</button></div>
        </Modal>
      )}

      {itemOrder && (
        <div className="fixed inset-0 z-[60] flex h-dvh w-screen flex-col overflow-hidden bg-slate-950 text-white" role="dialog" aria-modal="true" aria-labelledby="order-items-title">
          <header className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900 px-4 py-3 sm:px-6">
            <div>
              <h2 id="order-items-title" className="text-sm font-bold text-white">Ítems y precios · Orden #{itemOrder.id}</h2>
              <p className="mt-0.5 text-[10px] text-slate-400">{itemOrder.customer} · {itemOrder.vehicle.plate} · Fase: {itemOrder.status}</p>
            </div>
            <button type="button" aria-label="Cerrar ítems y precios" onClick={() => { setItemOrderId(null); setApprovalReviewOrderId(null) }} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"><X size={20} /></button>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:p-7">
          {canEditOrderItems && <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-700 bg-slate-900 p-3">
            <label className="min-w-[220px] flex-1">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Agregar desde inventario (opcional)</span>
              <span className="relative block"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input value={orderItemSearch} onChange={(event) => { setOrderItemSearch(event.target.value); setOrderItemId('') }} placeholder="Buscar por nombre o referencia" className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-xs text-white outline-none focus:border-lime-400" /></span>
            </label>
            <label className="w-24">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Cantidad</span>
              <NumericInput aria-label="Cantidad a agregar" min="1" value={orderItemQuantity} onChange={setOrderItemQuantity} className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-white" />
            </label>
            <button type="button" disabled={!selectedOrderItem} onClick={addItemToOrder} className="flex h-9 items-center gap-1 rounded-lg border border-lime-400 px-3 text-[10px] font-extrabold text-lime-300 hover:bg-lime-400/10 disabled:opacity-50"><Plus size={13} /> AGREGAR DE INVENTARIO</button>
            <button type="button" onClick={addBlankOrderItem} className="flex h-9 items-center gap-1 rounded-lg bg-lime-400 px-3 text-[10px] font-extrabold text-black hover:bg-lime-300"><Plus size={13} /> AGREGAR ÍTEM</button>
            {orderItemSearch && <div className="max-h-44 basis-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-950">{filteredOrderInventory.map((item) => <button type="button" key={item.id} onClick={() => { setOrderItemId(item.id); setOrderItemSearch(item.description) }} className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-slate-800 ${item.id === orderItemId ? 'bg-lime-950/30' : ''}`}><span><strong className="text-slate-200">{item.description}</strong><span className="ml-2 text-[10px] text-slate-400">{item.reference} · Stock {item.stock}</span></span><span className="font-semibold text-slate-300">S/ {item.price.toFixed(2)}</span></button>)}</div>}
          </div>}
          {!canEditOrderItems && <p className="mb-4 text-xs text-slate-400">Consulta los ítems de la orden. En esta fase no se pueden modificar.</p>}
          {!canViewOrderItems ? <p role="status" className="rounded-lg bg-amber-950/30 p-3 text-xs text-amber-200">Los ítems están disponibles desde la fase Repuestos.</p> : <>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full min-w-[1660px] border-collapse text-left">
              <thead className="bg-slate-900 text-[9px] font-bold uppercase tracking-wider text-slate-300"><tr>{['ID', 'Tipo', 'Ítem', 'Referencia', 'Costo', 'Rent. %', 'Valor/unitario', 'Desc. %', 'Impuesto', 'Subtotal', 'Cantidad', 'Total', 'Estado', 'Opciones'].map((column) => <th key={column} className="px-2 py-3 first:pl-4">{column}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-800">
                {(itemOrder.quoteItems ?? []).map((item, index) => {
                  const subtotal = item.price * item.quantity
                  const discount = subtotal * item.discount / 100
                  const tax = (subtotal - discount) * item.taxRate / 100
                  const margin = item.marginPercent ?? (item.cost > 0 ? (item.price / item.cost - 1) * 100 : 0)
                  const inputClass = 'h-8 w-full min-w-[72px] rounded-md border border-slate-700 bg-slate-950 px-2 text-[10px] text-slate-200 outline-none focus:border-lime-400'
                  const availableTypes = itemTypes.filter(itemAllowedInCurrentStage)
                  if (!availableTypes.includes(item.type)) availableTypes.push(item.type)
                  return <tr key={item.id} className="text-slate-200">
                    <td className="whitespace-nowrap px-2 py-2 pl-4 text-[10px] text-slate-400">{String(index + 1).padStart(2, '0')}</td>
                    <td className="px-2 py-2"><select aria-label={`Tipo de ${item.description || `ítem ${index + 1}`}`} disabled={!canEditOrderItems} value={item.type} onChange={(event) => updateOrderItem(item.id, { type: event.target.value as OrderServiceItem['type'] })} className={`${inputClass} min-w-[130px]`} >{availableTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></td>
                    <td className="px-2 py-2"><div className="min-w-[220px]"><input aria-label={`Descripción de ítem ${index + 1}`} disabled={!canEditOrderItems} value={item.description} onFocus={() => setActiveOrderItemDescriptionId(item.id)} onBlur={() => window.setTimeout(() => setActiveOrderItemDescriptionId((activeId) => activeId === item.id ? null : activeId), 150)} onChange={(event) => { setActiveOrderItemDescriptionId(item.id); updateOrderItem(item.id, { description: event.target.value }) }} placeholder="Ítem adicional" className={`${inputClass} min-w-[220px]`} />{canEditOrderItems && activeOrderItemDescriptionId === item.id && item.description.trim() && (() => {
                      const matches = inventory.filter((candidate) =>
                        (itemOrder.status !== 'Repuestos' || candidate.type === 'Repuesto' || candidate.type === 'Insumo' || candidate.id.startsWith('REP') || candidate.id.startsWith('INS')) &&
                        `${candidate.description} ${candidate.reference}`.toLowerCase().includes(item.description.trim().toLowerCase()),
                      )
                      return matches.length ? <div className="mt-1 max-h-36 overflow-y-auto rounded-md border border-slate-700 bg-slate-900">{matches.slice(0, 8).map((candidate) => {
                        const type: OrderServiceItem['type'] = candidate.type === 'Mano de Obra' || candidate.id.startsWith('SRV')
                          ? 'Mano de obra'
                          : candidate.type === 'Servicio Compuesto'
                            ? 'Servicio Compuesto'
                            : candidate.type === 'Insumo' || candidate.id.startsWith('INS')
                              ? 'Insumo'
                              : 'Repuesto'
                        return <button type="button" key={candidate.id} onClick={() => {
                          updateOrderItem(item.id, {
                          type,
                          description: candidate.description,
                          reference: candidate.reference,
                          cost: candidate.cost,
                          marginPercent: candidate.marginPercent ?? (candidate.cost > 0 ? (candidate.price / candidate.cost - 1) * 100 : 0),
                          price: candidate.price,
                          taxRate: candidate.taxRate,
                          laborHours: candidate.laborHours,
                          })
                          setActiveOrderItemDescriptionId(null)
                        }} className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[10px] hover:bg-slate-800"><span className="min-w-0"><strong className="block truncate text-slate-200">{candidate.description}</strong><span className="text-slate-400">{candidate.reference} · Stock {candidate.stock}</span></span><span className="shrink-0 text-slate-300">S/ {candidate.price.toFixed(2)}</span></button>
                      })}</div> : null
                    })()}</div></td>
                    <td className="px-2 py-2"><input aria-label={`Referencia de ítem ${index + 1}`} disabled={!canEditOrderItems} value={item.reference} onChange={(event) => updateOrderItem(item.id, { reference: event.target.value })} placeholder="Referencia" className={`${inputClass} min-w-[120px]`} /></td>
                    <td className="px-2 py-2"><NumericInput aria-label={`Costo de ítem ${index + 1}`} disabled={!canEditOrderItems} min="0" step="0.01" value={item.cost} onChange={(value) => updateOrderItem(item.id, { cost: Number(value) || 0 })} className={`${inputClass} min-w-[95px]`} /></td>
                    <td className="px-2 py-2"><NumericInput aria-label={`Rentabilidad de ítem ${index + 1}`} disabled={!canEditOrderItems} min="1" max="100" step="1" value={margin} onChange={(value) => updateOrderItem(item.id, { marginPercent: Math.min(100, Math.max(1, Number(value) || 1)) })} className={`${inputClass} min-w-[76px]`} /></td>
                    <td className="px-2 py-2"><NumericInput aria-label={`Precio unitario de ítem ${index + 1}`} disabled={!canEditOrderItems} min="0" step="0.01" value={item.price} onChange={(value) => updateOrderItem(item.id, { price: Number(value) || 0 })} className={`${inputClass} min-w-[105px]`} /></td>
                    <td className="px-2 py-2"><NumericInput aria-label={`Descuento de ítem ${index + 1}`} disabled={!canEditOrderItems} min="0" max="100" step="0.01" value={item.discount} onChange={(value) => updateOrderItem(item.id, { discount: Math.min(100, Math.max(0, Number(value) || 0)) })} className={`${inputClass} min-w-[76px]`} /></td>
                    <td className="px-2 py-2"><select aria-label={`Impuesto de ítem ${index + 1}`} disabled={!canEditOrderItems} value={item.taxRate} onChange={(event) => updateOrderItem(item.id, { taxRate: Number(event.target.value) })} className={`${inputClass} min-w-[115px]`}><option value="0">Sin impuesto</option><option value="18">IGV 18%</option></select><span className="mt-1 block text-right text-[9px] text-lime-300">S/ {tax.toFixed(2)}</span></td>
                    <td className="whitespace-nowrap px-2 py-2 text-right text-[10px] text-slate-300">S/ {subtotal.toFixed(2)}</td>
                    <td className="px-2 py-2"><NumericInput aria-label={`Cantidad de ítem ${index + 1}`} disabled={!canEditOrderItems} min="1" step="1" value={item.quantity} onChange={(value) => updateOrderItem(item.id, { quantity: Math.max(1, Number(value) || 1) })} className={`${inputClass} min-w-[70px]`} /></td>
                    <td className="whitespace-nowrap px-2 py-2 text-right text-[10px] font-bold text-white">S/ {(subtotal - discount + tax).toFixed(2)}</td>
                    <td className="px-2 py-2"><select aria-label={`Estado de ítem ${index + 1}`} disabled={!canEditOrderItems} value={item.status} onChange={(event) => updateOrderItem(item.id, { status: event.target.value as OrderServiceItem['status'] })} className={`${inputClass} min-w-[120px] ${item.status === 'Aprobado' ? 'text-emerald-300' : 'text-amber-300'}`}><option value="Aprobado">Aprobado</option><option value="Pendiente">No aprobado</option></select></td>
                    <td className="px-2 py-2">{canEditOrderItems && <button type="button" aria-label={`Eliminar ${item.description || `ítem ${index + 1}`}`} onClick={() => removeOrderItem(itemOrder.id, item.id)} className="flex h-8 w-8 items-center justify-center rounded-full text-red-400 hover:bg-red-950/40"><Trash2 size={14} /></button>}</td>
                  </tr>
                })}
                {!itemOrder.quoteItems?.length && <tr><td colSpan={11} className="px-3 py-5 text-center text-slate-400">Todavía no hay ítems registrados.</td></tr>}
              </tbody>
              <tfoot className="border-t border-slate-700 bg-slate-800/70 text-xs font-bold text-white"><tr><td colSpan={10} className="px-3 py-3 text-right">Total del presupuesto</td><td className="px-3 py-3 text-right">S/ {(itemOrder.quoteItems ?? []).reduce((total, item) => {
                const subtotal = item.price * item.quantity
                const discounted = subtotal - subtotal * item.discount / 100
                return total + discounted + discounted * item.taxRate / 100
              }, 0).toFixed(2)}</td><td colSpan={2} /></tr></tfoot>
            </table>
          </div>
          {approvalReviewOrderId === itemOrder.id && <div className="mt-5 flex justify-end">
            <button type="button" disabled={!itemOrder.quoteItems?.length} onClick={() => { setItemOrderId(null); setApprovalOrderId(itemOrder.id); setApprovalConfirmed(false); setApprovalReviewOrderId(null) }} className="rounded-lg bg-lime-400 px-4 py-2.5 text-xs font-extrabold text-black hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-50">CONTINUAR A CONFIRMACIÓN</button>
          </div>}
          </>}
          </main>
        </div>
      )}

      {whatsAppOrder && (
        <Modal title="Simular WhatsApp al cliente" onClose={() => setWhatsAppOrderId(null)}>
          <p className="text-xs text-slate-400">Vista previa del mensaje para {whatsAppOrder.customer} ({whatsAppOrder.phone}). No se envían mensajes reales en esta demo.</p>
          <div className="mt-4 rounded-xl bg-emerald-950/30 p-4 text-xs leading-relaxed text-emerald-950">Hola {whatsAppOrder.customer.split(' ')[0]}, te contamos que tu unidad {whatsAppOrder.vehicle.make} {whatsAppOrder.vehicle.model} ({whatsAppOrder.vehicle.plate}) se encuentra en la etapa de <strong>{whatsAppOrder.status}</strong> en RGR Taller. Motivo: {whatsAppOrder.reason}.</div>
          {whatsAppSent && <p role="status" className="mt-3 text-xs font-semibold text-emerald-300">Mensaje simulado correctamente. No se realizó ningún envío externo.</p>}
          <div className="mt-5 flex justify-end gap-2"><button onClick={() => setWhatsAppOrderId(null)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-400">Cerrar</button><button onClick={() => setWhatsAppSent(true)} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"><MessageCircle size={14} className="mr-1 inline" />Simular envío</button></div>
        </Modal>
      )}

      {pdfOrder && (
        <div className="print-preview-overlay fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`${pdfDocumentKind} #${pdfOrder.id}`}>
          <div className="no-print mx-auto mb-4 flex max-w-[900px] items-center justify-between rounded-xl bg-slate-900 px-4 py-3 shadow-lg">
            <div><p className="text-sm font-bold text-slate-100">Vista previa del documento</p><p className="mt-0.5 text-[10px] text-slate-400">#{pdfOrder.id} · Listo para imprimir o guardar como PDF</p></div>
            <button type="button" aria-label="Cerrar" onClick={() => setPdfOrderId(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800"><X size={18} /></button>
          </div>
          <WorkOrderPDFTemplate
            order={pdfOrder}
            settings={settings}
            kind={pdfDocumentKind}
            vehicleColor={clients.find((client) => client.name === pdfOrder.customer)?.vehicles.find((vehicle) => vehicle.plate === pdfOrder.vehicle.plate)?.color}
          />
        </div>
      )}

      {inventoryOrder && (
        <Modal title={`Inventario para ${inventoryOrder.vehicle.plate}`} onClose={() => setInventoryOrderId(null)} wide>
          <label className="relative block"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={orderItemSearch} onChange={(event) => setOrderItemSearch(event.target.value)} placeholder="Buscar repuesto, insumo o mano de obra" className="h-10 w-full rounded-lg border border-slate-700 pl-9 pr-3 text-xs outline-none focus:border-slate-700" /></label>
          <div className="mt-3 max-h-[50vh] overflow-y-auto rounded-lg border border-slate-700 divide-y divide-slate-100">{filteredOrderInventory.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 px-3 py-3"><div><p className="text-xs font-semibold text-slate-200">{item.description}</p><p className="mt-0.5 text-[10px] text-slate-400">{item.reference} · Stock {item.stock} · S/ {item.price.toFixed(2)}</p></div><button onClick={() => { setInventoryOrderId(null); setItemOrderId(inventoryOrder.id); setOrderItemId(item.id); setOrderItemSearch(item.description) }} className="rounded-md border border-slate-700 px-2.5 py-1.5 text-[10px] font-semibold text-slate-400 hover:bg-slate-800">Agregar a orden</button></div>)}</div>
        </Modal>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-labelledby="order-modal-title">
          <form onSubmit={saveOrder} className="my-auto w-full max-w-2xl rounded-2xl bg-slate-900 p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div><h2 id="order-modal-title" className="text-base font-bold text-slate-100">{editingOrderId ? 'Editar orden de servicio' : 'Crear orden de servicio'}</h2></div>
              <button type="button" aria-label="Cerrar" onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"><X size={18} /></button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Cliente</span><select required value={draft.customerId} onChange={(event) => setDraft({ ...draft, customerId: event.target.value, vehicleId: '', quotationId: '' })} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs outline-none focus:border-slate-700"><option value="">Selecciona un cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name} · {client.id}</option>)}</select></label>
              <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Vehículo</span><select required disabled={!draft.customerId || !availableVehicles.length} value={draft.vehicleId} onChange={(event) => setDraft({ ...draft, vehicleId: event.target.value, quotationId: '' })} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs outline-none focus:border-slate-700 disabled:bg-slate-800"><option value="">{availableVehicles.length ? 'Selecciona un vehículo' : 'Primero agrega un vehículo al cliente'}</option>{availableVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.make} {vehicle.model} · {vehicle.plate}</option>)}</select></label>
              <div className="sm:col-span-2">
                <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Importar cotización aceptada (opcional)</span><select disabled={!selectedVehicle || !availableQuotations.length} value={draft.quotationId} onChange={(event) => setDraft({ ...draft, quotationId: event.target.value })} className="h-10 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs outline-none focus:border-slate-700 disabled:bg-slate-800"><option value="">{!selectedVehicle ? 'Selecciona cliente y vehículo primero' : availableQuotations.length ? 'Crear orden sin importar cotización' : 'No hay cotizaciones guardadas para este vehículo'}</option>{availableQuotations.map((quotation) => <option key={quotation.id} value={quotation.id}>#{quotation.id} · {quotation.date} · {quotation.quoteItems?.length ?? 0} ítems · {quotation.reason}</option>)}</select></label>
                {selectedQuotation && <p className="mt-1.5 text-[10px] font-medium text-emerald-300">Se copiarán {selectedQuotation.quoteItems?.length ?? 0} ítems aprobados y el descuento de la cotización. La cotización quedará vinculada a esta orden.</p>}
                {selectedVehicle && !availableQuotations.length && <p className="mt-1.5 text-[10px] text-slate-400">No se encontraron cotizaciones guardadas y pendientes para este cliente y vehículo.</p>}
              </div>
              <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Fecha de ingreso</span><input required type="date" value={draft.dateISO} onChange={(event) => setDraft({ ...draft, dateISO: event.target.value })} className="h-10 w-full rounded-lg border border-slate-700 px-3 text-xs outline-none focus:border-slate-700" /></label>
              <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Kilometraje de ingreso</span><div className="relative"><NumericInput required min="0" step="1" value={draft.mileage} onChange={(value) => setDraft({ ...draft, mileage: value })} placeholder="Ej. 28450" className="h-10 w-full rounded-lg border border-slate-700 pl-3 pr-12 text-xs outline-none focus:border-slate-700" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">km</span></div></label>
              <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Etapa</span><select value={draft.status} disabled className="h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 text-xs text-slate-400">{orderStages.map((stage) => <option key={stage.name} value={stage.name}>{stage.name}</option>)}</select></label>
              <label className="sm:col-span-2"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Motivo de ingreso</span><input required value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} placeholder="Describe el motivo o falla reportada" className="h-10 w-full rounded-lg border border-slate-700 px-3 text-xs outline-none placeholder:text-slate-400 focus:border-slate-700" /></label>
              <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Técnico asignado</span><input required value={draft.technician} onChange={(event) => setDraft({ ...draft, technician: event.target.value })} placeholder="Nombre del técnico" className="h-10 w-full rounded-lg border border-slate-700 px-3 text-xs outline-none placeholder:text-slate-400 focus:border-slate-700" /></label>
              <label><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">Comentarios</span><input value={draft.comments} onChange={(event) => setDraft({ ...draft, comments: event.target.value })} placeholder="Notas adicionales (opcional)" className="h-10 w-full rounded-lg border border-slate-700 px-3 text-xs outline-none placeholder:text-slate-400 focus:border-slate-700" /></label>
              <div className="sm:col-span-2">
                <div className="mb-1.5 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Fotografías de ingreso</span><span className="text-[10px] text-slate-400">{draft.arrivalPhotos.length}/{maxArrivalPhotos}</span></div>
                <label className={`flex min-h-[88px] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-700 bg-slate-800 px-4 py-3 text-center transition hover:border-slate-700 hover:bg-slate-800 ${draft.arrivalPhotos.length >= maxArrivalPhotos || photosProcessing ? 'pointer-events-none opacity-50' : ''}`}>
                  <input aria-label="Subir fotografías de ingreso" type="file" accept="image/*" multiple disabled={draft.arrivalPhotos.length >= maxArrivalPhotos || photosProcessing} onChange={handlePhotoSelection} className="sr-only" />
                  <Camera size={18} className="text-slate-400" />
                  <span className="text-xs font-semibold text-slate-300">{photosProcessing ? 'Preparando fotografías…' : 'Selecciona o toma fotos de la unidad'}</span>
                  <span className="text-[10px] text-slate-400">Imágenes · máximo {maxArrivalPhotos} fotos · 12 MB por archivo. Se comprimen y guardan en Neon.</span>
                </label>
                {photoError && <p role="alert" className="mt-2 text-[11px] font-medium text-red-300">{photoError}</p>}
                {draft.arrivalPhotos.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{draft.arrivalPhotos.map((photo, index) => <div key={`${photo.name}-${index}`} className="group relative overflow-hidden rounded-lg border border-slate-700"><img src={photo.dataUrl} alt={`Foto de ingreso: ${photo.name}`} className="h-24 w-full object-cover" /><span className="block truncate px-2 py-1 text-[9px] text-slate-400">{photo.name}</span><button type="button" aria-label={`Quitar foto ${photo.name}`} onClick={() => setDraft((current) => ({ ...current, arrivalPhotos: current.arrivalPhotos.filter((_, photoIndex) => photoIndex !== index) }))} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/90 text-red-300 shadow hover:bg-slate-900"><Trash2 size={12} /></button></div>)}</div>}
              </div>
            </div>
            {draft.customerId && !availableVehicles.length && <p className="mt-3 text-[11px] text-orange-200">Este cliente todavía no tiene vehículos. Agrégalo desde el módulo Clientes antes de crear la orden.</p>}
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-800 pt-4">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-400 hover:bg-slate-800">Cancelar</button>
              <button type="submit" disabled={!availableVehicles.length || photosProcessing || orderSubmitting} className="rounded-lg bg-lime-300 px-4 py-2.5 text-xs font-extrabold text-slate-950 hover:bg-lime-400 disabled:cursor-not-allowed disabled:opacity-50">{editingOrderId ? 'Guardar cambios' : 'Crear orden'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function ActionButton({ label, icon, onClick, disabled = false, tone = 'lime' }: { label: string; icon: ReactNode; onClick: () => void; disabled?: boolean; tone?: 'lime' | 'neutral' }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-full border bg-transparent transition disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${tone === 'neutral' ? 'border-slate-600 text-slate-200 hover:bg-slate-700/40' : 'border-lime-400 text-lime-400 hover:bg-lime-400/20'}`}
    >
      {icon}
    </button>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 break-words text-xs font-medium text-slate-300">{value}</p></div>
}

function PhotoGallery({ photos, plate }: { photos: Order['arrivalPhotos']; plate: string }) {
  return <div className="mt-5 border-t border-slate-800 pt-4"><h3 className="text-xs font-bold text-slate-200">Fotografías de ingreso</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{photos.map((photo, index) => <a key={`${photo.name}-${index}`} href={photo.dataUrl} target="_blank" rel="noreferrer" className="overflow-hidden rounded-lg border border-slate-700"><img src={photo.dataUrl} alt={`Ingreso de ${plate}: ${photo.name}`} className="h-24 w-full object-cover" /><span className="block truncate px-2 py-1 text-[9px] text-slate-400">{photo.name}</span></a>)}</div></div>
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className={`my-auto w-full rounded-2xl bg-slate-900 p-5 shadow-2xl sm:p-6 ${wide ? 'max-w-3xl' : 'max-w-xl'}`}><div className="mb-5 flex items-center justify-between"><h2 className="text-base font-bold text-slate-100">{title}</h2><button aria-label="Cerrar" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-300"><X size={18} /></button></div>{children}</div></div>
}

export default OrdersView
