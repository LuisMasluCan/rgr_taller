import { Printer } from 'lucide-react'
import type { Order, OrderServiceItem, WorkshopSettings } from '../types'
import { calculateOrderTotals } from '../utils/orderTotals'
import type { OrderDocumentKind } from './OrderActionsDropdown'

type Props = {
  order: Order
  settings: WorkshopSettings
  kind?: OrderDocumentKind
  vehicleColor?: string
}

const currency = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 })
const warrantyIntro = 'Políticas de Garantía – Taller Automotriz RGR. Objeto y alcance. Estas políticas aplican a los servicios realizados por RGR en sus instalaciones de Jr. Huaraz s/n, Callería, Pucallpa, y a los repuestos vendidos e instalados por RGR. La garantía inicia en la fecha de entrega del vehículo y kilometraje registrado en la Orden de Trabajo (OT). 1) Cobertura general • Mano de obra: 30 días o 1,000 km, lo que ocurra primero. Incluye 1 revisión post-servicio gratuita dentro de la vigencia. • Repuestos: según garantía del fabricante/proveedor/importador (originales o alternativos de marca). RGR gestiona el trámite ante el proveedor. • Toda cobertura queda consignada en OT, Factura/Boleta y Check-list de Control de Calidad. 2) Qué cubre la garantía • Defectos de fábrica en piezas instaladas. • Fallas atribuibles a un error de procedimiento o montaje por parte de RGR. • Problemas directamente relacionados con el servicio ejecutado por RGR. 3) Qué no cubre • Desgaste natural de consumibles: pastillas y discos de freno, zapatas, bujías, filtros, plumillas, bandas, aceites y líquidos; vibraciones por deformación posterior por uso. • Daños por uso indebido, sobrecarga, manejo en condiciones extremas, impactos, inundación, combustible/aceite contaminado o inadecuado. • Intervenciones, modificaciones o instalaciones de terceros posteriores al servicio (incluye accesorios eléctricos no originales). • Piezas no vendidas e instaladas por RGR y daños causados por estas. • Eléctrico/electrónico: fallas por cortocircuitos externos, mala instalación de accesorios, variaciones de tensión o chipeadas. 4) Requisitos y'
const warrantyContinuation = 'procedimiento. 1. Aviso de reclamo: dentro de las 48 horas de detectado el fallo y detener el uso si continuar puede agravar el daño. 2. Lugar de evaluación: exclusivamente en RGR. Si el vehículo no puede movilizarse, el traslado corre por cuenta del cliente, salvo cobertura indicada en la cláusula 8. 3. Diagnóstico: sin costo si se confirma responsabilidad de RGR. En caso contrario, se cobra el diagnóstico técnico conforme a la tarifa vigente (informada previamente). 4. Resolución: RGR reparará o reemplazará la pieza defectuosa. No aplica devolución de dinero salvo que corresponda por imposibilidad de reparación conforme a ley. 5. Plazos (SLA): diagnóstico en 24–48 h hábiles; solución en 2–7 días hábiles según disponibilidad de repuestos y complejidad. 5) Cobertura de mano de obra y repuestos • Cubre mano de obra de reinstalación y pieza defectuosa cuando el uso fue normal. • No cubre daños progresivos por uso continuo una vez detectado el problema. • Ajustes y retorques: cuando aplique (ruedas, suspensión), el cliente debe asistir a retorque gratuito a los 50–100 km. Omitirlo puede anular la cobertura sobre aflojamientos. 6) Casos y plazos especiales • Trabajos de conservación (alineación, balanceo, limpieza de inyectores, pulido): 07 días o 300 km, lo que ocurra primero. o Alineación y balanceo: no cubre desajustes por baches, golpes o desgaste irregular posterior. o Pulido: no cubre rayones, agentes químicos o intemperie. • Suspensión y dirección: 60 días o 2,000 km, lo que ocurra primero, cuando las piezas son nuevas y de marcas recomendadas por RGR. Requiere retorque a los 50–100 km. • Latonería y pintura: 12 meses por defectos de aplicación (descascarado, peeling, burbujeo). No cubre golpes, rayones, químicos ni diferencias de tono por envejecimiento del resto de la carrocería. Ajustes de carrocería/ruidos: 45 días o 3,000 km, lo que ocurra primero. • Piezas reconstruidas/reparadas: 30 días o 500 km, lo que ocurra primero. 7) Piezas provistas por el cliente • RGR no garantiza piezas aportadas por el cliente. • La mano de obra se limita a la correcta instalación; si la pieza falla, el desmontaje/montaje posterior se cotiza aparte. • Piezas eléctricas/electrónicas aportadas por el cliente: sin garantía y sujetas a prueba previa. 8) Limitación de responsabilidad • La responsabilidad de RGR se limita, como máximo, al monto pagado por el servicio que originó el reclamo. • No cubre daños a terceros, lucro cesante, hotel, comunicaciones u otros gastos indirectos. • Remolque (grúa): si se confirma responsabilidad de RGR y el vehículo quedó inmovilizado por la falla, RGR cubrirá el 100% del servicio de grúa hasta nuestras instalaciones (previa coordinación). 9) Transparencia y seguimiento • Seguimiento digital de garantías, recordatorios y notificaciones. • Entrega de informe técnico con diagnóstico y solución aplicada. 10) Disposición final • Estas políticas se interpretan conforme a la normativa peruana de protección al consumidor (Indecopi). Nada de lo aquí dispuesto limita los derechos irrenunciables del consumidor. Contacto de garantías: 960 177 628 – Jr. Huaraz s/n, Callería, Pucallpa.'
const stageTimestamps: { key: keyof NonNullable<Order['timestamps']>; label: string }[] = [
  { key: 'fechaIngreso', label: 'Recepción' },
  { key: 'fechaDiagnostico', label: 'Diagnóstico' },
  { key: 'fechaRepuestos', label: 'Repuestos' },
  { key: 'fechaAprobacion', label: 'Aprobación' },
  { key: 'fechaInicioReparacion', label: 'Reparación' },
  { key: 'fechaControl', label: 'Control' },
  { key: 'fechaEntrega', label: 'Entrega' },
  { key: 'fechaArchivado', label: 'Archivados' },
]

function formatDate(value?: string) {
  if (!value) return 'No registrado'
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString('es-PE')
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
}

function formatMoney(value: number) {
  return currency.format(value)
}

function itemNet(item: OrderServiceItem, globalDiscount: number) {
  const discount = 1 - (1 - item.discount / 100) * (1 - globalDiscount / 100)
  const base = item.price * item.quantity * (1 - discount)
  return { discount, base, tax: base * item.taxRate / 100, total: base * (1 + item.taxRate / 100) }
}

function WorkOrderPDFTemplate({ order, settings, kind = 'service', vehicleColor = 'No registrado' }: Props) {
  if (kind === 'service') return <ServiceOrderDocument order={order} settings={settings} vehicleColor={vehicleColor} />
  if (kind === 'work') return <WorkOrderDocument order={order} settings={settings} vehicleColor={vehicleColor} />
  if (kind === 'report') return <OrderReportDocument order={order} settings={settings} vehicleColor={vehicleColor} />
  return <DiagnosisDocument order={order} settings={settings} vehicleColor={vehicleColor} />
}

function DocumentLogo() {
  return (
    <img className="document-logo" src="/rgr-logo.png" alt="RGR Taller Automotriz" />
  )
}

function DocumentHeader({ order, settings, title, version = false, vehicleColor = 'No registrado' }: { order: Order; settings: WorkshopSettings; title: string; version?: boolean; vehicleColor?: string }) {
  return (
    <header className="document-form-header">
      <div className="document-logo-cell"><DocumentLogo /></div>
      <div className="document-form-title"><strong>{title}</strong><span>{settings.name || 'RGR TALLER AUTOMOTRIZ'}</span></div>
      <div className="document-form-meta"><span>{version ? 'ODS-V1' : 'RGR-TALLER'}</span><span>Versión 001</span><span>{formatDate(order.dateISO ?? order.date)}</span></div>
      <div className="document-form-notice">El servicio de taller automotriz se atiende bajo las políticas de garantía impresas al reverso.</div>
      <table className="document-data-table">
        <tbody>
          <tr className="document-section-row"><th colSpan={6}>Datos del vehículo</th></tr>
          <tr><th>Orden de Servicio Nro:</th><td>{order.id}</td><th>Cliente:</th><td>{order.customer}</td><th>Kilometraje de Ingreso:</th><td>{order.mileage.toLocaleString('es-PE')}</td></tr>
          <tr><th>Fecha de ingreso:</th><td>{order.dateISO || order.date}</td><th>Vehículo:</th><td>{order.vehicle.make} {order.vehicle.model}</td><th>Nivel de combustible Ingreso:</th><td>{order.qualityControl?.fuelLevel || '—'}</td></tr>
          <tr><th>Hora de ingreso:</th><td>{order.timestamps?.fechaIngreso ? new Date(order.timestamps.fechaIngreso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—'}</td><th>Placas:</th><td>{order.vehicle.plate}</td><th>Autoriza Prueba de Ruta:</th><td>{order.qualityControl?.roadTest ? 'Sí' : '—'}</td></tr>
          <tr><th>Es una Garantía:</th><td>—</td><th>VIN:</th><td>{order.vehicle.vin || 'No registrado'}</td><th>Color de Vehículo:</th><td>{vehicleColor}</td></tr>
          <tr className="document-section-row"><th colSpan={6}>Personal a cargo</th></tr>
          <tr><th colSpan={2}>Asesor de Repuestos:</th><td colSpan={4}></td></tr>
          <tr><th colSpan={2}>Técnico Asignado:</th><td colSpan={4}>{order.technician || '—'}</td></tr>
        </tbody>
      </table>
    </header>
  )
}

function ODSInspector({ order }: { order: Order }) {
  const fluidNames = ['Aceite Motor', 'Refrigerante', 'Líquido de frenos', 'Aceite Hidráulico', 'Líquido de Embrague', 'Limpia Parabrisas']
  const checkedFluids = order.qualityControl?.fluidsChecklist ?? []
  return (
    <section className="document-inspection">
      <DocumentSectionTitle>Inspección en Vehículo</DocumentSectionTitle>
      <div className="document-inspection-grid">
        <table className="document-data-table">
          <tbody>
            <tr><th colSpan={2}>Fluidos:</th><th>OK</th><th>NO</th></tr>
            {fluidNames.map((fluid) => <tr key={fluid}><th colSpan={2}>{fluid}:</th><td>{checkedFluids.includes(fluid) ? '✓' : ''}</td><td>{checkedFluids.includes(fluid) ? '' : '□'}</td></tr>)}
            <tr><th colSpan={4}>Otros Fluidos:</th></tr>
            <tr><th colSpan={4}>Objetos de valor reportados:</th></tr>
          </tbody>
        </table>
        <div className="document-fuel">
          <strong>Nivel de combustible Control:</strong>
          <FuelGauge level={order.qualityControl?.fuelLevel} />
        </div>
        <table className="document-data-table">
          <tbody>
            {['Llanta de Repuesto', 'Kit de carretera', 'Herramientas', 'Botiquín', 'Extintor', 'Otros'].map((label) => <tr key={label}><th>{label}:</th><td></td></tr>)}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function FuelGauge({ level }: { level?: string }) {
  const pointer = level === 'Lleno' ? 'M140 112 L140 40' : level === '3/4' ? 'M140 112 L90 58' : level === '1/2' ? 'M140 112 L140 40' : level === '1/4' ? 'M140 112 L190 58' : 'M140 112 L202 112'
  return (
    <svg viewBox="0 0 280 150" role="img" aria-label={`Nivel de combustible ${level || 'sin registrar'}`} className="document-fuel-gauge">
      <path d="M53 112 A87 87 0 0 1 227 112" fill="none" stroke="#111827" strokeWidth="8" strokeDasharray="3 8" />
      <text x="34" y="126" fontSize="18" fontWeight="bold">E</text><text x="234" y="126" fontSize="18" fontWeight="bold">F</text>
      <text x="132" y="99" fontSize="18" fontWeight="bold">½</text>
      <path d={pointer} stroke="#b91c1c" strokeWidth="3" /><circle cx="140" cy="112" r="5" fill="#b91c1c" />
    </svg>
  )
}

function DocumentSectionTitle({ children }: { children: string }) {
  return <div className="document-band">{children}</div>
}

function VehicleSketch({ label }: { label: string }) {
  const isTop = label === 'Vista superior'
  return (
    <figure className="vehicle-sketch">
      <svg viewBox="0 0 180 72" aria-label={label} role="img">
        {isTop ? (
          <><path d="M49 8 Q90 0 131 8 L145 18 L151 55 L136 64 Q90 72 44 64 L29 55 L35 18Z" /><path d="M53 15 Q90 8 127 15 L134 25 L133 49 Q90 57 47 49 L46 25Z" /><path d="M48 30 H132 M48 44 H132" /><circle cx="39" cy="26" r="4" /><circle cx="141" cy="26" r="4" /></>
        ) : (
          <><path d="M12 49 L20 45 L34 42 L51 25 Q61 18 83 18 H124 Q138 20 149 34 L164 39 L170 45 V55 H12Z" /><path d="M56 26 Q64 21 82 21 H98 V39 H43Z M103 21 H123 Q135 23 145 39 H103Z" /><circle cx="48" cy="52" r="10" /><circle cx="135" cy="52" r="10" /><path d="M19 44 H164" /></>
        )}
      </svg>
      <figcaption>{label}</figcaption>
    </figure>
  )
}

function PolicyBlock() {
  return (
    <section className="document-policy">
      <DocumentSectionTitle>Políticas de Garantía</DocumentSectionTitle>
      <p>{warrantyIntro}</p>
    </section>
  )
}

function ServiceOrderDocument({ order, settings, vehicleColor }: { order: Order; settings: WorkshopSettings; vehicleColor: string }) {
  const reasons = order.reason.split(/\n|;|•/).map((reason) => reason.trim()).filter(Boolean)
  return (
    <article className="print-a4-document printable-order-document">
      <section className="document-page">
        <DocumentHeader order={order} settings={settings} title="ORDEN DE SERVICIO" version vehicleColor={vehicleColor} />
        <ODSInspector order={order} />
        <table className="document-data-table document-reasons-table">
          <thead><tr className="document-section-row"><th colSpan={3}>Motivo de Ingreso</th><th>Técnico Responsable</th><th colSpan={2}>Procedimientos</th></tr></thead>
          <tbody>{reasons.map((reason, index) => <tr key={`${reason}-${index}`}><td>{index + 1}</td><td colSpan={2}>{reason}</td><td>{order.technician || '—'}</td><td colSpan={2}>{order.diagnosis?.proposedWork || ''}</td></tr>)}</tbody>
        </table>
        <table className="document-data-table"><tbody><tr><th>Documentos del vehículo:</th><td colSpan={5}></td></tr><tr><th>Comentarios:</th><td colSpan={5}>{order.comments || ''}</td></tr></tbody></table>
        <section className="document-visual-inspection">
          <DocumentSectionTitle>Inspección Visual</DocumentSectionTitle>
          <div className="vehicle-sketches">{['Vista frontal', 'Vista lateral', 'Vista posterior', 'Vista lateral', 'Vista superior'].map((label, index) => <VehicleSketch key={`${label}-${index}`} label={label} />)}</div>
          <table className="document-data-table"><tbody><tr><th>Daños específicos:</th><td></td></tr><tr><th>Observaciones adicionales:</th><td>{order.qualityControl?.observations || ''}</td></tr></tbody></table>
        </section>
        <p className="document-consent">Con la firma de esta Orden de Servicio, certifico que he leído y acepto voluntariamente las políticas de garantía que se exponen al reverso de este documento.</p>
        <SignatureRow labels={['Cliente', 'Asesor de Servicio']} />
        <PolicyBlock />
      </section>
      <PolicyPage settings={settings} pageNumber="2" />
      <button type="button" onClick={() => window.print()} className="no-print mx-auto mt-5 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700"><Printer size={15} /> Imprimir / Guardar PDF</button>
    </article>
  )
}

function WorkOrderDocument({ order, settings, vehicleColor }: { order: Order; settings: WorkshopSettings; vehicleColor: string }) {
  const items = order.quoteItems ?? []
  const parts = items.filter((item) => item.type === 'Repuesto' || item.type === 'Insumo')
  const additional = items.filter((item) => !parts.includes(item))
  const hours = items.filter((item) => item.type === 'Mano de obra').reduce((total, item) => total + (item.laborHours ?? item.quantity), 0)
  return (
    <article className="print-a4-document printable-order-document">
      <section className="document-page">
        <DocumentHeader order={order} settings={settings} title="ORDEN DE TRABAJO" version vehicleColor={vehicleColor} />
        <DocumentSectionTitle>Inspección del vehículo</DocumentSectionTitle>
        <table className="document-work-table">
          <thead><tr><th>#</th><th>Motivo</th><th>Horas</th><th>Diagnóstico</th><th>Repuestos e Insumos</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>{order.reason}</td><td>{hours ? `${hours} hrs` : ''}</td><td>{order.diagnosis?.findings || ''}</td><td>{parts.map((item) => `${item.description} × ${item.quantity}`).join(', ')}</td></tr>
            <tr><td>2</td><td></td><td></td><td></td><td></td></tr>
          </tbody>
        </table>
        <DocumentSectionTitle>Ítems o Servicios adicionales</DocumentSectionTitle>
        <table className="document-data-table"><tbody>{additional.length ? additional.map((item, index) => <tr key={item.id}><td>{index + 1}</td><td>{item.description}</td><td>{item.type}</td><td>{item.quantity}</td></tr>) : <tr><td className="document-empty-row"> </td></tr>}</tbody></table>
        <DocumentSectionTitle>Hallazgos</DocumentSectionTitle>
        <FindingsTable first={1} last={6} />
      </section>
      <section className="document-page">
        <FindingsTable first={7} last={15} />
        <table className="document-data-table document-observations"><tbody><tr><th>Observaciones adicionales:</th><td>{order.qualityControl?.observations || ''}</td></tr><tr><th>Fecha Solicitud Control de Calidad:</th><td>{order.timestamps?.fechaControl ? formatDate(order.timestamps.fechaControl) : ''}</td></tr></tbody></table>
        <SignatureRow labels={['Técnico', 'Supervisor']} />
        <PolicyBlock />
      </section>
      <PolicyPage settings={settings} pageNumber="3" />
      <button type="button" onClick={() => window.print()} className="no-print mx-auto mt-5 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700"><Printer size={15} /> Imprimir / Guardar PDF</button>
    </article>
  )
}

function FindingsTable({ first, last }: { first: number; last: number }) {
  return (
    <table className="document-work-table document-findings-table">
      <thead><tr><th>#</th><th>Hallazgos</th><th>Horas</th><th>Diagnóstico</th><th>Repuestos e Insumos</th></tr></thead>
      <tbody>{Array.from({ length: last - first + 1 }, (_, index) => <tr key={first + index}><td>{first + index}</td><td></td><td></td><td></td><td></td></tr>)}</tbody>
    </table>
  )
}

function OrderReportDocument({ order, settings, vehicleColor }: { order: Order; settings: WorkshopSettings; vehicleColor: string }) {
  const items = order.quoteItems ?? []
  const totals = calculateOrderTotals(items, order.quoteDiscountPercent ?? 0)
  const approved = calculateOrderTotals(items, order.quoteDiscountPercent ?? 0, true)
  const date = order.timestamps?.fechaIngreso ? formatDateTime(order.timestamps.fechaIngreso) : order.date
  const timeline = stageTimestamps.flatMap(({ key, label }) => {
    const timestamp = order.timestamps?.[key]
    return timestamp ? [{ timestamp, label }] : []
  })

  return (
    <article className="print-a4-document printable-order-document printable-order-report">
      <section className="document-page report-page">
        <header className="report-header">
          <DocumentLogo />
          <div>{settings.name || 'RGR TALLER AUTOMOTRIZ'}<br />{settings.address}<br />{settings.email}</div>
        </header>
        <h1 className="report-title">ORDEN DE SERVICIO<br /><span>#{order.id}</span></h1>
        <DocumentSectionTitle>Información de la orden</DocumentSectionTitle>
        <div className="report-order-info">
          <p>Cliente: {order.customer}</p>
          <p>Vehículo: {order.vehicle.make}, Color {vehicleColor}, Modelo {order.vehicle.model}, Placa {order.vehicle.plate}, VIN {order.vehicle.vin || 'No registrado'}</p>
          <p>Ingreso: {date}</p>
          <p>Kilometraje: {order.mileage.toLocaleString('es-PE')}</p>
        </div>
        <DocumentSectionTitle>Presupuesto general</DocumentSectionTitle>
        <div className="report-items">
          <div className="report-item-head"><span>#</span><span>Descripción</span><span>Precio</span></div>
          <div className="report-reason"><strong>MOTIVO DE INGRESO: {order.reason}</strong><span>Motivo #1<br /><b>[{order.status.toUpperCase()}]</b></span>
            {order.diagnosis?.findings && <small>Diagnóstico: {order.diagnosis.findings}</small>}
          </div>
          {items.map((item, index) => {
            const line = itemNet(item, order.quoteDiscountPercent ?? 0)
            return <div key={item.id} className="report-item-row"><span>{index + 1}</span><span><b>[{item.type}]</b> {item.description}<small>Precio/unidad: {formatMoney(item.price)} · Descuento: {(line.discount * 100).toFixed(0)}% · Base imponible: {formatMoney(line.base)} · Impuesto: {item.taxRate}% · Cantidad: {item.quantity}</small></span><strong>{formatMoney(line.total)}</strong></div>
          })}
          {!items.length && <div className="report-item-row"><span>1</span><span>Sin ítems presupuestados</span><strong>{formatMoney(0)}</strong></div>}
        </div>
        <div className="report-generated">Generado: {date} · Creado mediante RGR Taller<span>Página 1</span></div>
      </section>

      <section className="document-page report-page">
        <TotalsReportTable totals={totals} approved={approved} />
        {order.arrivalPhotos.length > 0 && <ArrivalEvidence photos={order.arrivalPhotos} />}
        <div className="report-generated">Generado: {date} · Creado mediante RGR Taller<span>Página 2</span></div>
      </section>

      <section className="document-page report-page">
        <DocumentSectionTitle>Motivos de ingreso</DocumentSectionTitle>
        <table className="report-table"><thead><tr><th>#</th><th>Motivo de ingreso</th><th>Diagnóstico</th><th>Procedimientos autorizados</th></tr></thead>
          <tbody><tr><td>1</td><td>{order.reason}</td><td>{order.diagnosis?.findings || 'Pendiente'}</td><td>{order.diagnosis?.proposedWork || 'Pendiente de autorización'}</td></tr></tbody>
        </table>
        <DocumentSectionTitle>Trazabilidad de la orden de servicio</DocumentSectionTitle>
        <table className="report-table report-timeline"><thead><tr><th>Fecha/Hora</th><th>Tipo usuario</th><th>Usuario</th><th>Etapa</th><th>Título</th><th>Descripción</th></tr></thead>
          <tbody>{timeline.map(({ timestamp, label }) => <tr key={`${label}-${timestamp}`}><td>{formatDateTime(timestamp)}</td><td>Sistema</td><td>{order.technician || 'RGR Taller'}</td><td>{label}</td><td>Ingreso a {label}</td><td>Marca de tiempo registrada para la fase {label} de la orden.</td></tr>)}</tbody>
        </table>
        {!timeline.length && <p className="report-empty">La orden aún no tiene eventos de trazabilidad registrados.</p>}
        <div className="report-generated">Generado: {date} · Creado mediante RGR Taller<span>Página 3</span></div>
      </section>

      <PolicyPage settings={settings} pageNumber="4" report />
      <button type="button" onClick={() => window.print()} className="no-print mx-auto mt-5 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700"><Printer size={15} /> Imprimir / Guardar PDF</button>
    </article>
  )
}

function ArrivalEvidence({ photos }: { photos: Order['arrivalPhotos'] }) {
  return (
    <section className="report-arrival-evidence">
      <DocumentSectionTitle>Evidencia de ingreso</DocumentSectionTitle>
      <div className="report-arrival-photo-grid">
        {photos.map((photo, index) => (
          <figure key={`${photo.name}-${index}`}>
            <img src={photo.dataUrl} alt={`Evidencia de ingreso ${index + 1}: ${photo.name}`} />
          </figure>
        ))}
      </div>
    </section>
  )
}

function TotalsReportTable({ totals, approved }: { totals: ReturnType<typeof calculateOrderTotals>; approved: ReturnType<typeof calculateOrderTotals> }) {
  const rows: [string, number, number][] = [
    ['SUBTOTAL', totals.subtotal, approved.subtotal],
    ['DESCUENTOS', totals.discounts, approved.discounts],
    ['BASE IMPONIBLE', totals.base, approved.base],
    ['IMPUESTOS', totals.taxes, approved.taxes],
    ['TOTAL', totals.total, approved.total],
  ]
  return (
    <table className="report-table report-totals"><thead><tr><th>Concepto</th><th>Cotizado</th><th>Aprobado</th></tr></thead>
      <tbody>{rows.map(([label, quoted, accepted]) => <tr key={label}><th>{label}</th><td>{formatMoney(quoted)}</td><td>{formatMoney(accepted)}</td></tr>)}
        <tr className="report-total-service"><th colSpan={2}>TOTAL SERVICIO</th><th>{formatMoney(totals.total)}</th></tr></tbody>
    </table>
  )
}

function DiagnosisDocument({ order, settings, vehicleColor }: { order: Order; settings: WorkshopSettings; vehicleColor: string }) {
  return (
    <article className="print-a4-document printable-order-document printable-diagnosis-document">
      <section className="document-page">
        <DocumentHeader order={order} settings={settings} title="DIAGNÓSTICO MECÁNICO" vehicleColor={vehicleColor} />
        <DocumentSectionTitle>Motivo de ingreso</DocumentSectionTitle>
        <p className="diagnosis-description">{order.reason}</p>
        <DocumentSectionTitle>Datos del vehículo</DocumentSectionTitle>
        <table className="document-data-table"><tbody>
          <tr><th>Cliente</th><td>{order.customer}</td><th>Vehículo</th><td>{order.vehicle.make} {order.vehicle.model} {order.vehicle.year}</td></tr>
          <tr><th>Placa</th><td>{order.vehicle.plate}</td><th>Color / VIN</th><td>{vehicleColor} · {order.vehicle.vin || 'No registrado'}</td></tr>
          <tr><th>Kilometraje</th><td>{order.mileage.toLocaleString('es-PE')} km</td><th>Técnico</th><td>{order.technician || 'Por asignar'}</td></tr>
        </tbody></table>
        <DocumentSectionTitle>Hallazgos del diagnóstico</DocumentSectionTitle>
        <div className="diagnosis-writing-area">{order.diagnosis?.findings || 'Sin diagnóstico registrado.'}</div>
        <DocumentSectionTitle>Procedimiento recomendado</DocumentSectionTitle>
        <div className="diagnosis-writing-area">{order.diagnosis?.proposedWork || 'Sin procedimiento registrado.'}</div>
        <SignatureRow labels={['Técnico responsable', 'Cliente']} />
      </section>
      <button type="button" onClick={() => window.print()} className="no-print mx-auto mt-5 flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-700"><Printer size={15} /> Imprimir / Guardar PDF</button>
    </article>
  )
}

function SignatureRow({ labels }: { labels: string[] }) {
  return <div className="document-signatures">{labels.map((label) => <div key={label}><span></span><strong>{label}</strong></div>)}</div>
}

function PolicyPage({ settings, pageNumber, report = false }: { settings: WorkshopSettings; pageNumber: string; report?: boolean }) {
  return (
    <section className={`document-page ${report ? 'report-page' : ''}`}>
      {report ? <DocumentSectionTitle>Políticas de Garantía</DocumentSectionTitle> : (
        <header className="document-policy-header">
          <DocumentLogo />
          <strong>POLÍTICAS DE GARANTÍA</strong>
          <span>ODS-V1 · Versión 001</span>
        </header>
      )}
      <div className="document-policy-page">
        <p className="document-policy-intro"><strong>Políticas de Garantía · {settings.name || 'RGR Taller'}</strong></p>
        <p>{report ? `${warrantyIntro} ${warrantyContinuation}` : warrantyContinuation}</p>
      </div>
      <div className="document-page-number">Página {pageNumber}</div>
    </section>
  )
}

export default WorkOrderPDFTemplate
