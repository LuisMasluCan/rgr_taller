export type ExportCell = string | number

const localDateStamp = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const safeFilename = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()

export async function exportToPdf(data: ExportCell[][], columns: string[], title: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])
  const pdf = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' })
  const emittedAt = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long' }).format(new Date())
  const logo = new Image()
  logo.src = `${import.meta.env.BASE_URL}rgr-logo.png`
  await new Promise<void>((resolve, reject) => {
    logo.onload = () => resolve()
    logo.onerror = () => reject(new Error('No se pudo cargar el logo para el reporte PDF.'))
  })

  pdf.addImage(logo, 'PNG', 14, 6, 48, 14)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(15)
  pdf.setTextColor(16, 24, 39)
  pdf.text(title, 14, 28)
  pdf.setFontSize(9)
  pdf.setTextColor(100, 116, 139)
  pdf.text(`Fecha de emisión: ${emittedAt}`, 14, 35)

  autoTable(pdf, {
    head: [columns],
    body: data.map((row) => row.map(String)),
    startY: 42,
    theme: 'grid',
    headStyles: { fillColor: [16, 24, 39], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 3, textColor: [30, 41, 59] },
    margin: { left: 14, right: 14 },
  })

  pdf.save(`${safeFilename(title)}-${localDateStamp()}.pdf`)
}

export async function exportToExcel(data: ExportCell[][], columns: string[], title: string) {
  const XLSX = await import('xlsx')
  const worksheet = XLSX.utils.aoa_to_sheet([columns, ...data])
  worksheet['!cols'] = columns.map((column, index) => ({
    wch: Math.max(column.length + 2, ...data.map((row) => String(row[index] ?? '').length + 2), 12),
  }))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte')
  XLSX.writeFile(workbook, `${safeFilename(title)}-${localDateStamp()}.xlsx`)
}
