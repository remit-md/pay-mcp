/**
 * Test fixtures — mock PayAPI for unit tests.
 */

import type { PayAPI } from "../src/api.js";
import type {
  StatusResponse,
  DirectPaymentResult,
  Tab,
  WebhookRegistration,
  ContractsResponse,
  FundLinkResponse,
  WithdrawLinkResponse,
} from "../src/types.js";

export const AGENT_ADDR = "0x1111111111111111111111111111111111111111";
export const PROVIDER_ADDR = "0x2222222222222222222222222222222222222222";

export const MOCK_CONTRACTS: ContractsResponse = {
  router: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  pay_tab: "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
  pay_direct: "0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
  pay_fee: "0xDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
  usdc: "0xEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
  chain_id: 84532,
};

export const MOCK_STATUS: StatusResponse = {
  address: AGENT_ADDR,
  balance_usdc: "50000000", // $50
  open_tabs: 2,
  locked_usdc: "10000000", // $10
  available_usdc: "40000000", // $40
};

export const MOCK_TAB: Tab = {
  id: "tab-001",
  agent: AGENT_ADDR,
  provider: PROVIDER_ADDR,
  balance_remaining: "45000000",
  total_charged: "5000000",
  max_charge_per_call: "500000",
  charge_count: 10,
  pending_charge_count: 2,
  pending_charge_total: "1000000",
  effective_balance: "44000000",
  status: "open",
  contract_version: 3,
  created_at: new Date().toISOString(),
  closed_at: null,
  auto_close_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

export const MOCK_DIRECT_RESULT: DirectPaymentResult = {
  tx_hash: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
  from: AGENT_ADDR,
  to: PROVIDER_ADDR,
  amount: "5000000",
  fee: "50000",
  status: "confirmed",
};

export const MOCK_WEBHOOK: WebhookRegistration = {
  id: "wh-001",
  url: "https://example.com/webhook",
  events: ["payment.completed"],
  secret: "whsec_test123",
  created_at: new Date().toISOString(),
};

export const MOCK_FUND_LINK: FundLinkResponse = {
  url: "https://pay-skill.com/fund?token=abc123",
  token: "abc123",
  expires_at: new Date(Date.now() + 3600000).toISOString(),
};

export const MOCK_WITHDRAW_LINK: WithdrawLinkResponse = {
  url: "https://pay-skill.com/withdraw?token=xyz789",
  token: "xyz789",
  expires_at: new Date(Date.now() + 3600000).toISOString(),
};

/**
 * Create a mock PayAPI with all methods stubbed.
 * Override specific responses by passing partial overrides.
 */
export function createMockApi(overrides?: {
  status?: StatusResponse;
  tabs?: Tab[];
  tab?: Tab;
  direct?: DirectPaymentResult;
  webhook?: WebhookRegistration;
  webhooks?: WebhookRegistration[];
  fundLink?: FundLinkResponse;
  withdrawLink?: WithdrawLinkResponse;
  chainId?: number;
}): PayAPI {
  const status = overrides?.status ?? MOCK_STATUS;
  const tabs = overrides?.tabs ?? [MOCK_TAB];
  const tab = overrides?.tab ?? MOCK_TAB;
  const direct = overrides?.direct ?? MOCK_DIRECT_RESULT;
  const webhook = overrides?.webhook ?? MOCK_WEBHOOK;
  const webhooks = overrides?.webhooks ?? [MOCK_WEBHOOK];
  const fundLink = overrides?.fundLink ?? MOCK_FUND_LINK;
  const withdrawLink = overrides?.withdrawLink ?? MOCK_WITHDRAW_LINK;
  const chainId = overrides?.chainId ?? 84532;

  return {
    getAddress: () => AGENT_ADDR,
    getChainId: () => chainId,
    getApiUrl: () => "https://testnet.pay-skill.com/api/v1",
    getContracts: async () => MOCK_CONTRACTS,
    get: async <T>(path: string): Promise<T> => {
      if (path === "/status") return status as T;
      if (path.startsWith("/status/")) return status as T;
      if (path === "/tabs") return tabs as T;
      if (path.startsWith("/tabs/")) return tab as T;
      if (path === "/webhooks") return webhooks as T;
      throw new Error(`Unmocked GET: ${path}`);
    },
    post: async <T>(path: string, _body?: unknown): Promise<T> => {
      if (path === "/permit/prepare") {
        return { hash: "0x" + "ab".repeat(32), nonce: "1", deadline: 9999999999 } as T;
      }
      if (path === "/direct") return direct as T;
      if (path === "/tabs") return tab as T;
      if (path.endsWith("/close")) return { ...tab, status: "closed" } as T;
      if (path.endsWith("/charge")) return { charge_id: "ch-001" } as T;
      if (path.endsWith("/topup")) return tab as T;
      if (path === "/webhooks") return webhook as T;
      if (path === "/links/fund") return fundLink as T;
      if (path === "/links/withdraw") return withdrawLink as T;
      if (path === "/mint") return { tx_hash: "0x" + "00".repeat(32) } as T;
      throw new Error(`Unmocked POST: ${path}`);
    },
    del: async <T>(path: string): Promise<T> => {
      if (path.startsWith("/webhooks/")) return {} as T;
      throw new Error(`Unmocked DELETE: ${path}`);
    },
  } as unknown as PayAPI;
}
