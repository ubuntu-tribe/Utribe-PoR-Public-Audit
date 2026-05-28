#!/usr/bin/env python3
"""
verify_por_kyc.py — Reproduce uTribe's $GIFT Proof-of-Reserves and KYC/Whitelist
verification at any audit block on Polygon Mainnet.

Designed for HT Digital and any independent auditor.

Usage:
  python3 verify_por_kyc.py --block 84249585 --rpc <YOUR_RPC_URL>
  python3 verify_por_kyc.py --date 2026-03-16T00:00:00Z --rpc <YOUR_RPC_URL>
  python3 verify_por_kyc.py --latest --rpc <YOUR_RPC_URL>

Recommended RPCs:
  - HT Digital's own archive node (most independent)
  - Alchemy paid tier with archive       (uTribe production endpoint; key shared on engagement)
  - QuikNode public free                 (https://rpc-mainnet.matic.quiknode.pro)
  - Avoid: PublicNode (prunes archive state)
  - Avoid: polygon-rpc.com (returns 401 to unauthenticated)

Outputs:
  - Stdout: human-readable verification report
  - --csv-mint-recipients: enumerate all GIFT mint recipients up to the audit block
  - --csv-kyc-state: per-recipient KYC level + whitelist status at the audit block

No secrets, no API keys, no internal endpoints. Fully public + reproducible.

Public engineering companion:
  https://github.com/ubuntu-tribe/Utribe-PoR-Public-Audit/blob/main/docs/on-chain-reference.md

(c) 2026 uTribe / Ophir Ubuntu International. Apache 2.0.
"""

import argparse, json, sys, time, urllib.request
from datetime import datetime, timezone
from hashlib import sha3_256

# Use pysha3-compatible Keccak — but Polygon uses Keccak-256 (FIPS-202 SHA-3),
# which differs from SHA3-256 only in padding. Standard library sha3 gives SHA3,
# which is wrong for Ethereum. We bring in pycryptodome's Keccak.
try:
    from Crypto.Hash import keccak as _keccak
    def keccak256(data: bytes) -> bytes:
        k = _keccak.new(digest_bits=256); k.update(data); return k.digest()
except ImportError:
    print("ERROR: install pycryptodome -> pip install pycryptodome", file=sys.stderr)
    sys.exit(2)

# ===== Constants — audit-relevant uTribe contracts on Polygon Mainnet =====
NETWORK = "Polygon Mainnet (chain ID 137)"

# Reserve / token
GIFT_ERC20 = "0xCfde7c43EDB3c9f71331AAc1003b099CE40c94ea"   # production GIFT (deployed 2024-07-12)
V1_POR     = "0xF929a9Ba4a18E673603774c4F4607ea7ea770302"   # V1 PoR (deployed 2024-09-18)

# Compliance — March 16 2026 era
V1_KYC       = "0x29dc5b4efc83a99a737fd8113f26999a3b261261"  # V1 KYC Registry
V1_WHITELIST = "0xeD050d0c8cF7Cb413818fFF759EfcA7f59B51A3c"  # V1 Whitelist Registry

# Compliance — current era (post-2026-04-20)
COMPLIANCE_REGISTRY = "0xfa0bf4c2dbfb147f13127dd99712db0ea2b5b415"
COMPLIANCE_REGISTRY_DEPLOY_BLOCK = 85774550  # 2026-04-20 07:12 UTC

# Event topics
TRANSFER_TOPIC = "0x" + keccak256(b"Transfer(address,address,uint256)").hex()
ZERO_TOPIC     = "0x" + "00" * 32

# ===== RPC helpers =====
def selector(sig: str) -> str:
    return "0x" + keccak256(sig.encode()).hex()[:8]

class Rpc:
    def __init__(self, url: str, name: str = "rpc"):
        self.url = url
        self.name = name
        self.n_calls = 0

    def call(self, method: str, params: list, timeout: int = 30):
        self.n_calls += 1
        body = json.dumps({"jsonrpc": "2.0", "method": method, "params": params, "id": 1}).encode()
        req = urllib.request.Request(self.url, data=body,
            headers={"Content-Type": "application/json", "User-Agent": "verify_por_kyc/1.0"})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(req, timeout=timeout) as r:
                    return json.loads(r.read())
            except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
                if attempt == 2: raise
                time.sleep(1.5 ** attempt)

    def eth_call(self, to: str, data: str, block) -> str:
        blk = block if isinstance(block, str) else hex(block)
        r = self.call("eth_call", [{"to": to, "data": data}, blk])
        if "error" in r:
            raise RuntimeError(f"eth_call failed: {r['error']}")
        return r["result"]

    def eth_getCode(self, addr: str, block) -> str:
        blk = block if isinstance(block, str) else hex(block)
        r = self.call("eth_getCode", [addr, blk])
        return r.get("result", "0x")

    def eth_blockNumber(self) -> int:
        return int(self.call("eth_blockNumber", [])["result"], 16)

    def eth_getBlockByNumber(self, block, full: bool = False):
        blk = block if isinstance(block, str) else hex(block)
        return self.call("eth_getBlockByNumber", [blk, full]).get("result")

    def eth_getLogs(self, params: dict):
        r = self.call("eth_getLogs", [params])
        if "error" in r:
            raise RuntimeError(f"eth_getLogs failed: {r['error']}")
        return r.get("result", [])

# ===== ABI-decoding helpers =====
def dec_uint(hex_str: str) -> int:
    return int(hex_str, 16) if hex_str and hex_str != "0x" else 0

def dec_addr(hex_str: str) -> str:
    h = hex_str[2:] if hex_str.startswith("0x") else hex_str
    return "0x" + h[24:64].lower()

def dec_string_at_offset(full_hex: str, byte_offset: int) -> str:
    h = full_hex[2:] if full_hex.startswith("0x") else full_hex
    pos = byte_offset * 2
    slen = int(h[pos:pos+64], 16)
    return bytes.fromhex(h[pos+64:pos+64+slen*2]).decode("utf-8", errors="ignore")

# ===== Audit primitives =====
def find_block_for_date(rpc: Rpc, target_iso: str) -> int:
    """Binary-search for the first block with timestamp >= target_iso."""
    target_ts = int(datetime.fromisoformat(target_iso.replace("Z", "+00:00")).timestamp())
    latest = rpc.eth_blockNumber()
    earliest = 1
    # Estimate
    latest_blk = rpc.eth_getBlockByNumber(latest)
    if latest_blk:
        latest_ts = int(latest_blk["timestamp"], 16)
        diff_sec = latest_ts - target_ts
        est_back = max(1, int(diff_sec / 2.0))  # ~2s block
        lo = max(1, latest - est_back - 100000)
        hi = latest
    else:
        lo, hi = 1, latest
    while hi - lo > 1:
        mid = (lo + hi) // 2
        b = rpc.eth_getBlockByNumber(mid)
        if not b:
            lo = mid; continue
        ts = int(b["timestamp"], 16)
        if ts < target_ts:
            lo = mid + 1
        else:
            hi = mid
    return hi

def verify_reserve_state(rpc: Rpc, block: int, report: dict):
    """Verify $GIFT PoR state at audit block. Both V1 and current architecture."""
    print(f"\n--- Reserve verification at block {block:,} ---")
    
    # GIFT ERC-20
    print(f"\n[1/3] GIFT ERC-20 token  {GIFT_ERC20}")
    total = dec_uint(rpc.eth_call(GIFT_ERC20, selector("totalSupply()"), block))
    decimals = dec_uint(rpc.eth_call(GIFT_ERC20, selector("decimals()"), block))
    display = total / (10 ** decimals)
    report["gift"] = {
        "address": GIFT_ERC20,
        "totalSupply_raw": str(total),
        "decimals": decimals,
        "totalSupply_display_GIFT": display,
        "physical_kg_at_1mg_per_token": display / 1000,
    }
    print(f"  totalSupply() raw = {total:,}")
    print(f"  decimals()        = {decimals}")
    print(f"  display units     = {display:,.6f} GIFT")
    print(f"  physical          = {display/1000:,.3f} kg gold (at 1 GIFT = 1 mg)")

    # V1 PoR
    print(f"\n[2/3] V1 PoR reserve contract  {V1_POR}")
    res = dec_uint(rpc.eth_call(V1_POR, selector("GIFT_reserve()"), block))
    retr = dec_uint(rpc.eth_call(V1_POR, selector("retrieveReserve()"), block))
    total_raw = rpc.eth_call(V1_POR, selector("getTotalReserves()"), block)[2:]
    n_vaults = int(total_raw[:64], 16)
    total_cap = int(total_raw[64:128], 16)
    nxt = dec_uint(rpc.eth_call(V1_POR, selector("nextVaultId()"), block))
    owner = dec_addr(rpc.eth_call(V1_POR, selector("owner()"), block))
    report["v1_por"] = {
        "address": V1_POR,
        "GIFT_reserve_raw": str(res),
        "retrieveReserve_raw": str(retr),
        "scalar_cross_check": res == retr,
        "getTotalReserves": {"totalReserves_vault_count": n_vaults, "totalAmount_raw": str(total_cap)},
        "nextVaultId": nxt,
        "owner": owner,
    }
    print(f"  GIFT_reserve()      = {res:,} ({res/1e18:,.3f} kg-equiv)")
    print(f"  retrieveReserve()   = {retr:,}  cross-check = {'OK' if res == retr else 'MISMATCH'}")
    print(f"  getTotalReserves()  = ({n_vaults} vaults, totalAmount {total_cap:,})")
    print(f"  nextVaultId()       = {nxt}")
    print(f"  owner()             = {owner}")

    # Per-vault breakdown
    print(f"\n  Vault breakdown:")
    vaults = []
    for vid in range(1, nxt):
        meta_raw = rpc.eth_call(V1_POR, selector("physicalVaultsById(uint256)") + f"{vid:064x}", block)
        m_h = meta_raw[2:]
        v_id = int(m_h[0:64], 16); v_off = int(m_h[64:128], 16); v_amt = int(m_h[128:192], 16)
        v_name = dec_string_at_offset(meta_raw, v_off)
        try:
            state_raw = rpc.eth_call(V1_POR, selector("getReserveState(uint256)") + f"{vid:064x}", block)
            s_h = state_raw[2:]
            s_off = int(s_h[0:64], 16); s_id = int(s_h[64:128], 16); s_bal = int(s_h[128:192], 16)
            s_name = dec_string_at_offset(state_raw, s_off)
        except Exception:
            s_name, s_id, s_bal = "ERROR", 0, 0
        vault = {"id": v_id, "name": v_name, "capacity_raw": str(v_amt), "balance_raw": str(s_bal),
                 "capacity_kg": v_amt / 1e18 / 1000, "balance_kg": s_bal / 1e18 / 1000}
        vaults.append(vault)
        print(f"    vault {v_id}: name='{v_name}'  capacity={v_amt/1e18/1000:,.3f} kg  balance={s_bal/1e18/1000:,.3f} kg")
    report["v1_por"]["vaults"] = vaults

    # ComplianceRegistry presence
    print(f"\n[3/3] ComplianceRegistry  {COMPLIANCE_REGISTRY}")
    has_cr_code = rpc.eth_getCode(COMPLIANCE_REGISTRY, block)
    cr_exists = len(has_cr_code) > 2
    report["compliance_registry"] = {"address": COMPLIANCE_REGISTRY, "exists_at_block": cr_exists,
                                      "deployed_at_block": COMPLIANCE_REGISTRY_DEPLOY_BLOCK}
    if cr_exists:
        print(f"  Deployed BEFORE this block. Use ComplianceRegistry for KYC/whitelist reads.")
    else:
        print(f"  NOT yet deployed at this block.")
        print(f"  Deployed at block {COMPLIANCE_REGISTRY_DEPLOY_BLOCK:,} (2026-04-20 07:12 UTC).")
        print(f"  Use V1 KYC ({V1_KYC}) and V1 Whitelist ({V1_WHITELIST}) for this audit block.")

def verify_kyc_state(rpc: Rpc, block: int, wallet: str, report: dict):
    """Verify KYC + whitelist status for a single wallet at the audit block."""
    print(f"\n--- KYC/Whitelist verification for wallet {wallet} at block {block:,} ---")
    wallet_lower = wallet.lower().replace("0x", "")
    cr_exists = len(rpc.eth_getCode(COMPLIANCE_REGISTRY, block)) > 2

    if cr_exists:
        # Use ComplianceRegistry
        print(f"  Using ComplianceRegistry (post-2026-04-20 architecture)...")
        sel = selector("accounts(address)")
        try:
            r = rpc.eth_call(COMPLIANCE_REGISTRY, sel + "00" * 12 + wallet_lower, block)
            h = r[2:]
            whitelisted = bool(int(h[0:64], 16))
            kyc_level   = int(h[64:128], 16)
            frozen      = bool(int(h[128:192], 16))
            print(f"    whitelisted={whitelisted}  kycLevel={kyc_level}  frozen={frozen}")
            report["kyc"] = {"source": "ComplianceRegistry", "whitelisted": whitelisted,
                              "kycLevel": kyc_level, "frozen": frozen}
        except Exception as e:
            print(f"    ComplianceRegistry call failed: {e}")
            report["kyc"] = {"source": "ComplianceRegistry", "error": str(e)}
    else:
        # Use V1 KYC + V1 Whitelist
        print(f"  Using V1 KYC + V1 Whitelist (pre-2026-04-20 architecture)...")
        kyc_lvl = dec_uint(rpc.eth_call(V1_KYC, selector("getKYCLevel(address)") + "00" * 12 + wallet_lower, block))
        wl_raw = rpc.eth_call(V1_WHITELIST, selector("isWhitelisted(address)") + "00" * 12 + wallet_lower, block)
        whitelisted = bool(int(wl_raw, 16))
        print(f"    V1 getKYCLevel({wallet}) = {kyc_lvl}")
        print(f"    V1 isWhitelisted({wallet}) = {whitelisted}")
        report["kyc"] = {"source": "V1_KYC + V1_WHITELIST",
                          "v1_kyc_address": V1_KYC, "v1_whitelist_address": V1_WHITELIST,
                          "kycLevel": kyc_lvl, "whitelisted": whitelisted}

def enumerate_holders(rpc: Rpc, end_block: int, output_csv: str):
    """Walk all GIFT Transfer events through end_block; net balances; emit non-zero holders.

    Returns dict {addr -> net_balance_raw} and writes CSV.
    Walks Transfer(from, to, value): credits to, debits from. Excludes 0x0 (mints/burns).
    """
    GIFT_DEPLOY = 59261901
    CHUNK = 10000
    print(f"\n--- Enumerating GIFT holders up to block {end_block:,} ---")
    print(f"  Scanning blocks {GIFT_DEPLOY:,} -> {end_block:,} in {CHUNK:,}-block chunks...")
    balances = {}  # addr_lower -> int (raw)
    n_events = 0
    n_chunks = (end_block - GIFT_DEPLOY + CHUNK) // CHUNK
    for i, start in enumerate(range(GIFT_DEPLOY, end_block + 1, CHUNK)):
        stop = min(start + CHUNK - 1, end_block)
        if i % 50 == 0:
            n_holders = sum(1 for v in balances.values() if v > 0)
            print(f"    chunk {i+1}/{n_chunks}: blocks {start:,}-{stop:,}  events={n_events}  holders>0={n_holders}")
        try:
            logs = rpc.eth_getLogs({
                "fromBlock": hex(start), "toBlock": hex(stop),
                "address": GIFT_ERC20,
                "topics": [TRANSFER_TOPIC]  # all transfers (no from-filter)
            })
            for l in logs:
                if len(l["topics"]) < 3:
                    continue
                from_addr = "0x" + l["topics"][1][26:].lower()
                to_addr   = "0x" + l["topics"][2][26:].lower()
                value = int(l["data"], 16)
                if from_addr != "0x0000000000000000000000000000000000000000":
                    balances[from_addr] = balances.get(from_addr, 0) - value
                if to_addr != "0x0000000000000000000000000000000000000000":
                    balances[to_addr] = balances.get(to_addr, 0) + value
                n_events += 1
        except Exception as e:
            print(f"    chunk failed at {start}-{stop}: {e}")
    # Filter to non-zero positive balances
    holders = {a: b for a, b in balances.items() if b > 0}
    print(f"  Total Transfer events: {n_events}")
    print(f"  Unique non-zero holders: {len(holders)}")
    # Cross-check vs totalSupply at end_block
    ts = dec_uint(rpc.eth_call(GIFT_ERC20, selector("totalSupply()"), end_block))
    sum_h = sum(holders.values())
    diff = sum_h - ts
    print(f"  Reconciliation: sum(holder_balances) = {sum_h:,}")
    print(f"                  totalSupply() at end_block = {ts:,}")
    print(f"                  difference = {diff:,}")
    if diff != 0:
        print(f"  WARNING: holder-sum does not match totalSupply (may indicate missing logs or burn events)")
    with open(output_csv, "w") as f:
        f.write("holder_address,balance_raw,balance_GIFT,balance_kg_at_1mg_per_token\n")
        for addr in sorted(holders, key=lambda a: holders[a], reverse=True):
            v = holders[addr]
            f.write(f"{addr},{v},{v/1e18},{v/1e18/1000}\n")
    print(f"  Wrote {output_csv}")
    return holders

def enumerate_mint_recipients(rpc: Rpc, end_block: int, output_csv: str):
    """Walk all GIFT Transfer events with from=0x0 from genesis through end_block."""
    print(f"\n--- Enumerating GIFT mint recipients up to block {end_block:,} ---")
    GIFT_DEPLOY = 59261901  # block where GIFT was first deployed
    # Walk in chunks (most RPCs cap getLogs at ~10k blocks per call)
    CHUNK = 10000
    recipients = {}  # to_address -> total minted raw
    events = []
    n_blocks = end_block - GIFT_DEPLOY
    n_chunks = (n_blocks + CHUNK - 1) // CHUNK
    print(f"  Scanning ~{n_chunks} chunks of {CHUNK:,} blocks each (this may take 5-15 min)...")
    for i, start in enumerate(range(GIFT_DEPLOY, end_block + 1, CHUNK)):
        stop = min(start + CHUNK - 1, end_block)
        if i % 10 == 0:
            print(f"    chunk {i+1}/{n_chunks}: blocks {start:,}-{stop:,}  ({len(events)} mint events so far)")
        try:
            logs = rpc.eth_getLogs({
                "fromBlock": hex(start), "toBlock": hex(stop),
                "address": GIFT_ERC20,
                "topics": [TRANSFER_TOPIC, ZERO_TOPIC]
            })
            for l in logs:
                to_addr = "0x" + l["topics"][2][26:].lower()
                value = int(l["data"], 16)
                recipients[to_addr] = recipients.get(to_addr, 0) + value
                events.append({
                    "block": int(l["blockNumber"], 16),
                    "tx": l["transactionHash"],
                    "to": to_addr,
                    "value_raw": str(value),
                    "value_GIFT": value / 1e18,
                })
        except Exception as e:
            print(f"    chunk failed at {start}-{stop}: {e}")
    print(f"  Total mint events found: {len(events)}")
    print(f"  Unique recipient addresses: {len(recipients)}")
    # Write CSV
    with open(output_csv, "w") as f:
        f.write("recipient_address,total_minted_raw,total_minted_GIFT,event_count\n")
        for addr in sorted(recipients, key=lambda a: recipients[a], reverse=True):
            n = sum(1 for e in events if e["to"] == addr)
            f.write(f"{addr},{recipients[addr]},{recipients[addr]/1e18},{n}\n")
    print(f"  Wrote {output_csv}")
    return events, recipients

# ===== Main =====
def main():
    p = argparse.ArgumentParser(description="Verify $GIFT PoR + KYC at any Polygon block")
    p.add_argument("--rpc", required=True, help="Polygon Mainnet archive RPC URL")
    grp = p.add_mutually_exclusive_group(required=True)
    grp.add_argument("--block", type=int, help="Audit block number")
    grp.add_argument("--date", help="ISO date (binary-searched to first block at/after)")
    grp.add_argument("--latest", action="store_true", help="Use latest block")
    p.add_argument("--wallet", help="Wallet address to check KYC+whitelist for")
    p.add_argument("--csv-mint-recipients", help="Output CSV of all GIFT mint recipients up to the audit block")
    p.add_argument("--csv-holders", help="Output CSV of all wallets with non-zero GIFT balance at the audit block (netted Transfer events)")
    p.add_argument("--json-out", help="Output the full verification report as JSON")
    args = p.parse_args()

    rpc = Rpc(args.rpc)
    print(f"=== verify_por_kyc.py — uTribe $GIFT auditor reproduction ===")
    print(f"Network: {NETWORK}")
    print(f"RPC:     {args.rpc[:60]}...")
    print()

    # Resolve audit block
    if args.latest:
        block = rpc.eth_blockNumber()
        print(f"Using LATEST block: {block:,}")
    elif args.date:
        block = find_block_for_date(rpc, args.date)
        print(f"Resolved date {args.date} -> block {block:,}")
    else:
        block = args.block

    blk_info = rpc.eth_getBlockByNumber(block)
    if blk_info:
        ts = int(blk_info["timestamp"], 16)
        dt = datetime.fromtimestamp(ts, timezone.utc).isoformat()
        print(f"Block {block:,} timestamp: {dt}")

    report = {"network": NETWORK, "block": block, "timestamp_utc": dt if blk_info else None}

    verify_reserve_state(rpc, block, report)
    if args.wallet:
        verify_kyc_state(rpc, block, args.wallet, report)
    if args.csv_mint_recipients:
        events, recipients = enumerate_mint_recipients(rpc, block, args.csv_mint_recipients)
        report["mint_recipients_count"] = len(recipients)
        report["mint_events_count"] = len(events)
    if args.csv_holders:
        holders = enumerate_holders(rpc, block, args.csv_holders)
        report["holders_count"] = len(holders)

    if args.json_out:
        with open(args.json_out, "w") as f:
            json.dump(report, f, indent=2)
        print(f"\nReport written to {args.json_out}")

    print(f"\nTotal RPC calls: {rpc.n_calls}")

if __name__ == "__main__":
    main()
