export const laborConfig = {
  hourlySaleRate: 90,
  taxRate: 18,
  complexityFactors: {
    A: 1,
    B: 1.15,
    C: 1.3,
  },
  monthlyFixedCosts: 10_000,
} as const

export type LaborComplexity = keyof typeof laborConfig.complexityFactors

export function getLaborSuggestedPrice(hours: number, complexity: LaborComplexity): number {
  return hours * laborConfig.hourlySaleRate * laborConfig.complexityFactors[complexity]
}
