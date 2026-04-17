import { Endpoints } from './endpoints';
import { apiPost } from './rest';
import type { Handle } from '@/types/bluebubbles';

export async function queryHandles(params: { limit?: number; offset?: number } = {}): Promise<Handle[]> {
  return apiPost<Handle[]>(Endpoints.handleQuery, {
    limit: params.limit ?? 500,
    offset: params.offset ?? 0,
  });
}
