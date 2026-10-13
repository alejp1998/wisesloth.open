"""Exercise a disposable Compose test stack, using its local mock provider.

Run with SMOKE_URL=http://localhost:18080 python3 scripts/smoke-test.py.
Never run this against a real instance: it creates accounts and content.
"""

import base64
import http.cookiejar
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from mock_provider import fixture_content

BASE = os.environ.get("SMOKE_URL", "http://localhost:18080").rstrip("/")
if urllib.parse.urlparse(BASE).hostname not in {"localhost", "127.0.0.1"}:
    raise SystemExit("Smoke tests require a disposable localhost stack.")
env = dict(line.split("=", 1) for line in Path(os.environ.get("SMOKE_ENV", ".env")).read_text().splitlines()
           if line and not line.startswith("#") and "=" in line)


def browser():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))


def request(client, path, body=None, method=None, form=False, expected=200, origin=BASE):
    headers = {"Origin": origin}
    if body is not None:
        if form:
            data = urllib.parse.urlencode(body).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
    else:
        data = None
    call = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        response = client.open(call, timeout=130)
    except urllib.error.HTTPError as error:
        response = error
    result = response.read().decode()
    assert response.status == expected, f"{path}: expected {expected}, got {response.status}: {result[:300]}"
    return json.loads(result) if "application/json" in response.headers.get("Content-Type", "") else result


admin, guest, reader = browser(), browser(), browser()
request(admin, "/ready")
assert "wsBrowserAI" in request(admin, "/scripts/browser-ai.min.js")
request(admin, "/login", {"username": env.get("ADMIN_USERNAME", "admin"), "password": env["ADMIN_PASSWORD"]}, form=True)
for path in ["/", "/community", "/tests", "/tests/new", "/settings", "/help", "/about", "/privacy-policy", "/terms-of-use", "/users/admin"]:
    page = request(admin, path)
    assert "googletagmanager" not in page and "recaptcha" not in page, path
request(guest, "/api/tests/new", {}, expected=401)
request(admin, "/settings", {"weeklyBudgetUsd": ""}, form=True, origin="https://foreign.example", expected=403)
request(admin, "/settings/accounts", {"username": "smoke-reader-" + str(os.getpid()), "password": "sample-reader-password"}, form=True)
request(reader, "/login", {"username": "smoke-reader-" + str(os.getpid()), "password": "sample-reader-password"}, form=True)
for kind in ['instructions', 'personality']:
    generated = request(admin, '/api/tests/new', {'type': kind, 'language': 'English (en)', 'nQuestions': 2, 'nOptions': 3,
        'difficulty': 'beginner', 'instructions': 'Create a short study activity about arithmetic.'})
    assert generated['success'], generated
    request(admin, f"/tests/{generated['testId']}")
notes = "Addition combines quantities. Two plus two equals four and three plus three equals six. " * 3
exam = request(admin, '/api/tests/new', {'type': 'old-exam', 'text': notes})
assert exam['success'], exam
request(admin, f"/tests/{exam['testId']}")
quiz = request(admin, "/api/tests/new", {"type": "notes", "text": notes, "nQuestions": 2, "nOptions": 2, "difficulty": "beginner", "instructions": ""})
assert quiz["success"], quiz
quiz_id = quiz["testId"]
request(guest, f"/tests/{quiz_id}", expected=404)
request(reader, f"/tests/{quiz_id}", expected=404)
show = request(admin, f"/tests/{quiz_id}")
questions = json.loads(re.search(r"window.__showQuizData\s*=\s*(.*?);", show, re.S).group(1))["quizzes"]
question_id = questions[0]["id"]
# Upload through Express, then check the local image URL's visibility policy.
boundary = 'wisesloth-upload-fixture'
image_bytes = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEklEQVR4nGNkaGCAAyYGBmI4ABoEAIhjNExLAAAAAElFTkSuQmCC')
image_body = (f'--{boundary}\r\nContent-Disposition: form-data; name="newFileName"\r\n\r\n{question_id}.png\r\n'
              f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n').encode() + image_bytes + f'\r\n--{boundary}--\r\n'.encode()
image_response = admin.open(urllib.request.Request(BASE + '/api/tests/addimg', data=image_body,
    headers={'Origin': BASE, 'Content-Type': 'multipart/form-data; boundary=' + boundary}), timeout=30)
uploaded = json.loads(image_response.read())
assert uploaded['success'], uploaded
image_url = uploaded['imageUrl']
assert image_url.startswith('/uploads/')
assert admin.open(BASE + image_url).headers['Content-Type'] == 'image/webp'
request(guest, image_url, expected=404)

request(admin, "/api/tests/update-details", {"id": quiz_id, "name": "Shared arithmetic", "topic": "math-arithmetic", "desc": "Sharing fixture", "context": "", "hideAnswers": False, "visibility": "public"}, method="PUT")
for client in [guest, reader]:
    request(client, f"/tests/{quiz_id}")
    assert client.open(BASE + image_url).status == 200
    assert request(client, f"/tests/{quiz_id}?ajax=true")["renderedHTML"]
lobby = request(admin, f"/tests/{quiz_id}/livebattle?n=2&s=20")
battle_id = re.search(r"liveBattleId\s*=\s*[\"\']([^\"\']+)[\"\']", lobby).group(1)
request(guest, f"/livebattle/{battle_id}", expected=401)
request(reader, f"/livebattle/{battle_id}?pn=admin")
request(admin, f"/livebattle/{battle_id}?hip=true", {}, method="POST")
request(reader, f"/api/livebattle/{battle_id}/start", {}, method="POST", expected=403)
assert request(admin, f"/api/livebattle/{battle_id}/start", {}, method="POST")["success"]
request(reader, f"/api/livebattle/{battle_id}/answer?pn=admin&qi=999&co=1", {}, method="POST", expected=400)
time.sleep(11)
battle_answer = request(reader, f"/api/livebattle/{battle_id}/answer?pn=admin&qi=0&rms=999999&co=1", {}, method="POST")
assert battle_answer["success"] and 0 <= battle_answer["score"] <= 1000, battle_answer
battle_status = request(reader, f"/api/livebattle/{battle_id}/status?pn=admin")
players = battle_status["liveBattle"]["players"]
assert next(player for player in players if player["name"] == "admin")["scores"][0] == -1
request(reader, f"/tests/{quiz_id}/edit", expected=403)
request(reader, "/api/tests/edit-quiz-ai", {"testId": quiz_id, "quizId": question_id, "instruction": "Explain clearly"}, expected=403)
edit = request(admin, "/api/tests/edit-quiz-ai", {"testId": quiz_id, "quizId": question_id, "instruction": "Explain clearly"})
assert edit["success"], edit
proposal = request(admin, '/api/tests/edit-test-ai', {'testId': quiz_id, 'instruction': 'Add one question.'})
assert proposal['success'], proposal
assert request(admin, '/api/tests/apply-test-edit-ai', {'testId': quiz_id, 'diff': proposal['diff']})['success']
request(admin, f'/tests/{quiz_id}/edit')

attempt = request(reader, f"/tests/{quiz_id}/try")
result_id = re.search(r'data-result-id="([^"]+)"', attempt).group(1)
answer = {"nSeconds": 10, **{f"chosenOpts-{question['id']}": "1" for question in questions}}
result = request(reader, f"/api/results/{result_id}/check", answer)
assert result["success"], result
request(reader, f"/results/{result_id}")
request(guest, f"/results/{result_id}", expected=404)
cards = request(admin, "/api/tests/new-flashcards", {"text": notes, "nCards": 2, "instructions": ""})
assert cards["success"], cards
cards_page = request(admin, f"/tests/{cards['testId']}")
flashcards = json.loads(re.search(r"flashcards\s*=\s*(\[.*?\]);", cards_page, re.S).group(1))
card_edit = request(admin, '/api/tests/edit-flashcard-ai', {'testId': cards['testId'], 'flashcardId': flashcards[0]['id'], 'instruction': 'Explain the answer clearly.'})
assert card_edit['success'], card_edit
card_proposal = request(admin, '/api/tests/edit-test-ai', {'testId': cards['testId'], 'instruction': 'Add one card.'})
assert card_proposal['success'], card_proposal
assert request(admin, '/api/tests/apply-test-edit-ai', {'testId': cards['testId'], 'diff': card_proposal['diff']})['success']

for path in [f"/tests/{cards['testId']}", f"/tests/{cards['testId']}/edit", f"/tests/{cards['testId']}?ajax=true", "/tests/new?ajax=true", "/users/admin?ajax=true"]:
    request(admin, path)
blocked = request(admin, "/api/tests/new", {"type": "notes", "sourceUrl": "http://127.0.0.1", "text": "", "nQuestions": 2, "nOptions": 2, "difficulty": "beginner", "instructions": ""}, expected=400)
assert "private" in blocked["error"].lower() or "local" in blocked["error"].lower(), blocked
request(admin, "/settings", {"weeklyBudgetUsd": "0"}, form=True)
paused = request(admin, "/api/tests/new", {"type": "notes", "text": notes, "nQuestions": 2, "nOptions": 2, "difficulty": "beginner", "instructions": ""}, expected=429)
assert not paused["success"] and "weekly" in paused["error"].lower(), paused
request(admin, f"/tests/{quiz_id}")
request(admin, "/settings", {"weeklyBudgetUsd": ""}, form=True)
request(reader, "/settings/instance", {"weeklyBudgetUsd": "0"}, form=True, expected=403)
request(admin, "/settings/instance", {"weeklyBudgetUsd": "0"}, form=True)
request(admin, "/api/tests/new-flashcards", {"text": notes, "nCards": 2}, expected=429)
# Direct browser generation remains usable with the host budget paused.
for kind in ["old-exam", "notes", "instructions", "personality", "flashcards"]:
    endpoint = "/api/tests/new-flashcards" if kind == "flashcards" else "/api/tests/new"
    parameters = {"type": kind, "text": notes, "language": "English (en)", "nQuestions": 2,
                  "nOptions": 3, "nCards": 2, "difficulty": "beginner", "instructions": "Create an arithmetic study activity."}
    parameters["browserAI"] = {"mode": "prepare", "model": "gemini/gemini-3.8-flash"}
    plan = request(admin, endpoint, parameters)["browserAIPlan"]
    assert plan["model"] == "gemini/gemini-3.8-flash" and "schema" in plan
    parameters["browserAI"] = {"mode": "complete", "model": plan["model"],
                               "content": json.dumps(fixture_content(plan["schema"]))}
    created = request(admin, endpoint, parameters)
    assert created["success"] and created["tokensUsed"] == 0, created
    request(admin, "/tests/" + created["testId"])
    parameters["browserAI"]["content"] = '{"invalid":"completion"}'
    assert not request(admin, endpoint, parameters, expected=400)["success"]
for endpoint, parameters in [
    ("/api/tests/edit-quiz-ai", {"testId": quiz_id, "quizId": question_id, "instruction": "Explain the answer clearly."}),
    ("/api/tests/edit-flashcard-ai", {"testId": cards["testId"], "flashcardId": flashcards[0]["id"], "instruction": "Explain the answer clearly."}),
    ("/api/tests/edit-test-ai", {"testId": quiz_id, "instruction": "Add one question."}),
    ("/api/tests/edit-test-ai", {"testId": cards["testId"], "instruction": "Add one card."}),
]:
    parameters["browserAI"] = {"mode": "prepare", "model": "openai/gpt-6-luna"}
    plan = request(admin, endpoint, parameters)["browserAIPlan"]
    parameters["browserAI"] = {"mode": "complete", "model": plan["model"], "content": json.dumps(fixture_content(plan["schema"]))}
    assert request(admin, endpoint, parameters)["success"]
    if endpoint == "/api/tests/edit-quiz-ai":
        request(reader, endpoint, parameters, expected=403)
assert ">browser<" in request(admin, "/settings")
request(admin, "/api/tests/new-flashcards", {"text": notes, "nCards": 2}, expected=429)
request(admin, "/settings/instance", {"weeklyBudgetUsd": ""}, form=True)
request(admin, "/settings", {"weeklyBudgetUsd": "", "apiKey": "personal-offline-key"}, form=True)
settings = request(admin, "/settings")
assert "personal-offline-key" not in settings
malformed = request(admin, "/api/tests/new", {"type": "notes", "text": notes, "nQuestions": 2, "nOptions": 2, "difficulty": "beginner", "instructions": "MALFORMED_FIXTURE"}, expected=400)
assert not malformed["success"], malformed
assert ">error<" in request(admin, "/settings")
request(admin, "/api/tests/update-details", {"id": quiz_id, "name": "Private again", "topic": "math-arithmetic", "desc": "Privacy fixture", "context": "", "hideAnswers": True, "visibility": "private"}, method="PUT")
request(reader, f"/tests/{quiz_id}", expected=404)
request(guest, f"/tests/{quiz_id}", expected=404)
request(guest, image_url, expected=404)
request(admin, "/api/logout", {}, method="POST")
assert not request(admin, "/api/user/session")["loggedIn"]
print("PASS: login, pages, AJAX, creation, edits, sharing, private access, quiz results, link rejection, budgets, server/browser BYOK, failure metering, local-account live battles, logout")
