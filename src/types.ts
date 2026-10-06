export type QCStatus = 'Pending' | 'Passed' | 'Failed'

export interface Position {
  id: string
  stripeId: string
  boxId: string
  row: number
  column: string
  occupied: boolean
  sampleId?: string
}

export interface Sample {
  id: string
  cellLine: string
  sampleType: string
  passage?: number
  cellCount?: number
  qcStatus: QCStatus
  owner: string
  locationId: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Box {
  id: string
  stripeId: string
  name: string
  rows: number
  columns: string[]
}