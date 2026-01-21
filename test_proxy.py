import urllib.request
import urllib.error
import json
import sys

PROXY_URL = "https://gemni.uni-kui.shop"
ENDPOINT = "/v1beta/models"
TEST_KEY = "INVALID_KEY_FOR_TESTING"

url = f"{PROXY_URL}{ENDPOINT}?key={TEST_KEY}"

print(f"Testing Proxy: {url}")

try:
    req = urllib.request.Request(
        url, 
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as response:
        print(f"Status Code: {response.getcode()}")
        print("Response Body:")
        print(response.read().decode('utf-8'))
        
except urllib.error.HTTPError as e:
    print(f"HTTP Error Code: {e.code}")
    print("Response Body (Error from Upstream):")
    body = e.read().decode('utf-8')
    print(body)
    
    # Analyze if it looks like a Google error
    try:
        data = json.loads(body)
        if "error" in data:
            print("\nSUCCESS: Received structured error response from Google via Proxy.")
            print(f"Google Error Message: {data['error'].get('message', 'No message')}")
        else:
            print("\nWARNING: Response matches JSON format but doesn't look like a standard Google API error.")
    except json.JSONDecodeError:
        print("\nFAILURE: Response is not valid JSON. Proxy might be returning raw HTML or plain text.")

except urllib.error.URLError as e:
    print(f"Connection Failed: {e.reason}")
    print("Please check if the domain is correctly deployed and DNS is propagated.")
    sys.exit(1)
except Exception as e:
    print(f"An unexpected error occurred: {e}")
    sys.exit(1)
