import urllib.request
import urllib.error
import json
import urllib.parse

PROXY_URL = "https://podscribe-proxy.uni-kui.shop"
TARGET_URL = "https://itunes.apple.com/search?term=all%20ear&entity=podcast&limit=10"

url = f"{PROXY_URL}?url={urllib.parse.quote(TARGET_URL)}"

print(f"Testing Search Proxy: {url}")

try:
    req = urllib.request.Request(
        url, 
        headers={"User-Agent": "TestScript/1.0"}
    )
    with urllib.request.urlopen(req) as response:
        print(f"Status Code: {response.getcode()}")
        body = response.read().decode('utf-8')
        try:
            data = json.loads(body)
            print(f"Result Count: {data.get('resultCount')}")
            print("Success!")
        except:
            print("Response is not JSON:")
            print(body[:200])
        
except urllib.error.HTTPError as e:
    print(f"HTTP Error Code: {e.code}")
    print(e.read().decode('utf-8'))
except Exception as e:
    print(f"Error: {e}")
