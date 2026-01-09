---
title: "Building in Public: Lessons from Contributing to Open Source"
tags: ["Open Source", "Community", "Developer Experience", "GitHub"]
---

# Building in Public: Lessons from Contributing to Open Source

## Introduction

May 2025 marked a shift in how I approach software development. Instead of working in isolation on side projects, I dove deeper into open source communities, contributing to projects, engaging in technical discussions, and learning from developers worldwide. This post reflects on what I learned about tech community engagement and why it matters.

## Why Open Source Matters

### It's Not Just About Code

When I started contributing to open source, I thought it was purely about writing code. I was wrong. Open source communities teach you:

1. **Communication**: How to explain technical decisions clearly
2. **Collaboration**: Working with people across time zones and cultures
3. **Empathy**: Understanding user needs and maintainer constraints
4. **Patience**: Navigating review processes and feedback cycles

### The Learning Multiplier

Working alone, you're limited by your own knowledge. In open source:

- **Code Review**: Get feedback from experts
- **Issue Discussions**: See how others approach problems
- **Documentation**: Learn to explain complex concepts simply
- **Testing**: Discover edge cases you'd never think of

## My May Contributions

### Rust Ecosystem

Building on my January Clippy contribution, I continued exploring Rust tooling:

```rust
// Improved error messages in a cargo plugin
pub fn format_diagnostic(diag: &Diagnostic) -> String {
    let mut output = String::new();
    
    // Make errors human-readable
    output.push_str(&format!(
        "{}[{}]{} {}\n",
        color::RED,
        diag.level,
        color::RESET,
        diag.message
    ));
    
    // Show context
    if let Some(span) = &diag.span {
        output.push_str(&format_code_snippet(span));
    }
    
    // Suggest fixes
    if !diag.suggestions.is_empty() {
        output.push_str("\nPossible fixes:\n");
        for (i, suggestion) in diag.suggestions.iter().enumerate() {
            output.push_str(&format!("  {}. {}\n", i + 1, suggestion));
        }
    }
    
    output
}
```

**Lesson**: User experience matters in developer tools. Clear error messages save hours of debugging.

### JavaScript Tooling

Contributed to several build tool projects:

```typescript
// Performance optimization in a bundler plugin
export function optimizeChunkSplitting(modules: Module[]): Chunk[] {
  // Group frequently accessed modules together
  const frequencyMap = analyzeImportFrequency(modules);
  
  // Use graph clustering for optimal chunk boundaries
  const clusters = clusterByFrequency(modules, frequencyMap);
  
  return clusters.map(createChunk);
}
```

**Lesson**: Performance optimization requires deep understanding of both the tool and real-world usage patterns.

### Documentation Projects

One of my favorite contributions was improving documentation:

```markdown
## Before
Installation: Run `npm install foo`

## After
### Installation

#### npm
npm install foo

#### yarn
yarn add foo

#### pnpm
pnpm add foo

### Requirements
- Node.js >= 14.0.0
- TypeScript >= 4.5 (if using TypeScript)

### Verify Installation
foo --version

### Next Steps
- [Quick Start Guide](./quickstart.md)
- [API Reference](./api.md)
- [Examples](./examples.md)
```

**Lesson**: Good documentation is as important as good code. Many users never make it past bad docs.

## Best Practices I Learned

### 1. Start Small

Don't jump into core features immediately:

**Good First Contributions:**
- Fix typos in documentation
- Add missing type definitions
- Improve error messages
- Add test cases
- Update examples

**Why This Works:**
- Low risk of breaking things
- Get familiar with codebase
- Build trust with maintainers
- Learn the contribution process

### 2. Read the Contributing Guidelines

Every project has different expectations:

```markdown
# Example CONTRIBUTING.md structure
1. Code of Conduct
2. How to Report Issues
3. Development Setup
4. Coding Standards
5. Testing Requirements
6. Pull Request Process
7. Community Channels
```

**Pro Tip**: Create a checklist before submitting PRs:

```markdown
## PR Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] Changelog entry added
- [ ] Passes CI checks
- [ ] Follows code style guide
- [ ] Includes descriptive commit messages
```

### 3. Communicate Early and Often

Before spending hours on a feature:

```markdown
## Feature Discussion Template

**Problem**: Describe the issue you're solving

**Proposed Solution**: High-level approach

**Alternatives Considered**: Other options you explored

**Questions**: Anything you're unsure about

**Implementation Plan**: Major steps involved
```

This saves time and aligns expectations.

### 4. Accept Feedback Gracefully

Your code will be critiqued. That's good!

```diff
# Initial submission
- const result = data.map(x => x.value).filter(x => x > 0);
+ const result = data
+   .map(item => item.value)
+   .filter(value => value > 0);

# After feedback
+ const result = data
+   .filter(item => item.value > 0)  // Filter first for better performance
+   .map(item => item.value);         // Then map
```

**Lesson**: Every review is a learning opportunity.

## Building My Own Community

### Open Sourcing Personal Projects

Inspired by the communities I joined, I open-sourced several projects:

#### Project: DedCore

```rust
// Made the codebase welcoming to contributors
// src/lib.rs

//! # DedCore
//! 
//! A high-performance file deduplication tool.
//! 
//! ## Quick Start
//! 
//! ```rust
//! use dedcore::Scanner;
//! 
//! let scanner = Scanner::new("/path/to/scan");
//! let duplicates = scanner.find_duplicates()?;
//! ```
//! 
//! ## Architecture
//! 
//! The scanner works in three phases:
//! 1. File discovery (parallel directory traversal)
//! 2. Hashing (configurable algorithms)
//! 3. Duplicate detection (hash comparison)

pub mod scanner;
pub mod hasher;
pub mod detector;
```

**Result**: Got my first external contributor within a week!

### Creating Welcoming Documentation

```markdown
# Contributing to DedCore

Welcome! We're excited you're interested in contributing.

## First Time?

- Check out [Good First Issues](link)
- Join our [Discord](link) to ask questions
- Read the [Architecture Guide](link) to understand the codebase

## Need Help?

Don't hesitate to ask! You can:
- Open a GitHub Discussion
- Tag @mxnish in Discord
- Comment on the issue you're working on

Remember: There are no stupid questions. We were all beginners once!
```

## Measuring Community Impact

### Metrics That Matter

Not just stars and forks:

1. **Response Time**: How quickly do you respond to issues?
2. **Contributor Retention**: Do people contribute again?
3. **Issue Closure Rate**: Are problems getting solved?
4. **Documentation Quality**: Can newcomers get started easily?

### Tools I Use

```typescript
// GitHub API script to track community health
async function getCommunityMetrics(repo: string) {
  const issues = await github.issues.listForRepo(repo);
  const prs = await github.pulls.list(repo);
  
  return {
    avgResponseTime: calculateAvgResponseTime(issues),
    contributorCount: getUniqueContributors(prs),
    issueCloseRate: calculateCloseRate(issues),
    prMergeRate: calculateMergeRate(prs),
  };
}
```

## Unexpected Benefits

### 1. Better Code Quality

Writing for others makes you write better code:
- More comments
- Better variable names
- Comprehensive tests
- Cleaner architecture

### 2. Network Effects

Meeting developers who:
- Teach you new techniques
- Collaborate on future projects
- Provide career opportunities
- Share interesting problems

### 3. Portfolio Building

Open source contributions are:
- Publicly visible
- Reviewed by experts
- Demonstrate real-world skills
- Show your growth over time

## Common Pitfalls to Avoid

### 1. Drive-By PRs

Don't submit code and disappear. Engage with feedback.

### 2. Bikeshedding

Don't obsess over trivial details. Focus on meaningful improvements.

### 3. Taking Rejection Personally

Not every PR will be merged. Learn from it and move on.

### 4. Burning Out

Don't overcommit. Quality > Quantity.

## Looking Ahead: June Plans

With this solid foundation in community engagement, June will focus on:

1. **Learning Rust** more deeply
2. **Building DedCore** with community input
3. **Mentoring** first-time contributors
4. **Writing** about lessons learned

## Resources for Getting Started

### Finding Projects

- [First Timers Only](https://www.firsttimersonly.com/)
- [Good First Issue](https://goodfirstissue.dev/)
- [CodeTriage](https://www.codetriage.com/)
- GitHub's "Good First Issue" label

### Learning Resources

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [GitHub Flow](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)

### Community Platforms

- GitHub Discussions
- Discord servers
- Reddit (r/opensource)
- Dev.to community

## Final Thoughts

Open source isn't just about code—it's about people. The technical skills you gain are valuable, but the communication skills, collaboration patterns, and relationships you build are invaluable.

If you're not contributing to open source yet, start today. Find a project you use, read the code, and look for something you can improve. Your first PR might be scary, but I promise: the community wants you to succeed.

---

*What was your first open source contribution? What did you learn? Share your story!*
