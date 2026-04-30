# CLAUDE.md — Core Memory & Guidelines

> **Version**: 2.0
> **Last Updated**: 2026-04-28
> **Author**: Code Web Không Khó

---

## 🧠 Project Identity

This is an **AI-first project structure** designed for building production-ready systems with Claude Code.
It emphasizes **modularity**, **automation**, **long-term memory**, and **deterministic AI workflows**.

---

## 📌 Core Principles

1. **Think Modular** — Every skill, prompt, and workflow is a reusable unit.
2. **Automate Everything** — Use hooks, pipelines, and CI/CD to eliminate manual steps.
3. **Build Smarter with Claude** — Leverage AI agents for code review, generation, and optimization.
4. **Document Decisions** — Use ADRs (Architecture Decision Records) for every non-trivial choice.
5. **Test AI Outputs** — Evaluate generations with benchmarks and structured evals.

---

## 🗂️ Project Structure Overview

```
claude-code-system/
├── CLAUDE.md                  # Core memory (this file)
├── README.md                  # Public documentation
├── ROADMAP.md                 # Feature roadmap & milestones
├── CHANGELOG.md               # Version history
│
├── .claude/                   # Claude-specific configuration
│   ├── config.json            # Model settings, API keys, defaults
│   ├── memory/                # Long-term memory store
│   │   ├── global.md          # Cross-project knowledge
│   │   ├── patterns.md        # Learned patterns & preferences
│   │   └── mistakes.md        # Error log to avoid repetition
│   ├── skills/                # Reusable AI workflows
│   │   ├── coding/            # Code generation, debug, optimize
│   │   ├── product/           # Ideation, validation
│   │   └── content/           # Writing, hooks
│   ├── agents/                # Multi-agent definitions
│   │   ├── coder.md           # Code generation agent
│   │   ├── reviewer.md        # Code review agent
│   │   ├── architect.md       # System design agent
│   │   └── optimizer.md       # Performance optimization agent
│   ├── workflows/             # End-to-end automation flows
│   │   ├── build-feature.md   # Feature development pipeline
│   │   ├── ship-product.md    # Deployment pipeline
│   │   └── fix-bug.md         # Bug resolution pipeline
│   └── hooks/                 # Automation triggers
│       ├── pre-gen.md         # Pre-generation validation
│       ├── post-gen.md        # Post-generation checks
│       └── validation.md     # Output validation rules
│
├── docs/                      # Project documentation
│   ├── architecture.md        # System architecture
│   ├── decisions/             # ADRs (Architecture Decision Records)
│   ├── runbooks/              # Operational procedures
│   └── prompts/               # Prompt engineering documentation
│
├── prompts/                   # Organized prompt library
│   ├── system/                # System-level prompts
│   └── tasks/                 # Task-specific prompts
│
├── tools/                     # Automation scripts
│   ├── scripts/               # Utility scripts
│   ├── pipelines/             # CI/CD pipeline configs
│   └── evals/                 # AI output evaluation tools
│
├── src/                       # Application source code
│   └── core/                  # Core modules
│       └── modules/           # Feature modules
│           ├── ai/            # AI integration layer
│           │   ├── chains/    # LLM chain definitions
│           │   ├── agents/    # Agent implementations
│           │   └── context/   # Context management
│           ├── api/           # API layer
│           │   ├── routes/    # Route definitions
│           │   └── controllers/ # Request handlers
│           ├── data/          # Data layer
│           │   ├── embeddings/ # Vector embeddings
│           │   └── loaders/   # Data ingestion
│           └── ...
│
├── tests/                     # Test suite
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   └── ai-evals/              # AI output evaluations
│
├── experiments/               # Sandbox for new ideas
│   └── failed-ideas/         # Archive of failed experiments
│
└── deploy/                    # Deployment configs
    ├── docker/                # Docker configurations
    ├── configs/               # Environment configs
    └── infra/                 # Infrastructure as Code
```

---

## 🔧 Development Commands

```bash
# Start development
npm run dev

# Run tests
npm run test

# Run AI evaluations
npm run eval

# Build for production
npm run build

# Deploy
npm run deploy
```

---

## 🚫 Anti-Patterns to Avoid

- **Never** use mock data in production code.
- **Never** swallow exceptions in try-catch blocks.
- **Never** commit API keys or secrets to the repository.
- **Never** skip writing tests for core logic.
- **Never** make architectural decisions without an ADR.

---

## ✅ Code Standards

- All functions must have explicit error handling.
- All core logic must have corresponding unit tests.
- All AI outputs must pass validation before use.
- Structured logging for all system-level operations.
- Comments only for non-obvious logic.

---

## 🧩 Integration Points

| Service       | Purpose                    | Config Location           |
|---------------|----------------------------|---------------------------|
| Claude API    | AI generation & reasoning  | `.claude/config.json`     |
| Firebase      | Auth, DB, hosting          | `deploy/configs/`         |
| Docker        | Containerization           | `deploy/docker/`          |
| GitHub Actions| CI/CD pipelines            | `tools/pipelines/`        |

---

## 📖 Quick Reference

- **Add a new skill**: Create file in `.claude/skills/<category>/`
- **Add a new agent**: Create file in `.claude/agents/`
- **Add a new workflow**: Create file in `.claude/workflows/`
- **Log a decision**: Create ADR in `docs/decisions/`
- **Log a mistake**: Append to `.claude/memory/mistakes.md`
- **Run evaluations**: `npm run eval`
