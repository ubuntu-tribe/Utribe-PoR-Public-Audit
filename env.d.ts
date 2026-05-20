/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RPC_URL?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_GIFT_TOKEN_ADDRESS?: string;
  readonly VITE_POR_ADDRESS?: string;
  readonly VITE_MINT_CONTROLLER_ADDRESS?: string;
  readonly VITE_TAAS_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.vue" {
  import type { DefineComponent } from "vue";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>;
  export default component;
}

// Window.ethereum (EIP-1193) — provided by injected wallets.
interface EthereumProvider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
  isMetaMask?: boolean;
}

interface Window {
  ethereum?: EthereumProvider;
}
