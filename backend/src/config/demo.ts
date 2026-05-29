/**
 * Demo timing configuration — centralised here so every module uses the same values.
 * These accelerated values make real-world delays demo-friendly.
 */
export const DEMO_CONFIG = {
  /** Seconds after attendance submission before parent push fires */
  attendancePushDelaySeconds: 30,

  /** Seconds after admissions decision before offer letter email mock arrives */
  offerLetterDeliverySeconds: 5,

  /** Artificial timetable CSP generation delay range (makes loading animation feel real) */
  timetableGenerationMinSeconds: 12,
  timetableGenerationMaxSeconds: 15,

  /** Milliseconds before risk score recalculation result is returned */
  riskRecalcDelayMs: 1500,
} as const
