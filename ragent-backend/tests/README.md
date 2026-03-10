# 🛡️ Quality, Safety & Robustness

This test suite is being actively developed to transition RAgent from a prototype to a production-grade Agentic system. 

### 🎯 Current Focus:
1. **Adversarial Red-Teaming:** Implementing automated scripts to test the Orchestrator Agent's resilience against prompt injection and "jailbreak" attempts designed to bypass document retrieval guardrails.
2. **Retrieval Accuracy (RAG Evaluation):** Benchmarking the `all-MiniLM-L6-v2` embeddings against edge-case queries (e.g., conflicting data across multiple PDFs) to minimize hallucinations.
3. **Agent Loop Constraints:** Unit tests for the `AgentExecutor` to validate that `max_iterations=6` correctly handles complex multi-hop queries without entering infinite loops.

### 🧪 Methodology:
I am leveraging a "Champion-Challenger" model where new system prompts are tested against a "Golden Dataset" of known document facts to ensure iterative changes don't degrade the grounding of the answers.