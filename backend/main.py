from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict
import uuid
import asyncio
from datetime import datetime, timezone, timedelta
import io

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import mm
from reportlab.lib.units import mm as unit_mm

from . import models, schemas, database, odds_service
from .database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="SportPOS Pro")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    db = next(get_db())
    asyncio.create_task(odds_service.fetch_and_update_odds(db))

@app.get("/sports")
def list_sports_categorized(db: Session = Depends(get_db)):
    # Group sports and their leagues
    sports = db.query(models.Sport).all()
    structure = {}
    for s in sports:
        leagues = db.query(models.League).filter(models.League.sport_slug == s.slug, models.League.events_count > 0).all()
        if leagues:
            structure[s.name] = [[l.slug, l.name, True] for l in leagues]
    return structure

@app.get("/events", response_model=List[schemas.EventBase])
def read_events(league_slug: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Event).filter(models.Event.commence_time > datetime.now(timezone.utc))
    if league_slug:
        query = query.filter(models.Event.league_slug == league_slug)
    # Correct mapping for schemas.EventBase
    events = query.order_by(models.Event.commence_time.asc()).all()
    # Pydantic will handle field mapping if we help it
    return [
        {
            "id": ev.id,
            "sport_key": ev.sport_slug, # mapped to sport_key for frontend
            "sport_title": ev.league_slug,
            "commence_time": ev.commence_time,
            "home_team": ev.home_team,
            "away_team": ev.away_team
        } for ev in events
    ]

@app.get("/odds/{event_id}")
def read_odds(event_id: str, db: Session = Depends(get_db)):
    odds = db.query(models.Odds).filter(models.Odds.event_id == event_id).first()
    if not odds: return {}
    return odds.markets_data

@app.post("/bets", response_model=schemas.BetResponse)
def create_bet(bet: schemas.BetCreate, db: Session = Depends(get_db)):
    ticket_id = str(uuid.uuid4())[:8].upper()
    potential_payout = round(bet.stake * bet.total_odds, 2)
    db_bet = models.Bet(
        selections=[s.dict() for s in bet.selections],
        total_odds=bet.total_odds,
        stake=bet.stake,
        potential_payout=potential_payout,
        ticket_id=ticket_id
    )
    db.add(db_bet)
    transaction = models.Transaction(
        type="bet_placed",
        amount=-bet.stake,
        description=f"Ticket {ticket_id}: {'Combinada' if len(bet.selections)>1 else 'Simple'}"
    )
    db.add(transaction)
    db.commit()
    db.refresh(db_bet)
    return db_bet

@app.get("/bets/{ticket_id}/pdf")
def get_bet_pdf(ticket_id: str, db: Session = Depends(get_db)):
    bet = db.query(models.Bet).filter(models.Bet.ticket_id == ticket_id).first()
    if not bet: raise HTTPException(status_code=404, detail="Ticket no encontrado")
    buffer = io.BytesIO()
    p_width = 80 * unit_mm
    p_height = (100 + (len(bet.selections) * 20)) * unit_mm
    c = canvas.Canvas(buffer, pagesize=(p_width, p_height))
    y = p_height - 15 * unit_mm
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(40 * unit_mm, y, "SPORTPOS PRO")
    y -= 8 * unit_mm
    c.setFont("Helvetica", 8)
    c.drawCentredString(40 * unit_mm, y, f"TICKET: {bet.ticket_id}")
    y -= 4 * unit_mm
    c.drawCentredString(40 * unit_mm, y, f"FECHA: {bet.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
    y -= 5 * unit_mm
    c.line(5 * unit_mm, y, 75 * unit_mm, y)
    for sel in bet.selections:
        y -= 10 * unit_mm
        c.setFont("Helvetica-Bold", 9)
        c.drawString(8 * unit_mm, y, sel['event_name'][:35])
        y -= 4 * unit_mm
        c.setFont("Helvetica", 8)
        c.drawString(10 * unit_mm, y, f"OPCION: {sel['selection']}")
        c.drawRightString(70 * unit_mm, y, f"x{sel['odds']}")
        y -= 2 * unit_mm
        c.setDash(1, 2)
        c.line(10 * unit_mm, y, 70 * unit_mm, y)
        c.setDash()
    y -= 10 * unit_mm
    c.line(5 * unit_mm, y, 75 * unit_mm, y)
    y -= 8 * unit_mm
    c.setFont("Helvetica-Bold", 10)
    c.drawString(10 * unit_mm, y, "CUOTA TOTAL:")
    c.drawRightString(70 * unit_mm, y, f"x{bet.total_odds:.2f}")
    y -= 6 * unit_mm
    c.drawString(10 * unit_mm, y, "APUESTA:")
    c.drawRightString(70 * unit_mm, y, f"${bet.stake:.2f}")
    y -= 10 * unit_mm
    c.setFont("Helvetica-Bold", 14)
    c.drawString(10 * unit_mm, y, "PREMIO:")
    c.drawRightString(70 * unit_mm, y, f"${bet.potential_payout:.2f}")
    y -= 15 * unit_mm
    c.setFont("Helvetica-Oblique", 7)
    c.drawCentredString(40 * unit_mm, y, "CONSERVE ESTE TICKET PARA COBRAR")
    c.showPage()
    c.save()
    buffer.seek(0)
    return Response(content=buffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f"inline; filename=ticket_{ticket_id}.pdf"})

@app.get("/bets", response_model=List[schemas.BetResponse])
def read_bets(db: Session = Depends(get_db)):
    return db.query(models.Bet).order_by(models.Bet.created_at.desc()).all()

@app.get("/balance")
def get_balance(db: Session = Depends(get_db)):
    balance = db.query(func.sum(models.Transaction.amount)).scalar() or 0.0
    return {"balance": balance}

@app.post("/deposit")
def deposit(amount: float, db: Session = Depends(get_db)):
    db.add(models.Transaction(type="deposit", amount=amount, description="Carga manual"))
    db.commit()
    return {"message": "Carga exitosa"}

@app.get("/transactions", response_model=List[schemas.TransactionResponse])
def read_transactions(db: Session = Depends(get_db)):
    return db.query(models.Transaction).order_by(models.Transaction.timestamp.desc()).all()

@app.post("/refresh")
async def refresh_odds(db: Session = Depends(get_db)):
    await odds_service.fetch_and_update_odds(db)
    return {"success": True}

@app.post("/settle")
async def settle_bets(db: Session = Depends(get_db)):
    await odds_service.fetch_results(db)
    return {"message": "OK"}
