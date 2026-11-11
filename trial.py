import datetime, html, hmac, json, os, re, sqlite3, time, urllib.parse, urllib.request
from flask import request, session

TRIAL_ENABLED = True
TRIAL_DAYS = 30
TRIAL_KEY = "dda989b883"
PRICE_TEXT = "₱50 per month · ₱500 per year"
CONTACT_TEXT = "Facebook: Totskie Apps"
B = os.path.dirname(os.path.abspath(__file__)) + "/"
_hits = {}

PAGE = """<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Tindahan Kahera</title>
<style>body{font-family:sans-serif;background:#0f172a;color:#f8fafc;margin:0;padding:14px;text-align:center;box-sizing:border-box;min-height:100vh;min-height:100dvh}
.box{max-width:360px;margin:0 auto;display:flex;flex-direction:column;justify-content:space-between;min-height:calc(100vh - 28px);min-height:calc(100dvh - 28px)}
.row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center;margin:14px 0}
img{width:160px;height:160px;object-fit:contain;background:#fff;border-radius:8px}
input{width:92%;padding:14px;margin:6px 0;font-size:18px;border-radius:6px;border:1px solid #334155;background:#1e293b;color:#fff;text-align:center;box-sizing:border-box}
button{width:92%;padding:15px;font-size:18px;font-weight:bold;border:none;border-radius:6px;background:#22c55e;color:#0f172a}
.msg{color:#fbbf24;margin:8px 0;font-size:15px}small{color:#94a3b8}
a.b{display:inline-block;padding:10px 14px;background:#334155;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px}</style></head><body><div class="box">
<div style="display:flex;justify-content:space-between;align-items:center"><a class="b" href="/">&larr; Back to app</a><b style="font-size:18px">Payment / Bayad</b></div>
<p style="margin:12px 0"><small style="font-size:14px">Pay {{PRICE}} via GCash. Scan the QR or send to the number, then enter your code and reference no.</small></p>
<div class="row"><img src="/static/gcash_qr.png" alt="GCash QR">
<div><small>Can't scan? Send to GCash:</small><div style="font-size:21px;font-weight:bold">09XX XXX XXXX</div>
<div style="color:#94a3b8;font-size:13px;margin-bottom:6px">Edison P</div>
<button type="button" id="cpb" style="width:100%;padding:11px;font-size:16px;background:#334155;color:#fff" onclick="var n='09XX XXX XXXX',b=document.getElementById('cpb');function ok(){b.textContent='Copied!';}if(navigator.clipboard){navigator.clipboard.writeText(n).then(ok,function(){});}else{var t=document.createElement('textarea');t.value=n;document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();ok();}">Copy number</button></div></div>
<div class="msg">{{MSG}}</div>
<form method="post" action="/pay">
<input name="code" placeholder="Tester Code" maxlength="6" value="{{CODE}}" autocomplete="off">
<input name="ref" placeholder="GCash reference number" maxlength="20" autocomplete="off">
<button>Send payment details</button></form>
<p style="margin:8px 0 0"><a class="b" href="https://www.facebook.com/share/18yoHq4zFP/">Message us on Facebook</a></p></div><p style="text-align:center;color:#64748b;font-size:11px;margin:10px 0 0">by Totskie Tech Solution</p></body></html>"""


def tg(text):
    try:
        c = json.load(open(B + "telegram.json"))
        d = urllib.parse.urlencode({"chat_id": c["chat_id"], "text": text}).encode()
        urllib.request.urlopen("https://api.telegram.org/bot%s/sendMessage" % c["token"], d, timeout=8)
    except Exception:
        pass


def path_for(code):
    if code and re.fullmatch(r"[A-Z0-9]{6}", code) and os.path.exists(B + "pos_" + code + ".db"):
        return B + "pos_" + code + ".db"
    return None


def _get(path, k):
    c = sqlite3.connect(path)
    r = c.execute("SELECT value FROM app_state WHERE key=?", (k,)).fetchone()
    c.close()
    return r[0] if r else None


def _put(path, k, v):
    c = sqlite3.connect(path)
    c.execute("INSERT OR REPLACE INTO app_state(key,value) VALUES(?,?)", (k, v))
    c.commit()
    c.close()


def end_date(path):
    if _get(path, "trial_unlock") == "1":
        return None
    e = _get(path, "trial_end")
    if e:
        return datetime.date.fromisoformat(e)
    s = _get(path, "trial_start")
    if not s:
        s = datetime.date.today().isoformat()
        _put(path, "trial_start", s)
    return datetime.date.fromisoformat(s) + datetime.timedelta(days=TRIAL_DAYS)


def expired(path):
    try:
        e = end_date(path)
        return e is not None and datetime.date.today() >= e
    except Exception:
        return False


def pay_page(code, msg):
    return (PAGE.replace("{{PRICE}}", html.escape(PRICE_TEXT))
            .replace("{{CONTACT}}", html.escape(CONTACT_TEXT))
            .replace("{{MSG}}", html.escape(msg))
            .replace("{{CODE}}", html.escape(code or "")))


def setup(app, db):
    @app.before_request
    def gate():
        if not TRIAL_ENABLED:
            return None
        p = request.path
        if p.startswith(("/trial-admin", "/static", "/pay", "/download", "/sw.js", "/manifest.json", "/.well-known")) or p in ("/api/auth/status", "/api/auth/logout"):
            return None
        code = session.get("tcode")
        path = path_for(code)
        if not path or not expired(path):
            return None
        if p.startswith("/api/"):
            return ('{"error":"Trial ended"}', 403, {"Content-Type": "application/json"})
        return pay_page(code, ""), 403

    @app.route("/pay", methods=["GET", "POST"])
    def pay():
        code = (request.form.get("code") or session.get("tcode") or "").strip().upper()
        if request.method == "GET":
            return pay_page(code, "")
        ref = re.sub(r"[^A-Za-z0-9]", "", request.form.get("ref", ""))[:20]
        ip = request.remote_addr or "?"
        now = time.time()
        h = [t for t in _hits.get(ip, []) if now - t < 3600]
        if len(h) >= 5:
            return pay_page(code, "Too many tries. Please message us."), 429
        path = path_for(code)
        if not path:
            return pay_page(code, "Tester Code not found."), 400
        if len(ref) < 4:
            return pay_page(code, "Enter the GCash reference number (at least 4 characters)."), 400
        h.append(now)
        _hits[ip] = h
        _put(path, "pay_ref", ref + " @ " + datetime.datetime.now().isoformat(timespec="minutes"))
        tg("[Tindahan Kahera] PAYMENT: code %s, ref %s" % (code, ref))
        return pay_page(code, "Received! We will check and activate your account. Try again in a few minutes."), 200

    @app.route("/api/trial-info")
    def trial_info():
        days = None
        try:
            path = path_for(session.get("tcode"))
            if path:
                e = end_date(path)
                if e is not None:
                    days = max((e - datetime.date.today()).days, 0)
        except Exception:
            days = None
        return (json.dumps({"days": days}), 200, {"Content-Type": "application/json"})

    @app.route("/trial-admin", methods=["GET", "POST"])
    def trial_admin():
        msg = ""
        if request.method == "POST":
            code = (request.form.get("code") or "").strip().upper()
            path = path_for(code)
            if not hmac.compare_digest(request.form.get("key", ""), TRIAL_KEY):
                msg = "Wrong key."
            elif not path:
                msg = "Tester Code not found."
            else:
                try:
                    d = int(request.form.get("days") or 0)
                except ValueError:
                    d = 0
                if d <= 0:
                    msg = "Days must be 1 or more."
                else:
                    _put(path, "trial_unlock", "0")
                    e0 = end_date(path)
                    base = max(datetime.date.today(), e0) if e0 else datetime.date.today()
                    ne = (base + datetime.timedelta(days=d)).isoformat()
                    _put(path, "trial_end", ne)
                    msg = "%s: active until %s (+%d days)." % (code, ne, d)
        page = ("<!doctype html><meta charset=utf-8>"
                "<meta name=viewport content='width=device-width,initial-scale=1'>"
                "<title>Trial admin</title>"
                "<style>body{margin:0;background:#0f172a;font-family:sans-serif;color:#fff;"
                "display:flex;align-items:center;justify-content:center;min-height:100vh}"
                ".card{width:90%;max-width:340px;background:#1e293b;border-radius:14px;padding:20px;"
                "box-shadow:0 8px 30px rgba(0,0,0,.5)}"
                "h3{margin:0 0 10px;text-align:center}"
                ".msg{background:#14532d;border-radius:8px;padding:10px;margin-bottom:10px;"
                "text-align:center;font-weight:bold}"
                "input{width:100%;box-sizing:border-box;padding:14px;margin:6px 0;font-size:18px;"
                "border-radius:8px;border:1px solid #334155;background:#0f172a;color:#fff;text-align:center}"
                "button{width:100%;padding:15px;margin-top:8px;font-size:18px;font-weight:bold;"
                "border:none;border-radius:8px;background:#22c55e;color:#0f172a}"
                "</style><div class=card><a href=/ style='display:block;margin-bottom:12px;padding:12px;background:#334155;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;text-align:center'>&larr; Back to app</a><h3>Trial admin</h3>%s"
                "<form method=post>"
                "<input id=k name=key type=password placeholder='Key' autocomplete=off autocapitalize=off autocorrect=off spellcheck=false>"
                "<input name=code placeholder='Tester Code' autocapitalize=characters autocomplete=off>"
                "<input name=days type=number inputmode=numeric placeholder='Days (30 or 365)' value=30>"
                "<button>Activate</button></form></div>"
                "<script>var k=document.getElementById('k');"
                "try{k.value=localStorage.getItem('ta_k')||''}catch(e){}"
                "k.form.addEventListener('submit',function(){try{localStorage.setItem('ta_k',k.value)}catch(e){}})"
                "</script>")
        box = "<div class=msg>%s</div>" % html.escape(msg) if msg else ""
        return page.replace("%s", box, 1)
