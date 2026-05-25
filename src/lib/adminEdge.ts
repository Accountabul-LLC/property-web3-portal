import { callEdgeFunction } from '@/lib/edgeFunction'

export async function callAdminEdgeFunction<T = any>(fn: string, body: Record<string, unknown>): Promise<T> {
  return callEdgeFunction<T>(fn, body)
}
