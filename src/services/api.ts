import type { Box, Sample } from '../types'

// Same-origin by default: Cloud Run serves both the React build and /api.
// Set VITE_API_BASE_URL only when the API lives on a different origin.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')

export interface InventoryData { samples: Sample[]; boxes: Box[] }

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) } })
  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as { error?: string } | undefined
    throw new Error(body?.error || `API request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function getInventory() { return request<InventoryData>('/api/inventory') }
export function createSample(sample: Omit<Sample, 'createdAt' | 'updatedAt'>) { return request<Sample>('/api/samples', { method: 'POST', body: JSON.stringify({ action: 'create', sample }) }) }
export function updateSample(sample: Sample) { return request<Sample>('/api/samples', { method: 'POST', body: JSON.stringify({ action: 'update', sample }) }) }
export function moveSample(sampleId: string, toLocationId: string) { return request<Sample>('/api/move', { method: 'POST', body: JSON.stringify({ sampleId, toLocationId }) }) }
