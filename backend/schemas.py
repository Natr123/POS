from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import List, Optional
from .models import BetStatus

class EventBase(BaseModel):
    id: str
    sport_key: str
    sport_title: str
    commence_time: datetime
    home_team: str
    away_team: str

class Selection(BaseModel):
    event_id: str
    event_name: str
    selection: str
    odds: float

class BetCreate(BaseModel):
    selections: List[Selection]
    total_odds: float
    stake: float

class BetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    selections: List[Selection]
    total_odds: float
    stake: float
    potential_payout: float
    status: BetStatus
    created_at: datetime
    ticket_id: str

class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    amount: float
    description: str
    timestamp: datetime
