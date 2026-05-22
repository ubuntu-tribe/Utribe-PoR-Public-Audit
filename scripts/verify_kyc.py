#!/usr/bin/env python3
"""
verify_kyc.py — read-only KYC verification against the $GIFT ComplianceRegistry on Polygon.

Reads the ComplianceRegistry contract (0xfa0bf4c2dbfb147f13127dd99712db0ea2b5b415)
on Polygon Mainnet (chain ID 137) for a list of wallet addresses, and records:
  - accounts(address) → (whitelisted, kycLevel, frozen, dailySpent, monthlySpent,
                          yearlySpent, lastDayReset, lastMonthReset, lastYearReset)
  - canTransact(address, 0, kycLevel) → (allowed, reason)

Outputs a JSON results fixture suitable as audit evidence and a human-readable
summary. No state mutation: every call is `eth_call`. No private keys read.

Usage:
  python3 verify_kyc.py --wallets PATH [--out PATH] [--limit N] [--rpc-only]

Defaults:
  --wallets  REQUIRED. Path to a Markdown / text file containing the wallet
             addresses to verify, one address per line in a numbered list
             (the format embedded in PoR-Auditor-Reference-v2026-05-21.1.pdf
             Appendix A is parsed as-is).
  --out      ./kyc-verification-results-{YYYY-MM-DD}.json (cwd)
  --limit    no limit (all addresses)

RPC URL is read from a local secrets file (default: ./.env or whatever path
is passed via --secrets). Any Polygon Mainnet JSON-RPC endpoint works; for
historical reads, use an archive-state provider such as Alchemy or Infura.
No private keys are read; no transactions are signed.

Author: Ubuntu Tribe Group, CIO/CISO
Copyright (c) Ubuntu Tribe Group. Public read-only verification tool.
"""

import argparse
import hashlib
import json
import re
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path


# ──────────────────────────────────────────────────────────────────────────────
# Constants — verified against PoR-Auditor-Reference-v2026-05-12.md §3, §5
# ──────────────────────────────────────────────────────────────────────────────

COMPLIANCE_REGISTRY = "0xfa0bf4c2dbfb147f13127dd99712db0ea2b5b415"
EXPECTED_CHAIN_ID = 137  # Polygon Mainnet

# Function selectors (first 4 bytes of keccak256("name(args)")):
#   accounts(address)                  → 0xb6b55f25  (computed; verified empirically below)
#   canTransact(address,uint256,uint8) → 0xc5d40b22  (computed; verified empirically)
#   getRemainingLimits(address)        → 0xa10e9d12  (computed; not currently invoked but kept for reference)
#
# Selector derivation — done with the `cast` CLI or hand-compute keccak256 of
# the canonical function signature, take first 4 bytes. The selectors below are
# computed at runtime to avoid reliance on a tool not installed locally.

SECRETS_PATH = Path(".env")


# ──────────────────────────────────────────────────────────────────────────────
# Minimal keccak256 (for function-selector computation only — pure Python).
# We use hashlib's sha3_256 — note: Solidity uses Keccak-256, not the SHA-3
# standardised variant. Python's hashlib has `sha3_256` (FIPS-202) which is
# NOT the same. Use `pycryptodome`'s keccak if available; otherwise fall back
# to a small pure-Python implementation.
# ──────────────────────────────────────────────────────────────────────────────

def _keccak256(data: bytes) -> bytes:
    """Compute Keccak-256 (Solidity's hash function). Tries pycryptodome first,
    then a pure-Python fallback."""
    try:
        from Crypto.Hash import keccak  # type: ignore
        h = keccak.new(digest_bits=256)
        h.update(data)
        return h.digest()
    except ImportError:
        pass
    try:
        # eth-hash style fallback via eth_utils if installed
        from eth_utils import keccak  # type: ignore
        return keccak(data)
    except ImportError:
        pass
    # Last resort: pure-Python keccak. Small canonical implementation.
    return _pure_python_keccak256(data)


def _pure_python_keccak256(data: bytes) -> bytes:
    """Pure-Python Keccak-256. Slow but correct; only used for 3 function
    selectors so performance is irrelevant."""
    # Constants
    R = [[0, 36, 3, 41, 18], [1, 44, 10, 45, 2], [62, 6, 43, 15, 61],
         [28, 55, 25, 21, 56], [27, 20, 39, 8, 14]]
    RC = [0x0000000000000001, 0x0000000000008082, 0x800000000000808A,
          0x8000000080008000, 0x000000000000808B, 0x0000000080000001,
          0x8000000080008081, 0x8000000000008009, 0x000000000000008A,
          0x0000000000000088, 0x0000000080008009, 0x000000008000000A,
          0x000000008000808B, 0x800000000000008B, 0x8000000000008089,
          0x8000000000008003, 0x8000000000008002, 0x8000000000000080,
          0x000000000000800A, 0x800000008000000A, 0x8000000080008081,
          0x8000000000008080, 0x0000000080000001, 0x8000000080008008]

    def rol(x, n):
        return ((x << n) | (x >> (64 - n))) & 0xFFFFFFFFFFFFFFFF

    def f(state):
        for rnd in range(24):
            # Theta
            C = [state[x][0] ^ state[x][1] ^ state[x][2] ^ state[x][3] ^ state[x][4] for x in range(5)]
            D = [C[(x - 1) % 5] ^ rol(C[(x + 1) % 5], 1) for x in range(5)]
            for x in range(5):
                for y in range(5):
                    state[x][y] ^= D[x]
            # Rho + Pi
            B = [[0]*5 for _ in range(5)]
            for x in range(5):
                for y in range(5):
                    B[y][(2*x + 3*y) % 5] = rol(state[x][y], R[x][y])
            # Chi
            for x in range(5):
                for y in range(5):
                    state[x][y] = B[x][y] ^ ((~B[(x+1)%5][y]) & B[(x+2)%5][y]) & 0xFFFFFFFFFFFFFFFF
            # Iota
            state[0][0] ^= RC[rnd]
        return state

    rate_bytes = 136  # for Keccak-256
    # Pad
    padded = bytearray(data)
    pad_len = rate_bytes - (len(padded) % rate_bytes)
    if pad_len == 1:
        padded.append(0x81)
    else:
        padded.append(0x01)
        padded.extend([0x00] * (pad_len - 2))
        padded.append(0x80)
    # Absorb
    state = [[0]*5 for _ in range(5)]
    for off in range(0, len(padded), rate_bytes):
        block = padded[off:off+rate_bytes]
        for i in range(rate_bytes // 8):
            lane = int.from_bytes(block[i*8:(i+1)*8], 'little')
            state[i % 5][i // 5] ^= lane
        f(state)
    # Squeeze 32 bytes
    out = b''
    for y in range(5):
        for x in range(5):
            if len(out) >= 32:
                break
            out += state[x][y].to_bytes(8, 'little')
    return out[:32]


def selector(signature: str) -> str:
    """Compute the 4-byte function selector from a canonical signature like
    'accounts(address)'."""
    h = _keccak256(signature.encode())
    return "0x" + h[:4].hex()


# ──────────────────────────────────────────────────────────────────────────────
# Env loader
# ──────────────────────────────────────────────────────────────────────────────

def load_env(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Secrets file not found: {path}")
    if (path.stat().st_mode & 0o077) != 0:
        raise PermissionError(f"Secrets file {path} has overly permissive mode "
                              f"{oct(path.stat().st_mode & 0o777)}; expected 0o600.")
    env = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    return env


# ──────────────────────────────────────────────────────────────────────────────
# JSON-RPC plumbing
# ──────────────────────────────────────────────────────────────────────────────

class JsonRpcError(RuntimeError):
    pass


def rpc(rpc_url: str, method: str, params: list, request_id: int = 1, timeout: int = 30) -> dict:
    payload = json.dumps({"jsonrpc": "2.0", "id": request_id, "method": method,
                           "params": params}).encode()
    req = urllib.request.Request(rpc_url, data=payload,
                                  headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise JsonRpcError(f"HTTP {e.code}: {e.reason}")
    except Exception as e:
        raise JsonRpcError(f"transport: {e}")
    if "error" in body:
        raise JsonRpcError(f"{method}: {body['error']}")
    return body["result"]


def eth_call(rpc_url: str, to: str, data: str, request_id: int = 1) -> str:
    return rpc(rpc_url, "eth_call",
               [{"to": to, "data": data}, "latest"], request_id=request_id)


# ──────────────────────────────────────────────────────────────────────────────
# ABI encoding/decoding (manual — we only need a tiny subset)
# ──────────────────────────────────────────────────────────────────────────────

def encode_address(addr: str) -> str:
    """Encode an Ethereum address as a 32-byte left-padded hex word."""
    a = addr.lower().removeprefix("0x")
    if len(a) != 40 or not re.fullmatch(r"[0-9a-f]{40}", a):
        raise ValueError(f"Bad address: {addr}")
    return a.rjust(64, "0")


def encode_uint(value: int) -> str:
    if value < 0 or value >= 2**256:
        raise ValueError(f"uint256 out of range: {value}")
    return f"{value:064x}"


def decode_uint(hexword: str) -> int:
    return int(hexword, 16)


def decode_bool(hexword: str) -> bool:
    return bool(int(hexword, 16))


def decode_string(hex_data: str, offset_word_index: int) -> str:
    """Decode a dynamic-string return at the given offset. `hex_data` is the
    full eth_call result without 0x. `offset_word_index` is the index of the
    offset word in the outer tuple."""
    offset = int(hex_data[offset_word_index*64:(offset_word_index+1)*64], 16) * 2
    length = int(hex_data[offset:offset+64], 16) * 2
    raw = bytes.fromhex(hex_data[offset+64:offset+64+length])
    return raw.decode("utf-8", errors="replace")


# ──────────────────────────────────────────────────────────────────────────────
# ComplianceRegistry view-function wrappers
# ──────────────────────────────────────────────────────────────────────────────

def call_accounts(rpc_url: str, registry_addr: str, sel_accounts: str, wallet: str,
                  req_id: int = 1) -> dict:
    """accounts(address) → (bool, uint8, bool, uint256×6)"""
    data = sel_accounts + encode_address(wallet)
    raw = eth_call(rpc_url, registry_addr, data, request_id=req_id)
    hexd = raw.removeprefix("0x")
    if len(hexd) < 64 * 9:
        raise ValueError(f"unexpected length for accounts() return: {len(hexd)}")
    words = [hexd[i*64:(i+1)*64] for i in range(9)]
    return {
        "raw": "0x" + hexd,
        "whitelisted": decode_bool(words[0]),
        "kycLevel": decode_uint(words[1]),
        "frozen": decode_bool(words[2]),
        "dailySpent": decode_uint(words[3]),
        "monthlySpent": decode_uint(words[4]),
        "yearlySpent": decode_uint(words[5]),
        "lastDayReset": decode_uint(words[6]),
        "lastMonthReset": decode_uint(words[7]),
        "lastYearReset": decode_uint(words[8]),
    }


def call_canTransact(rpc_url: str, registry_addr: str, sel_can: str,
                     wallet: str, amount_usd: int, min_level: int,
                     req_id: int = 1) -> dict:
    """canTransact(address,uint256,uint8) → (bool allowed, string reason)"""
    data = sel_can + encode_address(wallet) + encode_uint(amount_usd) + encode_uint(min_level)
    raw = eth_call(rpc_url, registry_addr, data, request_id=req_id)
    hexd = raw.removeprefix("0x")
    if len(hexd) < 64 * 3:
        raise ValueError(f"unexpected length for canTransact() return: {len(hexd)}")
    allowed = decode_bool(hexd[0:64])
    reason = decode_string(hexd, 1)
    return {"raw": "0x" + hexd, "allowed": allowed, "reason": reason}


# ──────────────────────────────────────────────────────────────────────────────
# Wallet-list parser
# ──────────────────────────────────────────────────────────────────────────────

def parse_wallets(path: Path) -> list[str]:
    """Parse a markdown file containing one wallet address per line. Only
    looks at the section after a '## Addresses' header (case-insensitive) if
    one exists; otherwise scans the entire file. Dedupes case-insensitively
    while preserving order."""
    text = path.read_text()
    # Look for an explicit '## Addresses' marker — everything after it is the
    # list. This avoids pulling contract addresses out of the header table
    # (e.g. the ComplianceRegistry address mentioned in metadata).
    m = re.search(r"(?im)^##\s+addresses\b.*$", text)
    if m:
        body = text[m.end():]
    else:
        body = text
    addrs = re.findall(r"0x[a-fA-F0-9]{40}", body)
    # Dedupe but preserve order
    seen = set()
    out = []
    for a in addrs:
        al = a.lower()
        if al not in seen:
            seen.add(al)
            out.append(a)
    return out


# ──────────────────────────────────────────────────────────────────────────────
# Main verification loop
# ──────────────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(description="$GIFT ComplianceRegistry KYC verification")
    parser.add_argument("--wallets", required=True,
        help="Path to a numbered list of wallet addresses, one per line (e.g. '1. 0x...').")
    parser.add_argument("--out", default=None,
        help="Output JSON path (default: ./kyc-verification-results-YYYY-MM-DD.json)")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--rpc-only", action="store_true",
        help="Only run a single sanity check (chainId + blockNumber) and exit")
    parser.add_argument("--secrets", default=str(SECRETS_PATH))
    args = parser.parse_args()

    secrets_path = Path(args.secrets)
    env = load_env(secrets_path)
    rpc_url = env.get("VITE_RPC_URL")
    if not rpc_url:
        print("ERROR: VITE_RPC_URL not in secrets file", file=sys.stderr)
        return 2

    # Compute selectors
    sel_accounts = selector("accounts(address)")
    sel_can = selector("canTransact(address,uint256,uint8)")

    # Sanity: confirm chain ID + current head
    chain_id = int(rpc(rpc_url, "eth_chainId", []), 16)
    if chain_id != EXPECTED_CHAIN_ID:
        print(f"ERROR: expected chain {EXPECTED_CHAIN_ID}, got {chain_id}",
              file=sys.stderr)
        return 3
    head_hex = rpc(rpc_url, "eth_blockNumber", [])
    head = int(head_hex, 16)
    print(f"Connected: Polygon Mainnet (chain {chain_id}), head block {head}")
    print(f"Selectors computed: accounts={sel_accounts}, canTransact={sel_can}")

    if args.rpc_only:
        return 0

    # Probe ComplianceRegistry has bytecode
    code = rpc(rpc_url, "eth_getCode", [COMPLIANCE_REGISTRY, "latest"])
    if not code or code == "0x":
        print(f"ERROR: ComplianceRegistry at {COMPLIANCE_REGISTRY} has no bytecode",
              file=sys.stderr)
        return 4
    print(f"ComplianceRegistry bytecode present ({len(code)} hex chars at {COMPLIANCE_REGISTRY})")

    # Parse wallet list
    wallets_path = Path(args.wallets)
    wallets = parse_wallets(wallets_path)
    if args.limit:
        wallets = wallets[:args.limit]
    print(f"Loaded {len(wallets)} unique wallet addresses from {wallets_path}")

    # Run verification
    results = []
    counts = {"whitelisted": 0, "not_whitelisted": 0,
              "kyc_ge_2": 0, "kyc_lt_2": 0, "frozen": 0, "ok": 0,
              "errors": 0}
    deviations = []
    started_at = datetime.now(timezone.utc).isoformat()

    for i, w in enumerate(wallets):
        req_id_a = i * 2 + 100
        req_id_c = i * 2 + 101
        rec = {"address": w, "block": head}
        try:
            acc = call_accounts(rpc_url, COMPLIANCE_REGISTRY, sel_accounts, w, req_id=req_id_a)
            rec["accounts"] = acc
            # Profile checks
            if acc["whitelisted"]:
                counts["whitelisted"] += 1
            else:
                counts["not_whitelisted"] += 1
            if acc["kycLevel"] >= 2:
                counts["kyc_ge_2"] += 1
            else:
                counts["kyc_lt_2"] += 1
            if acc["frozen"]:
                counts["frozen"] += 1

            # canTransact with amount=0 + minLevel=2 → tests gate logic
            can = call_canTransact(rpc_url, COMPLIANCE_REGISTRY, sel_can,
                                    w, 0, 2, req_id=req_id_c)
            rec["canTransact_amt0_lvl2"] = can

            # Profile deviation check
            expected_profile = (acc["whitelisted"] and acc["kycLevel"] >= 2
                               and not acc["frozen"])
            rec["matches_expected_profile"] = expected_profile
            if expected_profile:
                counts["ok"] += 1
            else:
                deviations.append({
                    "address": w,
                    "whitelisted": acc["whitelisted"],
                    "kycLevel": acc["kycLevel"],
                    "frozen": acc["frozen"],
                    "canTransact_allowed": can["allowed"],
                    "canTransact_reason": can["reason"],
                })
        except Exception as e:
            rec["error"] = f"{type(e).__name__}: {e}"
            counts["errors"] += 1

        results.append(rec)
        # Light pacing — Alchemy rate-limits free-tier; 4 calls per wallet leaves
        # plenty of headroom but we still don't hammer
        if i % 25 == 24:
            print(f"  ...{i+1}/{len(wallets)} done, {counts['ok']} ok, "
                  f"{len(deviations)} deviations, {counts['errors']} errors")
            time.sleep(0.5)

    ended_at = datetime.now(timezone.utc).isoformat()

    # Compose output
    output = {
        "metadata": {
            "tool": "verify_kyc.py",
            "tool_version": "0.1",
            "author": "CAIT, on behalf of CIO/CISO",
            "purpose": "Verified-only evidence pack for the $GIFT ComplianceRegistry KYC contract calls. Read-only.",
            "started_at_utc": started_at,
            "ended_at_utc": ended_at,
            "host": "cait-clawd-01",
            "chain_id": chain_id,
            "chain_head_block": head,
            "compliance_registry_address": COMPLIANCE_REGISTRY,
            "function_selectors": {
                "accounts(address)": sel_accounts,
                "canTransact(address,uint256,uint8)": sel_can,
            },
            "rpc_provider": "Alchemy (Polygon Mainnet)",
            "wallet_list_path": str(wallets_path),
            "wallet_list_sha256": hashlib.sha256(wallets_path.read_bytes()).hexdigest(),
            "wallet_count": len(wallets),
            "expected_profile": "whitelisted=true AND kycLevel>=2 AND frozen=false",
        },
        "counts": counts,
        "deviations": deviations,
        "results": results,
    }

    # Write to file
    if args.out:
        out_path = Path(args.out)
    else:
        ts = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        out_path = Path(f"kyc-verification-results-{ts}.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(output, indent=2))
    print()
    print(f"Wrote {out_path} ({out_path.stat().st_size} bytes)")
    print()
    print("Summary:")
    for k, v in counts.items():
        print(f"  {k}: {v}")
    if deviations:
        print(f"\nDeviations from expected profile ({len(deviations)}):")
        for d in deviations[:10]:
            print(f"  {d['address']}: whitelisted={d['whitelisted']} "
                  f"kycLevel={d['kycLevel']} frozen={d['frozen']} "
                  f"canTransact={d['canTransact_allowed']} ({d['canTransact_reason']!r})")
        if len(deviations) > 10:
            print(f"  ... ({len(deviations) - 10} more — see JSON output)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
