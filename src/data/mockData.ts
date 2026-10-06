import type { Box, Position, Sample } from '../types'

export const boxes: Box[] = [
  { id:'S1-B01', stripeId:'S1', name:'Box 01', rows:9, columns:['A','B','C','D','E','F','G','H','I'] },
  { id:'S1-B02', stripeId:'S1', name:'Box 02', rows:9, columns:['A','B','C','D','E','F','G','H','I'] },
  { id:'S2-B01', stripeId:'S2', name:'Box 01', rows:9, columns:['A','B','C','D','E','F','G','H','I'] },
]

export const samples: Sample[] = [
  { id:'YAS-001', cellLine:'HEK293T', sampleType:'Cell line', passage:12, cellCount:5, qcStatus:'Passed', owner:'YAS', locationId:'S1-B01-C3', notes:'Working stock', createdAt:'2026-10-01', updatedAt:'2026-10-01' },
  { id:'YAS-002', cellLine:'HeLa', sampleType:'Cell line', passage:8, cellCount:4, qcStatus:'Pending', owner:'Alex', locationId:'S1-B01-F6', notes:'Awaiting QC', createdAt:'2026-10-03', updatedAt:'2026-10-03' },
]

export function buildPositions(box: Box): Position[] {
  return box.columns.flatMap(column => Array.from({length:box.rows}, (_, index) => {
    const row=index+1
    const id=box.id+'-'+column+row
    const sample=samples.find(item=>item.locationId===id)
    return { id, stripeId:box.stripeId, boxId:box.id, row, column, occupied:Boolean(sample), sampleId:sample?.id }
  }))
}