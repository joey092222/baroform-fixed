import { getJson } from "./http";
import type { WalletData } from "../types";

export const emptyWallet: WalletData = { balance: 0, transactions: [] };

export async function fetchWallet(authToken: string): Promise<WalletData> {
  const result = await getJson<Partial<WalletData>>("/api/wallet", { authToken });
  return {
    balance: Number(result.balance ?? 0),
    transactions: Array.isArray(result.transactions) ? result.transactions : [],
  };
}
