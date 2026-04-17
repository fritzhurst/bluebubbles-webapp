import { Endpoints } from './endpoints';
import { apiGet, apiRequestWith } from './rest';
import type { ServerInfo } from '@/types/bluebubbles';

/**
 * Ping the server. Used during login before we persist credentials.
 * Returns true if the server responded 200 with a valid envelope.
 */
export async function pingWith(serverUrl: string, password: string): Promise<boolean> {
  try {
    await apiRequestWith<unknown>(serverUrl, password, Endpoints.ping);
    return true;
  } catch {
    return false;
  }
}

export async function getServerInfoWith(
  serverUrl: string,
  password: string,
): Promise<ServerInfo> {
  return apiRequestWith<ServerInfo>(serverUrl, password, Endpoints.serverInfo);
}

export async function getServerInfo(): Promise<ServerInfo> {
  return apiGet<ServerInfo>(Endpoints.serverInfo);
}
