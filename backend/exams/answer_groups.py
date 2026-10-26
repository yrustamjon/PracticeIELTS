"""Validated unordered groups of distinct letter answers across numbered slots."""

from rest_framework.exceptions import ValidationError


def answer_groups(questions):
    by_number = {q["number"]: q for q in questions}
    groups = set()

    def invalid():
        raise ValidationError(
            {
                "questions": "An answer group must reference 2–10 questions in the same Part, with identical unordered/distinct rules and the same set of correct letters (one distinct letter per slot)."
            }
        )

    for q in questions:
        group = q["context"].get("answer_group")
        if group is None:
            continue
        if not isinstance(group, dict):
            invalid()
        numbers = group.get("numbers")
        if (
            not isinstance(numbers, list)
            or not 2 <= len(numbers) <= 10
            or any(type(n) is not int for n in numbers)
            or len(set(numbers)) != len(numbers)
            or q["number"] not in numbers
            or group.get("order_matters") is not False
            or group.get("distinct") is not True
        ):
            invalid()
        canonical = tuple(sorted(numbers))
        keys = None
        for n in canonical:
            member = by_number.get(n)
            if member is None or member["part"] != q["part"]:
                invalid()
            other = member["context"].get("answer_group")
            if (
                not isinstance(other, dict)
                or other.get("order_matters") is not False
                or other.get("distinct") is not True
                or not isinstance(other.get("numbers"), list)
                or any(type(i) is not int for i in other["numbers"])
                or tuple(sorted(other["numbers"])) != canonical
            ):
                invalid()
            answers = member["answers"]
            if any(
                not isinstance(a, str)
                or len(a.strip()) != 1
                or a.strip().upper() not in "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                for a in answers
            ):
                invalid()
            letters = {a.strip().upper() for a in answers}
            if len(letters) != len(canonical) or (keys is not None and keys != letters):
                invalid()
            keys = letters
        groups.add(canonical)
    return sorted(groups)
