from dataclasses import dataclass, field
from typing import Optional
import uuid


@dataclass
class AgentMemory:
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    conversation_history: list[dict] = field(default_factory=list)
    current_strategy: Optional[dict] = None
    last_backtest_result: Optional[dict] = None
    clarification_count: int = 0
    MAX_CLARIFICATIONS = 3

    def add_user_message(self, content: str):
        self.conversation_history.append({"role": "user", "content": content})

    def add_agent_message(self, content: str):
        self.conversation_history.append({"role": "model", "content": content})

    def get_gemini_history(self) -> list[dict]:
        return [
            {"role": item["role"], "parts": [{"text": item["content"]}]}
            for item in self.conversation_history
        ]

    def to_dict(self) -> dict:
        return {
            "session_id": self.session_id,
            "conversation_history": self.conversation_history,
            "current_strategy": self.current_strategy,
            "last_backtest_result": self.last_backtest_result,
            "clarification_count": self.clarification_count,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AgentMemory":
        memory = cls(session_id=data.get("session_id", str(uuid.uuid4())))
        memory.conversation_history = data.get("conversation_history", [])
        memory.current_strategy = data.get("current_strategy")
        memory.last_backtest_result = data.get("last_backtest_result")
        memory.clarification_count = data.get("clarification_count", 0)
        return memory
