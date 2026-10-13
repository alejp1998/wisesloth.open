"""Offline OpenAI-compatible fixture for the isolated release smoke test."""

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def fixture_content(schema):
    properties = schema.get("properties", {})
    question = {"q": "What is two plus two?", "a": "4", "b": "5", "c": "", "d": "", "e": "", "exp": "Adding two and two gives four.", "correctOpts": ["a"]}
    content = {"lang": "en", "name": "Arithmetic", "topic": "math-arithmetic", "desc": "Practice simple addition."}
    if "test_updates" in properties:
        content = {"summary": "Added one study item.", "test_updates": {"name": "Revised arithmetic", "topic": "math-arithmetic", "desc": "Practice simple addition."}}
        if "cards_to_add" in properties:
            content.update(cards_to_add=[{"front": "1 + 1", "back": "2"}], cards_to_remove_ids=[], cards_to_update=[])
        else:
            content.update(quizzes_to_add=[question], quizzes_to_remove_ids=[], quizzes_to_update=[])
    elif "personalities" in properties:
        names = {str(i): name for i, name in enumerate(["Thinker", "Planner", "Explorer", "", "", ""], 1)}
        content.update(personalities=names, personalities_desc={key: ("A study style." if name else "") for key, name in names.items()},
                       quizzes=[{"q": "How do you study?", **{f"opt{i}": name for i, name in enumerate(names.values(), 1)}}])
    elif "cards" in properties:
        content["cards"] = [{"front": "2 + 2", "back": "4"}, {"front": "3 + 3", "back": "6"}]
    elif "front" in properties:
        content = {"front": "2 + 2", "back": "Four"}
    elif "q" in properties:
        content = question
    else:
        content["quizzes"] = [question, {**question, "q": "What is three plus three?", "a": "6", "b": "7"}]
    return content


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_POST(self):
        request = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        schema = request.get("response_format", {}).get("json_schema", {}).get("schema", {})
        content = fixture_content(schema)
        if any("MALFORMED_FIXTURE" in message.get("content", "") for message in request.get("messages", [])):
            raw = "not valid JSON"
        else:
            raw = json.dumps(content)
        response = {"id": "chatcmpl-offline", "object": "chat.completion", "created": 1,
                    "model": "gpt-6-luna", "choices": [{"index": 0, "message": {"role": "assistant", "content": raw}, "finish_reason": "stop"}],
                    "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150}}
        data = json.dumps(response).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", 8000), Handler).serve_forever()
