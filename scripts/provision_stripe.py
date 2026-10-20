import os, json, urllib.request, urllib.error
import stripe

base   = os.environ["INTEGRATION_PROXY_URL"]
job_id = "f094059d-13d0-4ac5-adb0-d551354bc344"
key    = "sk-emergent-c68De2dCe803fC5Cb0"
req = urllib.request.Request(
    base + "/stripe/sandboxes",
    data=json.dumps({"job_id": job_id}).encode(),
    headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req) as r:
        sandbox = json.load(r)
except urllib.error.HTTPError as e:
    print("ERR", e.code, e.read().decode())
    raise SystemExit(1)

stripe.api_key = sandbox["sandbox_secret_key"]
acct = stripe.Account.retrieve()
print("COUNTRY:", acct["country"])
print("DEFAULT_CURRENCY:", acct.get("default_currency"))
print("SECRET:", sandbox["sandbox_secret_key"][:14])
print("PUB:", sandbox["sandbox_publishable_key"][:14])
print("ACCT_ID:", sandbox["sandbox_account_id"])
print("WEBHOOK_SECRET:", sandbox.get("preview_webhook_secret", "")[:12])
print("ONBOARDING:", sandbox.get("onboarding_url"))
with open("/tmp/sandbox.json", "w") as f:
    json.dump(sandbox, f)
