"""Signed direct uploads, verified responses, and bounded Cloudinary downloads."""
import hmac
import os
import time
import uuid
from urllib.parse import quote

import cloudinary.utils
import httpx
from fastapi import HTTPException

MAX_BYTES = 10 * 1024 * 1024


class Cloud:
    def __init__(self):
        self.name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
        self.key = os.getenv("CLOUDINARY_API_KEY", "").strip()
        self.secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()

    @property
    def configured(self):
        return bool(self.name and self.key and self.secret)

    def require(self):
        if not self.configured:
            raise HTTPException(503, "Add Cloudinary credentials to .env and restart the dashboard. You can try the sample meanwhile.")

    def sign(self, store):
        self.require()
        upload_id = uuid.uuid4().hex
        timestamp = int(time.time())
        public_id = f"yolo26/uploads/{upload_id}"
        params = {"timestamp": timestamp, "public_id": public_id, "overwrite": "false"}
        signature = cloudinary.utils.api_sign_request(params, self.secret)
        store.ticket(upload_id, public_id, timestamp)
        return {
            "upload_id": upload_id,
            "url": f"https://api.cloudinary.com/v1_1/{quote(self.name, safe='')}/image/upload",
            "fields": {**params, "api_key": self.key, "signature": signature},
        }

    def download(self, asset, store):
        self.require()
        ticket = store.get_ticket(asset.upload_id)
        if not ticket or ticket[0] != asset.public_id or int(time.time()) - ticket[1] > 3600:
            raise HTTPException(400, "Upload authorization expired or is invalid. Upload the image again.")
        expected = cloudinary.utils.api_sign_request(
            {"public_id": asset.public_id, "version": asset.version}, self.secret,
        )
        if not hmac.compare_digest(expected, asset.signature):
            raise HTTPException(400, "The Cloudinary upload response could not be verified.")
        # Derive the URL from verified identifiers; never fetch a browser-supplied URL.
        url = f"https://res.cloudinary.com/{quote(self.name, safe='')}/image/upload/v{asset.version}/{quote(asset.public_id, safe='/')}"
        try:
            with httpx.stream("GET", url, timeout=30, follow_redirects=False) as response:
                if response.status_code != 200:
                    raise HTTPException(502, "The uploaded Cloudinary image could not be retrieved.")
                body = bytearray()
                for chunk in response.iter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_BYTES:
                        raise HTTPException(413, "Images must be 10 MB or smaller.")
            return bytes(body), url
        except httpx.HTTPError as error:
            raise HTTPException(502, "Cloudinary could not be reached. Please try again.") from error
