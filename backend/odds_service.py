import httpx
import os
import asyncio
from dotenv import load_dotenv
from . import models
from datetime import datetime, timezone
import json

load_dotenv()

API_KEY = os.getenv("THE_ODDS_API_KEY")
BASE_URL = "https://api.the-odds-api.com/v4/sports"

POPULAR_SPORTS = [
    "soccer_spain_la_liga",
    "soccer_uefa_champs_league",
    "soccer_england_league_1",
    "soccer_italy_serie_a",
    "soccer_germany_bundesliga",
    "soccer_france_ligue_1",
    "basketball_nba",
    "baseball_mlb",
    "americanfootball_nfl",
    "icehockey_nhl"
]

# In-memory cache to speed up reads
cache = {
    "sports": None,
    "odds": {}, # event_id: odds_data
    "last_sync": None
}

async def fetch_and_update_odds(db):
    if not API_KEY:
        return False

    async with httpx.AsyncClient() as client:
        tasks = []
        for sport in POPULAR_SPORTS:
            url = f"{BASE_URL}/{sport}/odds/?regions=eu,us&markets=h2h&apiKey={API_KEY}"
            tasks.append(client.get(url))

        responses = await asyncio.gather(*tasks, return_exceptions=True)

        for response in responses:
            if isinstance(response, httpx.Response) and response.status_code == 200:
                update_db_with_data(db, response.json())

        cache["last_sync"] = datetime.now(timezone.utc)
        return True

def update_db_with_data(db, data):
    for item in data:
        commence_time = datetime.fromisoformat(item["commence_time"].replace("Z", "+00:00"))

        event = db.query(models.Event).filter(models.Event.id == item["id"]).first()
        if not event:
            event = models.Event(
                id=item["id"],
                sport_key=item["sport_key"],
                sport_title=item["sport_title"],
                commence_time=commence_time,
                home_team=item["home_team"],
                away_team=item["away_team"]
            )
            db.add(event)
        else:
            event.commence_time = commence_time
            event.sport_title = item["sport_title"]

        if item.get("bookmakers"):
            bm = item["bookmakers"][0]
            for market in bm["markets"]:
                if market["key"] == "h2h":
                    try:
                        home_price = next(o["price"] for o in market["outcomes"] if o["name"] == item["home_team"])
                        away_price = next(o["price"] for o in market["outcomes"] if o["name"] == item["away_team"])
                        draw_price = next((o["price"] for o in market["outcomes"] if o["name"] == "Draw"), None)

                        odds = db.query(models.Odds).filter(models.Odds.event_id == item["id"]).first()
                        if not odds:
                            odds = models.Odds(
                                event_id=item["id"],
                                bookmaker=bm["title"],
                                market=market["key"],
                                home_price=home_price,
                                away_price=away_price,
                                draw_price=draw_price,
                                last_update=datetime.now(timezone.utc)
                            )
                            db.add(odds)
                        else:
                            odds.home_price = home_price
                            odds.away_price = away_price
                            odds.draw_price = draw_price
                            odds.last_update = datetime.now(timezone.utc)
                    except StopIteration:
                        continue
    db.commit()

async def fetch_results(db):
    try:
        now = datetime.now(timezone.utc)
        events_to_check = db.query(models.Event).filter(models.Event.commence_time < now).all()
        sports_to_check = list(set(e.sport_key for e in events_to_check))

        async with httpx.AsyncClient() as client:
            tasks = [client.get(f"{BASE_URL}/{sport}/scores/?daysFrom=3&apiKey={API_KEY}") for sport in sports_to_check]
            responses = await asyncio.gather(*tasks, return_exceptions=True)

            for response in responses:
                if isinstance(response, httpx.Response) and response.status_code == 200:
                    settle_bets(db, response.json())
        return True
    except Exception as e:
        print(f"Error fetching results: {e}")
        return False

def settle_bets(db, results):
    for result in results:
        if not result.get("completed"):
            continue

        event_id = result["id"]
        bets = db.query(models.Bet).filter(models.Bet.event_id == event_id, models.Bet.status == models.BetStatus.PENDING).all()

        if not bets:
            continue

        scores = result.get("scores")
        if not scores:
            continue

        try:
            home_score = next((int(s["score"]) for s in scores if s["name"] == result["home_team"]), 0)
            away_score = next((int(s["score"]) for s in scores if s["name"] == result["away_team"]), 0)

            winner = None
            if home_score > away_score:
                winner = result["home_team"]
            elif away_score > home_score:
                winner = result["away_team"]
            else:
                winner = "Draw"

            for bet in bets:
                if bet.selection == winner:
                    bet.status = models.BetStatus.WON
                    transaction = models.Transaction(
                        type="bet_payout",
                        amount=bet.potential_payout,
                        description=f"Payout for bet on {event_id} - Ticket: {bet.ticket_id}"
                    )
                    db.add(transaction)
                else:
                    bet.status = models.BetStatus.LOST
        except Exception:
            continue
    db.commit()
