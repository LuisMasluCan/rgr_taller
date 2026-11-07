export type MonthlyMetric = {
  month: string
  hoursSold: number
  vehiclesAttended: number
  averageServiceTicket: number
  capacityUtilization: number
  warrantyRate: number
  averageStayHours: number
  totalSales: number
  laborSales: number
  partsSales: number
  externalServiceSales: number
  partsProfit: number
  partsProfitability: number
  externalServiceProfit: number
}

export const mockMetrics: MonthlyMetric[] = [
  { month: '2025-12', hoursSold: 132, vehiclesAttended: 78, averageServiceTicket: 389, capacityUtilization: 63, warrantyRate: 4.1, averageStayHours: 31, totalSales: 28600, laborSales: 10400, partsSales: 15800, externalServiceSales: 2400, partsProfit: 3900, partsProfitability: 24.7, externalServiceProfit: 420 },
  { month: '2026-01', hoursSold: 118, vehiclesAttended: 69, averageServiceTicket: 372, capacityUtilization: 57, warrantyRate: 3.8, averageStayHours: 29, totalSales: 25670, laborSales: 9200, partsSales: 14300, externalServiceSales: 2170, partsProfit: 3550, partsProfitability: 24.8, externalServiceProfit: 380 },
  { month: '2026-02', hoursSold: 145, vehiclesAttended: 83, averageServiceTicket: 405, capacityUtilization: 69, warrantyRate: 3.5, averageStayHours: 28, totalSales: 33600, laborSales: 11600, partsSales: 19100, externalServiceSales: 2900, partsProfit: 4900, partsProfitability: 25.7, externalServiceProfit: 540 },
  { month: '2026-03', hoursSold: 153, vehiclesAttended: 91, averageServiceTicket: 418, capacityUtilization: 73, warrantyRate: 3.2, averageStayHours: 27, totalSales: 38000, laborSales: 12600, partsSales: 22100, externalServiceSales: 3300, partsProfit: 5700, partsProfitability: 25.8, externalServiceProfit: 610 },
  { month: '2026-04', hoursSold: 139, vehiclesAttended: 80, averageServiceTicket: 397, capacityUtilization: 66, warrantyRate: 3.7, averageStayHours: 30, totalSales: 31750, laborSales: 11100, partsSales: 18000, externalServiceSales: 2650, partsProfit: 4450, partsProfitability: 24.7, externalServiceProfit: 470 },
  { month: '2026-05', hoursSold: 161, vehiclesAttended: 95, averageServiceTicket: 426, capacityUtilization: 77, warrantyRate: 2.9, averageStayHours: 26, totalSales: 40470, laborSales: 13400, partsSales: 23400, externalServiceSales: 3670, partsProfit: 6100, partsProfitability: 26.1, externalServiceProfit: 690 },
  { month: '2026-06', hoursSold: 148, vehiclesAttended: 87, averageServiceTicket: 411, capacityUtilization: 71, warrantyRate: 3.4, averageStayHours: 28, totalSales: 35760, laborSales: 12100, partsSales: 20700, externalServiceSales: 2960, partsProfit: 5250, partsProfitability: 25.4, externalServiceProfit: 560 },
  { month: '2026-07', hoursSold: 172, vehiclesAttended: 102, averageServiceTicket: 439, capacityUtilization: 82, warrantyRate: 2.6, averageStayHours: 25, totalSales: 44780, laborSales: 14300, partsSales: 26300, externalServiceSales: 4180, partsProfit: 7050, partsProfitability: 26.8, externalServiceProfit: 790 },
  { month: '2026-08', hoursSold: 157, vehiclesAttended: 93, averageServiceTicket: 421, capacityUtilization: 75, warrantyRate: 3.1, averageStayHours: 27, totalSales: 39100, laborSales: 12900, partsSales: 22800, externalServiceSales: 3400, partsProfit: 5850, partsProfitability: 25.7, externalServiceProfit: 640 },
  { month: '2026-09', hoursSold: 181, vehiclesAttended: 108, averageServiceTicket: 452, capacityUtilization: 86, warrantyRate: 2.4, averageStayHours: 24, totalSales: 48820, laborSales: 15100, partsSales: 28800, externalServiceSales: 4920, partsProfit: 7900, partsProfitability: 27.4, externalServiceProfit: 950 },
  { month: '2026-10', hoursSold: 166, vehiclesAttended: 97, averageServiceTicket: 433, capacityUtilization: 79, warrantyRate: 2.8, averageStayHours: 26, totalSales: 41940, laborSales: 13700, partsSales: 24400, externalServiceSales: 3840, partsProfit: 6600, partsProfitability: 27, externalServiceProfit: 740 },
  { month: '2026-11', hoursSold: 190, vehiclesAttended: 114, averageServiceTicket: 468, capacityUtilization: 91, warrantyRate: 2.1, averageStayHours: 23, totalSales: 53300, laborSales: 16100, partsSales: 31800, externalServiceSales: 5400, partsProfit: 8950, partsProfitability: 28.1, externalServiceProfit: 1080 },
]
