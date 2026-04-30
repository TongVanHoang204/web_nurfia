# 🏗️ System Architecture

> High-level architecture of the Claude Code System.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        USER LAYER                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   CLI    │  │   IDE    │  │   Web    │  │   API    │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       └──────────────┴──────────────┴──────────────┘        │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                     AI ORCHESTRATION LAYER                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Coder   │  │ Reviewer │  │Architect │  │Optimizer │   │
│  │  Agent   │  │  Agent   │  │  Agent   │  │  Agent   │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       └──────────────┴──────────────┴──────────────┘        │
│                           │                                  │
│  ┌────────────────────────▼────────────────────────────┐    │
│  │              SKILL & WORKFLOW ENGINE                  │    │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐    │    │
│  │  │ Skills │  │Workflow│  │ Hooks  │  │Prompts │    │    │
│  │  └────────┘  └────────┘  └────────┘  └────────┘    │    │
│  └──────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                      MEMORY LAYER                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Global  │  │ Patterns │  │ Mistakes │  │  Config  │   │
│  │  Memory  │  │  Memory  │  │   Log    │  │  Store   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                    APPLICATION LAYER                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │    AI    │  │   API    │  │   Data   │  │  Tests   │   │
│  │  Module  │  │  Module  │  │  Module  │  │  Module  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Docker  │  │   GCP    │  │ Firebase │  │  CI/CD   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Layer Descriptions

### User Layer
Entry points for interacting with the system. Supports CLI, IDE extensions, web interface, and direct API calls.

### AI Orchestration Layer
Multi-agent system that routes tasks to specialized agents. Each agent has defined capabilities, constraints, and escalation protocols.

### Skill & Workflow Engine
Reusable AI skills (generate, debug, optimize) composed into end-to-end workflows (build-feature, ship-product, fix-bug). Hooks provide pre/post automation.

### Memory Layer
Persistent knowledge store that survives across sessions. Includes global knowledge, learned patterns, error logs, and configuration.

### Application Layer
The actual source code being developed. Organized by feature modules with AI, API, and Data separation.

### Infrastructure Layer
Deployment, containerization, and cloud infrastructure. Supports Docker, GCP, Firebase, and CI/CD pipelines.

## Data Flow

1. User submits a request via any entry point
2. Request is analyzed and routed to appropriate agent(s)
3. Agent loads relevant context from Memory Layer
4. Agent executes using Skills and follows Workflows
5. Pre/Post hooks validate inputs and outputs
6. Results are delivered to the user
7. New knowledge is persisted to Memory Layer
