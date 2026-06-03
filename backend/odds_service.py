import requests
import os
from dotenv import load_dotenv
from . import models
from datetime import datetime, timezone
import json

load_dotenv()

API_KEY = os.getenv("THE_ODDS_API_KEY")
BASE_URL = "https://api.the-odds-api.com/v4/sports"

def fetch_and_update_odds(db):
    if not API_KEY:
        print("API Key not found")
        return False

    try:
        # Fetching odds for soccer_spain_la_liga as a default example,
        # or we could fetch 'upcoming' but that might return too many events.
        # Let's try to fetch upcoming odds for a few popular sports.
        sports_to_fetch = ['soccer_spain_la_liga', 'soccer_uefa_champs_league', 'basketball_nba']

        for sport in sports_to_fetch:
            url = f"{BASE_URL}/{sport}/odds/?regions=eu&markets=h2h&apiKey={API_KEY}"
            response = requests.get(url)
            if response.status_code != 200:
                print(f"Error fetching {sport}: {response.text}")
                continue

            data = response.json()
            update_db_with_data(db, data)
        return True
    except Exception as e:
        print(f"Error updating odds: {e}")
        return False

def update_db_with_data(db, data):
    for item in data:
        # Parse commence time
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

        # We'll take the first bookmaker for simplicity in this POS demo
        if item.get("bookmakers"):
            bm = item["bookmakers"][0] # Usually pinnacle or similar if eu region
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
                            odds.bookmaker = bm["title"]
                            odds.home_price = home_price
                            odds.away_price = away_price
                            odds.draw_price = draw_price
                            odds.last_update = datetime.now(timezone.utc)
                    except StopIteration:
                        continue
    db.commit()

def fetch_results(db):
    # This would call the /scores endpoint or /results endpoint of the API
    # The Odds API results/scores endpoint: /v4/sports/{sport}/scores/?daysFrom=3&apiKey={apiKey}
    try:
        sports_to_check = ['soccer_spain_la_liga', 'soccer_uefa_champs_league', 'basketball_nba']
        for sport in sports_to_check:
            url = f"{BASE_URL}/{sport}/scores/?daysFrom=3&apiKey={API_KEY}"
            response = requests.get(url)
            if response.status_code == 200:
                results = response.json()
                settle_bets(db, results)
        return True
    except Exception as e:
        print(f"Error fetching results: {e}")
        return False

def settle_bets(db, results):
    for result in results:
        if not result.get("completed"):
            continue

        event_id = result["id"]
        # Find all pending bets for this event
        bets = db.query(models.Bet).filter(models.Bet.event_id == event_id, models.Bet.status == models.BetStatus.PENDING).all()

        if not bets:
            continue

        # Determine winner
        scores = result.get("scores")
        if not scores:
            continue

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
                # Record payout transaction
                transaction = models.Transaction(
                    type="bet_payout",
                    amount=bet.potential_payout,
                    description=f"Payout for bet on {event_id} - Ticket: {bet.ticket_id}"
                )
                db.add(transaction)
            else:
                bet.status = models.BetStatus.LOST
    db.commit()
