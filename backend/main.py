from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
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

app = FastAPI(title="SportPOS Pro API")

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
def list_sports(db: Session = Depends(get_db)):
    sports = db.query(models.Event.sport_key, models.Event.sport_title).distinct().all()
    return [{"key": s.sport_key, "title": s.sport_title} for s in sports]

@app.get("/events", response_model=List[schemas.EventBase])
def read_events(sport_key: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Event).filter(models.Event.commence_time > datetime.now(timezone.utc))
    if sport_key:
        query = query.filter(models.Event.sport_key == sport_key)
    return query.order_by(models.Event.commence_time.asc()).all()

@app.get("/odds/{event_id}")
def read_odds(event_id: str, db: Session = Depends(get_db)):
    odds = db.query(models.Odds).filter(models.Odds.event_id == event_id).first()
    if not odds:
        raise HTTPException(status_code=404, detail="Odds not found")
    return odds.markets_data

@app.post("/bets", response_model=schemas.BetResponse)
def create_bet(bet: schemas.BetCreate, db: Session = Depends(get_db)):
    ticket_id = str(uuid.uuid4())[:8].upper()
    potential_payout = round(bet.stake * bet.odds, 2)

    db_bet = models.Bet(
        event_id=bet.event_id,
        event_name=bet.event_name,
        selection=bet.selection,
        odds=bet.odds,
        stake=bet.stake,
        potential_payout=potential_payout,
        ticket_id=ticket_id
    )
    db.add(db_bet)

    transaction = models.Transaction(
        type="bet_placed",
        amount=-bet.stake,
        description=f"Apuesta: {bet.event_name} ({bet.selection}) - Ticket: {ticket_id}"
    )
    db.add(transaction)

    db.commit()
    db.refresh(db_bet)
    return db_bet

@app.get("/bets/{ticket_id}/pdf")
def get_bet_pdf(ticket_id: str, db: Session = Depends(get_db)):
    bet = db.query(models.Bet).filter(models.Bet.ticket_id == ticket_id).first()
    if not bet:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")

    buffer = io.BytesIO()
    # Thermal printer standard size: 80mm width, dynamic height
    p_width = 80 * unit_mm
    p_height = 120 * unit_mm
    c = canvas.Canvas(buffer, pagesize=(p_width, p_height))

    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(40 * unit_mm, 110 * unit_mm, "SPORTPOS PRO")

    c.setFont("Helvetica", 8)
    c.drawCentredString(40 * unit_mm, 105 * unit_mm, f"TICKET: {bet.ticket_id}")
    c.drawCentredString(40 * unit_mm, 102 * unit_mm, f"FECHA: {bet.created_at.strftime('%Y-%m-%d %H:%M:%S')}")

    c.line(5 * unit_mm, 98 * unit_mm, 75 * unit_mm, 98 * unit_mm)

    c.setFont("Helvetica-Bold", 10)
    # Wrap text for event name if too long
    ev_name = bet.event_name[:30] + "..." if len(bet.event_name) > 30 else bet.event_name
    c.drawCentredString(40 * unit_mm, 92 * unit_mm, ev_name)

    c.setFont("Helvetica", 9)
    c.drawString(10 * unit_mm, 85 * unit_mm, "SELECCION:")
    c.drawRightString(70 * unit_mm, 85 * unit_mm, bet.selection[:25])

    c.drawString(10 * unit_mm, 80 * unit_mm, "CUOTA:")
    c.drawRightString(70 * unit_mm, 80 * unit_mm, f"x{bet.odds}")

    c.drawString(10 * unit_mm, 75 * unit_mm, "APUESTA:")
    c.drawRightString(70 * unit_mm, 75 * unit_mm, f"${bet.stake:.2f}")

    c.setFont("Helvetica-Bold", 12)
    c.drawString(10 * unit_mm, 65 * unit_mm, "PREMIO:")
    c.drawRightString(70 * unit_mm, 65 * unit_mm, f"${bet.potential_payout:.2f}")

    c.line(5 * unit_mm, 60 * unit_mm, 75 * unit_mm, 60 * unit_mm)

    c.setFont("Helvetica-Oblique", 7)
    c.drawCentredString(40 * unit_mm, 50 * unit_mm, "CONSERVE ESTE TICKET PARA COBRAR")
    c.drawCentredString(40 * unit_mm, 46 * unit_mm, "GRACIAS POR SU PREFERENCIA")

    c.showPage()
    c.save()

    buffer.seek(0)
    return Response(content=buffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f"inline; filename=ticket_{ticket_id}.pdf"})

@app.post("/bets/{ticket_id}/cancel")
def cancel_bet(ticket_id: str, db: Session = Depends(get_db)):
    bet = db.query(models.Bet).filter(models.Bet.ticket_id == ticket_id).first()
    if not bet:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    if bet.status != models.BetStatus.PENDING:
        raise HTTPException(status_code=400, detail="Solo se pueden cancelar apuestas pendientes")

    if datetime.now(timezone.utc) - bet.created_at.replace(tzinfo=timezone.utc) > timedelta(minutes=5):
         raise HTTPException(status_code=400, detail="Tiempo de cancelación expirado (5 min)")

    bet.status = models.BetStatus.CANCELLED
    transaction = models.Transaction(
        type="bet_cancelled",
        amount=bet.stake,
        description=f"Cancelación de ticket: {ticket_id}"
    )
    db.add(transaction)
    db.commit()
    return {"message": "Apuesta cancelada y monto reembolsado"}

@app.get("/bets", response_model=List[schemas.BetResponse])
def read_bets(db: Session = Depends(get_db)):
    return db.query(models.Bet).order_by(models.Bet.created_at.desc()).all()

@app.get("/transactions", response_model=List[schemas.TransactionResponse])
def read_transactions(db: Session = Depends(get_db)):
    return db.query(models.Transaction).order_by(models.Transaction.timestamp.desc()).all()

@app.get("/balance")
def get_balance(db: Session = Depends(get_db)):
    balance = db.query(func.sum(models.Transaction.amount)).scalar() or 0.0
    return {"balance": balance}

@app.post("/deposit")
def deposit(amount: float, db: Session = Depends(get_db)):
    transaction = models.Transaction(
        type="deposit",
        amount=amount,
        description="Depósito manual en caja"
    )
    db.add(transaction)
    db.commit()
    return {"message": "Depósito exitoso"}

@app.post("/withdraw")
def withdraw(amount: float, db: Session = Depends(get_db)):
    transaction = models.Transaction(
        type="withdrawal",
        amount=-amount,
        description="Retiro manual de caja"
    )
    db.add(transaction)
    db.commit()
    return {"message": "Retiro exitoso"}

@app.post("/settle")
async def settle_all_bets(db: Session = Depends(get_db)):
    success = await odds_service.fetch_results(db)
    if success:
        return {"message": "Liquidación completada"}
    else:
        raise HTTPException(status_code=500, detail="Error en liquidación")

@app.post("/refresh")
async def refresh_odds(db: Session = Depends(get_db)):
    success = await odds_service.fetch_and_update_odds(db)
    return {"success": success}
