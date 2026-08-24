import urllib.request
import json
import base64
import os

def test():
    # 1. Test Profile
    print("Testing /api/user/profile...")
    with urllib.request.urlopen("http://127.0.0.1:5000/api/user/profile") as r:
        prof = json.loads(r.read().decode())
        print("  Profile loaded:", prof["profile"]["user_name"], "|", prof["profile"]["role"])

    # 2. Test Image Upload
    print("Testing /api/upload with PNG...")
    png_data = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==")
    boundary = "----TestBoundary123"
    payload = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="test_logo.png"\r\n'
        f"Content-Type: image/png\r\n\r\n"
    ).encode("utf-8") + png_data + f"\r\n--{boundary}--\r\n".encode("utf-8")

    req = urllib.request.Request(
        "http://127.0.0.1:5000/api/upload",
        data=payload,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"}
    )
    with urllib.request.urlopen(req) as r:
        res = json.loads(r.read().decode())
        print("  Upload response:", res["status"], "| is_image:", res["is_image"], "| URL:", res["image_url"])
        image_url = res["image_url"]

    # 3. Test Static Serving of Uploaded Image
    print(f"Testing static fetch of {image_url}...")
    with urllib.request.urlopen(f"http://127.0.0.1:5000{image_url}") as r:
        content = r.read()
        print(f"  Fetched {len(content)} bytes with HTTP {r.status} successfully!")

    # 4. Test RAG / Self-RAG status
    print("Testing /api/rag/status...")
    with urllib.request.urlopen("http://127.0.0.1:5000/api/rag/status") as r:
        rag_s = json.loads(r.read().decode())
        print("  RAG status:", rag_s.get("status"), "| Total chunks:", rag_s.get("total_chunks"))

if __name__ == "__main__":
    test()
