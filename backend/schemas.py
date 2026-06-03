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

class OddsBase(BaseModel):
    event_id: str
    bookmaker: str
    market: str
    home_price: float
    away_price: float
    draw_price: Optional[float] = None

class BetCreate(BaseModel):
    event_id: str
    event_name: str
    selection: str
    odds: float
    stake: float

class BetResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: str
    event_name: str
    selection: str
    odds: float
    stake: float
    potential_payout: float
    status: BetStatus
    created_at: datetime
    ticket_id: str

class TransactionCreate(BaseModel):
    type: str
    amount: float
    description: str

class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: str
    amount: float
    description: str
    timestamp: datetime
