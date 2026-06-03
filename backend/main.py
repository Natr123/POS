from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import uuid

from . import models, schemas, database, odds_service
from .database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Sports Betting POS Backend")

@app.on_event("startup")
def startup_event():
    db = next(get_db())
    odds_service.fetch_and_update_odds(db)

@app.get("/events", response_model=List[schemas.EventBase])
def read_events(db: Session = Depends(get_db)):
    return db.query(models.Event).all()

@app.get("/odds/{event_id}")
def read_odds(event_id: str, db: Session = Depends(get_db)):
    odds = db.query(models.Odds).filter(models.Odds.event_id == event_id).first()
    if not odds:
        raise HTTPException(status_code=404, detail="Odds not found")
    return odds

@app.post("/bets", response_model=schemas.BetResponse)
def create_bet(bet: schemas.BetCreate, db: Session = Depends(get_db)):
    ticket_id = str(uuid.uuid4())[:8].upper()
    potential_payout = bet.stake * bet.odds

    db_bet = models.Bet(
        event_id=bet.event_id,
        selection=bet.selection,
        odds=bet.odds,
        stake=bet.stake,
        potential_payout=potential_payout,
        ticket_id=ticket_id
    )
    db.add(db_bet)

    # Record transaction
    transaction = models.Transaction(
        type="bet_placed",
        amount=-bet.stake,
        description=f"Bet placed on {bet.event_id} ({bet.selection}) - Ticket: {ticket_id}"
    )
    db.add(transaction)

    db.commit()
    db.refresh(db_bet)
    return db_bet

@app.get("/bets", response_model=List[schemas.BetResponse])
def read_bets(db: Session = Depends(get_db)):
    return db.query(models.Bet).all()

@app.get("/transactions", response_model=List[schemas.TransactionResponse])
def read_transactions(db: Session = Depends(get_db)):
    return db.query(models.Transaction).all()

@app.get("/balance")
def get_balance(db: Session = Depends(get_db)):
    balance = db.query(func.sum(models.Transaction.amount)).scalar() or 0.0
    return {"balance": balance}

@app.post("/deposit")
def deposit(amount: float, db: Session = Depends(get_db)):
    transaction = models.Transaction(
        type="deposit",
        amount=amount,
        description="Manual deposit to caja"
    )
    db.add(transaction)
    db.commit()
    return {"message": "Deposit successful"}
