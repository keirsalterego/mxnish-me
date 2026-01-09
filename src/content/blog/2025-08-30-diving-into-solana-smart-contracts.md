---
title: "Diving into Solana: Building Smart Contracts with Anchor Framework"
tags: ["Solana", "Blockchain", "Rust", "Web3", "Smart Contracts", "Anchor"]
---

# Diving into Solana: Building Smart Contracts with Anchor Framework

## Introduction

August 2025 marked my entry into blockchain development, specifically on Solana. Coming from traditional web development and systems programming, blockchain presented a completely different paradigm. This post documents my journey from Solana bootcamp graduate to shipping production smart contracts.

## Why Solana?

### The Speed Advantage

After researching various blockchain platforms, Solana stood out:

- **400ms Block Time**: Near-instant finality
- **65,000 TPS**: Capable of handling real app load
- **Low Fees**: $0.00025 per transaction (vs $50+ on Ethereum during congestion)
- **Proof of History**: Innovative consensus mechanism

### Developer Experience

- **Anchor Framework**: Rust-based with excellent developer tools
- **Fast Iteration**: Local validator for rapid testing
- **Rich Ecosystem**: Growing collection of tools and libraries

## Month-Long Bootcamp Journey

### Week 1: Blockchain Fundamentals

Understanding the core concepts:

```rust
// Basic account structure
#[account]
pub struct TokenAccount {
    pub owner: Pubkey,          // Who owns this account
    pub mint: Pubkey,           // Which token this represents
    pub amount: u64,            // Token balance
    pub delegate: Option<Pubkey>,
    pub close_authority: Option<Pubkey>,
}
```

**Key Concepts Learned**:
- Accounts store all data (Solana has no smart contract storage)
- Programs (smart contracts) are stateless
- Everything is a transaction
- Pay rent for account storage

### Week 2: First Program - Token Minter

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint};

declare_id!("YourProgramID");

#[program]
pub mod token_minter {
    use super::*;
    
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let mint = &mut ctx.accounts.mint;
        mint.authority = ctx.accounts.authority.key();
        mint.supply = 0;
        Ok(())
    }
    
    pub fn mint_tokens(
        ctx: Context<MintTokens>,
        amount: u64
    ) -> Result<()> {
        // Verify authority
        require!(
            ctx.accounts.authority.key() == ctx.accounts.mint.authority,
            ErrorCode::Unauthorized
        );
        
        // Mint tokens
        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            amount,
        )?;
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        mint::decimals = 9,
        mint::authority = authority,
    )]
    pub mint: Account<'info, Mint>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub recipient: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("You are not authorized to perform this action")]
    Unauthorized,
}
```

### Week 3: Staking Contract

More complex logic with time-based rewards:

```rust
#[program]
pub mod staking {
    use super::*;
    
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        let stake_account = &mut ctx.accounts.stake_account;
        let clock = Clock::get()?;
        
        // Transfer tokens to stake vault
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.stake_vault.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;
        
        // Update stake account
        stake_account.user = ctx.accounts.user.key();
        stake_account.amount = amount;
        stake_account.staked_at = clock.unix_timestamp;
        stake_account.last_claimed = clock.unix_timestamp;
        
        emit!(StakeEvent {
            user: ctx.accounts.user.key(),
            amount,
            timestamp: clock.unix_timestamp,
        });
        
        Ok(())
    }
    
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let stake_account = &ctx.accounts.stake_account;
        let clock = Clock::get()?;
        
        // Calculate rewards
        let time_staked = clock.unix_timestamp - stake_account.last_claimed;
        let reward_rate = 100; // 100 tokens per second (adjust as needed)
        let rewards = (time_staked as u64)
            .checked_mul(reward_rate)
            .unwrap()
            .checked_mul(stake_account.amount)
            .unwrap()
            .checked_div(1_000_000_000) // Scale down
            .unwrap();
        
        require!(rewards > 0, ErrorCode::NoRewards);
        
        // Mint reward tokens
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::MintTo {
                    mint: ctx.accounts.reward_mint.to_account_info(),
                    to: ctx.accounts.user_reward_account.to_account_info(),
                    authority: ctx.accounts.stake_vault.to_account_info(),
                },
                &[&[b"vault", &[ctx.bumps.stake_vault]]],
            ),
            rewards,
        )?;
        
        // Update claim timestamp
        let stake_account = &mut ctx.accounts.stake_account;
        stake_account.last_claimed = clock.unix_timestamp;
        
        Ok(())
    }
}

#[account]
pub struct StakeAccount {
    pub user: Pubkey,
    pub amount: u64,
    pub staked_at: i64,
    pub last_claimed: i64,
}

#[event]
pub struct StakeEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}
```

### Week 4: Token Swap DApp

Building a DEX-like swap mechanism:

```rust
#[program]
pub mod token_swap {
    use super::*;
    
    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        fee_numerator: u64,
        fee_denominator: u64,
    ) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        
        pool.token_a_account = ctx.accounts.token_a_account.key();
        pool.token_b_account = ctx.accounts.token_b_account.key();
        pool.fee_numerator = fee_numerator;
        pool.fee_denominator = fee_denominator;
        pool.authority = ctx.accounts.authority.key();
        
        Ok(())
    }
    
    pub fn swap(
        ctx: Context<Swap>,
        amount_in: u64,
        minimum_amount_out: u64,
    ) -> Result<()> {
        let pool = &ctx.accounts.pool;
        
        // Get current balances
        let balance_a = ctx.accounts.pool_token_a.amount;
        let balance_b = ctx.accounts.pool_token_b.amount;
        
        // Calculate output with constant product formula: x * y = k
        let amount_out = calculate_swap_output(
            amount_in,
            balance_a,
            balance_b,
            pool.fee_numerator,
            pool.fee_denominator,
        )?;
        
        require!(
            amount_out >= minimum_amount_out,
            ErrorCode::SlippageExceeded
        );
        
        // Transfer tokens in
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.user_token_a.to_account_info(),
                    to: ctx.accounts.pool_token_a.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount_in,
        )?;
        
        // Transfer tokens out
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                token::Transfer {
                    from: ctx.accounts.pool_token_b.to_account_info(),
                    to: ctx.accounts.user_token_b.to_account_info(),
                    authority: ctx.accounts.pool_authority.to_account_info(),
                },
                &[&[b"pool-authority", &[ctx.bumps.pool_authority]]],
            ),
            amount_out,
        )?;
        
        emit!(SwapEvent {
            user: ctx.accounts.user.key(),
            amount_in,
            amount_out,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

fn calculate_swap_output(
    amount_in: u64,
    reserve_in: u64,
    reserve_out: u64,
    fee_num: u64,
    fee_denom: u64,
) -> Result<u64> {
    // Apply fee
    let amount_in_with_fee = (amount_in as u128)
        .checked_mul(fee_denom as u128 - fee_num as u128)
        .unwrap()
        .checked_div(fee_denom as u128)
        .unwrap();
    
    // Constant product formula: (x + Δx)(y - Δy) = xy
    // Solve for Δy: Δy = y * Δx / (x + Δx)
    let numerator = (amount_in_with_fee as u128)
        .checked_mul(reserve_out as u128)
        .unwrap();
    
    let denominator = (reserve_in as u128)
        .checked_add(amount_in_with_fee as u128)
        .unwrap();
    
    let amount_out = numerator
        .checked_div(denominator)
        .unwrap() as u64;
    
    Ok(amount_out)
}
```

## Production Work: Building Real DApps

### Security Research Tool

Built a Python CLI that monitors Solana wallets:

```python
from solana.rpc.api import Client
from solana.publickey import PublicKey
import time

class WalletMonitor:
    def __init__(self, rpc_url: str):
        self.client = Client(rpc_url)
        self.tracked_wallets = set()
        
    def add_wallet(self, address: str):
        """Track a wallet for large transactions"""
        self.tracked_wallets.add(PublicKey(address))
        
    def monitor(self, threshold: float = 1000.0):
        """Monitor for transactions above threshold (in SOL)"""
        while True:
            for wallet in self.tracked_wallets:
                try:
                    # Get recent transactions
                    txs = self.client.get_signatures_for_address(
                        wallet,
                        limit=10
                    )
                    
                    for tx in txs['result']:
                        # Get transaction details
                        tx_detail = self.client.get_transaction(
                            tx['signature']
                        )
                        
                        # Parse transaction
                        amount = self.parse_transaction_amount(tx_detail)
                        
                        if amount >= threshold:
                            self.send_alert(wallet, amount, tx['signature'])
                            
                except Exception as e:
                    print(f"Error monitoring {wallet}: {e}")
                    
            time.sleep(30)  # Check every 30 seconds
            
    def parse_transaction_amount(self, tx_detail) -> float:
        """Extract transaction amount from transaction details"""
        # Parse the transaction structure
        if not tx_detail or 'result' not in tx_detail:
            return 0.0
            
        meta = tx_detail['result'].get('meta', {})
        pre_balances = meta.get('preBalances', [])
        post_balances = meta.get('postBalances', [])
        
        if not pre_balances or not post_balances:
            return 0.0
            
        # Calculate the difference
        diff = abs(pre_balances[0] - post_balances[0])
        return diff / 1e9  # Convert lamports to SOL
        
    def send_alert(self, wallet: PublicKey, amount: float, signature: str):
        """Send alert via Discord webhook"""
        import requests
        
        webhook_url = os.getenv('DISCORD_WEBHOOK_URL')
        
        message = {
            "content": f"🚨 Large Transaction Detected!\n"
                      f"Wallet: {wallet}\n"
                      f"Amount: {amount:.2f} SOL\n"
                      f"TX: https://solscan.io/tx/{signature}"
        }
        
        requests.post(webhook_url, json=message)

# Usage
if __name__ == "__main__":
    monitor = WalletMonitor("https://api.mainnet-beta.solana.com")
    
    # Add whales to monitor
    monitor.add_wallet("YourWalletAddressHere")
    
    # Start monitoring
    monitor.monitor(threshold=1000.0)  # Alert for transactions > 1000 SOL
```

### Browser Security Tool

Python script to audit token storage:

```python
import os
import json
import sqlite3
from pathlib import Path
from typing import List, Dict
import base64

class BrowserTokenScanner:
    """Scan browser storage for exposed tokens"""
    
    STORAGE_PATHS = {
        'chrome': {
            'linux': '~/.config/google-chrome/Default/Local Storage/leveldb',
            'darwin': '~/Library/Application Support/Google/Chrome/Default/Local Storage/leveldb',
            'win32': '%LOCALAPPDATA%\\Google\\Chrome\\User Data\\Default\\Local Storage\\leveldb',
        },
        'firefox': {
            'linux': '~/.mozilla/firefox/*.default-release/storage/default',
        }
    }
    
    def scan_chrome_storage(self) -> List[Dict]:
        """Scan Chrome's localStorage for tokens"""
        findings = []
        
        # Get platform-specific path
        platform = sys.platform
        if platform not in ['linux', 'darwin', 'win32']:
            return findings
            
        storage_path = Path(
            os.path.expanduser(self.STORAGE_PATHS['chrome'][platform])
        )
        
        if not storage_path.exists():
            return findings
            
        # Read leveldb files
        for file in storage_path.glob('*.ldb'):
            try:
                with open(file, 'rb') as f:
                    content = f.read()
                    
                # Search for token patterns
                tokens = self.extract_tokens(content)
                
                for token in tokens:
                    findings.append({
                        'type': self.identify_token_type(token),
                        'token': token,
                        'file': str(file),
                        'risk': self.assess_risk(token),
                    })
                    
            except Exception as e:
                print(f"Error reading {file}: {e}")
                
        return findings
        
    def extract_tokens(self, data: bytes) -> List[str]:
        """Extract potential tokens from binary data"""
        # Discord token pattern
        discord_pattern = rb'[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}'
        
        # Generic JWT pattern  
        jwt_pattern = rb'eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+'
        
        # Solana private key pattern (base58)
        solana_pattern = rb'[1-9A-HJ-NP-Za-km-z]{87,88}'
        
        import re
        tokens = []
        
        for pattern in [discord_pattern, jwt_pattern, solana_pattern]:
            matches = re.findall(pattern, data)
            tokens.extend([m.decode('utf-8', errors='ignore') for m in matches])
            
        return tokens
        
    def identify_token_type(self, token: str) -> str:
        """Identify what kind of token this is"""
        if token.startswith('ey'):
            return 'JWT'
        elif token[0] in 'MN' and '.' in token:
            return 'Discord'
        elif len(token) in [87, 88]:
            return 'Solana Private Key'
        else:
            return 'Unknown'
            
    def assess_risk(self, token: str) -> str:
        """Assess the security risk of exposed token"""
        token_type = self.identify_token_type(token)
        
        risk_levels = {
            'Solana Private Key': 'CRITICAL',
            'Discord': 'HIGH',
            'JWT': 'MEDIUM',
            'Unknown': 'LOW',
        }
        
        return risk_levels.get(token_type, 'LOW')
        
    def generate_report(self, findings: List[Dict]) -> str:
        """Generate security audit report"""
        report = "# Browser Token Security Audit\n\n"
        
        # Group by risk level
        by_risk = {}
        for finding in findings:
            risk = finding['risk']
            if risk not in by_risk:
                by_risk[risk] = []
            by_risk[risk].append(finding)
            
        # Report each risk level
        for risk in ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']:
            if risk in by_risk:
                report += f"\n## {risk} Risk ({len(by_risk[risk])} findings)\n\n"
                
                for finding in by_risk[risk]:
                    report += f"- **Type**: {finding['type']}\n"
                    report += f"  **Location**: {finding['file']}\n"
                    report += f"  **Token**: {finding['token'][:20]}...\n\n"
                    
        return report

# Usage
if __name__ == "__main__":
    scanner = BrowserTokenScanner()
    findings = scanner.scan_chrome_storage()
    
    if findings:
        print(f"Found {len(findings)} exposed tokens!")
        report = scanner.generate_report(findings)
        
        with open('security_audit.md', 'w') as f:
            f.write(report)
            
        print("Report saved to security_audit.md")
    else:
        print("No exposed tokens found. Good job!")
```

## Key Learnings

### 1. Think in Accounts, Not Storage

Coming from traditional backends where you `UPDATE users SET ...`, Solana requires rethinking data management:

```rust
// Traditional thinking (doesn't work)
pub fn update_user(ctx: Context<Update>, new_name: String) -> Result<()> {
    // Where is the storage???
    user.name = new_name;  // ❌ No implicit storage
    Ok(())
}

// Solana thinking (correct)
#[derive(Accounts)]
pub struct UpdateUser<'info> {
    #[account(mut)]  // ✅ Explicitly pass the account
    pub user_account: Account<'info, UserData>,
}

pub fn update_user(ctx: Context<UpdateUser>, new_name: String) -> Result<()> {
    let user = &mut ctx.accounts.user_account;  // ✅ Modify account data
    user.name = new_name;
    Ok(())
}
```

### 2. Compute Units are Precious

Every operation costs compute units. Optimize ruthlessly:

```rust
// Before: Multiple account reads
pub fn expensive_operation(ctx: Context<Process>) -> Result<()> {
    let value1 = ctx.accounts.account1.value;  // Read
    let value2 = ctx.accounts.account2.value;  // Read
    let value3 = ctx.accounts.account3.value;  // Read
    
    // Process...
}

// After: Single account with all data
#[account]
pub struct CombinedData {
    pub value1: u64,
    pub value2: u64,
    pub value3: u64,
}

pub fn optimized_operation(ctx: Context<Process>) -> Result<()> {
    let data = &ctx.accounts.combined_data;  // Single read
    // Process...
}
```

**Result**: Reduced compute units by ~15% across my programs.

### 3. Test Everything Locally

The Solana test validator is amazing:

```bash
# Start local validator
solana-test-validator

# Deploy program
anchor deploy

# Run tests
anchor test --skip-local-validator
```

**Testing Framework**:

```typescript
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { expect } from "chai";

describe("token-swap", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  const program = anchor.workspace.TokenSwap as Program<TokenSwap>;
  
  it("Initializes pool correctly", async () => {
    const [pool] = await PublicKey.findProgramAddress(
      [Buffer.from("pool")],
      program.programId
    );
    
    await program.methods
      .initializePool(new anchor.BN(3), new anchor.BN(1000))
      .accounts({
        pool,
        authority: provider.wallet.publicKey,
        // ... other accounts
      })
      .rpc();
      
    const poolAccount = await program.account.pool.fetch(pool);
    expect(poolAccount.feeNumerator.toNumber()).to.equal(3);
  });
});
```

## What's Next: September Plans

With solid Solana fundamentals, September will focus on:

1. **Time Capsule Protocol**: Trustless time-locking mechanism
2. **Advanced Testing**: Fuzzing and security audits
3. **Frontend Integration**: Building the UI with Next.js

---

*Are you building on Solana? What's been your experience? Let's connect!*
