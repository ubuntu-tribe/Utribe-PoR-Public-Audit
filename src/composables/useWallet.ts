/**
 * Minimum-dependency wallet integration.
 *
 * Picked **raw `window.ethereum` + ethers `BrowserProvider`** instead of
 * web3-onboard / wagmi / rainbowkit because:
 *   1. Public audit app — fewer dependencies, no vendor lock-in.
 *   2. We only need: connect, current account, signer, chain check, switch
 *      chain. Adding a wallet-aggregator library is overkill.
 *   3. Every major browser wallet (MetaMask, Rabby, Brave, OKX, Coinbase,
 *      Trust, Frame, etc.) ships EIP-1193 + EIP-3085 support.
 *
 * Trade-off: no WalletConnect modal for mobile users without an in-app dapp
 * browser. That's acceptable for V1 — auditors all use a desktop browser
 * extension wallet.
 */

import { BrowserProvider, type JsonRpcSigner } from "ethers";
import { computed, readonly, ref } from "vue";
import { NETWORK } from "@/config/chain";
import { POLYGON_NETWORK_PARAMS } from "@/config/env";

const account = ref<string | null>(null);
const chainIdHex = ref<string | null>(null);
const connecting = ref(false);
const connectError = ref<string | null>(null);

const isCorrectChain = computed(() => {
  if (!chainIdHex.value) return false;
  return parseInt(chainIdHex.value, 16) === NETWORK.chainId;
});

const isInstalled = computed(() => typeof window !== "undefined" && Boolean(window.ethereum));

function ethereum(): NonNullable<Window["ethereum"]> {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("No injected wallet detected. Install MetaMask, Rabby, Brave Wallet, or any EIP-1193 browser wallet.");
  }
  return window.ethereum;
}

async function refreshChain(): Promise<void> {
  try {
    const id = (await ethereum().request({ method: "eth_chainId" })) as string;
    chainIdHex.value = id;
  } catch {
    chainIdHex.value = null;
  }
}

async function connect(): Promise<void> {
  if (connecting.value) return;
  connecting.value = true;
  connectError.value = null;
  try {
    const eth = ethereum();
    const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
    account.value = accounts[0] ?? null;
    await refreshChain();
    attachListeners();
  } catch (err) {
    const msg = (err as { message?: string }).message ?? String(err);
    connectError.value = msg;
  } finally {
    connecting.value = false;
  }
}

function disconnect(): void {
  // EIP-1193 doesn't define a programmatic disconnect; we just drop the
  // local references. The user can revoke from their wallet UI.
  account.value = null;
}

async function switchToPolygon(): Promise<void> {
  const eth = ethereum();
  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: POLYGON_NETWORK_PARAMS.chainId }],
    });
  } catch (err) {
    const code = (err as { code?: number }).code;
    // 4902 = chain not added to the wallet — add it then retry.
    if (code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [POLYGON_NETWORK_PARAMS],
      });
    } else {
      throw err;
    }
  }
  await refreshChain();
}

async function getSigner(): Promise<JsonRpcSigner> {
  if (!account.value) throw new Error("Wallet not connected");
  if (!isCorrectChain.value) throw new Error("Wallet is on the wrong chain — switch to Polygon first.");
  const provider = new BrowserProvider(ethereum() as unknown as ConstructorParameters<typeof BrowserProvider>[0]);
  return provider.getSigner();
}

let listenersAttached = false;
function attachListeners(): void {
  if (listenersAttached || typeof window === "undefined" || !window.ethereum) return;
  const eth = window.ethereum;
  if (eth.on) {
    eth.on("accountsChanged", ((accounts: string[]) => {
      account.value = accounts[0] ?? null;
    }) as unknown as (...args: unknown[]) => void);
    eth.on("chainChanged", ((id: string) => {
      chainIdHex.value = id;
    }) as unknown as (...args: unknown[]) => void);
  }
  listenersAttached = true;
}

/**
 * One singleton instance shared across the app — no scoping issues with
 * useQuery dependencies.
 */
export function useWallet() {
  return {
    account: readonly(account),
    chainIdHex: readonly(chainIdHex),
    connecting: readonly(connecting),
    connectError: readonly(connectError),
    isInstalled,
    isCorrectChain,
    connect,
    disconnect,
    switchToPolygon,
    getSigner,
    refreshChain,
  };
}

/** Account ref directly — handy for query enabled-flags. */
export function useAccountRef() {
  return account;
}
