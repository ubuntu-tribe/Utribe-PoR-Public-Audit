/**
 * Environment with safe defaults for Polygon mainnet.
 * Override via Vite env vars (`VITE_*`) for testnet/staging builds.
 */

const env = import.meta.env;

export const ENV = {
  rpcUrl: env.VITE_RPC_URL ?? "https://polygon-rpc.com",
  chainId: Number(env.VITE_CHAIN_ID ?? "137"),
  giftToken: (env.VITE_GIFT_TOKEN_ADDRESS ?? "0xCfde7c43EDB3c9f71331AAc1003b099CE40c94ea") as `0x${string}`,
  porAddress: (env.VITE_POR_ADDRESS ?? "0xa674f2b838328A5ca29Df5fC2357d20D1AAc785e") as `0x${string}`,
  mintController: (env.VITE_MINT_CONTROLLER_ADDRESS ?? "0xeae4E63F42794952Aa820c30731B1b1f18D6c4C9") as `0x${string}`,
  taasApiUrl: env.VITE_TAAS_API_URL ?? "https://api-stage1.utribe.app",
} as const;

export const POLYGONSCAN = "https://polygonscan.com";
export const IPFS_GATEWAY = "https://ipfs.io/ipfs";

/**
 * Polygon network parameters for `wallet_addEthereumChain` / `wallet_switchEthereumChain`.
 * chainId is encoded as a hex string per EIP-3085.
 */
export const POLYGON_NETWORK_PARAMS = {
  chainId: "0x89", // 137
  chainName: "Polygon Mainnet",
  nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
  rpcUrls: [ENV.rpcUrl],
  blockExplorerUrls: [POLYGONSCAN],
} as const;
