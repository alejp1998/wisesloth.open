"""Publish scrubbed startup diagnostics as a CI annotation, never configuration secrets."""

import os
import re
import subprocess
import sys
from pathlib import Path

secrets = []
for line in Path(".env").read_text().splitlines():
    if "=" not in line or line.startswith("#"):
        continue
    name, value = line.split("=", 1)
    if value and any(word in name for word in ["PASSWORD", "SECRET", "API_KEY"]):
        secrets.append(value)


def scrub(text):
    for value in secrets:
        text = text.replace(value, "[redacted]")
    return re.sub(r"scrypt:[a-f0-9]+:[a-f0-9]+", "[password hash]", text)


sections = {"Compose startup": Path(sys.argv[1]).read_text(errors="replace")}
for service in ["web", "ai", "db", "mock"]:
    logs = subprocess.run([
        "docker", "compose", "-p", "wisesloth-open-test", "-f", "compose.yaml", "-f", "compose.test.yaml",
        "logs", "--tail", "30", service,
    ], capture_output=True, text=True, check=False)
    sections[service] = logs.stdout + logs.stderr

summary = []
for title, text in sections.items():
    excerpt = scrub("\n".join(text.splitlines()[-30:]))[-3500:]
    summary.append(f"### {title}\n\n```text\n{excerpt}\n```\n")
    message = excerpt.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")
    print(f"::error title=Startup diagnostics — {title}::{message}")
Path(os.environ["GITHUB_STEP_SUMMARY"]).write_text("\n".join(summary))
