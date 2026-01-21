import urllib.request
import urllib.parse
import urllib.error
import sys

# Testing the ORIGINAL podcast proxy
PROXY_URL = "https://podscribe-proxy.uni-kui.shop"
TARGET_URL = "https://itunes.apple.com/search?term=all+ear&entity=podcast&limit=10"

encoded_target = urllib.parse.quote(TARGET_URL)
test_url = f"{PROXY_URL}?url={encoded_target}"

print(f"Testing Podcast Proxy: {test_url}")

try:
    req = urllib.request.Request(test_url)
    with urllib.request.urlopen(req) as response:
        print(f"Status Code: {response.getcode()}")
        print(f"Content-Type: {response.headers.get('Content-Type')}")
        body = response.read().decode('utf-8')
        print(f"Body Preview: {body[:200]}...")
        
except urllib.error.HTTPError as e:
    print(f"HTTP Error Code: {e.code}")
    print("Response Body:")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
