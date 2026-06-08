import httpx
import os
import asyncio
from dotenv import load_dotenv
from . import models
from datetime import datetime, timezone
import json

load_dotenv()

API_KEY = "2e5fa03c199ce594cc93f00930cae020"
BASE_URL = "https://api.odds-api.io/v3"

# Bookmakers to use for odds
SELECTED_BOOKMAKERS = "Bet365,SingBet,Pinnacle,Unibet"

async def sync_sports(db):
    url = f"{BASE_URL}/sports"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                for item in data:
                    sport = db.query(models.Sport).filter(models.Sport.slug == item["slug"]).first()
                    if not sport:
                        sport = models.Sport(slug=item["slug"], name=item["name"])
                        db.add(sport)
                    else:
                        sport.name = item["name"]
                db.commit()
                return True
        except Exception as e:
            print(f"Error syncing sports: {e}")
            return False

async def sync_leagues(db, sport_slug):
    url = f"{BASE_URL}/leagues?apiKey={API_KEY}&sport={sport_slug}"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                for item in data:
                    league = db.query(models.League).filter(models.League.slug == item["slug"]).first()
                    if not league:
                        league = models.League(
                            slug=item["slug"],
                            name=item["name"],
                            sport_slug=sport_slug,
                            events_count=item.get("eventsCount", 0)
                        )
                        db.add(league)
                    else:
                        league.name = item["name"]
                        league.events_count = item.get("eventsCount", 0)
                db.commit()
                return True
        except Exception: return False

async def fetch_and_update_odds(db):
    if not API_KEY: return False

    await sync_sports(db)
    sports = db.query(models.Sport).all()

    # To avoid rate limits and keep it responsive, we'll sync leagues for top sports
    top_sports = ["football", "basketball", "tennis", "baseball", "american-football", "ice-hockey", "esports"]

    async with httpx.AsyncClient() as client:
        for s_slug in top_sports:
            await sync_leagues(db, s_slug)

            # Fetch events for this sport
            url_ev = f"{BASE_URL}/events?apiKey={API_KEY}&sport={s_slug}&status=pending"
            resp_ev = await client.get(url_ev)
            if resp_ev.status_code == 200:
                events_data = resp_ev.json()
                # Update events in DB
                for ev in events_data:
                    db_ev = db.query(models.Event).filter(models.Event.id == str(ev["id"])).first()
                    if not db_ev:
                        db_ev = models.Event(
                            id=str(ev["id"]),
                            sport_slug=s_slug,
                            league_slug=ev["league"]["slug"],
                            commence_time=datetime.fromisoformat(ev["date"].replace("Z", "+00:00")),
                            home_team=ev["home"],
                            away_team=ev["away"],
                            status=ev["status"]
                        )
                        db.add(db_ev)
                db.commit()

                # Fetch odds for first 10 events (batch)
                event_ids = [str(ev["id"]) for ev in events_data[:10]]
                if event_ids:
                    ids_str = ",".join(event_ids)
                    url_odds = f"{BASE_URL}/odds/multi?apiKey={API_KEY}&eventIds={ids_str}&bookmakers={SELECTED_BOOKMAKERS}"
                    resp_odds = await client.get(url_odds)
                    if resp_odds.status_code == 200:
                        update_db_with_odds(db, resp_odds.json())
        return True

def update_db_with_odds(db, data):
    # data is a list of objects from /odds/multi
    for item in data:
        event_id = str(item["id"])
        # Find the "best" odds from the bookmakers
        # For simplicity, we merge or take the first available
        markets_obj = {}
        for bookie_name, markets in item.get("bookmakers", {}).items():
            for m in markets:
                if m["name"] == "ML":
                    o = m["odds"][0]
                    # We initialize or update if higher (optional, here we take first)
                    if "h2h" not in markets_obj:
                        markets_obj["h2h"] = {
                            "home": float(o.get("home", 0)),
                            "away": float(o.get("away", 0)),
                            "draw": float(o.get("draw", 0)) if o.get("draw") else None
                        }
                elif "Handicap" in m["name"]:
                    o = m["odds"][0]
                    if "spreads" not in markets_obj:
                        markets_obj["spreads"] = {
                            "home_name": item["home"],
                            "home_price": float(o.get("home", 0)),
                            "home_point": o.get("hdp"),
                            "away_name": item["away"],
                            "away_price": float(o.get("away", 0)),
                            "away_point": -o.get("hdp") if o.get("hdp") is not None else None
                        }
                elif m["name"] == "Totals":
                    o = m["odds"][0]
                    if "totals" not in markets_obj:
                        markets_obj["totals"] = {
                            "point": o.get("hdp"),
                            "over_price": float(o.get("over", 0)),
                            "under_price": float(o.get("under", 0))
                        }

        odds = db.query(models.Odds).filter(models.Odds.event_id == event_id).first()
        if not odds:
            odds = models.Odds(event_id=event_id, bookmaker="Multi", last_update=datetime.now(timezone.utc), markets_data=markets_obj)
            db.add(odds)
        else:
            odds.markets_data = markets_obj
    db.commit()

async def fetch_results(db):
    # Settle bets using scores from /events endpoint
    pass
