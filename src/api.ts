/**
 * PayAPI — authenticated HTTP client for the Pay server.
 *
 * Handles EIP-712 auth headers on every request, /contracts caching,
 * and structured error responses. All tool/resource handlers call this.
 */

import { type Hex, type Address } from "viem";
import { buildAuthHeaders, type AuthConfig } from "./crypto/auth.js";
import type { ContractsResponse } from "./types.js";

export class PayAPI {
  private readonly privateKey: Hex;
  private readonly address: string;
  private readonly apiUrl: string;
  private readonly chainId: number;
  private contractsCache: ContractsResponse | null = null;
  private authConfig: AuthConfig | null = null;

  constructor(
    privateKey: Hex,
    address: string,
    apiUrl: string,
    chainId: number,
  ) {
    this.privateKey = privateKey;
    this.address = address;
    this.apiUrl = apiUrl;
    this.chainId = chainId;
  }

  /** Wallet address (checksummed). */
  getAddress(): string {
    return this.address;
  }

  /** Chain ID this client is configured for. */
  getChainId(): number {
    return this.chainId;
  }

  /** API base URL. */
  getApiUrl(): string {
    return this.apiUrl;
  }

  /**
   * Fetch contract addresses (cached after first call).
   * GET /contracts is public, no auth needed.
   */
  async getContracts(): Promise<ContractsResponse> {
    if (this.contractsCache) return this.contractsCache;

    const resp = await fetch(`${this.apiUrl}/contracts`);
    if (!resp.ok) {
      throw new Error(`GET /contracts failed: ${resp.status} ${resp.statusText}`);
    }
    this.contractsCache = (await resp.json()) as ContractsResponse;
    return this.contractsCache;
  }

  /**
   * Get the auth config (router address from /contracts + chain ID).
   * Lazy-loaded and cached.
   */
  private async getAuthConfig(): Promise<AuthConfig> {
    if (this.authConfig) return this.authConfig;
    const contracts = await this.getContracts();
    this.authConfig = {
      chainId: this.chainId,
      routerAddress: contracts.router as Address,
    };
    return this.authConfig;
  }

  /**
   * Authenticated GET request.
   */
  async get<T = unknown>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  /**
   * Authenticated POST request with JSON body.
   */
  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  /**
   * Authenticated DELETE request.
   */
  async del<T = unknown>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }

  /**
   * Core request method with auth headers and 401 retry (refresh router address).
   */
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const resp = await this.doRequest(method, path, body);

    // On 401, refresh contracts cache (router address may have changed) and retry once
    if (resp.status === 401) {
      this.contractsCache = null;
      this.authConfig = null;
      const retry = await this.doRequest(method, path, body);
      return this.handleResponse<T>(retry, method, path);
    }

    return this.handleResponse<T>(resp, method, path);
  }

  private async doRequest(method: string, path: string, body?: unknown): Promise<Response> {
    const authConfig = await this.getAuthConfig();
    const headers = await buildAuthHeaders(this.privateKey, method, path, authConfig);

    const fetchHeaders: Record<string, string> = {
      ...headers,
      "Content-Type": "application/json",
    };

    return fetch(`${this.apiUrl}${path}`, {
      method,
      headers: fetchHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  private async handleResponse<T>(resp: Response, method: string, path: string): Promise<T> {
    if (!resp.ok) {
      let errorBody: string;
      try {
        errorBody = await resp.text();
      } catch {
        errorBody = "(no body)";
      }
      throw new PayAPIError(
        `${method} ${path} failed: ${resp.status} ${resp.statusText}`,
        resp.status,
        errorBody,
      );
    }
    return (await resp.json()) as T;
  }
}

export class PayAPIError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "PayAPIError";
    this.status = status;
    this.body = body;
  }
}
