from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timezone
import enum

Base = declarative_base()

class BetStatus(enum.Enum):
    PENDING = "pending"
    WON = "won"
    LOST = "lost"
    CANCELLED = "cancelled"

class Sport(Base):
    __tablename__ = "sports"
    key = Column(String, primary_key=True)
    group = Column(String) # Soccer, Basketball, etc.
    title = Column(String)
    description = Column(String)
    active = Column(Boolean)
    has_outrights = Column(Boolean)

class Event(Base):
    __tablename__ = "events"
    id = Column(String, primary_key=True)
    sport_key = Column(String, ForeignKey("sports.key"))
    sport_title = Column(String)
    commence_time = Column(DateTime)
    home_team = Column(String)
    away_team = Column(String)

class Odds(Base):
    __tablename__ = "odds"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String, ForeignKey("events.id"))
    bookmaker = Column(String)
    last_update = Column(DateTime)
    markets_data = Column(JSON)

class Bet(Base):
    __tablename__ = "bets"
    id = Column(Integer, primary_key=True, index=True)
    selections = Column(JSON)
    total_odds = Column(Float)
    stake = Column(Float)
    potential_payout = Column(Float)
    status = Column(Enum(BetStatus), default=BetStatus.PENDING)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    ticket_id = Column(String, unique=True)

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String)
    amount = Column(Float)
    description = Column(String)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
