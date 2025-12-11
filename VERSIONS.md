# Handcraft Version Reference

This document tracks all dependency versions for compatibility. Do not change these without testing.

## CLI Tools

| Tool | Version | Command to Check |
|------|---------|------------------|
| Solana CLI | 3.0.13 | `solana --version` |
| Anchor CLI | 0.32.1 | `anchor --version` |
| Rust | stable (1.91.1+) | `rustc --version` |
| Node.js | v24.10.0 | `node --version` |

## Rust Dependencies (programs/content-registry/Cargo.toml)

```toml
[dependencies]
anchor-lang = { version = "0.32.1", features = ["init-if-needed"] }
anchor-spl = { version = "0.32.1", features = ["token", "associated_token"] }
spl-token = { version = "4.0", default-features = false, features = ["no-entrypoint"] }
mpl-core = "0.11.1"
solana-sha256-hasher = "2.1"
switchboard-on-demand = "0.11.3"
ephemeral-vrf-sdk = { version = "0.2", features = ["anchor"] }
```

## TypeScript Dependencies (packages/sdk/package.json)

```json
{
  "@coral-xyz/anchor": "^0.32.1"
}
```

## Configuration Files

### Anchor.toml
```toml
[toolchain]
anchor_version = "0.32.1"
```

### rust-toolchain.toml
```toml
[toolchain]
channel = "stable"
```

## Important Notes

1. **spl-token**: Must use `no-entrypoint` feature to avoid `#[global_allocator]` conflict
2. **solana-sha256-hasher**: Required because hash module moved out of `anchor_lang::solana_program` in newer versions
3. **base64ct**: Pinned to 1.7.3 in Cargo.lock (run `cargo update base64ct@1.8.0 --precise 1.7.3` if needed)
4. **mpl-core**: Version 0.11.1 required for compatibility with Anchor 0.32.1 and Solana 3.x
5. **IDL Format**: Anchor 0.32.1 uses new IDL format with snake_case (`writable`, `signer`) instead of old camelCase (`isMut`, `isSigner`). After `anchor build`, copy the IDL from `target/idl/content_registry.json` to `packages/sdk/src/program/content_registry.json`
6. **Program Constructor**: With new IDL format, address is embedded in IDL, so use `new Program(idl, provider)` instead of `new Program(idl, programId, provider)`

## Known Warnings (Safe to Ignore)

1. **mpl-core stack offset warning**: The warning about `registry_records_to_plugin_list` exceeding 4096 bytes is an upstream issue in mpl-core library, not in our code. Build succeeds and this can be ignored.

## Compatibility Matrix

| Anchor | Solana CLI | Platform Tools | Rust (BPF) |
|--------|------------|----------------|------------|
| 0.32.1 | 3.0.x | v1.51 | 1.84.1 |

Last updated: 2025-12-11
