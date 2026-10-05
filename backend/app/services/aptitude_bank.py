"""Templated aptitude questions with computed answers: always correct, unlimited, no AI cost.

Each generator returns the correct value and plausible wrong values built from common mistakes.
`params` keeps the inputs so tests can recompute every answer independently.
"""

from __future__ import annotations

import math
import random
import string
from collections.abc import Callable
from fractions import Fraction

Item = dict


def num(x: float | Fraction) -> str:
    """Format a number the way an aptitude test would print it."""
    if isinstance(x, Fraction):
        return str(x.numerator) if x.denominator == 1 else f"{x.numerator}/{x.denominator}"
    if abs(x - round(x)) < 1e-9:
        return f"{round(x):,}"
    return f"{x:,.2f}".rstrip("0").rstrip(".")


def _options(rng: random.Random, correct: str, wrong: list[str],
             fill: Callable[[int], str]) -> tuple[dict, str]:
    """Four distinct options with the correct one at a random letter."""
    choices = [correct]
    for w in wrong:
        if w not in choices:
            choices.append(w)
        if len(choices) == 4:
            break
    k = 1
    while len(choices) < 4:
        candidate = fill(k)
        if candidate not in choices:
            choices.append(candidate)
        k += 1
    rng.shuffle(choices)
    letters = dict(zip("ABCD", choices, strict=True))
    answer = next(key for key, v in letters.items() if v == correct)
    return letters, answer


def _item(rng, section, topic, question, correct, wrong, fill, explanation, params) -> Item:
    options, answer = _options(rng, correct, wrong, fill)
    return {"section": section, "topic": topic, "question": question, "passage": None, "options": options,
            "answer": answer, "explanation": explanation, "params": params, "source": "template"}


# ---------------------------------------------------------------- quantitative
def percent_change(rng: random.Random, level: int) -> Item:
    price = rng.choice([200, 400, 500, 800, 1000, 1200, 2000])
    up = rng.choice([10, 20, 25, 30, 40, 50])
    down = rng.choice([10, 20, 25, 40] if level > 1 else [10, 20])
    final = price * (100 + up) * (100 - down) / 10000
    return _item(
        rng, "quant", "Percentages",
        f"A product costs ${price}. Its price is raised by {up}% and then the new price is cut by {down}%. "
        "What is the final price?",
        f"${num(final)}",
        [f"${num(price * (100 + up - down) / 100)}", f"${num(price * (100 + up) / 100)}",
         f"${num(price * (100 - down) / 100)}"],
        lambda k: f"${num(final + 10 * k)}",
        f"Successive changes multiply: {price} × {1 + up / 100:g} × {1 - down / 100:g} = {num(final)}. "
        "Adding and subtracting the percentages is the common mistake.",
        {"price": price, "up": up, "down": down},
    )


def ratio_share(rng: random.Random, level: int) -> Item:
    pairs = [(2, 3), (3, 5), (4, 5), (5, 7), (3, 4), (7, 9)] if level > 1 else [(1, 2), (2, 3), (3, 4)]
    m, n = rng.choice(pairs)
    total = (m + n) * rng.choice([20, 40, 50, 100, 150])
    share = total * n // (m + n)
    return _item(
        rng, "quant", "Ratio and proportion",
        f"${total:,} is shared between A and B in the ratio {m}:{n}. How much does B receive?",
        f"${share:,}",
        [f"${total * m // (m + n):,}", f"${total // 2:,}", f"${round(total * n / max(m, 1)):,}"],
        lambda k: f"${share + 10 * k:,}",
        f"B gets {n}/{m + n} of the total: {total} × {n}/{m + n} = {share}.",
        {"total": total, "m": m, "n": n},
    )


def average_removed(rng: random.Random, level: int) -> Item:
    count = rng.choice([5, 6, 8, 10] if level > 1 else [4, 5])
    new_avg = rng.randint(10, 60)
    removed = rng.randint(5, 90)
    avg = Fraction(new_avg * (count - 1) + removed, count)
    while avg.denominator != 1:
        removed += 1
        avg = Fraction(new_avg * (count - 1) + removed, count)
    return _item(
        rng, "quant", "Averages",
        f"The average of {count} numbers is {avg}. If the number {removed} is removed, what is the average "
        "of the remaining numbers?",
        num(new_avg),
        [num(float(avg - Fraction(removed, count))), num(avg), num((int(avg) * count - removed) / count)],
        lambda k: num(new_avg + k),
        f"Sum = {count} × {avg} = {int(avg) * count}. Remove {removed}: {int(avg) * count - removed}. "
        f"Divide by {count - 1}: {new_avg}.",
        {"count": count, "avg": int(avg), "removed": removed},
    )


def train_pole(rng: random.Random, level: int) -> Item:
    speed = rng.choice([36, 54, 72, 90, 108])  # km/h, multiples of 18 so m/s is an integer
    seconds = rng.choice([6, 8, 9, 10, 12, 15, 18, 20])
    length = speed * 5 // 18 * seconds
    if level > 1:
        platform = rng.choice([100, 150, 200, 250, 300])
        total_s = Fraction(length + platform, speed * 5 // 18)
        while total_s.denominator != 1:
            platform += 10
            total_s = Fraction(length + platform, speed * 5 // 18)
        return _item(
            rng, "quant", "Time, speed and distance",
            f"A {length} m long train runs at {speed} km/h. How many seconds does it take to cross a "
            f"{platform} m long platform?",
            num(total_s),
            [num(seconds), num(platform / (speed * 5 // 18)), num((length + platform) / speed)],
            lambda k: num(total_s + 2 * k),
            f"{speed} km/h = {speed * 5 // 18} m/s. Distance = train + platform = {length + platform} m. "
            f"Time = {length + platform} ÷ {speed * 5 // 18} = {total_s} s.",
            {"length": length, "speed": speed, "platform": platform},
        )
    return _item(
        rng, "quant", "Time, speed and distance",
        f"A {length} m long train runs at {speed} km/h. How many seconds does it take to pass a pole?",
        num(seconds),
        [num(length / speed), num(seconds * 2), num(length * 18 / speed / 5 / 5)],
        lambda k: num(seconds + k),
        f"{speed} km/h = {speed} × 5/18 = {speed * 5 // 18} m/s, "
        f"so {length} ÷ {speed * 5 // 18} = {seconds} s.",
        {"length": length, "speed": speed, "platform": 0},
    )


def work_together(rng: random.Random, level: int) -> Item:
    a, b = rng.choice([(6, 3), (12, 6), (10, 15), (20, 30), (12, 4), (18, 9), (24, 8), (30, 20)]
                      if level > 1 else [(6, 3), (12, 6), (12, 4)])
    together = Fraction(a * b, a + b)
    return _item(
        rng, "quant", "Time and work",
        f"A can finish a job in {a} days and B can finish it in {b} days. Working together, how many days "
        "do they take?",
        num(together),
        [num((a + b) / 2), num(a + b), num(abs(a - b))],
        lambda k: num(together + k),
        f"Together they do 1/{a} + 1/{b} = {Fraction(1, a) + Fraction(1, b)} of the job per day, "
        f"so they need {together} days.",
        {"a": a, "b": b},
    )


def profit_percent(rng: random.Random, level: int) -> Item:
    cost = rng.choice([200, 300, 400, 500, 800, 1000, 1200])  # multiples of 100 keep the price exact
    pct = rng.choice([10, 20, 25, 40, 50] if level > 1 else [10, 20, 50])
    loss = level > 1 and rng.random() < 0.4
    sell = cost * (100 - pct) // 100 if loss else cost * (100 + pct) // 100
    word = "loss" if loss else "profit"
    return _item(
        rng, "quant", "Profit and loss",
        f"An item bought for ${cost} is sold for ${sell}. What is the {word} percentage?",
        f"{pct}%",
        [f"{num(abs(sell - cost) / sell * 100)}%", f"{abs(sell - cost)}%", f"{100 - pct}%"],
        lambda k: f"{pct + 5 * k}%",
        f"{word.title()} % is measured on the cost price: |{sell} − {cost}| ÷ {cost} × 100 = {pct}%.",
        {"cost": cost, "sell": sell},
    )


def interest(rng: random.Random, level: int) -> Item:
    principal = rng.choice([1000, 2000, 5000, 8000, 10000])
    rate = rng.choice([5, 10, 20] if level > 1 else [5, 10])
    years = 2 if level > 1 else rng.choice([2, 3])
    if level > 1:
        ci = principal * (100 + rate) ** 2 / 10000 - principal
        si = principal * rate * years / 100
        return _item(
            rng, "quant", "Compound interest",
            f"What is the compound interest on ${principal:,} at {rate}% a year for {years} years, "
            "compounded annually?",
            f"${num(ci)}",
            [f"${num(si)}", f"${num(principal + ci)}", f"${num(ci - principal * rate / 100)}"],
            lambda k: f"${num(ci + 25 * k)}",
            f"Amount = {principal} × (1 + {rate}/100)² = {num(principal + ci)}; "
            f"interest = amount − principal = {num(ci)}.",
            {"principal": principal, "rate": rate, "years": years, "compound": True},
        )
    si = principal * rate * years / 100
    return _item(
        rng, "quant", "Simple interest",
        f"What is the simple interest on ${principal:,} at {rate}% a year for {years} years?",
        f"${num(si)}",
        [f"${num(principal + si)}", f"${num(principal * rate / 100)}", f"${num(si * 2)}"],
        lambda k: f"${num(si + 50 * k)}",
        f"Simple interest = P × R × T / 100 = {principal} × {rate} × {years} / 100 = {num(si)}.",
        {"principal": principal, "rate": rate, "years": years, "compound": False},
    )


def dice_probability(rng: random.Random, level: int) -> Item:
    if level == 1:
        flips, heads = rng.choice([(3, 2), (4, 2), (3, 1), (4, 3)])
        p = Fraction(math.comb(flips, heads), 2 ** flips)
        return _item(
            rng, "quant", "Probability",
            f"A fair coin is tossed {flips} times. What is the probability of getting exactly {heads} heads?",
            num(p),
            [num(Fraction(heads, flips)), num(Fraction(1, 2 ** flips)), num(Fraction(1, 2))],
            lambda k: num(Fraction(k, 2 ** flips + k)),
            f"There are C({flips},{heads}) = {math.comb(flips, heads)} favourable outcomes out of "
            f"2^{flips} = {2 ** flips}, so p = {p}.",
            {"flips": flips, "heads": heads, "dice": False},
        )
    target = rng.choice([4, 5, 6, 7, 8, 9, 10])
    ways = sum(1 for a in range(1, 7) for b in range(1, 7) if a + b == target)
    p = Fraction(ways, 36)
    return _item(
        rng, "quant", "Probability",
        f"Two fair dice are rolled. What is the probability that the sum is {target}?",
        num(p),
        [num(Fraction(1, 11)), num(Fraction(ways, 12)),
         num(Fraction(1, 6) if p != Fraction(1, 6) else Fraction(1, 9))],
        lambda k: num(Fraction(ways + k, 36)),
        f"{ways} of the 36 equally likely outcomes give a sum of {target}, so p = {p}.",
        {"target": target, "dice": True},
    )


# ---------------------------------------------------------------- logical
def number_series(rng: random.Random, level: int) -> Item:
    kind = rng.choice(["arith", "geom"] if level == 1 else ["arith2", "square", "geom", "alt"])
    start = rng.randint(2, 9)
    if kind == "arith":
        d = rng.randint(3, 9)
        seq = [start + d * i for i in range(6)]
        why = f"Each term adds {d}."
    elif kind == "geom":
        r = rng.choice([2, 3])
        seq = [start * r ** i for i in range(6)]
        why = f"Each term is multiplied by {r}."
    elif kind == "arith2":
        d, step = rng.randint(1, 4), rng.randint(1, 3)
        seq = [start]
        for i in range(5):
            seq.append(seq[-1] + d + step * i)
        diffs = ", ".join(str(seq[i + 1] - seq[i]) for i in range(5))
        why = f"The differences grow by {step} each time ({diffs})."
    elif kind == "square":
        off = rng.randint(-2, 3)
        base = rng.randint(1, 4)
        seq = [(base + i) ** 2 + off for i in range(6)]
        why = f"Terms are consecutive squares {'plus' if off >= 0 else 'minus'} {abs(off)}."
    else:
        b = rng.randint(1, 4)
        seq = [start]
        for i in range(5):
            seq.append(seq[-1] * 2 if i % 2 == 0 else seq[-1] - b)
        why = f"The pattern alternates: ×2, then −{b}."
    shown, answer = seq[:5], seq[5]
    d_last = seq[4] - seq[3]
    return _item(
        rng, "logical", "Number series",
        f"What comes next in the series: {', '.join(map(str, shown))}, ?",
        str(answer),
        [str(seq[4] + d_last), str(answer + 1), str(answer - 2)],
        lambda k: str(answer + 2 + k),
        why,
        {"seq": seq},
    )


def letter_series(rng: random.Random, level: int) -> Item:
    step = rng.randint(2, 4) if level == 1 else rng.randint(3, 6)
    start = rng.randint(0, 25 - step * 4)
    seq = [string.ascii_uppercase[start + step * i] for i in range(5)]
    answer = seq[-1]
    last = start + step * 4
    wrong = [string.ascii_uppercase[last + d] for d in (-1, 1, 2) if 0 <= last + d < 26]
    return _item(
        rng, "logical", "Letter series",
        f"What comes next: {', '.join(seq[:4])}, ?",
        answer,
        wrong,
        lambda k: string.ascii_uppercase[(start + step * 4 + 2 + k) % 26],
        f"Each letter moves {step} places forward in the alphabet.",
        {"start": start, "step": step},
    )


def coding_decoding(rng: random.Random, level: int) -> Item:
    words = ["CAT", "DOG", "MILK", "BOOK", "GAME", "CODE", "FISH", "LAMP", "RIVER", "PLANT", "MOUSE", "TRAIN"]
    sample, target = rng.sample(words, 2)
    shift = rng.randint(1, 3) if level == 1 else rng.choice([-3, -2, 2, 3, 4])

    def enc(w: str, s: int) -> str:
        return "".join(string.ascii_uppercase[(ord(c) - 65 + s) % 26] for c in w)

    answer = enc(target, shift)
    return _item(
        rng, "logical", "Coding-decoding",
        f"In a certain code, {sample} is written as {enc(sample, shift)}. "
        f"How is {target} written in that code?",
        answer,
        [enc(target, shift + 1), enc(target, -shift), enc(target[::-1], shift)],
        lambda k: enc(target, shift + 1 + k),
        f"Each letter is shifted {abs(shift)} place{'s' if abs(shift) != 1 else ''} "
        f"{'forward' if shift > 0 else 'back'} in the alphabet.",
        {"target": target, "shift": shift},
    )


def clock_angle(rng: random.Random, level: int) -> Item:
    hour = rng.randint(1, 11)
    minute = rng.choice([0, 15, 30, 45] if level == 1 else [10, 20, 25, 40, 50])
    raw = abs(30 * hour - 5.5 * minute)
    angle = min(raw, 360 - raw)
    return _item(
        rng, "logical", "Clocks",
        f"What is the smaller angle between the hour and minute hands at {hour}:{minute:02d}?",
        f"{num(angle)}°",
        [f"{num(abs(30 * hour - 6 * minute) % 360)}°", f"{num(360 - angle)}°", f"{num(angle + 30)}°"],
        lambda k: f"{num(angle + 7.5 * k)}°",
        f"Hour hand: 30 × {hour} + 0.5 × {minute} = {num(30 * hour + 0.5 * minute)}°. Minute hand: "
        f"6 × {minute} = {6 * minute}°. Difference = {num(raw)}°, smaller angle = {num(angle)}°.",
        {"hour": hour, "minute": minute},
    )


QUANT = [percent_change, ratio_share, average_removed, train_pole, work_together, profit_percent, interest,
         dice_probability]
LOGICAL = [number_series, letter_series, coding_decoding, clock_angle]


def generate(section: str, count: int, level: int, rng: random.Random | None = None) -> list[Item]:
    """`count` templated items for 'quant' or 'logical', rotating through topics, no repeated stems."""
    rng = rng or random.Random()
    pool = QUANT if section == "quant" else LOGICAL
    order = pool[:]
    rng.shuffle(order)
    items: list[Item] = []
    seen: set[str] = set()
    attempts = 0
    while len(items) < count and attempts < count * 20:
        gen = order[attempts % len(order)]
        attempts += 1
        item = gen(rng, level)
        if item["question"] in seen:
            continue
        seen.add(item["question"])
        items.append(item)
    return items
