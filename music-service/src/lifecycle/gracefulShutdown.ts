import type { Server } from 'node:http';
import logger from '../utils/logger';
import config from '../config/config';
import { closeRabbitMQ } from '../messaging/rabbitmq';
import { disconnectMongo, isMongoReady } from '../infra/mongo';
import { disconnectRedis, isRedisReady } from '../infra/redis';

const {
  SHUTDOWN_FORCE_EXIT_MS: FORCE_EXIT_MS,
  SHUTDOWN_ENDPOINT_PROPAGATION_MS: ENDPOINT_PROPAGATION_MS,
  SHUTDOWN_HTTP_DRAIN_GRACE_MS: HTTP_DRAIN_GRACE_MS,
  SHUTDOWN_INGRESS_STEP_TIMEOUT_MS: INGRESS_STEP_TIMEOUT_MS,
  SHUTDOWN_RESOURCE_CLOSE_TIMEOUT_MS: RESOURCE_CLOSE_TIMEOUT_MS,
} = config;

export interface ShutdownTargets {
  server?: Server;
  stopConsumers?: () => Promise<void>;
  readinessChecks?: (() => boolean)[];
}

let shuttingDown = false;
let shutdownPromise: Promise<void> | null = null;
let targets: ShutdownTargets = {};

export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function isServiceReady(): boolean {
  if (shuttingDown) return false;
  if (!isMongoReady() || !isRedisReady()) return false;
  return (targets.readinessChecks ?? []).every((check) => check());
}

async function performShutdown(reason: string, exitCode: number): Promise<void> {
  shuttingDown = true;
  logger.info({ reason }, 'graceful shutdown started');
  const hardDeadline = setTimeout(() => {
    logger.fatal({ reason }, 'graceful shutdown deadline exceeded');
    process.exit(1);
  }, FORCE_EXIT_MS);
  hardDeadline.unref();

  const ingressSteps: Promise<boolean>[] = [];
  if (targets.server) ingressSteps.push(runStep('http', () => drainHttp(targets.server!), INGRESS_STEP_TIMEOUT_MS));
  if (targets.stopConsumers) ingressSteps.push(runStep('consumers', targets.stopConsumers, INGRESS_STEP_TIMEOUT_MS));

  const ingressResults = await Promise.all(ingressSteps);
  const resourceResults = await Promise.all([
    runStep('rabbitmq', closeRabbitMQ, RESOURCE_CLOSE_TIMEOUT_MS),
    runStep('redis', disconnectRedis, RESOURCE_CLOSE_TIMEOUT_MS),
    runStep('mongo', disconnectMongo, RESOURCE_CLOSE_TIMEOUT_MS),
  ]);

  const failed = [...ingressResults, ...resourceResults].some((succeeded) => !succeeded);
  clearTimeout(hardDeadline);
  const finalExitCode = failed ? 1 : exitCode;
  logger.info({ reason, exitCode: finalExitCode }, 'graceful shutdown complete');
  if (failed) process.exit(finalExitCode);
  process.exitCode = finalExitCode;
}

async function drainHttp(server: Server): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ENDPOINT_PROPAGATION_MS));
  const forceClose = setTimeout(() => {
    logger.warn('forcing remaining HTTP connections closed');
    server.closeAllConnections();
  }, HTTP_DRAIN_GRACE_MS);
  forceClose.unref();
  await new Promise<void>((resolve, reject) => {
    server.close((err?: Error) => (err ? reject(err) : resolve()));
    server.closeIdleConnections();
  }).finally(() => clearTimeout(forceClose));
}

async function withTimeout(name: string, fn: () => Promise<unknown>, ms: number): Promise<unknown> {
  let timer: NodeJS.Timeout | undefined;
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${name} did not settle within ${ms}ms`)), ms);
    timer.unref();
  });
  try {
    return await Promise.race([fn(), expiry]);
  } finally {
    clearTimeout(timer);
  }
}

async function runStep(name: string, fn: () => Promise<unknown>, timeoutMs: number): Promise<boolean> {
  try {
    await withTimeout(name, fn, timeoutMs);
    logger.info({ step: name }, 'shutdown step complete');
    return true;
  } catch (err: any) {
    logger.error({ step: name, err: err?.message }, 'shutdown step failed');
    return false;
  }
}

export function shutdown(reason: string, exitCode = 0): Promise<void> {
  if (!shutdownPromise) shutdownPromise = performShutdown(reason, exitCode);
  return shutdownPromise;
}

export function registerShutdown(shutdownTargets: ShutdownTargets): void {
  targets = shutdownTargets;
  for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => void shutdown(signal));
  process.on('uncaughtException', (err) => logger.error({ err }, 'uncaught exception'));
  process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'unhandled rejection'));
}
