import requests
import os
from dotenv import load_dotenv
from . import models, database
from datetime import datetime, timezone
import json

load_dotenv()

API_KEY = os.getenv("THE_ODDS_API_KEY")
BASE_URL = "https://api.the-odds-api.com/v4/sports"

def fetch_and_update_odds(db):
    # For demonstration, if API_KEY is placeholder, return mock data
    if not API_KEY or API_KEY == "your_api_key_here":
        return get_mock_odds(db)

    # Actual API call would go here
    # response = requests.get(f"{BASE_URL}/upcoming/odds/?regions=us&markets=h2h&apiKey={API_KEY}")
    # data = response.json()
    # update_db_with_data(db, data)
    return get_mock_odds(db)

def get_mock_odds(db):
    mock_data = [
        {
            "id": "event1",
            "sport_key": "soccer_spain_la_liga",
            "sport_title": "La Liga",
            "commence_time": "2023-12-01T20:00:00Z",
            "home_team": "Real Madrid",
            "away_team": "Barcelona",
            "bookmakers": [
                {
                    "key": "pinnacle",
                    "markets": [
                        {
                            "key": "h2h",
                            "outcomes": [
                                {"name": "Real Madrid", "price": 2.1},
                                {"name": "Barcelona", "price": 3.2},
                                {"name": "Draw", "price": 3.5}
                            ]
                        }
                    ]
                }
            ]
        },
        {
            "id": "event2",
            "sport_key": "basketball_nba",
            "sport_title": "NBA",
            "commence_time": "2023-12-02T01:00:00Z",
            "home_team": "LA Lakers",
            "away_team": "GS Warriors",
            "bookmakers": [
                {
                    "key": "pinnacle",
                    "markets": [
                        {
                            "key": "h2h",
                            "outcomes": [
                                {"name": "LA Lakers", "price": 1.8},
                                {"name": "GS Warriors", "price": 2.0}
                            ]
                        }
                    ]
                }
            ]
        }
    ]

    for item in mock_data:
        event = db.query(models.Event).filter(models.Event.id == item["id"]).first()
        if not event:
            event = models.Event(
                id=item["id"],
                sport_key=item["sport_key"],
                sport_title=item["sport_title"],
                commence_time=datetime.fromisoformat(item["commence_time"].replace("Z", "")),
                home_team=item["home_team"],
                away_team=item["away_team"]
            )
            db.add(event)

        for bm in item["bookmakers"]:
            for market in bm["markets"]:
                if market["key"] == "h2h":
                    home_price = next(o["price"] for o in market["outcomes"] if o["name"] == item["home_team"])
                    away_price = next(o["price"] for o in market["outcomes"] if o["name"] == item["away_team"])
                    draw_price = next((o["price"] for o in market["outcomes"] if o["name"] == "Draw"), None)

                    odds = db.query(models.Odds).filter(models.Odds.event_id == item["id"]).first()
                    if not odds:
                        odds = models.Odds(
                            event_id=item["id"],
                            bookmaker=bm["key"],
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
    db.commit()
    return True
