"""Clean the SIH 2026 problem statements CSV into data/problems.json for the dashboard.

Source: Kaggle "SIH 2026 Problem Statements Dataset" (riteshmaurya86), compiled from the
official Smart India Hackathon 2026 portal. 226 rows, 8 columns.

Cleaning (documented so the dashboard's numbers can be checked):
  - Organization names: merge duplicates ("AICTE" and "All India Council for Technical
    Education (AICTE)") and fix typos ("Governmcnt of Jharkhand").
  - Titles: the source has OCR-style typos where "AI" became "Al" ("Al-Based ..."); fixed.
  - Dropped columns that are constant: "Submitted Idea(s) Count" (always 0/500) and
    "Deadline for Idea Submission" (always 20 September 2026).
  - Added, derived from the title (not from the theme label):
      generic  - AICTE's placeholder rows titled just "Student Innovation"
      tech     - technology tags (AI, IoT, Blockchain, ...)
      health   - the problem is about human health or healthcare
      mislabel - health problem filed outside the MedTech theme, or a MedTech-themed
                 problem that isn't about health

Usage:  python3 scripts/prepare.py
"""
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "sih2026.csv"
OUT = ROOT / "data" / "problems.json"

ORG_FIX = {
    "All India Council for Technical Education (AICTE)": "AICTE",
    "Governmcnt of Jharkhand": "Government of Jharkhand",
    "Government Of Maharashtra": "Government of Maharashtra",
    "Indian Space Research Organisation(ISRO)": "Indian Space Research Organisation (ISRO)",
}
# Short labels for charts
ORG_SHORT = {
    "Ministry of Earth Sciences (MoES)": "MoES",
    "National Technical Research Organisation (NTRO)": "NTRO",
    "Indian Space Research Organisation (ISRO)": "ISRO",
    "Ministry of Consumer Affairs, Food & Public Distribution": "Consumer Affairs",
    "Ministry of Social Justice and Empowerment (MoSJE)": "Social Justice (MoSJE)",
    "Ministry of Development of North Eastern Region (MDoNER)": "MDoNER",
    "Ministry of Fisheries, Animal Husbandry & Dairying": "Fisheries & Dairying",
    "Mangalore Refinery and Petrochemicals Limited (MRPL)": "MRPL",
    "Ministry of Petroleum & Natural Gas": "Petroleum & Gas",
}

TECH = {  # tag: regex on the lower-cased, cleaned title
    "AI / ML": r"\bai\b|\bai-|artificial intelligence|machine learning|\bml\b|deep learning|neural|predict",
    "IoT & sensors": r"\biot\b|sensor|smart meter|embedded",
    "Drones & robotics": r"drone|uav|robot",
    "Space & satellite": r"satellite|space|remote sensing|isro|gnss",
    "Blockchain": r"blockchain",
    "Cybersecurity": r"cyber|security|fraud|phishing|malware|deepfake",
    "AR / VR": r"\bar\b|\bvr\b|augmented|virtual reality|metaverse",
    "Digital twin": r"digital twin",
    "Quantum": r"quantum",
}
HEALTH = re.compile(r"health|medical|medic|patient|clinic|hospital|dementia|\bmental|rehabilit|"
                    r"disease|ayush|therapy|diagnos|elderly|disab|stress|welfare monitoring|wellness|arthrit|osteo|cancer|"
                    r"nutrition|maternal|vaccin|blood|cardi|diabet|surgery|surgical|ayurved|yoga")
NOT_HUMAN_HEALTH = re.compile(r"crop|pest|livestock|animal|fault prediction|mission|soil")


def clean_title(t: str) -> str:
    t = re.sub(r"\bAl(?=[- ](Based|Assisted|Powered|Enabled|Driven))", "AI", t)
    t = re.sub(r"\s*,\s*", ", ", t)
    return t.strip()


def main():
    rows = list(csv.DictReader(SRC.open(encoding="utf-8-sig")))
    out = []
    for r in rows:
        org = ORG_FIX.get(r["Organization"], r["Organization"])
        title = clean_title(r["Problem Statement Title"])
        low = title.lower()
        generic = low == "student innovation"
        health = bool(HEALTH.search(low)) and not NOT_HUMAN_HEALTH.search(low)
        medtech = r["Theme"].startswith("MedTech")
        out.append({
            "id": r["PS Number"],
            "title": title,
            "org": org,
            "org_short": ORG_SHORT.get(org, org.replace("Ministry of ", "")),
            "category": r["Category"],
            "theme": r["Theme"],
            "generic": generic,
            "tech": [tag for tag, rx in TECH.items() if re.search(rx, low)],
            "health": health,
            "mislabel": (not generic) and (health != medtech),
        })
    meta = {
        "source": "Kaggle: riteshmaurya86/sih-2026-problem-statements-dataset (official SIH 2026 portal)",
        "rows": len(out),
        "deadline": rows[0]["Deadline for Idea Submission"],
        "ideas_limit": rows[0]["Submitted Idea(s) Count"].split("/")[-1],
    }
    OUT.write_text(json.dumps({"meta": meta, "problems": out}, indent=1, ensure_ascii=False))
    print(f"wrote {OUT} ({len(out)} rows)")
    print("health:", sum(p["health"] for p in out), "mislabel:", sum(p["mislabel"] for p in out),
          "generic:", sum(p["generic"] for p in out))


if __name__ == "__main__":
    main()
