import type { Server } from 'node:http';
import { registerShutdown, isServiceReady } from './gracefulShutdown';

export function registerGracefulShutdown(server: Server): void {
  registerShutdown({ server });
}

export { isServiceReady };
