import httpx
import os
import asyncio
from dotenv import load_dotenv
from . import models
from datetime import datetime, timezone
import json

load_dotenv()

API_KEY = "2e5fa03c199ce594cc93f00930cae020"
BASE_URL = "https://api.the-odds-api.com/v4/sports"

async def sync_sports(db):
    url = f"{BASE_URL}?apiKey={API_KEY}&all=true"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                for item in data:
                    sport = db.query(models.Sport).filter(models.Sport.key == item["key"]).first()
                    if not sport:
                        sport = models.Sport(
                            key=item["key"],
                            group=item["group"],
                            title=item["title"],
                            description=item["description"],
                            active=item["active"],
                            has_outrights=item["has_outrights"]
                        )
                        db.add(sport)
                    else:
                        sport.active = item["active"]
                        sport.group = item["group"]
                        sport.title = item["title"]
                db.commit()
                return True
        except Exception as e:
            print(f"Error syncing sports: {e}")
            return False

async def fetch_and_update_odds(db):
    if not API_KEY: return False

    # Ensure sports are synced
    await sync_sports(db)

    # Get active sports only
    active_sports = db.query(models.Sport).filter(models.Sport.active == True).all()

    async with httpx.AsyncClient() as client:
        tasks = []
        for s in active_sports:
            url = f"{BASE_URL}/{s.key}/odds/?regions=us,eu&markets=h2h,spreads,totals&apiKey={API_KEY}"
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
                    odds = models.Odds(event_id=item["id"], bookmaker=bm["title"], last_update=datetime.now(timezone.utc), markets_data=markets_obj)
                    db.add(odds)
                else:
                    odds.markets_data = markets_obj
                    odds.last_update = datetime.now(timezone.utc)
        except Exception: continue
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
                    # settlement logic here
                    pass
        return True
    except Exception: return False
