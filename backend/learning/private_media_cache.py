"""Conditional media responses. Call only AFTER current access checks."""

import hashlib

from django.http import HttpResponseNotModified
from django.utils.cache import patch_vary_headers
from django.utils.http import parse_etags


def file_revision(file):
    # Storage paths are immutable UUIDs. Metadata also detects local replacements.
    try:
        modified = file.storage.get_modified_time(file.name).isoformat()
    except (NotImplementedError, AttributeError):
        modified = ""
    return hashlib.sha256(
        f"{file.name}:{file.size}:{modified}".encode()
    ).hexdigest()


def private_headers(response, etag):
    response["ETag"] = etag
    response["Cache-Control"] = "private, no-cache, must-revalidate"
    patch_vary_headers(response, ["Authorization", "Cookie"])
    return response


def not_modified(request, etag):
    candidates = parse_etags(request.headers.get("If-None-Match", ""))
    if "*" in candidates or etag in [value.removeprefix("W/") for value in candidates]:
        return private_headers(HttpResponseNotModified(), etag)
    return None
