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

# Structured categories for UI and API
SPORTS_STRUCTURE = {
    "⚽ Fútbol": [
        ("soccer_epl", "Premier League"),
        ("soccer_spain_la_liga", "LaLiga"),
        ("soccer_italy_serie_a", "Serie A"),
        ("soccer_germany_bundesliga", "Bundesliga"),
        ("soccer_france_ligue_one", "Ligue 1"),
        ("soccer_uefa_champs_league", "Champions League"),
        ("soccer_international", "Selecciones / Torneos")
    ],
    "🏀 Baloncesto": [
        ("basketball_nba", "NBA"),
        ("basketball_ncaab", "NCAA"),
        ("basketball_euroleague", "Euroliga")
    ],
    "🎾 Tenis": [
        ("tennis_atp", "ATP"),
        ("tennis_wta", "WTA"),
        ("tennis_itf_men", "ITF Men"),
        ("tennis_itf_women", "ITF Women")
    ],
    "🏒 Hockey": [
        ("icehockey_nhl", "NHL"),
        ("icehockey_sweden_allsvenskan", "Allsvenskan"),
        ("icehockey_finland_mestis", "Mestis")
    ],
    "🏈 Fútbol Am.": [
        ("americanfootball_nfl", "NFL"),
        ("americanfootball_ncaaf", "NCAAF")
    ],
    "⚾ Béisbol": [
        ("baseball_mlb", "MLB"),
        ("baseball_npb", "NPB"),
        ("baseball_kbo", "KBO")
    ],
    "🏎️ Motor": [
        ("motorsport_formula1", "F1"),
        ("motorsport_moto_gp", "MotoGP")
    ],
    "🥊 Combate": [
        ("mma_mixed_martial_arts", "MMA"),
        ("boxing", "Boxeo")
    ],
    "🏇 Carreras": [
        ("horse_racing", "Caballos"),
        ("greyhound_racing", "Galgos")
    ],
    "🎮 eSports": [
        ("esports_csgo", "CS2 / CS:GO"),
        ("esports_dota2", "Dota 2"),
        ("esports_league_of_legends", "LoL"),
        ("esports_valorant", "Valorant")
    ],
    "🧠 Otros": [
        ("golf_pga", "PGA Golf"),
        ("rugby_union", "Rugby Union"),
        ("rugby_league", "Rugby League"),
        ("cricket_international", "Cricket"),
        ("darts", "Dardos"),
        ("snooker", "Snooker")
    ]
}

async def fetch_and_update_odds(db):
    if not API_KEY: return False

    # Collect all unique keys from structure
    all_keys = []
    for cat in SPORTS_STRUCTURE.values():
        for key, name in cat:
            all_keys.append(key)

    async with httpx.AsyncClient() as client:
        tasks = []
        for sport in all_keys:
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
                    settle_bets(db, response.json())
        return True
    except Exception: return False

def settle_bets(db, results):
    # Simplified settlement
    pass
