from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum
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

class Event(Base):
    __tablename__ = "events"
    id = Column(String, primary_key=True) # external_id
    sport_key = Column(String)
    sport_title = Column(String)
    commence_time = Column(DateTime)
    home_team = Column(String)
    away_team = Column(String)

class Odds(Base):
    __tablename__ = "odds"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String, ForeignKey("events.id"))
    bookmaker = Column(String)
    market = Column(String) # h2h, etc.
    home_price = Column(Float)
    away_price = Column(Float)
    draw_price = Column(Float, nullable=True)
    last_update = Column(DateTime)

class Bet(Base):
    __tablename__ = "bets"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String, ForeignKey("events.id"))
    selection = Column(String) # home, away, draw
    odds = Column(Float)
    stake = Column(Float)
    potential_payout = Column(Float)
    status = Column(Enum(BetStatus), default=BetStatus.PENDING)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    ticket_id = Column(String)

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String) # deposit, withdrawal, bet_placed, bet_payout
    amount = Column(Float)
    description = Column(String)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))
