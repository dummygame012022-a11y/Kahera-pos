from flask import Flask, render_template, jsonify, request, session, g, has_request_context
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps
from datetime import timedelta
import sqlite3, os, re, time, secrets, json, urllib.request, urllib.parse
B=os.path.dirname(os.path.abspath(__file__))+"/"

app = Flask(__name__)
DB_PATH = B+"pos_database.db"
SECRET_PATH = B+"secret.key"
HASH_METHOD = "pbkdf2:sha256:100000"
ROLES = ("admin", "cashier", "kitchen")
STATE_WRITE = {
    "totskie_categories": {"admin"},
    "totskie_store": {"admin"},
    "totskie_products": {"admin", "cashier"},
    "totskie_sales": {"admin", "cashier"},
    "totskie_utang": {"admin", "cashier"},
    "totskie_kds": {"admin", "cashier", "kitchen"},
}
KITCHEN_READ = {"totskie_kds", "totskie_products", "totskie_categories", "totskie_store"}
FAILS = {}
ACTIVE = {}
MAX_ONLINE = 20
ONLINE_WINDOW = 600


def load_secret():
    if not os.path.exists(SECRET_PATH):
        with open(SECRET_PATH, "w") as f:
            f.write(secrets.token_hex(32))
        try:
            os.chmod(SECRET_PATH, 0o600)
        except OSError:
            pass
    with open(SECRET_PATH) as f:
        return f.read().strip()


app.secret_key = load_secret()
app.permanent_session_lifetime = timedelta(hours=12)
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")


def db():
    path = DB_PATH
    if has_request_context():
        c = g.get("tcode") or session.get("tcode") or ""
        if re.fullmatch(r"[A-Z0-9]{6}", c) and os.path.exists(B+"pos_"+c+".db"):
            path = B+"pos_"+c+".db"
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = db()
    conn.execute("CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)")
    conn.execute("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, role TEXT NOT NULL, pin_hash TEXT NOT NULL)")
    conn.commit()
    conn.close()


def current_user():
    uid = session.get("uid")
    if not uid:
        return None
    conn = db()
    row = conn.execute("SELECT id, name, role FROM users WHERE id=?", (uid,)).fetchone()
    conn.close()
    return dict(row) if row else None


def require_role(*roles):
    def deco(fn):
        @wraps(fn)
        def wrapper(*a, **k):
            u = current_user()
            if not u:
                return jsonify({"error": "login required"}), 401
            if roles and u["role"] not in roles:
                return jsonify({"error": "not allowed"}), 403
            return fn(*a, **k)
        return wrapper
    return deco


@app.route("/sw.js")
def sw_js():
    from flask import send_from_directory
    r=send_from_directory(app.static_folder,"sw.js")
    r.headers["Cache-Control"]="no-cache"
    return r

import trial
trial.setup(app, db)

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/auth/status", methods=["GET"])
def auth_status():
    conn = db()
    n = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    conn.close()
    return jsonify({"setup_needed": n == 0, "user": current_user(), "signup_open": len(tester_files()) < max_users()})


@app.route("/api/auth/setup", methods=["POST"])
def auth_setup():
    pin = str((request.get_json(silent=True) or {}).get("pin", ""))
    if not re.fullmatch(r"[0-9]{4,6}", pin):
        return jsonify({"error": "PIN must be 4-6 digits."}), 400
    conn = db()
    if conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] > 0:
        conn.close()
        return jsonify({"error": "Already set up."}), 403
    cur = conn.execute("INSERT INTO users (name, role, pin_hash) VALUES (?, 'admin', ?)", ("Admin", generate_password_hash(pin, method=HASH_METHOD)))
    conn.commit()
    uid = cur.lastrowid
    conn.close()
    session.clear()
    session["uid"] = uid
    session.permanent = True
    return jsonify({"ok": True})


def online_count():
    now = time.time()
    for k in [k for k, v in ACTIVE.items() if now - v > ONLINE_WINDOW]:
        ACTIVE.pop(k, None)
    return len(ACTIVE)


@app.before_request
def track_online():
    if request.path.startswith("/api/") and session.get("uid") and session.get("tcode") != "OWNER1":
        sid = session.get("sid")
        if not sid:
            sid = secrets.token_hex(8)
            session["sid"] = sid
        ACTIVE[sid] = time.time()


@app.route("/api/online")
def api_online():
    if session.get("tcode") != "OWNER1" or not current_user():
        return jsonify({"error": "not allowed"}), 403
    return jsonify({"online": online_count(), "max_online": MAX_ONLINE, "testers": len(tester_files())})


def tester_files():
    return [f for f in os.listdir(B) if f != "pos_OWNER1.db" and re.fullmatch(r"pos_[A-Z0-9]{6}\.db", f)]


def max_users():
    try:
        return int(json.load(open(B+"telegram.json")).get("max_users", 20))
    except Exception:
        return 20


def tg(text):
    try:
        c = json.load(open(B+"telegram.json"))
        d = urllib.parse.urlencode({"chat_id": c["chat_id"], "text": text}).encode()
        urllib.request.urlopen("https://api.telegram.org/bot%s/sendMessage" % c["token"], d, timeout=8)
    except Exception:
        pass


@app.route("/api/auth/signup", methods=["POST"])
def auth_signup():
    pin = str((request.get_json(silent=True) or {}).get("pin", ""))
    if not re.fullmatch(r"[0-9]{4,6}", pin):
        return jsonify({"error": "PIN must be 4-6 digits."}), 400
    if online_count() >= MAX_ONLINE:
        return jsonify({"error": "Server busy. Try again in a few minutes."}), 503
    n = len(tester_files())
    mx = max_users()
    if n >= mx:
        return jsonify({"error": "Tester is full. Try again later."}), 403
    code = secrets.token_hex(3).upper()
    while os.path.exists(B+"pos_"+code+".db"):
        code = secrets.token_hex(3).upper()
    src = sqlite3.connect(DB_PATH)
    schemas = [r[0] for r in src.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL")]
    src.close()
    dst = sqlite3.connect(B+"pos_"+code+".db")
    for q in schemas:
        dst.execute(q)
    cur = dst.execute("INSERT INTO users (name, role, pin_hash) VALUES (?, 'admin', ?)", ("Admin", generate_password_hash(pin, method=HASH_METHOD)))
    now = int(time.time() * 1000)
    cats = [{"id": now + 1, "name": "Load", "color": "#3b82f6"}, {"id": now + 2, "name": "Inumin", "color": "#06b6d4"}, {"id": now + 3, "name": "Snacks", "color": "#f59e0b"}, {"id": now + 4, "name": "Grocery", "color": "#22c55e"}]
    items = [("Load 50", 50, 9999, "Load"), ("Load 100", 100, 9999, "Load"), ("Softdrinks", 20, 24, "Inumin"), ("Bottled Water", 15, 36, "Inumin"), ("Kape sachet", 8, 50, "Snacks"), ("Chips", 10, 40, "Snacks"), ("Instant Noodles", 15, 30, "Grocery"), ("Asukal 1/4kg", 25, 20, "Grocery"), ("Sabon", 15, 20, "Grocery")]
    prods = [{"id": now + 10 + i, "name": "SAMPLE " + n, "price": p, "stock": st, "category": c} for i, (n, p, st, c) in enumerate(items)]
    dst.execute("INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)", ("totskie_categories", json.dumps(cats)))
    dst.execute("INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)", ("totskie_products", json.dumps(prods)))
    dst.commit()
    uid = cur.lastrowid
    dst.close()
    session.clear()
    session["tcode"] = code
    session["uid"] = uid
    session.permanent = True
    tg("[Tindahan Kahera] Bag-ong user: %d/%d, online: %d/%d" % (n+1, mx, online_count(), MAX_ONLINE))
    if n+1 >= mx:
        tg("[Tindahan Kahera] PUNO NA %d/%d. Himo na og bag-ong server." % (n+1, mx))
    return jsonify({"ok": True, "code": code})


@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    ip = request.remote_addr or "?"
    count, locked_until = FAILS.get(ip, (0, 0))
    now = time.time()
    if locked_until > now:
        return jsonify({"error": "Too many tries. Wait %d seconds." % (int(locked_until - now) + 1)}), 429
    jd = request.get_json(silent=True) or {}
    pin = str(jd.get("pin", ""))
    c = str(jd.get("code", "")).upper()
    g.tcode = c if re.fullmatch(r"[A-Z0-9]{6}", c) else ""
    if not g.tcode or not os.path.exists(B+"pos_"+g.tcode+".db"):
        return jsonify({"error": "Tester code is required."}), 401
    if g.tcode != "OWNER1" and online_count() >= MAX_ONLINE:
        return jsonify({"error": "Server busy. Try again in a few minutes."}), 503
    conn = db()
    users = conn.execute("SELECT id, pin_hash FROM users").fetchall()
    conn.close()
    for u in users:
        if check_password_hash(u["pin_hash"], pin):
            FAILS.pop(ip, None)
            session.clear()
            session["uid"] = u["id"]
            session["tcode"] = g.tcode if g.tcode and os.path.exists(B+"pos_"+g.tcode+".db") else ""
            session.permanent = True
            return jsonify({"ok": True})
    count += 1
    FAILS[ip] = (count, now + 30 if count >= 5 else 0)
    if count >= 5:
        FAILS[ip] = (0, now + 30)
    return jsonify({"error": "Wrong PIN."}), 401


@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    ACTIVE.pop(session.get("sid"), None)
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/users", methods=["GET"])
@require_role("admin")
def list_users():
    conn = db()
    rows = conn.execute("SELECT id, name, role FROM users ORDER BY id").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/users", methods=["POST"])
@require_role("admin")
def add_user():
    d = request.get_json(silent=True) or {}
    name = str(d.get("name", "")).strip()[:30]
    role = d.get("role")
    pin = str(d.get("pin", ""))
    if not name:
        return jsonify({"error": "Please enter a name."}), 400
    if role not in ROLES:
        return jsonify({"error": "Bad role."}), 400
    if not re.fullmatch(r"[0-9]{4,6}", pin):
        return jsonify({"error": "PIN must be 4-6 digits."}), 400
    conn = db()
    for u in conn.execute("SELECT pin_hash FROM users").fetchall():
        if check_password_hash(u["pin_hash"], pin):
            conn.close()
            return jsonify({"error": "That PIN is already used."}), 400
    conn.execute("INSERT INTO users (name, role, pin_hash) VALUES (?, ?, ?)", (name, role, generate_password_hash(pin, method=HASH_METHOD)))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/users/<int:uid>", methods=["DELETE"])
@require_role("admin")
def delete_user(uid):
    me = current_user()
    if me["id"] == uid:
        return jsonify({"error": "You cannot delete your own account."}), 400
    conn = db()
    row = conn.execute("SELECT role FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Not found."}), 404
    if row["role"] == "admin" and conn.execute("SELECT COUNT(*) FROM users WHERE role='admin'").fetchone()[0] <= 1:
        conn.close()
        return jsonify({"error": "Cannot delete the last admin."}), 400
    conn.execute("DELETE FROM users WHERE id=?", (uid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/recovery/status", methods=["GET"])
@require_role("admin")
def recovery_status():
    me = current_user()
    conn = db()
    conn.execute("CREATE TABLE IF NOT EXISTS recovery (uid INTEGER PRIMARY KEY, code_hash TEXT NOT NULL)")
    row = conn.execute("SELECT 1 FROM recovery WHERE uid=?", (me["id"],)).fetchone()
    conn.close()
    return jsonify({"has_code": bool(row)})


@app.route("/api/recovery/generate", methods=["POST"])
@require_role("admin")
def recovery_generate():
    me = current_user()
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    raw = "".join(secrets.choice(alphabet) for _ in range(8))
    conn = db()
    conn.execute("CREATE TABLE IF NOT EXISTS recovery (uid INTEGER PRIMARY KEY, code_hash TEXT NOT NULL)")
    conn.execute("INSERT OR REPLACE INTO recovery (uid, code_hash) VALUES (?, ?)", (me["id"], generate_password_hash(raw, method=HASH_METHOD)))
    conn.commit()
    conn.close()
    return jsonify({"code": raw[:4] + "-" + raw[4:]})


@app.route("/api/auth/recover", methods=["POST"])
def auth_recover():
    ip = request.remote_addr or "?"
    count, locked_until = FAILS.get(ip, (0, 0))
    now = time.time()
    if locked_until > now:
        return jsonify({"error": "Too many tries. Wait %d seconds." % (int(locked_until - now) + 1)}), 429
    jd = request.get_json(silent=True) or {}
    pin = str(jd.get("pin", ""))
    c = str(jd.get("code", "")).upper()
    rec = re.sub(r"[^A-Z0-9]", "", str(jd.get("recovery", "")).upper())
    g.tcode = c if re.fullmatch(r"[A-Z0-9]{6}", c) else ""
    if not g.tcode or not os.path.exists(B+"pos_"+g.tcode+".db"):
        return jsonify({"error": "Tester code is required."}), 401
    if not re.fullmatch(r"[0-9]{4,6}", pin):
        return jsonify({"error": "PIN must be 4-6 digits."}), 400
    conn = db()
    conn.execute("CREATE TABLE IF NOT EXISTS recovery (uid INTEGER PRIMARY KEY, code_hash TEXT NOT NULL)")
    rows = conn.execute("SELECT uid, code_hash FROM recovery").fetchall()
    hit = None
    for r in rows:
        if len(rec) == 8 and check_password_hash(r["code_hash"], rec):
            hit = r["uid"]
            break
    if hit is None:
        conn.close()
        count += 1
        FAILS[ip] = (count, now + 30 if count >= 5 else 0)
        if count >= 5:
            FAILS[ip] = (0, now + 30)
        return jsonify({"error": "Wrong Recovery Code."}), 401
    if not conn.execute("SELECT 1 FROM users WHERE id=?", (hit,)).fetchone():
        conn.execute("DELETE FROM recovery WHERE uid=?", (hit,))
        conn.commit()
        conn.close()
        return jsonify({"error": "Account not found."}), 404
    for u in conn.execute("SELECT id, pin_hash FROM users").fetchall():
        if u["id"] != hit and check_password_hash(u["pin_hash"], pin):
            conn.close()
            return jsonify({"error": "That PIN is already used."}), 400
    conn.execute("UPDATE users SET pin_hash=? WHERE id=?", (generate_password_hash(pin, method=HASH_METHOD), hit))
    conn.execute("DELETE FROM recovery WHERE uid=?", (hit,))
    conn.commit()
    conn.close()
    FAILS.pop(ip, None)
    return jsonify({"ok": True})


@app.route("/api/users/<int:uid>/pin", methods=["PUT"])
@require_role("admin")
def change_pin(uid):
    d = request.get_json(silent=True) or {}
    pin = str(d.get("pin", ""))
    if not re.fullmatch(r"[0-9]{4,6}", pin):
        return jsonify({"error": "PIN must be 4-6 digits."}), 400
    conn = db()
    if not conn.execute("SELECT 1 FROM users WHERE id=?", (uid,)).fetchone():
        conn.close()
        return jsonify({"error": "Not found."}), 404
    for u in conn.execute("SELECT id, pin_hash FROM users").fetchall():
        if u["id"] != uid and check_password_hash(u["pin_hash"], pin):
            conn.close()
            return jsonify({"error": "That PIN is already used."}), 400
    conn.execute("UPDATE users SET pin_hash=? WHERE id=?", (generate_password_hash(pin, method=HASH_METHOD), uid))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/state", methods=["GET"])
@require_role()
def get_state():
    u = current_user()
    conn = db()
    rows = conn.execute("SELECT key, value FROM app_state").fetchall()
    conn.close()
    out = {r["key"]: r["value"] for r in rows if u["role"] != "kitchen" or r["key"] in KITCHEN_READ}
    return jsonify(out)


@app.route("/api/state/<key>", methods=["POST"])
def set_state(key):
    u = current_user()
    if not u:
        return jsonify({"error": "login required"}), 401
    if key not in STATE_WRITE:
        return jsonify({"error": "unknown key"}), 400
    if u["role"] not in STATE_WRITE[key]:
        return jsonify({"error": "not allowed"}), 403
    value = (request.get_json(silent=True) or {}).get("value")
    if not isinstance(value, str):
        return jsonify({"error": "bad value"}), 400
    conn = db()
    conn.execute(
        "INSERT INTO app_state (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP",
        (key, value),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


import json as _json
import time as _time


def _kds_mutate(change):
    conn = db()
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT value FROM app_state WHERE key='totskie_kds'").fetchone()
        try:
            orders = _json.loads(row["value"]) if row else []
        except ValueError:
            orders = []
        if not isinstance(orders, list):
            orders = []
        result = change(orders)
        conn.execute(
            "INSERT INTO app_state (key, value, updated_at) VALUES ('totskie_kds', ?, CURRENT_TIMESTAMP) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP",
            (_json.dumps(orders),),
        )
        conn.commit()
        return orders, result
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@app.route("/api/kds", methods=["GET"])
@require_role("admin", "cashier", "kitchen")
def kds_list():
    conn = db()
    row = conn.execute("SELECT value FROM app_state WHERE key='totskie_kds'").fetchone()
    conn.close()
    try:
        orders = _json.loads(row["value"]) if row else []
    except ValueError:
        orders = []
    return jsonify(orders if isinstance(orders, list) else [])


@app.route("/api/kds", methods=["POST"])
@require_role("admin", "cashier")
def kds_add():
    d = request.get_json(silent=True) or {}
    items = d.get("items")
    if not isinstance(items, list):
        return jsonify({"error": "bad items"}), 400
    order = {
        "id": int(_time.time() * 1000),
        "customer": str(d.get("customer") or "")[:100],
        "items": items,
        "note": str(d.get("note") or "")[:500],
        "status": "pending",
        "orderType": str(d.get("orderType") or "")[:50],
        "time": str(d.get("time") or "")[:20],
    }

    def change(orders):
        used = {o.get("id") for o in orders if isinstance(o, dict)}
        while order["id"] in used:
            order["id"] += 1
        orders.insert(0, order)

    orders, _ = _kds_mutate(change)
    return jsonify({"ok": True, "order": order, "orders": orders})


@app.route("/api/kds/<int:oid>/ready", methods=["POST"])
@require_role("admin", "cashier", "kitchen")
def kds_ready(oid):
    def change(orders):
        for o in orders:
            if isinstance(o, dict) and o.get("id") == oid and o.get("status") == "pending":
                o["status"] = "ready"
                return True
        return False

    orders, found = _kds_mutate(change)
    return jsonify({"ok": True, "found": found, "orders": orders})


@app.route("/api/kds/<int:oid>/remove", methods=["POST"])
@require_role("admin", "cashier", "kitchen")
def kds_remove(oid):
    def change(orders):
        before = len(orders)
        orders[:] = [o for o in orders if not (isinstance(o, dict) and o.get("id") == oid)]
        return len(orders) < before

    orders, found = _kds_mutate(change)
    return jsonify({"ok": True, "found": found, "orders": orders})


@app.route("/api/reset", methods=["POST"])
@require_role("admin")
def reset_data():
    me = current_user()
    key = "reset-" + (request.remote_addr or "?")
    count, locked_until = FAILS.get(key, (0, 0))
    now = time.time()
    if locked_until > now:
        return jsonify({"error": "Too many tries. Wait %d seconds." % (int(locked_until - now) + 1)}), 429
    pin = str((request.get_json(silent=True) or {}).get("pin", ""))
    conn = db()
    row = conn.execute("SELECT pin_hash FROM users WHERE id=?", (me["id"],)).fetchone()
    if not row or not check_password_hash(row["pin_hash"], pin):
        conn.close()
        count += 1
        FAILS[key] = (0, now + 30) if count >= 5 else (count, 0)
        return jsonify({"error": "Wrong PIN."}), 401
    FAILS.pop(key, None)
    conn.execute("DELETE FROM app_state")
    for k in ("totskie_products", "totskie_sales", "totskie_kds", "totskie_utang"):
        conn.execute("INSERT INTO app_state (key, value) VALUES (?, '[]')", (k,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/categories", methods=["GET"])
@require_role()
def get_categories():
    try:
        conn = db()
        rows = conn.execute("SELECT * FROM categories").fetchall()
        conn.close()
        return jsonify([dict(r) for r in rows])
    except sqlite3.Error:
        return jsonify([])


@app.route("/api/products", methods=["GET"])
@require_role()
def get_products():
    try:
        conn = db()
        rows = conn.execute("SELECT * FROM products").fetchall()
        conn.close()
        return jsonify([dict(r) for r in rows])
    except sqlite3.Error:
        return jsonify([])


@app.route("/manifest.json")
def pwa_manifest():
    from flask import send_from_directory
    return send_from_directory(app.static_folder, "manifest.json", mimetype="application/manifest+json")


@app.route("/.well-known/assetlinks.json")
def pwa_assetlinks():
    import os
    from flask import Response
    fp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assetlinks.json")
    data = open(fp, encoding="utf-8").read() if os.path.exists(fp) else "[]"
    return Response(data, mimetype="application/json")


@app.route("/download")
def download_page():
    return render_template("download.html")

@app.route("/download/apk")
def download_apk():
    from flask import send_from_directory
    r = send_from_directory(app.static_folder, "Tindahan_Kahera.apk", mimetype="application/vnd.android.package-archive", as_attachment=True)
    r.headers["Cache-Control"] = "no-cache"
    return r


if __name__ == "__main__":
    init_db()
    app.run(host=os.environ.get("TOTSKIE_HOST", "127.0.0.1"), port=8080, debug=os.environ.get("TOTSKIE_DEBUG") == "1")
