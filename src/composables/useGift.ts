/**
 * GIFT ERC-20 reads. Single contract on Polygon — keep these dead simple.
 */

import { useQuery, type UseQueryReturnType } from "@tanstack/vue-query";
import { Contract, JsonRpcProvider } from "ethers";
import { ADDRESSES, GIFT_ABI, NETWORK } from "@/config/chain";
import { classifyError, type ClassifiedError } from "@/lib/errors";

const provider = new JsonRpcProvider(NETWORK.rpcUrl);
const gift = new Contract(ADDRESSES.giftToken, GIFT_ABI, provider);

export function useGiftTotalSupply(): UseQueryReturnType<bigint, ClassifiedError> {
  return useQuery<bigint, ClassifiedError>({
    queryKey: ["gift", "totalSupply"],
    queryFn: async () => {
      try {
        return BigInt((await gift.totalSupply()) as bigint);
      } catch (err) {
        throw classifyError(err);
      }
    },
    retry: 1,
    staleTime: 30_000,
  });
}
