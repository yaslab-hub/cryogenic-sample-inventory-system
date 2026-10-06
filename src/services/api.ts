import type { Box, Sample } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://script.google.com/macros/s/AKfycby1x2fRTFs4NGWcZ9bqsHFp1piYeRNc1bXpQtINTC0wPU7V_yzIKBOxC9We3aTGE5rG/exec'

export interface InventoryData { samples: Sample[]; boxes: Box[] }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!API_BASE_URL) throw new Error('VITE_API_BASE_URL is not configured.')
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'text/plain;charset=utf-8', ...(options?.headers || {}) } })
  if (!response.ok) throw new Error(`API request failed: ${response.status}`)
  return response.json() as Promise<T>
}

export function getInventory() { return request<InventoryData>('/?action=inventory') }
export function createSample(sample: Omit<Sample, 'createdAt' | 'updatedAt'>) { return request<Sample>('/?action=samples', { method: 'POST', body: JSON.stringify({ action: 'create', sample }) }) }
export function updateSample(sample: Sample) { return request<Sample>('/?action=samples', { method: 'POST', body: JSON.stringify({ action: 'update', sample }) }) }
export function moveSample(sampleId: string, toLocationId: string) { return request<Sample>('/?action=move', { method: 'POST', body: JSON.stringify({ action: 'move', sampleId, toLocationId }) }) }
