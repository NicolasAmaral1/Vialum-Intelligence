"""
Vialum Switch Client — Python SDK for squads
Usage:
    from switch_client import SwitchClient
    switch = SwitchClient()
    result = switch.classify(file_id, "document_type")
    result = switch.ocr(file_id)
    result = switch.transcribe(file_id)
"""

import os
import json
import requests

SWITCH_URL = os.environ.get("SWITCH_URL", "http://vialum-switch:3004")
JWT_TOKEN = os.environ.get("VIALUM_JWT", "")


class SwitchClient:
    def __init__(self, base_url=None, token=None):
        self.base_url = base_url or SWITCH_URL
        self.token = token or JWT_TOKEN
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
        }

    def process(self, processor, file_id=None, file_url=None, text=None, params=None):
        """Generic process call."""
        input_data = {}
        if file_id:
            input_data["fileId"] = file_id
        elif file_url:
            input_data["fileUrl"] = file_url
        elif text:
            input_data["text"] = text

        body = {"processor": processor, "input": input_data}
        if params:
            body["params"] = params

        resp = requests.post(
            f"{self.base_url}/switch/api/v1/process",
            headers=self.headers,
            json=body,
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()

    def classify(self, file_id, classifier="document_type"):
        """Classify a document by type."""
        return self.process("classify", file_id=file_id, params={"classifier": classifier})

    def ocr(self, file_id):
        """Extract text from image/PDF."""
        return self.process("ocr", file_id=file_id)

    def transcribe(self, file_id):
        """Transcribe audio/video to text."""
        return self.process("transcribe", file_id=file_id)

    def get_job(self, job_id):
        """Get job result by ID."""
        resp = requests.get(
            f"{self.base_url}/switch/api/v1/jobs/{job_id}",
            headers=self.headers,
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
