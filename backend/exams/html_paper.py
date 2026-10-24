"""Import question content as inert, bounded markup. Never execute source HTML."""

import re
from dataclasses import dataclass, field
from html import escape
from html.parser import HTMLParser

from rest_framework.exceptions import ValidationError

ALLOWED = {
    "p",
    "div",
    "section",
    "span",
    "h2",
    "h3",
    "h4",
    "h5",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "br",
    "ul",
    "ol",
    "li",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "caption",
    "sup",
    "sub",
    "label",
}
DROP = {
    "script",
    "style",
    "iframe",
    "object",
    "embed",
    "svg",
    "audio",
    "video",
    "button",
    "noscript",
    "template",
}
VOID = {"input", "img", "br", "hr", "meta", "link", "source", "embed", "wbr"}
MARKER = re.compile(r"\{\{(\d{1,3})(?::([A-Za-z0-9]{1,8}))?\}\}")


@dataclass
class Node:
    tag: str
    attrs: dict = field(default_factory=dict)
    children: list = field(default_factory=list)


class Tree(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node("root")
        self.stack = [self.root]
        self.count = 0

    def handle_starttag(self, tag, attrs):
        self.count += 1
        if self.count > 20000 or len(self.stack) > 100:
            raise ValidationError({"file": "The HTML document is too complex."})
        node = Node(tag, dict(attrs))
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack = self.stack[:i]
                break

    def handle_data(self, text):
        self.stack[-1].children.append(text)


def parse(text):
    parser = Tree()
    parser.feed(text)
    return parser.root


def plain(node):
    if isinstance(node, str):
        return node
    return "" if node.tag in DROP else " ".join(plain(c) for c in node.children)


def has_tag(node, tag):
    return isinstance(node, Node) and (
        node.tag == tag or any(has_tag(c, tag) for c in node.children)
    )


def clean(node, control=None):
    if isinstance(node, str):
        return escape(node)
    if node.tag in DROP:
        return ""
    if node.tag in ("input", "select"):
        return control(node) if control else ""
    children = "".join(clean(c, control) for c in node.children)
    if node.tag not in ALLOWED:
        return children
    tag = node.tag
    classes = node.attrs.get("class", "").split()
    if any(c.endswith("notes-title") for c in classes):
        tag = "h3"
    elif "gx-sec-title" in classes:
        tag = "h4"
    attrs = ""
    if tag in ("td", "th"):
        for name in ("colspan", "rowspan"):
            value = node.attrs.get(name, "")
            if value.isdigit() and 1 <= int(value) <= 20:
                attrs += f' {name}="{value}"'
    return f"<{tag}{attrs}>{children}" + ("" if tag == "br" else f"</{tag}>")


def sanitize(text):
    return clean(parse(text))


def import_question_html(text):
    root = parse(text)
    sections, questions, warnings = [], {}, []

    def visit(node):
        if isinstance(node, str) or node.tag in DROP:
            return
        part = re.fullmatch(r"part([1-4])", node.attrs.get("id", ""), re.I)
        if not part:
            for child in node.children:
                visit(child)
            return
        part_number = int(part[1])
        option_text = {}
        prompts = {}

        def describe(item, parent=None):
            if isinstance(item, str) or item.tag in DROP:
                return
            if item.tag == "label":
                for c in item.children:
                    if isinstance(c, Node) and c.tag == "input":
                        key = c.attrs.get("value", "").upper()
                        n = c.attrs.get("data-question", "")
                        option_text[(n, key)] = re.sub(
                            r"^" + re.escape(key) + r"[.)]?\s+", "", plain(item).strip()
                        )[:1000]
            if item.tag in ("input", "select") and parent is not None:
                prompts.setdefault(
                    item.attrs.get("data-question", ""), plain(parent).strip()[:5000]
                )
            for child in item.children:
                describe(child, item)

        describe(node)

        def control(item):
            value = item.attrs.get("data-question", "")
            if not value.isdigit() or not 1 <= int(value) <= 100:
                warnings.append(
                    "An unnumbered control was omitted. Add its question marker manually."
                )
                return ""
            n = int(value)
            kind = item.attrs.get("type", "text")
            q = questions.setdefault(
                n,
                {
                    "number": n,
                    "part": part_number,
                    "type": "short_answer",
                    "prompt": f"Question {n}",
                    "instructions": "",
                    "options": [],
                    "answers": [],
                    "max_words": 3,
                    "context": {},
                },
            )
            if prompts.get(value):
                q["prompt"] = prompts[value]
            if q["part"] != part_number:
                raise ValidationError(
                    {"file": f"Question {n} occurs in more than one part."}
                )
            if item.tag == "select":
                q["type"] = "matching"
                q["options"] = [
                    {"key": c.attrs.get("value", "").upper(), "text": plain(c).strip()}
                    for c in item.children
                    if isinstance(c, Node)
                    and c.tag == "option"
                    and re.fullmatch(r"[A-Za-z0-9]{1,8}", c.attrs.get("value", ""))
                ]
                return "{{" + str(n) + "}}"
            if kind in ("radio", "checkbox"):
                key = item.attrs.get("value", "").upper()
                if not re.fullmatch(r"[A-Z0-9]{1,8}", key):
                    raise ValidationError(
                        {"file": f"Question {n} has an invalid option label."}
                    )
                q["type"] = "multiple_choice"
                if not any(o["key"] == key for o in q["options"]):
                    q["options"].append(
                        {"key": key, "text": option_text.get((value, key), key)}
                    )
                return "{{" + str(n) + ":" + key + "}}"
            if kind not in ("text", "number", ""):
                return ""
            return "{{" + str(n) + "}}"

        # No source style, event handler, script, form target or remote URL survives.
        html = "".join(clean(c, control) for c in node.children)
        if has_tag(node, "img"):
            warnings.append(
                f"Part {part_number}: source figures need an authorized local figure or a complete text description; remote images are not imported."
            )
        sections.append({"part": part_number, "html": html})

    visit(root)
    if not sections or not questions:
        raise ValidationError(
            {
                "file": 'Use question sections with id="part1" … "part4" and controls labelled data-question="1" … "40".'
            }
        )
    warnings.insert(
        0,
        "Review all notes, instructions, options and missing figures. Enter the answer key yourself; source scripts and embedded keys are ignored.",
    )
    return {
        "sections": sections,
        "questions": sorted(questions.values(), key=lambda q: q["number"]),
        "warnings": warnings,
    }
