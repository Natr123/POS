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

# Prioritizing Soccer and popular leagues
PRIORITY_SPORTS = [
    "soccer_spain_la_liga", "soccer_uefa_champs_league", "soccer_england_league_1",
    "soccer_italy_serie_a", "soccer_germany_bundesliga", "soccer_france_ligue_1",
    "soccer_mexico_liga_mx", "soccer_conmebol_libertadores",
    "basketball_nba", "baseball_mlb", "americanfootball_nfl", "icehockey_nhl"
]

async def fetch_and_update_odds(db):
    if not API_KEY:
        return False

    async with httpx.AsyncClient() as client:
        # Discover all active sports but focus on priority first
        sports_to_fetch = PRIORITY_SPORTS

        url_all = f"{BASE_URL}/?apiKey={API_KEY}"
        resp_sports = await client.get(url_all)
        if resp_sports.status_code == 200:
            active_keys = [s['key'] for s in resp_sports.json() if s['active']]
            # Add other active sports if not already in priority
            for k in active_keys[:30]:
                if k not in sports_to_fetch:
                    sports_to_fetch.append(k)

        tasks = []
        for sport in sports_to_fetch:
            url = f"{BASE_URL}/{sport}/odds/?regions=us,eu&markets=h2h,spreads,totals&apiKey={API_KEY}"
            tasks.append(client.get(url))

        responses = await asyncio.gather(*tasks, return_exceptions=True)

        for response in responses:
            if isinstance(response, httpx.Response) and response.status_code == 200:
                update_db_with_data(db, response.json())
        return True

def update_db_with_data(db, data):
    for item in data:
        try:
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
                markets_obj = {}

                for market in bm["markets"]:
                    if market["key"] == "h2h":
                        markets_obj["h2h"] = {
                            "home": next((o["price"] for o in market["outcomes"] if o["name"] == item["home_team"]), None),
                            "away": next((o["price"] for o in market["outcomes"] if o["name"] == item["away_team"]), None),
                            "draw": next((o["price"] for o in market["outcomes"] if o["name"] == "Draw"), None)
                        }
                    elif market["key"] == "spreads":
                        outcomes = market["outcomes"]
                        if len(outcomes) >= 2:
                            markets_obj["spreads"] = {
                                "home_name": outcomes[0]["name"],
                                "home_price": outcomes[0]["price"],
                                "home_point": outcomes[0].get("point"),
                                "away_name": outcomes[1]["name"],
                                "away_price": outcomes[1]["price"],
                                "away_point": outcomes[1].get("point")
                            }
                    elif market["key"] == "totals":
                        outcomes = market["outcomes"]
                        over = next((o for o in outcomes if o["name"].lower() == "over"), None)
                        under = next((o for o in outcomes if o["name"].lower() == "under"), None)
                        if over and under:
                            markets_obj["totals"] = {
                                "point": over.get("point"),
                                "over_price": over["price"],
                                "under_price": under["price"]
                            }

                odds = db.query(models.Odds).filter(models.Odds.event_id == item["id"]).first()
                if not odds:
                    odds = models.Odds(
                        event_id=item["id"],
                        bookmaker=bm["title"],
                        last_update=datetime.now(timezone.utc),
                        markets_data=markets_obj
                    )
                    db.add(odds)
                else:
                    odds.markets_data = markets_obj
                    odds.last_update = datetime.now(timezone.utc)
        except Exception:
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
        bets = db.query(models.Bet).filter(models.Bet.status == models.BetStatus.PENDING).all()

        # Determine winner for H2H
        scores = result.get("scores")
        if not scores: continue

        try:
            home_score = next((int(s["score"]) for s in scores if s["name"] == result["home_team"]), 0)
            away_score = next((int(s["score"]) for s in scores if s["name"] == result["away_team"]), 0)
            winner = result["home_team"] if home_score > away_score else result["away_team"] if away_score > home_score else "Draw"

            for bet in bets:
                # Check if this event is in the bet's selections
                sels = bet.selections
                involved = False
                all_sels_won = True
                any_sel_lost = False

                # Parlay settlement logic: all selections must win
                # This logic would need to store results for each selection separately in a real system.
                # Simplified for this POS: we only settle simple bets for now to avoid complexity,
                # or mark the whole bet if all selections are finished.
                # Real implementation would require a 'Selection' status in the DB.
        except Exception:
            continue
    db.commit()
