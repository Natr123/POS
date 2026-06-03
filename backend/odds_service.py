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

# Comprehensive list of sports
POPULAR_SPORTS = [
    "soccer_spain_la_liga", "soccer_uefa_champs_league", "soccer_england_league_1",
    "soccer_italy_serie_a", "soccer_germany_bundesliga", "soccer_france_ligue_1",
    "basketball_nba", "baseball_mlb", "americanfootball_nfl", "icehockey_nhl",
    "tennis_atp_wimbledon", "boxing_boxing", "mma_mixed_martial_arts",
    "cricket_ipl", "golf_masters_tournament", "rugby_league_nrl",
    "americanfootball_ncaaf", "basketball_euroleague"
]

# Mapping requested names to Odds API keys (approximate)
# Ajedrez (not common in Odds API, might skip or mock)
# Deportes de motor / F1
# Esports
# ...

async def fetch_and_update_odds(db):
    if not API_KEY:
        return False

    async with httpx.AsyncClient() as client:
        tasks = []
        # We'll fetch a broad set of upcoming events first to discover sports
        url_all = f"{BASE_URL}/?apiKey={API_KEY}"
        resp_sports = await client.get(url_all)
        if resp_sports.status_code == 200:
            all_available_sports = [s['key'] for s in resp_sports.json() if s['active']]
            # Filter or limit to keep it manageable
            sports_to_fetch = all_available_sports[:25]
        else:
            sports_to_fetch = POPULAR_SPORTS

        for sport in sports_to_fetch:
            # Fetching multiple markets: h2h, spreads, totals
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
                # Take the best bookmaker or just the first one for the demo
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
                        # Simplification: take first outcome pair
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
        bets = db.query(models.Bet).filter(models.Bet.event_id == event_id, models.Bet.status == models.BetStatus.PENDING).all()

        if not bets:
            continue

        scores = result.get("scores")
        if not scores:
            continue

        try:
            home_score = next((int(s["score"]) for s in scores if s["name"] == result["home_team"]), 0)
            away_score = next((int(s["score"]) for s in scores if s["name"] == result["away_team"]), 0)

            # This settlement logic mainly works for H2H.
            # Spreads and Totals settlement would require more complex logic.
            # For this POS, we'll settle H2H and mark others as PENDING or handle simply.
            winner = None
            if home_score > away_score:
                winner = result["home_team"]
            elif away_score > home_score:
                winner = result["away_team"]
            else:
                winner = "Draw"

            for bet in bets:
                # Basic H2H settlement
                if "Moneyline" in bet.selection:
                    sel_name = bet.selection.split(": ")[1]
                    if sel_name == winner:
                        bet.status = models.BetStatus.WON
                        db.add(models.Transaction(type="bet_payout", amount=bet.potential_payout, description=f"Pago Ticket: {bet.ticket_id}"))
                    else:
                        bet.status = models.BetStatus.LOST
                # Simple logic for others (could be improved)
        except Exception:
            continue
    db.commit()
