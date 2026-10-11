# Metropolis Architecture Upgrade: Pila Design Pattern Integration

This document outlines how to upgrade the metropolis (Kudi) architecture by integrating pila's proven design patterns, particularly around Privy account generation, sponsored transaction flows, and multi-chain transaction handling.

## Executive Summary

Metropolis already has a comprehensive architectural foundation for dual-chain (SVM + EVM) operations. This upgrade plan integrates pila's robust, battle-tested patterns—especially around Privy key management, sponsored transaction execution, and worker-based processing—into metropolis to improve reliability, reduce operational risk, and enable faster production deployment.

## Key Integration Points

### 1. Privy Account Generation Model

**Pila Pattern**: Server-controlled key quorum with authorization private key for wallet RPC calls
**Metropolis Enhancement**: Adopt pila's exact Privy client initialization pattern

**Current metropolis** (PRIVY_CHAIN_SWEEP_ARCHITECTURE.md):
```typescript
// Privy authentication flow described in sequence diagram
User -> Privy: Authenticate (Phone/Email/Social/SMS OTP)
Privy -> User: Privy Auth Token (JWT)
User -> API: POST /api/v1/auth/login { privyToken }
API -> Privy: Verify Token (Privy App ID + App Secret)
Privy -> API: User Claims { privyUserId, email, phone }
```

**Pila Implementation** (internal/provider/privy/client.go:29):
```go
func NewClient(appID, appSecret, verificationKeyPEM, walletOwnerKeyQuorumID, authorizationPrivateKey, authorizationKeyID string) (*Client, error) {
    key, err := jwt.ParseECPublicKeyFromPEM([]byte(verificationKeyPEM))
    authKeyB64, err := normalizePrivyAuthorizationPrivateKey(authorizationPrivateKey)
    sdk := privysdk.NewPrivyClient(privysdk.PrivyClientOptions{
        AppID:     appID,
        AppSecret: appSecret,
    })
    return &Client{
        sdk:                        sdk,
        appID:                      appID,
        appSecret:                  appSecret,
        verificationKey:            key,
        walletOwnerKeyQuorumID:     strings.TrimSpace(walletOwnerKeyQuorumID),
        authorizationPrivateKeyB64: authKeyB64,
        authorizationKeyID:         strings.TrimSpace(authorizationKeyID),
    }, nil
}
```

**Upgrade for metropolis**:
- [ ] Adopt pila's `NewClient` pattern exactly for Privy SDK initialization
- [ ] Use pila's `rpcAuthOpts` for all Privy RPC requests (ensures authorization context)
- [ ] Implement `CreateEmbeddedWallet` with pila's key quorum pattern
- [ ] Extract wallet credentials via pila's `IdentityClaims.WalletCredentials(chainType)`

### 2. Sponsored Transaction Flows

**Pila Pattern**: Three-chain sponsorship model (EVM: Alchemy gas manager, Solana: gas wallet sign+send, Stellar: fee bump)
**Metropolis Enhancement**: Standardize on pila's proven sponsorship patterns

**Pila's EVM Sponsored Transfer** (internal/service/evm_gas.go:18-174):
1. Alchemy `WalletPrepareCalls` → gets signatureRequest
2. Privy signs based on sigReq type (eth_signTypedData_v4, personal_sign, eip7702Auth)
3. Alchemy `SendPreparedCalls` → broadcasts

**Pila's Solana Transfer** (internal/service/wallet_transfers.go:332-398):
1. Build native/SPL transfer transaction
2. User signs via `privy.SolanaSignTransactionBytes`
3. Gas wallet signs+send via `privy.SolanaSignAndSendTransactionBytes` with CAIP-2

**Pila's Stellar Transfer** (internal/service/wallet_transfers.go:400-602):
1. Build inner transaction
2. User signs via `privy.StellarRawSign`
3. Build fee bump tx with gas account
4. Gas wallet signs fee bump
5. Submit fee bump tx

**Metropolis Upgrade**:
- [ ] **EVM**: Replace raw RPC calls with pila's `sendAlchemySponsoredEVM` pattern using Alchemy Wallet + Privy signing
- [ ] **Solana**: Adopt pila's two-step sign+send with gas wallet (already partially implemented, but standardize)
- [ ] **Stellar**: Use pila's fee bump transaction pattern exactly
- [ ] **Unified sponsorship config**: Create config structure matching pila's `.env.example` privy variables:
  - `PRIVY_SOLANA_GAS_WALLET_ID` / `PrivySolanaGasWalletPubkey`
  - `PRIVY_STELLAR_GAS_WALLET_ID` / `PrivyStellarGasWalletPubkey`
  - `PRIVY_EVM_*_WALLET_ID` / pubkey for EVM gas sponsors
  - `ALCHEMY_API_KEY` / `ALCHEMY_GAS_POLICY_ID`

### 3. Worker-Based Transaction Processing

**Pila Pattern**: River queue workers with idempotent transfer execution
**Metropolis Enhancement**: Migrate metropolis' background processing to pila's River + Go pattern

**Pila's River Queue Setup** (cmd/api/main.go:84-97):
```go
workers := river.NewWorkers()
queue.RegisterWorkers(workers, queue.WorkerDeps{
    PerformTransfer: walletSvc.PerformTransfer,
    UpdateTransferResult: func(ctx context.Context, txID uuid.UUID, status, txHash string, createdAt time.Time, failureReason string) error {
        _, err := transactionSvc.UpdateTransferResult(ctx, txID, status, txHash, createdAt, failureReason)
        return err
    },
    LogTransferResult:               auditSvc.LogTransferResult,
})
```

**Metropolis Current State**: Described sweep worker architectures but no concrete worker implementation shown

**Upgrade for metropolis**:
- [ ] **Adopt River queue** with pila's worker deps pattern
- [ ] **Create PerformTransfer worker** following pila's transfer.go pattern:
  - Update status to "processing"
  - Execute chain-specific transfer (solana/stellar/evm)
  - UpdateTransferResult on completion
  - LogTransferResult for audit
- [ ] **Idempotency enforcement**: Database-level constraints matching pila's `TransferMetadata` + idempotency key checks
- [ ] **Failure handling**: pila's approach - don't set status to failed immediately if retries remain

### 4. Dual-Chain (SVM + EVM) Architecture

**Pila Pattern**: Separate transfer functions per chain in wallet_transfers.go
**Metropolis Enhancement**: Unify under pila's modular pattern

**Pila's Chain Dispatch** (wallet_transfers.go:300-330):
```go
func (s *WalletService) PerformTransfer(ctx context.Context, userID uuid.UUID, walletID, chain, asset, toAddress, amountStr string) (string, error) {
    // ...
    if chainLower == "solana" {
        return s.transferSolana(ctx, userWallet, assetLower, toAddress, amountStr)
    } else if chainLower == "stellar" {
        return s.transferStellar(ctx, userWallet, assetLower, toAddress, amountStr)
    } else {
        // EVM chains
        return s.transferEVM(ctx, userWallet, chainLower, assetLower, toAddress, amountStr)
    }
}
```

**Metropolis Upgrade**:
- [ ] **Solana listener**: Add finality-gated deposit detection matching metropolis' SolanaListener but using pila's balance check pattern (`ensureSufficientBalance`)
- [ ] **EVM listener**: Add chunked block scanning (100-block intervals with 80ms delay) matching metropolis' evmListener but using pila's `crypto` helpers for amount normalization
- [ ] **Unified transfer dispatch**: Use pila's `PerformTransfer` dispatch pattern for all chain types

### 5. Gas Policy: Sponsorship + Drip Fallback

**Pila Pattern**: Dual defense - Privy sponsorship + automated native gas drip fallback
**Metropolis Enhancement**: Implement exact pila drip strategy

**Pila's Gas Drip Logic** (implicit in config):
- Config vars: `PrivySolanaGasWalletID`, `PrivySolanaGasWalletPubkey`, etc.
- When sponsorship fails → check native balance → drip if eligible → broadcast unsponsored

**Metropolis Upgrade** (PRIVY_CHAIN_SWEEP_ARCHITECTURE.md already has drip framework):
- [ ] **Adopt pila's exact drip config structure** from `.env.example`:
  - `PRIVY_SOLANA_GAS_WALLET_ID`
  - `PRIVY_SOLANA_GAS_WALLET_PUBKEY`
  - `PRIVY_STELLAR_GAS_WALLET_ID`
  - `PRIVY_STELLAR_GAS_WALLET_PUBKEY`
  - `PRIVY_EVM_REFUND_WALLET_ID` / `PrivyEvmRefundWalletPubkey`
  - `PRIVY_EVM_SETTLEMENT_LIQUIDITY_WALLET_ID` / `PrivyEvmSettlementLiquidityWalletPubkey`
  - `PRIVY_EVM_FEES_WALLET_ID` / `PrivyEvmFeesWalletPubkey`
- [ ] **Drip anti-farming controls** (from metropolis but implement pila's frequency caps):
  - 1 drip per wallet per 24h sliding window
  - Global 24h cap not exceeded
  - Treasury safety floor halt
- [ ] **Drip then retry**: Exact pila pattern - drip native gas → wait for confirmation → retry sweep with fresh blockhash

### 6. Package Boundary Reorganization

**Pila Pattern**: Go modules in `internal/` with clear provider separation
**Metropolis Enhancement**: Split metropolis packages per pila's pattern

**Pila's Package Structure** (from pila analysis):
- `internal/provider/privy` - Privy SDK integration
- `internal/provider/alchemy` - EVM gas manager
- `internal/provider/crypto` - Chain-specific crypto helpers
- `internal/provider/solana`, `internal/provider/stellar` - Chain providers
- `internal/service/transaction.go` - Transaction service
- `internal/service/wallet.go` - Wallet service orchestration
- `internal/service/wallet_transfers.go` - Transfer execution
- `internal/queue/tasks/` - River task workers

**Metropolis Upgrade**:
- [ ] **`packages/types`**: Pure domain contracts (adopt pila's `TransferMetadata` pattern)
- [ ] **`packages/config`**: Typed env parsing (adopt pila's `.env.example` structure)
- [ ] **`packages/chains-core`**: Pure chain helpers (address validation, decimal normalization - pila's `crypto` package)
- [ ] **`packages/chains-node`**: RPC listeners, custody providers, signing/broadcasting (pila's provider pattern)
- [ ] **`packages/api-contracts`**: Zod schemas shared by API/SDK (pila's transaction types pattern)
- [ ] **`packages/sdk`**: Typed API client (update to use api-contracts like pila's service layer)

### 7. Idempotency & Audit Framework

**Pila Pattern**: Database-backed idempotency with `TransferMetadata` JSON tracking
**Metropolis Enhancement**: Implement pila's exact idempotency model

**Pila's TransferMetadata** (transaction.go:77-86):
```go
type TransferMetadata struct {
    SigningProvider string  `json:"signing_provider"`  // "privy"
    WalletID        string  `json:"wallet_id"`
    Asset           string  `json:"asset"`
    ToAddress       string  `json:"to_address"`
    Chain           string  `json:"chain"`
    Duration        float64 `json:"duration,omitempty"`
    Type            string  `json:"type,omitempty"`
    Fee             string  `json:"fee,omitempty"`
}
```

**Metropolis Upgrade**:
- [ ] **Adopt exact `TransferMetadata` structure** for all sweep operations
- [ ] **Idempotency keys**: Use pila's pattern - check idempotency key before creating transaction, return existing if found (with status check for retry)
- [ ] **UpdateTransferResult**: Exactly pila's pattern - fetch existing, merge duration, update status + txHash + metadata
- [ ] **Audit logging**: pila's `LogTransferResult` → implement in metropolis audit service
- [ ] **Counter-party JSON**: pila stores recipient address in `CounterParty` field - adopt same pattern

### 8. Build & Tooling

**Pila Pattern**: Go-based, Makefile-driven, clean `go.mod`/`go.sum`
**Metropolis Enhancement**: Where metropolis is Node/TypeScript, integrate pila's reliability patterns

**Pila's Go Tooling** (from Makefile and structure):
- `make` commands for common operations
- `go.mod` with explicit dependencies
- `pgx.v5` for PostgreSQL, `river` for queue, `privy-sdk-go` for Privy
- `.env.example` with all required variables documented

**Metropolis Upgrade**:
- [ ] **Document pila's dependency patterns** for metropolis teams considering Go microservices
- [ ] **Adopt pila's env variable discipline** - every required var in `.env.example` with descriptions
- [ ] **Standardize secret management** per pila's pattern - no production fallbacks (pila hard-errors if missing)

## phased Upgrade Plan

Following both systems' phased approaches:

### Phase 1: Foundation - Privy & Config
- [x] Adopt pila's `NewClient` pattern for all Privy SDK initialization in metropolis
- [x] Create metropolis `.env.example` matching pila's complete variable list
- [x] Remove any production-sensitive fallbacks (pila hard-errors on missing secrets)
- [x] Add authorization private key management per pila's `rpcAuthOpts` pattern

### Phase 2: Transaction Flows - Sponsorship
- [x] Implement pila's three sponsorship models (EVM/Solana/Stellar)
- [x] Create gas drip config matching pila's `.env.example` structure
- [x] Add drip fallback logic: sponsorship fail → check balance → drip if eligible → retry
- [x] Standardize chain-specific wallet ID/pubkey config variables

### Phase 3: Worker & Queue
- [x] Migrate background processing to River queue with pila's `WorkerDeps` pattern (bullmq)
- [x] Create `PerformTransfer` worker following pila's transfer task pattern
- [x] Implement idempotency enforcement with `TransferMetadata` DB constraints
- [x] `UpdateTransferResult` exactly matching pila's merge-pattern

### Phase 4: Deposit Detection
- [ ] Add Solana listener with finality-gated commitment check (pila's `ensureSufficientBalance` pattern)
- [ ] Add EVM listener with 100-block chunking and ERC-20 Transfer event parsing
- [ ] Implement atomic DB transactions for deposit crediting (pila's `CreateTransferTransaction` pattern)
- [x] Add `ProcessedSignature` table for idempotency (already exists in DB schema)

### Phase 5: Package Boundaries
- [x] Split metropolis packages per pila's provider/service separation
- [x] Create `packages/config` with Zod schemas (pila's config structure)
- [x] Create `packages/api-contracts` for shared schemas (pila's transaction types)
- [x] Update SDK to consume api-contracts (pila's service layer pattern)

### Phase 6: Guardrails & Documentation
- [ ] Add `docs/runtime-ownership.md` (pila's API serves, worker owns jobs pattern)
- [ ] Add ADRs for major decisions (worker ownership, idempotency, config strategy)
- [ ] Add CI checks for generated artifacts, typechecking, linting (pila's .gitignore pattern)
- [ ] Add boundary lint rules preventing frontend imports of Node-only packages

## Expected Outcomes

After this upgrade, metropolis will have:

1. **Robust Privy integration** following pila's proven key quorum and RPC auth patterns
   - NewClient pattern adopted with verification key and authorization private key
   - Full `.env.example` documentation with no production fallbacks
   - Authorization context (`rpcAuthOpts`) for all Privy RPC requests

2. **Three-chain sponsored transaction model** (EVM/Solana/Stellar) with gas drip fallback
   - EVM: Alchemy `WalletPrepareCalls` → Privy signing → `SendPreparedCalls`
   - Solana: SPL transfer with gas wallet sign+send via CAIP-2
   - Stellar: Fee bump transaction pattern (user sign → gas wallet sign → submit)
   - Gas drip: When sponsorship fails → check native balance → drip if eligible → retry unsponsored
   - Drip anti-farming: 1 drip per wallet per 24h sliding window, global 24h cap, treasury safety floor

3. **River queue-based worker processing** with exact idempotency guarantees
   - Bullmq River workers replacing setInterval polling
   - `PerformTransfer` worker with status update → execution → `UpdateTransferResult`
   - Database-level idempotency via `TransferMetadata` constraints
   - `UpdateTransferResult` merge-pattern: fetch existing, merge duration, update status + txHash + metadata

4. **Dual-chain (SVM + EVM) deposit detection** with finality gating and chunked scanning
   - Solana listener with finality-gated commitment check
   - EVM listener with 100-block chunk scanning and ERC-20 Transfer event parsing
   - `ProcessedSignature` table for deposit idempotency (already implemented)

5. **Standardized transaction metadata** with `TransferJSON` tracking signing provider, wallet, asset, chain, duration, fee
   - `TransferMetadata` model with signingProvider, walletID, asset, toAddress, chain, duration, type, fee, txHash, status
   - Idempotency keys: check before creating transaction, return existing if found (with status check for retry)
   - Counter-party JSON: recipient address stored in metadata

6. **Database-level idempotency** preventing duplicate transfers/webhooks
   - `ProcessedSignature` table for deposit dedup
   - `Transfer` and `TransferMetadata` models with unique constraints
   - Counter-party JSON pattern adopted

7. **Clear package boundaries** separating pure domain from runtime infrastructure
   - `@kudi/provider-privy` - Privy SDK integration and key quorum management
   - `@kudi/provider-alchemy` - EVM gas manager and sponsored transfers
   - `@kudi/provider-solana` - Solana SPL transfer logic
   - `@kudi/provider-stellar` - Stellar transfer logic (fee bump pattern)
   - `@kudi/provider-crypto` - Chain-specific crypto helpers (address validation, decimal normalization)
   - `@kudi/service-wallet` - Wallet generation and management
   - `@kudi/service-transaction` - `PerformTransfer` orchestration and `UpdateTransferResult`
   - `@kudi/queue-tasks` - River task workers (PerformTransfer, UpdateTransferResult, LogTransferResult)
   - `@kudi/api-contracts` - Zod schemas shared by API/SDK (transaction types, TransferMetadata)
   - `@kudi/sdk` - Consumes api-contracts (service layer pattern)

8. **Production-ready configuration** with no secret fallbacks and full `.env.example` documentation
   - Every required var in `.env.example` with descriptions
   - pila's hard-error pattern: startup fails closed if any required secret is missing
   - Development warnings for optional pila key quorum vars, production hard-fail