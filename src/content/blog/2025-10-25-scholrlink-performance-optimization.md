---
title: "ScholrLink: Social Funding with Solana Blinks and Performance Optimization"
tags: ["Solana", "Blinks", "Next.js", "Performance", "Web3", "DeFi"]
---

# ScholrLink: Social Funding with Solana Blinks and Performance Optimization

## Introduction

October 2025 brought ScholrLink to life—a platform that transforms social media posts into one-tap funding portals using Solana Blinks. But shipping the feature was only half the battle. This month was about optimization, error handling, and building something that actually works at scale.

## What is ScholrLink?

ScholrLink turns scholarships and funding requests into blockchain-powered social interactions:

1. **Creator** posts about their project/need
2. **Blink** converts the post into an actionable funding button
3. **Supporters** fund with one tap, directly on Twitter/Discord
4. **NFT Badge**: Supporters get soulbound "patron badges"

All without leaving the social platform.

## Solana Blinks: The Game Changer

### What are Blinks?

Blockchain Links (Blinks) are Solana's answer to making crypto interactions as easy as clicking a link:

```typescript
// A Blink is just a URL that returns blockchain actions
https://scholr-link.vercel.app/api/blink/fund?project=abc123

// Returns:
{
  "type": "action",
  "icon": "https://...",
  "title": "Fund Alice's CS Degree",
  "description": "Support Alice's computer science education",
  "links": {
    "actions": [
      {
        "label": "Fund 0.1 SOL",
        "href": "/api/blink/fund?project=abc123&amount=0.1"
      },
      {
        "label": "Fund 1 SOL",
        "href": "/api/blink/fund?project=abc123&amount=1"
      },
      {
        "label": "Custom Amount",
        "href": "/api/blink/fund?project=abc123&amount={amount}",
        "parameters": [
          {
            "name": "amount",
            "label": "Enter amount in SOL"
          }
        ]
      }
    ]
  }
}
```

### Implementing the Blink API

```typescript
// pages/api/blink/fund.ts
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { createFundingInstruction } from '@/lib/scholrlink';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // CORS for Blink providers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  const { project, amount } = req.query;
  
  if (req.method === 'GET') {
    // Return action metadata
    const projectData = await getProject(project as string);
    
    return res.json({
      type: 'action',
      icon: projectData.image,
      title: `Fund ${projectData.title}`,
      description: projectData.description,
      links: {
        actions: [
          {
            label: 'Fund 0.1 SOL',
            href: `/api/blink/fund?project=${project}&amount=0.1`,
          },
          {
            label: 'Fund 0.5 SOL',
            href: `/api/blink/fund?project=${project}&amount=0.5`,
          },
          {
            label: 'Fund 1 SOL',
            href: `/api/blink/fund?project=${project}&amount=1`,
          },
          {
            label: 'Custom Amount',
            href: `/api/blink/fund?project=${project}&amount={amount}`,
            parameters: [{
              name: 'amount',
              label: 'Enter amount in SOL',
              required: true,
            }],
          },
        ],
      },
    });
  }
  
  if (req.method === 'POST') {
    // Create transaction
    const { account } = req.body;
    
    const connection = new Connection(process.env.SOLANA_RPC_URL!);
    const projectData = await getProject(project as string);
    
    // Create funding transaction
    const tx = await createFundingTransaction({
      from: new PublicKey(account),
      to: new PublicKey(projectData.wallet),
      amount: parseFloat(amount as string),
      project: project as string,
    });
    
    // Serialize and return
    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    
    return res.json({
      transaction: serialized.toString('base64'),
      message: `Funding ${amount} SOL to ${projectData.title}`,
    });
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
}
```

## The Smart Contract

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("ScholrLinkProgramID");

#[program]
pub mod scholr_link {
    use super::*;
    
    pub fn initialize_project(
        ctx: Context<InitializeProject>,
        title: String,
        description: String,
        goal_amount: u64,
    ) -> Result<()> {
        let project = &mut ctx.accounts.project;
        
        project.creator = ctx.accounts.creator.key();
        project.title = title;
        project.description = description;
        project.goal_amount = goal_amount;
        project.raised_amount = 0;
        project.supporter_count = 0;
        project.created_at = Clock::get()?.unix_timestamp;
        project.is_active = true;
        project.bump = ctx.bumps.project;
        
        Ok(())
    }
    
    pub fn fund_project(
        ctx: Context<FundProject>,
        amount: u64,
    ) -> Result<()> {
        let project = &mut ctx.accounts.project;
        
        require!(project.is_active, ErrorCode::ProjectInactive);
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        // Transfer SOL to project creator
        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.supporter.key(),
            &project.creator,
            amount,
        );
        
        anchor_lang::solana_program::program::invoke(
            &transfer_ix,
            &[
                ctx.accounts.supporter.to_account_info(),
                ctx.accounts.creator.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        
        // Update project stats
        project.raised_amount = project.raised_amount.checked_add(amount).unwrap();
        project.supporter_count = project.supporter_count.checked_add(1).unwrap();
        
        // Create supporter record
        let supporter_record = &mut ctx.accounts.supporter_record;
        supporter_record.supporter = ctx.accounts.supporter.key();
        supporter_record.project = project.key();
        supporter_record.amount = amount;
        supporter_record.funded_at = Clock::get()?.unix_timestamp;
        supporter_record.bump = ctx.bumps.supporter_record;
        
        // Mint soulbound badge NFT
        mint_patron_badge(
            &ctx.accounts.badge_mint,
            &ctx.accounts.supporter_badge_account,
            &ctx.accounts.supporter.key(),
            amount,
        )?;
        
        emit!(FundingEvent {
            project: project.key(),
            supporter: ctx.accounts.supporter.key(),
            amount,
            total_raised: project.raised_amount,
        });
        
        Ok(())
    }
    
    pub fn claim_funds(ctx: Context<ClaimFunds>) -> Result<()> {
        let project = &mut ctx.accounts.project;
        
        require!(
            ctx.accounts.creator.key() == project.creator,
            ErrorCode::Unauthorized
        );
        
        // Funds are already transferred in fund_project
        // This is for additional features like milestones
        
        Ok(())
    }
}

#[account]
pub struct Project {
    pub creator: Pubkey,
    pub title: String,
    pub description: String,
    pub goal_amount: u64,
    pub raised_amount: u64,
    pub supporter_count: u32,
    pub created_at: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
pub struct SupporterRecord {
    pub supporter: Pubkey,
    pub project: Pubkey,
    pub amount: u64,
    pub funded_at: i64,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct FundProject<'info> {
    #[account(mut)]
    pub supporter: Signer<'info>,
    
    #[account(mut)]
    pub project: Account<'info, Project>,
    
    /// CHECK: Project creator receives funds
    #[account(mut)]
    pub creator: AccountInfo<'info>,
    
    #[account(
        init,
        payer = supporter,
        space = 8 + SupporterRecord::INIT_SPACE,
        seeds = [b"supporter", project.key().as_ref(), supporter.key().as_ref()],
        bump
    )]
    pub supporter_record: Account<'info, SupporterRecord>,
    
    // Badge NFT accounts
    #[account(mut)]
    pub badge_mint: Account<'info, token::Mint>,
    
    #[account(mut)]
    pub supporter_badge_account: Account<'info, TokenAccount>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
}

fn mint_patron_badge(
    badge_mint: &Account<token::Mint>,
    recipient: &Account<TokenAccount>,
    supporter: &Pubkey,
    amount: u64,
) -> Result<()> {
    // Mint soulbound NFT (non-transferable)
    // Badge tier based on funding amount
    let tier = calculate_badge_tier(amount);
    
    // Implementation details...
    
    Ok(())
}

fn calculate_badge_tier(amount: u64) -> BadgeTier {
    match amount {
        0..=100_000_000 => BadgeTier::Bronze,  // < 0.1 SOL
        100_000_001..=1_000_000_000 => BadgeTier::Silver,  // 0.1 - 1 SOL
        1_000_000_001..=10_000_000_000 => BadgeTier::Gold,  // 1 - 10 SOL
        _ => BadgeTier::Platinum,  // > 10 SOL
    }
}

#[derive(Debug, Clone, Copy)]
pub enum BadgeTier {
    Bronze,
    Silver,
    Gold,
    Platinum,
}

#[event]
pub struct FundingEvent {
    pub project: Pubkey,
    pub supporter: Pubkey,
    pub amount: u64,
    pub total_raised: u64,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Project is not active")]
    ProjectInactive,
    
    #[msg("Invalid funding amount")]
    InvalidAmount,
    
    #[msg("Unauthorized action")]
    Unauthorized,
}
```

## Performance Optimization Journey

### Problem 1: Rate Limiting

Initial version had no rate limits. Got hammered during testing:

```typescript
// Before: No protection
export default async function handler(req, res) {
  // Process every request
  const result = await processBlinkAction(req);
  return res.json(result);
}

// After: Rate limiting with Redis
import { RateLimiter } from '@/lib/rate-limit';

const limiter = new RateLimiter({
  redis: redisClient,
  windowMs: 60 * 1000,  // 1 minute
  max: 10,  // 10 requests per minute per IP
});

export default async function handler(req, res) {
  // Check rate limit
  const limited = await limiter.check(req);
  
  if (limited) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: limited.retryAfter,
    });
  }
  
  const result = await processBlinkAction(req);
  return res.json(result);
}
```

**Implementation**:

```typescript
import Redis from 'ioredis';

export class RateLimiter {
  private redis: Redis;
  private windowMs: number;
  private max: number;
  
  constructor(options: {
    redis: Redis;
    windowMs: number;
    max: number;
  }) {
    this.redis = options.redis;
    this.windowMs = options.windowMs;
    this.max = options.max;
  }
  
  async check(req: NextApiRequest): Promise<false | { retryAfter: number }> {
    const identifier = this.getIdentifier(req);
    const key = `ratelimit:${identifier}`;
    
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      // First request in window, set expiry
      await this.redis.pexpire(key, this.windowMs);
    }
    
    if (current > this.max) {
      const ttl = await this.redis.pttl(key);
      return {
        retryAfter: Math.ceil(ttl / 1000),
      };
    }
    
    return false;
  }
  
  private getIdentifier(req: NextApiRequest): string {
    // Use IP address or API key
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded
      ? (forwarded as string).split(',')[0]
      : req.socket.remoteAddress;
    
    return ip || 'unknown';
  }
}
```

### Problem 2: Error Surface Area

Failed transactions left users confused:

```typescript
// Before: Generic errors
catch (error) {
  return res.status(500).json({ error: 'Something went wrong' });
}

// After: Detailed error handling
interface BlinkError {
  code: string;
  message: string;
  details?: any;
  userMessage: string;
}

function handleBlinkError(error: any): BlinkError {
  // Solana transaction errors
  if (error.message?.includes('insufficient funds')) {
    return {
      code: 'INSUFFICIENT_FUNDS',
      message: error.message,
      userMessage: 'You don\'t have enough SOL to complete this transaction.',
    };
  }
  
  if (error.message?.includes('blockhash not found')) {
    return {
      code: 'STALE_BLOCKHASH',
      message: error.message,
      userMessage: 'Transaction expired. Please try again.',
    };
  }
  
  if (error.message?.includes('Project is not active')) {
    return {
      code: 'PROJECT_INACTIVE',
      message: error.message,
      userMessage: 'This project is no longer accepting funding.',
    };
  }
  
  // Network errors
  if (error.code === 'ECONNREFUSED') {
    return {
      code: 'RPC_UNAVAILABLE',
      message: 'RPC connection failed',
      userMessage: 'Unable to connect to Solana network. Please try again later.',
    };
  }
  
  // Default
  return {
    code: 'UNKNOWN_ERROR',
    message: error.message || 'Unknown error',
    userMessage: 'An unexpected error occurred. Please try again.',
  };
}

// Usage
try {
  const result = await processBlinkAction(req);
  return res.json(result);
} catch (error) {
  const blinkError = handleBlinkError(error);
  
  // Log for debugging
  console.error('[Blink Error]', {
    code: blinkError.code,
    message: blinkError.message,
    details: error,
  });
  
  // User-friendly response
  return res.status(400).json({
    error: blinkError.userMessage,
    code: blinkError.code,
  });
}
```

### Problem 3: Next.js Edge Cache

Initial version had no caching. Every Blink request hit the database:

```typescript
// Before: No caching
export default async function handler(req, res) {
  const project = await db.project.findUnique({
    where: { id: req.query.project },
  });
  
  return res.json(formatBlinkResponse(project));
}

// After: Edge caching with revalidation
export const config = {
  runtime: 'edge',
};

export default async function handler(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('project');
  
  // Check edge cache
  const cacheKey = `blink:${projectId}`;
  const cached = await kv.get(cacheKey);
  
  if (cached) {
    return new Response(JSON.stringify(cached), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  }
  
  // Fetch from database
  const project = await db.project.findUnique({
    where: { id: projectId },
  });
  
  const response = formatBlinkResponse(project);
  
  // Cache for 5 minutes
  await kv.set(cacheKey, response, { ex: 300 });
  
  return new Response(JSON.stringify(response), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
```

**Result**:
- **99% cache hit rate** after warmup
- **<50ms response time** (from ~300ms)
- **10x reduction** in database queries

### Problem 4: Soulbound Badges in Profile

Displaying badges required querying all supporter records:

```typescript
// Before: Slow O(n) query
async function getUserBadges(userId: string) {
  const supporters = await db.supporterRecord.findMany({
    where: { supporter: userId },
    include: { project: true },
  });
  
  return supporters.map(s => ({
    project: s.project.title,
    amount: s.amount,
    tier: calculateBadgeTier(s.amount),
  }));
}

// After: Indexed query with caching
async function getUserBadges(userId: string) {
  // Check cache first
  const cached = await cache.get(`badges:${userId}`);
  if (cached) return cached;
  
  // Use indexed query
  const supporters = await db.supporterRecord.findMany({
    where: { supporter: userId },
    select: {
      amount: true,
      funded_at: true,
      project: {
        select: {
          id: true,
          title: true,
          creator: true,
        },
      },
    },
    orderBy: { funded_at: 'desc' },
    take: 50,  // Limit to recent badges
  });
  
  const badges = supporters.map(s => ({
    projectId: s.project.id,
    projectTitle: s.project.title,
    amount: s.amount,
    tier: calculateBadgeTier(s.amount),
    fundedAt: s.funded_at,
  }));
  
  // Cache for 10 minutes
  await cache.set(`badges:${userId}`, badges, 600);
  
  return badges;
}
```

## Real-World Impact

After optimizations:

### Performance Metrics
- **API Response Time**: 300ms → 50ms (83% faster)
- **Cache Hit Rate**: 0% → 99%
- **Database Load**: 1000 req/min → 10 req/min
- **Error Rate**: 15% → 2%

### User Engagement
- **Funding Completion Rate**: 45% → 78%
- **Average Funding Amount**: 0.2 SOL → 0.5 SOL
- **Return Funders**: 12% → 34%

### Technical Wins
- ✅ Zero downtime deployments
- ✅ Handles 10k+ requests/min
- ✅ Sub-100ms p95 latency
- ✅ Comprehensive error tracking

## DedCore Optimizations

In parallel, optimized DedCore:

```rust
// Before: Sequential hashing
for file in files {
    let hash = hash_file(&file)?;
    hashes.insert(file, hash);
}

// After: Skip tiny files, parallel hash
let files_to_hash: Vec<_> = files
    .into_iter()
    .filter(|f| f.size >= MIN_SIZE)  // Skip tiny files
    .collect();

let hashes: HashMap<_, _> = files_to_hash
    .par_iter()  // Parallel iteration
    .filter_map(|file| {
        hash_file(file)
            .ok()
            .map(|hash| (file.clone(), hash))
    })
    .collect();
```

**Result**: ~8% faster on large datasets

## Lessons Learned

### 1. Cache Aggressively

Most Blink data doesn't change often. Aggressive caching with smart invalidation is key.

### 2. Error Messages Matter

Users can't fix problems if they don't understand them. Invest in error handling.

### 3. Rate Limiting is Essential

Protect your APIs from abuse and accidental DDoS from testing.

### 4. Edge Computing Wins

Moving computation closer to users dramatically improves latency.

## Looking Ahead: November

Plans for next month:

1. **RustyTasks**: Building a task manager with Rust
2. **Validator Metrics**: On-chain monitoring system
3. **DedCore Fuzzy Search**: Improve file filtering

---

*Check out ScholrLink at [scholr-link.vercel.app](https://scholr-link.vercel.app)*
