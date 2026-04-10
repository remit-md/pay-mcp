/** Domain types matching the Pay server API response shapes. */

export interface StatusResponse {
  address: string;
  balance_usdc: string;
  open_tabs: number;
  locked_usdc: string;
  available_usdc: string;
}

export interface DirectPaymentResult {
  tx_hash: string;
  from: string;
  to: string;
  amount: string;
  fee: string;
  status: "confirmed" | "pending";
}

export interface Tab {
  id: string;
  agent: string;
  provider: string;
  balance_remaining: string;
  total_charged: string;
  max_charge_per_call: string;
  charge_count: number;
  pending_charge_count: number;
  pending_charge_total: string;
  effective_balance: string;
  status: "open" | "closed";
  contract_version: number;
  created_at: string;
  closed_at: string | null;
  auto_close_at: string | null;
}

export interface WebhookRegistration {
  id: string;
  url: string;
  events: string[];
  secret: string;
  created_at: string;
}

export interface DiscoverService {
  name: string;
  domain: string;
  base_url: string;
  description: string;
  keywords: string[];
  category: string;
  settlement: string;
  price_range: string | null;
  website: string | null;
}

export interface ContractsResponse {
  router: string;
  tab: string;
  tab_v2?: string;
  direct: string;
  usdc: string;
  chain_id: number;
}

export interface FundLinkResponse {
  url: string;
  token: string;
  expires_at: string;
}

export interface WithdrawLinkResponse {
  url: string;
  token: string;
  expires_at: string;
}
