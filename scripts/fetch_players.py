"""
Sports Guesser — data fetcher.

Pulls CURRENT rosters for NBA, NFL, and MLB from ESPN's free public API and
writes them into ../data/<sport>.js as plain JS files the game can load with a
<script> tag (so the app works by just opening index.html — no server needed).

Re-run this whenever you want to refresh rosters:
    python3 scripts/fetch_players.py
"""

import json
import os
import sys
import time
import urllib.request

# Where to write the data files (../data relative to this script)
HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "..", "data")

# ESPN API path + the JS variable name for each sport
SPORTS = {
    "nba": {"path": "basketball/nba", "var": "NBA_PLAYERS"},
    "nfl": {"path": "football/nfl", "var": "NFL_PLAYERS"},
    "mlb": {"path": "baseball/mlb", "var": "MLB_PLAYERS"},
}

# Conference/Division by team NICKNAME (stable, rarely changes).
# For MLB, "conference" holds the league (AL / NL).
DIVISIONS = {
    "nba": {
        "Celtics": ("Eastern", "Atlantic"), "Nets": ("Eastern", "Atlantic"),
        "Knicks": ("Eastern", "Atlantic"), "76ers": ("Eastern", "Atlantic"),
        "Raptors": ("Eastern", "Atlantic"),
        "Bulls": ("Eastern", "Central"), "Cavaliers": ("Eastern", "Central"),
        "Pistons": ("Eastern", "Central"), "Pacers": ("Eastern", "Central"),
        "Bucks": ("Eastern", "Central"),
        "Hawks": ("Eastern", "Southeast"), "Hornets": ("Eastern", "Southeast"),
        "Heat": ("Eastern", "Southeast"), "Magic": ("Eastern", "Southeast"),
        "Wizards": ("Eastern", "Southeast"),
        "Nuggets": ("Western", "Northwest"), "Timberwolves": ("Western", "Northwest"),
        "Thunder": ("Western", "Northwest"), "Trail Blazers": ("Western", "Northwest"),
        "Jazz": ("Western", "Northwest"),
        "Warriors": ("Western", "Pacific"), "Clippers": ("Western", "Pacific"),
        "Lakers": ("Western", "Pacific"), "Suns": ("Western", "Pacific"),
        "Kings": ("Western", "Pacific"),
        "Mavericks": ("Western", "Southwest"), "Rockets": ("Western", "Southwest"),
        "Grizzlies": ("Western", "Southwest"), "Pelicans": ("Western", "Southwest"),
        "Spurs": ("Western", "Southwest"),
    },
    "nfl": {
        "Bills": ("AFC", "East"), "Dolphins": ("AFC", "East"),
        "Patriots": ("AFC", "East"), "Jets": ("AFC", "East"),
        "Ravens": ("AFC", "North"), "Bengals": ("AFC", "North"),
        "Browns": ("AFC", "North"), "Steelers": ("AFC", "North"),
        "Texans": ("AFC", "South"), "Colts": ("AFC", "South"),
        "Jaguars": ("AFC", "South"), "Titans": ("AFC", "South"),
        "Broncos": ("AFC", "West"), "Chiefs": ("AFC", "West"),
        "Raiders": ("AFC", "West"), "Chargers": ("AFC", "West"),
        "Cowboys": ("NFC", "East"), "Giants": ("NFC", "East"),
        "Eagles": ("NFC", "East"), "Commanders": ("NFC", "East"),
        "Bears": ("NFC", "North"), "Lions": ("NFC", "North"),
        "Packers": ("NFC", "North"), "Vikings": ("NFC", "North"),
        "Falcons": ("NFC", "South"), "Panthers": ("NFC", "South"),
        "Saints": ("NFC", "South"), "Buccaneers": ("NFC", "South"),
        "Cardinals": ("NFC", "West"), "Rams": ("NFC", "West"),
        "49ers": ("NFC", "West"), "Seahawks": ("NFC", "West"),
    },
    "mlb": {
        "Orioles": ("AL", "East"), "Red Sox": ("AL", "East"),
        "Yankees": ("AL", "East"), "Rays": ("AL", "East"), "Blue Jays": ("AL", "East"),
        "White Sox": ("AL", "Central"), "Guardians": ("AL", "Central"),
        "Tigers": ("AL", "Central"), "Royals": ("AL", "Central"), "Twins": ("AL", "Central"),
        "Astros": ("AL", "West"), "Angels": ("AL", "West"),
        "Athletics": ("AL", "West"), "Mariners": ("AL", "West"), "Rangers": ("AL", "West"),
        "Braves": ("NL", "East"), "Marlins": ("NL", "East"),
        "Mets": ("NL", "East"), "Phillies": ("NL", "East"), "Nationals": ("NL", "East"),
        "Cubs": ("NL", "Central"), "Reds": ("NL", "Central"),
        "Brewers": ("NL", "Central"), "Pirates": ("NL", "Central"), "Cardinals": ("NL", "Central"),
        "Diamondbacks": ("NL", "West"), "Rockies": ("NL", "West"),
        "Dodgers": ("NL", "West"), "Padres": ("NL", "West"), "Giants": ("NL", "West"),
    },
}

BASE = "https://site.api.espn.com/apis/site/v2/sports"


def get_json(url):
    """Fetch a URL and parse JSON, pretending to be a normal browser."""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def to_int(value):
    """Turn '5' or 5.0 into 5; return None if not possible."""
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def iter_athletes(roster):
    """Yield individual players.

    NBA gives a flat list of players. NFL/MLB group them under position
    buckets like {"position": "offense", "items": [...]}. Handle both.
    """
    for entry in roster.get("athletes", []):
        if isinstance(entry, dict) and "items" in entry:
            for player in entry["items"]:
                yield player
        else:
            yield entry


def fetch_sport(sport):
    cfg = SPORTS[sport]
    div_map = DIVISIONS[sport]

    # 1) Get the list of teams (id + nickname) for this sport.
    teams_url = f"{BASE}/{cfg['path']}/teams"
    data = get_json(teams_url)
    teams = data["sports"][0]["leagues"][0]["teams"]

    players = []
    for entry in teams:
        team = entry["team"]
        team_id = team["id"]
        nickname = team.get("name", "")          # e.g. "Lakers"
        team_full = team.get("displayName", "")   # e.g. "Los Angeles Lakers"
        conference, division = div_map.get(nickname, ("", ""))

        # 2) Get this team's current roster.
        roster_url = f"{BASE}/{cfg['path']}/teams/{team_id}/roster"
        try:
            roster = get_json(roster_url)
        except Exception as err:
            print(f"  ! skipped {team_full}: {err}")
            continue

        team_count = 0
        for a in iter_athletes(roster):
            position = a.get("position") or {}
            pos = position.get("abbreviation", "")
            # Broad position group, e.g. Relief Pitcher -> "P" (used for "related" orange).
            pos_group = (position.get("parent") or {}).get("abbreviation", "") or pos
            bats = (a.get("bats") or {}).get("abbreviation", "") if isinstance(a.get("bats"), dict) else ""
            throws = (a.get("throws") or {}).get("abbreviation", "") if isinstance(a.get("throws"), dict) else ""
            players.append({
                "id": str(a.get("id", "")),
                "name": a.get("fullName", ""),
                "team": nickname,
                "teamFull": team_full,
                "conference": conference,
                "division": division,
                "position": pos,
                "posGroup": pos_group,
                "height": to_int(a.get("height")),       # inches
                "heightDisplay": a.get("displayHeight", ""),
                "age": to_int(a.get("age")),
                "jersey": to_int(a.get("jersey")),
                "weight": to_int(a.get("weight")),
                "bats": bats,      # MLB only: R / L / S
                "throws": throws,  # MLB only: R / L
                "college": (a.get("college") or {}).get("name", "") if isinstance(a.get("college"), dict) else "",
            })
            team_count += 1
        print(f"  {team_full}: {team_count} players")
        time.sleep(0.2)  # be polite to ESPN

    return players


def write_js(sport, players):
    var = SPORTS[sport]["var"]
    out_path = os.path.join(DATA_DIR, f"{sport}.js")
    body = json.dumps(players, indent=2, ensure_ascii=False)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(f"// Auto-generated by scripts/fetch_players.py — do not edit by hand.\n")
        f.write(f"// {len(players)} current {sport.upper()} players.\n")
        f.write(f"const {var} = {body};\n")
    print(f"  -> wrote {len(players)} players to data/{sport}.js")


STATS_BASE = "https://site.web.api.espn.com/apis/common/v3/sports"


def fetch_stats(path):
    """Return {athlete_id: {gamesPlayed, avgMinutes}} for the regular season.

    This is how we keep only players who actually contributed (known players)
    instead of every deep-bench / practice-squad name.
    """
    stats = {}
    page, pages = 1, 1
    while page <= pages:
        url = (
            f"{STATS_BASE}/{path}/statistics/byathlete"
            f"?region=us&lang=en&contentorigin=espn&isqualified=false&seasontype=2&page={page}&limit=200"
        )
        try:
            data = get_json(url)
        except Exception as err:
            print(f"  ! stats fetch error: {err}")
            break
        pages = data.get("pagination", {}).get("pages", 1)
        cats = data.get("categories", [])
        # Locate gamesPlayed / avgMinutes within the per-athlete category arrays.
        loc = {}
        for c in cats:
            for vi, n in enumerate(c.get("names") or []):
                loc.setdefault(n, (c.get("name"), vi))
        for a in data.get("athletes", []):
            aid = str(a.get("athlete", {}).get("id"))
            acats = {ac.get("name"): (ac.get("values") or []) for ac in a.get("categories", [])}

            def stat(name):
                if name not in loc:
                    return None
                cname, vi = loc[name]
                vals = acats.get(cname, [])
                return vals[vi] if vi < len(vals) else None

            stats[aid] = {"gamesPlayed": stat("gamesPlayed"), "avgMinutes": stat("avgMinutes")}
        page += 1
        time.sleep(0.1)
    return stats


# Keep a player only if they meet the "known / contributor" bar for their sport.
# (player, stats) -> bool. NFL is limited to skill positions (QB/RB/WR/TE).
NFL_SKILL = ("QB", "RB", "WR", "TE")
KNOWN = {
    "nba": lambda p, s: (s.get("avgMinutes") or 0) >= 12 and (s.get("gamesPlayed") or 0) >= 10,
    "nfl": lambda p, s: p.get("position") in NFL_SKILL and (s.get("gamesPlayed") or 0) >= 8,
    "mlb": lambda p, s: (s.get("gamesPlayed") or 0) >= 25,
}


def main():
    # Allow: python3 fetch_players.py nba   (one sport)  or  no args (all sports)
    wanted = sys.argv[1:] or list(SPORTS.keys())
    for sport in wanted:
        if sport not in SPORTS:
            print(f"Unknown sport '{sport}'. Choose from: {', '.join(SPORTS)}")
            continue
        print(f"\n=== {sport.upper()} ===")
        players = fetch_sport(sport)
        print("  fetching season stats to keep known players…")
        stats = fetch_stats(SPORTS[sport]["path"])
        keep = KNOWN[sport]
        before = len(players)
        players = [p for p in players if keep(p, stats.get(p["id"], {}))]
        print(f"  known-player filter: {before} -> {len(players)}")
        write_js(sport, players)
    print("\nDone.")


if __name__ == "__main__":
    main()
