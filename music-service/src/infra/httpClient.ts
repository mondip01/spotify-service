import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import * as http from "http";
import * as https from "https";
import { randomUUID } from "crypto";

export interface IHttpResponse<T> extends AxiosResponse<T> {
  requestId: string | null;
}
export interface IHttpClient {
  request<T>(config: AxiosRequestConfig): Promise<IHttpResponse<T>>;
  get<T>(url: string, config?: AxiosRequestConfig): Promise<IHttpResponse<T>>;
  post<T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<IHttpResponse<T>>;
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<IHttpResponse<T>>;
}
export interface HttpClientConfig {
  baseURL: string;
  timeoutMs: number;
  keepAlive?: boolean;
  maxSockets?: number;
}
function toHttpResponse<T>(res: AxiosResponse<T>): IHttpResponse<T> {
  const requestId = (res.config?.headers?.["x-request-id"] as string) ?? null;
  return Object.assign(res, { requestId });
}
export function createHttpClient(config: HttpClientConfig): IHttpClient {
  const httpAgent = new http.Agent({ keepAlive: config.keepAlive ?? true, maxSockets: config.maxSockets ?? 50 });
  const httpsAgent = new https.Agent({ keepAlive: config.keepAlive ?? true, maxSockets: config.maxSockets ?? 50 });
  const axiosInstance: AxiosInstance = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeoutMs,
    httpAgent,
    httpsAgent,
  });
  axiosInstance.interceptors.request.use((req) => {
    req.headers = req.headers ?? {};
    if (!req.headers["x-request-id"]) req.headers["x-request-id"] = randomUUID();
    return req;
  });
  async function request<T>(reqConfig: AxiosRequestConfig): Promise<IHttpResponse<T>> {
    const res = await axiosInstance.request<T>(reqConfig);
    return toHttpResponse(res);
  }
  function get<T>(url: string, reqConfig?: AxiosRequestConfig): Promise<IHttpResponse<T>> {
    return request<T>({ ...reqConfig, method: "GET", url });
  }
  function post<T>(url: string, data?: unknown, reqConfig?: AxiosRequestConfig): Promise<IHttpResponse<T>> {
    return request<T>({ ...reqConfig, method: "POST", url, data });
  }
  function del<T>(url: string, reqConfig?: AxiosRequestConfig): Promise<IHttpResponse<T>> {
    return request<T>({ ...reqConfig, method: "DELETE", url });
  }
  return { request, get, post, delete: del };
}
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  isRetryable: (err: unknown) => boolean;
}
const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 200,
  maxDelayMs: 2000,
  isRetryable: () => false,
};
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
function jitteredDelay(attempt: number, base: number, max: number): number {
  const exp = Math.min(base * 2 ** attempt, max);
  return exp / 2 + Math.random() * (exp / 2);
}
export function withRetry(inner: IHttpClient, retryConfig?: Partial<RetryConfig>): IHttpClient {
  const cfg: RetryConfig = { ...DEFAULT_RETRY, ...retryConfig };
  async function request<T>(reqConfig: AxiosRequestConfig): Promise<IHttpResponse<T>> {
    let lastErr: unknown;
    for (let attempt = 0; attempt < cfg.maxAttempts; attempt++) {
      try {
        return await inner.request<T>(reqConfig);
      } catch (err) {
        lastErr = err;
        const isLast = attempt === cfg.maxAttempts - 1;
        if (isLast || !cfg.isRetryable(err)) throw err;
        await sleep(jitteredDelay(attempt, cfg.baseDelayMs, cfg.maxDelayMs));
      }
    }
    throw lastErr;
  }
  function get<T>(url: string, reqConfig?: AxiosRequestConfig): Promise<IHttpResponse<T>> {
    return request<T>({ ...reqConfig, method: "GET", url });
  }
  function post<T>(url: string, data?: unknown, reqConfig?: AxiosRequestConfig): Promise<IHttpResponse<T>> {
    return request<T>({ ...reqConfig, method: "POST", url, data });
  }
  function del<T>(url: string, reqConfig?: AxiosRequestConfig): Promise<IHttpResponse<T>> {
    return request<T>({ ...reqConfig, method: "DELETE", url });
  }
  return { request, get, post, delete: del };
}

/** Backwards-compatible helper used by service-to-service clients. */
const defaultHttpClient = createHttpClient({ baseURL: '', timeoutMs: 5000 });
export async function httpGet<T = unknown>(url: string, headers?: Record<string, string>): Promise<T> {
  const response = await defaultHttpClient.get<T>(url, { headers });
  return response.data;
}
