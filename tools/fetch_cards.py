#!/usr/bin/env python3
"""Build data/cards.json and download all 78 Rider-Waite-Smith card images
from Wikimedia Commons (public domain, 1910 deck scans) into public/cards/."""
import json
import os
import sys
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CARDS_JSON = os.path.join(ROOT, "data", "cards.json")
CARDS_DIR = os.path.join(ROOT, "public", "cards")

MAJORS = [
    ("fool", "The Fool", "00 The Fool",
     "A leap of faith into the unknown. The Fool stands at the edge of a cliff with only a small bag and a dog at his heels, ready to begin a journey full of possibility and innocent trust."),
    ("magician", "The Magician", "01 The Magician",
     "Manifestation and resourcefulness. With one hand raised to heaven and one pointing to earth, the Magician shows you already hold every tool needed to turn an idea into reality."),
    ("high-priestess", "The High Priestess", "02 The High Priestess",
     "Intuition, mystery, and inner knowledge. Seated between the black and white pillars, she guards the secrets that surface when you trust your instincts over what is obvious."),
    ("empress", "The Empress", "03 The Empress",
     "Abundance, fertility, and nurturing creativity. Surrounded by a lush garden and a field of wheat, she is the energy of growth, comfort, and natural plenty."),
    ("emperor", "The Emperor", "04 The Emperor",
     "Structure, authority, and discipline. Seated on his stone throne, he provides stability and order — the framework that turns chaos into something lasting."),
    ("hierophant", "The Hierophant", "05 The Hierophant",
     "Tradition, spiritual guidance, and shared wisdom. He is the bridge between the sacred and the everyday, offering teachings passed down through generations."),
    ("lovers", "The Lovers", "06 The Lovers",
     "Love, harmony, and a meaningful choice. More than romance, this card speaks of alignment — a decision made with the whole heart."),
    ("chariot", "The Chariot", "07 The Chariot",
     "Determination, willpower, and victory through focus. Two sphinxes pull in different directions, yet the charioteer keeps them both moving forward."),
    ("strength", "Strength", "08 Strength",
     "Courage, patience, and gentle mastery over instinct. The woman calmly closes the lion's jaws, showing that true power comes from compassion, not force."),
    ("hermit", "The Hermit", "09 The Hermit",
     "Solitude, introspection, and inner guidance. With his lantern raised high, he lights the way for anyone willing to look within for answers."),
    ("wheel-of-fortune", "Wheel of Fortune", "10 Wheel of Fortune",
     "Cycles, fate, and turning points. The wheel never stops spinning — what rises must fall — bringing change beyond your control but not beyond your understanding."),
    ("justice", "Justice", "11 Justice",
     "Fairness, truth, and consequence. With her scales and her sword, she reminds you that every choice carries a weight and every action has an answer."),
    ("hanged-man", "The Hanged Man", "12 The Hanged Man",
     "Surrender, new perspective, and letting go. Suspended upside down, he sees the world differently — sometimes you must pause in order to gain clarity."),
    ("death", "Death", "13 Death",
     "Transformation, endings, and rebirth. Not a literal death, but the necessary ending that clears the ground for something new to begin."),
    ("temperance", "Temperance", "14 Temperance",
     "Balance, moderation, and patient blending. The angel pours water between two cups, showing that harmony comes from mixing opposites in the right measure."),
    ("devil", "The Devil", "15 The Devil",
     "Bondage, materialism, and the shadow self. Chained to the pedestal, the figures could leave at any moment — the card asks what truly holds you back."),
    ("tower", "The Tower", "16 The Tower",
     "Sudden upheaval and revelation. Struck by lightning, the tower crumbles — false structures fall away and truth remains in the ashes."),
    ("star", "The Star", "17 The Star",
     "Hope, inspiration, and healing. Kneeling by the water, the figure pours life back into the world — a gentle promise that renewal follows hardship."),
    ("moon", "The Moon", "18 The Moon",
     "Illusion, fear, and the subconscious. The moon lights the path but distorts it — not everything in the dark is what it seems; trust your intuition."),
    ("sun", "The Sun", "19 The Sun",
     "Joy, success, and vitality. The sun shines over a walled garden where a child rides a white horse — pure, uncomplicated happiness."),
    ("judgement", "Judgement", "20 Judgement",
     "Rebirth, inner calling, and absolution. The angel's trumpet wakes the figures from their graves — a call to rise, answer, and begin again."),
    ("world", "The World", "21 The World",
     "Completion, integration, and wholeness. Dancing inside a laurel wreath, the figure has finished the great journey — achievement and the close of a cycle."),
]

SUITS = [
    ("wands", "Wands", "fire, action and creativity", [
        ("ace", "Ace of Wands", "01 (Ace)",
         "A spark of inspiration and raw creative potential. A hand emerges from the clouds holding a sprouting wand — the seed of a bold new venture."),
        ("02", "Two of Wands", "02",
         "Planning, decision, and looking toward the horizon. Standing on a castle battlement with a globe in hand, you weigh the world — the choice of where to go next is yours."),
        ("03", "Three of Wands", "03",
         "Expansion, foresight, and early success. Ships sail on the horizon while the merchant watches from the shore — your groundwork is beginning to pay off."),
        ("04", "Four of Wands", "04",
         "Celebration, harmony, and a milestone reached. A garlanded pavilion marks a happy occasion — homecoming, reunion, or a well-earned rest."),
        ("05", "Five of Wands", "05",
         "Conflict, competition, and clashing egos. Five figures swing their wands in a mock battle — disagreement tests you, but it need not defeat you."),
        ("06", "Six of Wands", "06",
         "Victory, recognition, and public success. Carried on shoulders through cheering crowds, the rider shows that effort is seen and rewarded."),
        ("07", "Seven of Wands", "07",
         "Defense, perseverance, and protecting your ground. From the hilltop you fend off attackers from above — you hold the advantage, so stand firm."),
        ("08", "Eight of Wands", "08",
         "Speed, swift action, and rapid movement. Eight wands fly through the air like arrows — a message, project, or change arriving faster than expected."),
        ("09", "Nine of Wands", "09",
         "Resilience, grit, and the last stand. Wounded but watchful, you lean on your wand — tired, perhaps, but nearly there. Keep going."),
        ("10", "Ten of Wands", "10",
         "Burden, responsibility, and overwhelm. Carrying all ten wands at once, you struggle forward — success can become a weight when you carry it alone."),
        ("page", "Page of Wands", "11 (Page)",
         "Curiosity, exploration, and a burst of creative energy. The page gazes at his wand like a messenger bearing exciting news — a new passion to pursue."),
        ("knight", "Knight of Wands", "12 (Knight)",
         "Impulsiveness, adventure, and charging ahead. The knight rides off in search of quests — bold, passionate action, sometimes without a plan."),
        ("queen", "Queen of Wands", "13 (Queen)",
         "Confidence, warmth, and independent determination. Seated with her wand, she is fire made steady — a charismatic presence who inspires everyone around her."),
        ("king", "King of Wands", "14 (King)",
         "Vision, leadership, and mastery of fire. The king holds his wand like a scepter — bold ideas executed with the authority of hard-won experience."),
    ]),
    ("cups", "Cups", "water, emotion and relationships", [
        ("ace", "Ace of Cups", "01 (Ace)",
         "An overflowing cup of new love, joy, and emotional beginnings. A hand from the clouds offers a vessel brimming with feeling — a fresh start of the heart."),
        ("02", "Two of Cups", "02",
         "Partnership, mutual attraction, and union. Two figures exchange cups face to face — a meaningful connection built on equality and affection."),
        ("03", "Three of Cups", "03",
         "Friendship, community, and shared celebration. Three women raise their cups in a joyful gathering — togetherness and collective happiness."),
        ("04", "Four of Cups", "04",
         "Apathy, contemplation, and a missed opportunity. Seated under a tree, the figure ignores the cup offered from a cloud — sometimes you must look up to see what is being given."),
        ("05", "Five of Cups", "05",
         "Loss, grief, and dwelling on what is gone. Kneeling before three spilled cups, the figure mourns — but two cups still stand behind him. Not all is lost."),
        ("06", "Six of Cups", "06",
         "Nostalgia, childhood memory, and innocent joy. Children fill their cups in a garden — a return to simpler times and pure, uncomplicated happiness."),
        ("07", "Seven of Cups", "07",
         "Choices, fantasy, and wishful thinking. Seven cups drift in the clouds, each holding a vision — dreams are abundant, but only one can become real."),
        ("08", "Eight of Cups", "08",
         "Walking away, deeper meaning, and leaving the familiar. The figure departs at night with six cups behind — sometimes growth means leaving what is comfortable."),
        ("09", "Nine of Cups", "09",
         "Contentment, satisfaction, and a wish fulfilled. Arms crossed before nine full cups, the figure savours the quiet joy of having enough."),
        ("10", "Ten of Cups", "10",
         "Lasting harmony, love, and emotional fulfillment. A rainbow arcs over a family dancing together — deep belonging and a happy home."),
        ("page", "Page of Cups", "11 (Page)",
         "Creativity, intuition, and a gentle new message. The page gazes at the fish in his cup — a sensitive soul receiving emotional or artistic inspiration."),
        ("knight", "Knight of Cups", "12 (Knight)",
         "Romance, charm, and following the heart. The knight rides a white horse bearing a cup — an offer of love, or a creative pursuit chased with idealism."),
        ("queen", "Queen of Cups", "13 (Queen)",
         "Compassion, emotional maturity, and deep intuition. Seated by the sea with her cup, she is a nurturing, empathic presence who feels more than she says."),
        ("king", "King of Cups", "14 (King)",
         "Emotional balance, diplomacy, and mastery of feelings. Ruling the waves from his throne, he is calm control over deep waters — generous, wise, and kind."),
    ]),
    ("swords", "Swords", "air, intellect and truth", [
        ("ace", "Ace of Swords", "01 (Ace)",
         "A breakthrough of clarity and a piercing new idea. The hand from the clouds raises a sword crowned with laurels — the triumph of the mind."),
        ("02", "Two of Swords", "02",
         "Indecision, difficult choices, and stalemate. Blindfolded and balancing two crossed blades, the figure shows that the hardest choice is often the one you avoid."),
        ("03", "Three of Swords", "03",
         "Heartbreak, sorrow, and painful truth. A storm rages over a heart pierced by three swords — grief that is real, but not forever."),
        ("04", "Four of Swords", "04",
         "Rest, recovery, and quiet contemplation. The figure lies in peaceful repose — a necessary pause that restores your strength."),
        ("05", "Five of Swords", "05",
         "Conflict, hollow victory, and winning at a cost. The victor gathers swords while others retreat — a win that can leave you poorer than before."),
        ("06", "Six of Swords", "06",
         "Transition, moving on, and leaving turmoil behind. A ferryman carries passengers toward calm waters — a journey toward healing and a gentler shore."),
        ("07", "Seven of Swords", "07",
         "Strategy, deception, and slipping away. The figure creeps off with five swords, leaving two behind — sometimes you must act quietly to get what you need."),
        ("08", "Eight of Swords", "08",
         "Restriction, negative thoughts, and feeling trapped. Bound and blindfolded before eight swords, the figure reminds you that the cage is often one you build yourself."),
        ("09", "Nine of Swords", "09",
         "Anxiety, worry, and sleepless nights. Sitting up in bed with nine swords on the wall, the figure shows how fear looms largest in the dark."),
        ("10", "Ten of Swords", "10",
         "Painful endings, deep wounds, and rock bottom. Pierced by ten swords at dawn — the darkest moment right before the light returns."),
        ("page", "Page of Swords", "11 (Page)",
         "Vigilance, curiosity, and a sharp new idea. The page raises his sword — an eager mind hunting for truth and fresh perspectives."),
        ("knight", "Knight of Swords", "12 (Knight)",
         "Ambition, action, and charging into battle. The knight gallops with his sword raised — swift and decisive, and sometimes reckless."),
        ("queen", "Queen of Swords", "13 (Queen)",
         "Independence, clear boundaries, and honest intellect. Seated among the clouds with her sword, she is uncompromising truth — perceptive, fair, and direct."),
        ("king", "King of Swords", "14 (King)",
         "Authority, truth, and intellectual power. The king lifts his sword to the sky — reason and justice wielded with a steady, incorruptible hand."),
    ]),
    ("pentacles", "Pentacles", "earth, material world and work", [
        ("ace", "Ace of Pentacles", "01 (Ace)",
         "A new financial opportunity and a material beginning. The hand from the cloud offers a golden pentacle — prosperity and security taking root."),
        ("02", "Two of Pentacles", "02",
         "Balance, adaptability, and juggling priorities. The figure dances with two pentacles linked by an infinity ribbon — keeping many things in motion at once."),
        ("03", "Three of Pentacles", "03",
         "Teamwork, craftsmanship, and collaboration. The mason carves a cathedral arch while his client looks on — skill recognized and rewarded through cooperation."),
        ("04", "Four of Pentacles", "04",
         "Security, control, and holding on tightly. Pentacles clutched to crown, hands, and feet give stability — but at the cost of openness."),
        ("05", "Five of Pentacles", "05",
         "Hardship, loss, and feeling left out in the cold. Two figures pass a lit window in the snow — struggle is real, but shelter and help exist if you ask for them."),
        ("06", "Six of Pentacles", "06",
         "Generosity, giving, and fair exchange. The merchant weighs coins on his scales, giving to those in need — charity and balanced reciprocity."),
        ("07", "Seven of Pentacles", "07",
         "Patience, long-term view, and assessing progress. The farmer leans on his staff, surveying vines heavy with fruit — hard work is growing, but the harvest is not yet in."),
        ("08", "Eight of Pentacles", "08",
         "Apprenticeship, skill, and diligent practice. The artisan carves pentacles one by one — mastery comes from focused, repeated effort."),
        ("09", "Nine of Pentacles", "09",
         "Luxury, self-sufficiency, and enjoying the fruits of labor. The woman walks her vineyard with a hooded falcon — independence and refined comfort."),
        ("10", "Ten of Pentacles", "10",
         "Wealth, inheritance, and lasting legacy. A family beneath an archway of pentacles — prosperity shared across generations."),
        ("page", "Page of Pentacles", "11 (Page)",
         "Ambition, practicality, and a new opportunity. The page studies his pentacle — a grounded approach to manifesting material goals."),
        ("knight", "Knight of Pentacles", "12 (Knight)",
         "Hard work, routine, and dependable progress. The knight rides slowly across fertile fields — steady, methodical effort that reliably gets results."),
        ("queen", "Queen of Pentacles", "13 (Queen)",
         "Nurturing, practicality, and abundant comfort. Seated in her lush garden, she is a generous provider of material and emotional security."),
        ("king", "King of Pentacles", "14 (King)",
         "Success, abundance, and material mastery. The king on his throne, the bull's head on his pedestal — wealth and business acumen at their peak."),
    ]),
]


def build_cards():
    cards = []
    for slug, title, commons_name, desc in MAJORS:
        cards.append({
            "id": slug,
            "title": title,
            "arcana": "Major Arcana",
            "image": f"cards/{slug}.png",
            "description": desc,
            "_commons": f"RWS Tarot 1910 - {commons_name}.png",
        })
    for suit, suit_name, _element, members in SUITS:
        for slug, title, num, desc in members:
            cid = f"{suit}-{slug}"
            cards.append({
                "id": cid,
                "title": title,
                "arcana": suit_name,
                "image": f"cards/{cid}.png",
                "description": desc,
                "_commons": f"RWS Tarot 1910 - {suit_name} {num}.png",
            })
    return cards


def commons_imageinfo(titles):
    """Return {title: thumburl} for the given File: titles (batched)."""
    result = {}
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        params = {
            "action": "query",
            "format": "json",
            "prop": "imageinfo",
            "iiprop": "url",
            "iiurlwidth": "640",
            "titles": "|".join("File:" + t for t in batch),
        }
        url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"User-Agent": "tarot-gallery-demo/1.0 (educational)"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.load(r)
        for page in data.get("query", {}).get("pages", {}).values():
            title = page.get("title", "").replace("File:", "", 1)
            ii = page.get("imageinfo", [{}])[0]
            result[title] = ii.get("thumburl") or ii.get("url")
    return result


def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "tarot-gallery-demo/1.0 (educational)"})
    with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
        f.write(r.read())


def main():
    cards = build_cards()
    assert len(cards) == 78, f"expected 78 cards, got {len(cards)}"

    os.makedirs(CARDS_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(CARDS_JSON), exist_ok=True)

    titles = [c["_commons"] for c in cards]
    print(f"Resolving {len(titles)} file URLs on Wikimedia Commons...")
    urls = commons_imageinfo(titles)

    missing = [t for t in titles if t not in urls]
    if missing:
        print("MISSING:", missing, file=sys.stderr)
        sys.exit(1)

    ok = 0
    for c in cards:
        dest = os.path.join(CARDS_DIR, c["id"] + ".png")
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            ok += 1
            continue
        download(urls[c["_commons"]], dest)
        ok += 1
        print(f"[{ok}/78] {c['id']}.png  <-  {c['_commons']}")

    for c in cards:
        c.pop("_commons")
    with open(CARDS_JSON, "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)
    print(f"Done. {ok} images in {CARDS_DIR}, data in {CARDS_JSON}")


if __name__ == "__main__":
    main()
