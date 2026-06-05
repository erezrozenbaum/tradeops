<div dir="rtl">

# TradeOps AI — מדריך מנהל מערכת

**גרסה:** 3.41.0  
**עודכן לאחרונה:** 5 ביוני 2026

מדריך זה מכסה התקנה, הגדרות, ניהול מסד נתונים, פריסת Kubernetes ותפעול שוטף של TradeOps AI.

---

## תוכן עניינים

1. [דרישות מקדימות](#1-דרישות-מקדימות)
2. [הגדרת סביבה](#2-הגדרת-סביבה)
3. [פריסה אוטומטית — Windows](#3-פריסה-אוטומטית--windows)
4. [פריסה אוטומטית — Linux ו-macOS](#4-פריסה-אוטומטית--linux-ו-macos)
5. [הפעלה עם Docker Compose (פיתוח)](#5-הפעלה-עם-docker-compose-פיתוח)
6. [ניהול מסד נתונים](#6-ניהול-מסד-נתונים)
7. [אימות משתמשים וניהול חשבונות](#7-אימות-משתמשים-וניהול-חשבונות)
8. [ניטור ולוגים](#8-ניטור-ולוגים)
9. [עצירה ואיפוס](#9-עצירה-ואיפוס)
10. [פריסת Kubernetes עם Helm](#10-פריסת-kubernetes-עם-helm)
11. [פתרון תקלות](#11-פתרון-תקלות)
12. [רשימת פיצ'רים](#12-רשימת-פיצרים)
13. [רשימת תחזוקה](#13-רשימת-תחזוקה)

---

## 1. דרישות מקדימות

### פריסת Docker Compose (פיתוח מקומי)

| כלי | גרסה מינימלית |
|------|----------------|
| Docker Desktop | 24.x |
| Docker Compose plugin | v2 |
| Git | כל גרסה עדכנית |
| מפתח Anthropic API | נדרש לפיצ'רים של AI |

**אין צורך בהתקנת Python או Node.js באופן מקומי.**

### פריסת Kubernetes

| כלי | הערות |
|------|-------|
| Kubernetes cluster | 1.27+ (AKS, EKS, GKE, k3s, minikube — כולם תואמים) |
| Helm | 3.12+ |
| nginx-ingress controller | לניתוב Ingress |
| cert-manager | אופציונלי — לחידוש TLS אוטומטי |
| ArgoCD | אופציונלי — לפריסה GitOps |

---

## 2. הגדרת סביבה

קובץ ההגדרות היחיד שנדרש עבור Docker Compose הוא `backend/.env`.

```bash
cp backend/.env.example backend/.env
```

**משתני הסביבה של `backend/.env`:**

```env
# חובה
DATABASE_URL=postgresql://tradeops:tradeops@db:5432/tradeops
ANTHROPIC_API_KEY=sk-ant-...

# אופציונלי — ערכי ברירת מחדל
SECRET_KEY=change-me-in-production
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:3000
AI_MONTHLY_BUDGET_USD=0
REDIS_URL=redis://redis:6379/0
```

| משתנה | נדרש | תיאור |
|----------|----------|-------------|
| `DATABASE_URL` | כן | מחרוזת חיבור PostgreSQL. ב-Docker Compose השרת הוא `db`. |
| `ANTHROPIC_API_KEY` | כן (לפיצ'רים של AI) | דוח AI, מחקר שוק, המלצות וסוכן AI — כולם דורשים מפתח זה. הפלטפורמה פועלת בלעדיו, אך פיצ'רים אלו יחזירו שגיאה. |
| `SECRET_KEY` | מומלץ | החלף לפני כל פריסה חשופה לאינטרנט. |
| `ALLOWED_ORIGINS` | ייצור | רשימת origins מורשים, מופרדים בפסיק. ברירת מחדל: `http://localhost:3000`. |
| `AI_MONTHLY_BUDGET_USD` | לא | מגבלת הוצאה חודשית לכל משקיע בדולרים. `0` = ללא הגבלה (ברירת מחדל). |
| `REDIS_URL` | לא | מחרוזת חיבור Redis לצורך rate limiting. ייפול ל-in-memory אם לא מוגדר. |
| `LANGFUSE_PUBLIC_KEY` | לא | מפתח ציבורי של Langfuse לניטור קריאות AI. |
| `LANGFUSE_SECRET_KEY` | לא | מפתח סודי של Langfuse. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | לא | נקודת קצה gRPC לייצוא traces (למשל: `http://otel-collector:4317`). |

---

## 3. פריסה אוטומטית — Windows

להפעלה בפקודה אחת על Windows 10 / 11:

```powershell
.\deploy.ps1
```

הסקריפט מבצע את כל השלבים אוטומטית:

| שלב | מה קורה |
|------|-------------|
| בדיקת מערכת | גרסת Windows ≥ 19041, דיסק ≥ 15GB, RAM ≥ 6GB |
| Docker Desktop | מזוהה אוטומטית; מוריד ומתקין אם חסר; מפעיל אם כבוי |
| הפקת סודות | `POSTGRES_PASSWORD` ו-`JWT_SECRET_KEY` נוצרים אוטומטית |
| מפתח Anthropic | פרומפט אינטראקטיבי עם הוראות שלב-אחר-שלב |
| בנייה | `docker compose build` + `docker compose up -d` |
| בדיקת בריאות | מצביא על `/health` וה-frontend עד שניהם עונים |

**מצבים נוספים:**

```powershell
.\deploy.ps1 -Stop        # עצור את כל השירותים
.\deploy.ps1 -Update      # בנה מחדש + הפעל מחדש (שמור סודות)
.\deploy.ps1 -Reset       # אפס סודות ונתחל מחדש
.\deploy.ps1 -Monitoring  # הפעל גם Prometheus + Grafana
```

---

## 4. פריסה אוטומטית — Linux ו-macOS

```bash
chmod +x deploy.sh
./deploy.sh
```

הסקריפט מבצע אותם שלבים כמו גרסת Windows:

| שלב | מה קורה |
|------|-------------|
| בדיקת מערכת | Docker, דיסק ≥ 15GB, RAM ≥ 6GB |
| הפקת סודות | `openssl rand` מייצר JWT, DB וסיסמת Redis אוטומטית |
| מפתח Anthropic | פרומפט אינטראקטיבי — ניתן לדלג (פיצ'רי AI יהיו לא זמינים) |
| בנייה | `docker compose build` + `docker compose up -d` |
| בדיקת בריאות | ממתין ל-backend וה-frontend לפני הצגת כתובות הגישה |

**מצבים נוספים:**

```bash
./deploy.sh --stop        # עצור את כל השירותים
./deploy.sh --update      # בנה מחדש + הפעל מחדש
./deploy.sh --reset       # אפס סודות
./deploy.sh --monitoring  # הפעל גם Prometheus + Grafana
```

---

## 5. הפעלה עם Docker Compose (פיתוח)

```bash
docker compose -f infra/docker-compose.yml up -d
```

סדר הפעלה (מסודר אוטומטית לפי בדיקות בריאות):

1. **PostgreSQL** — עולה ועובר בדיקת `pg_isready`
2. **Backend** — מריץ `alembic upgrade head` (אידמפוטנטי), ואז `uvicorn --reload`
3. **Frontend** — מתקין `npm` ומפעיל את שרת Next.js

הפעלה ראשונה לוקחת 2–3 דקות בזמן שה-npm מוריד חבילות.

| שירות | כתובת |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| Swagger UI | http://localhost:8000/docs |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 (admin / tradeops) |

---

## 6. ניהול מסד נתונים

### הרצת migrations ידנית

```bash
docker compose -f infra/docker-compose.yml exec backend alembic upgrade head
```

Migrations רצים גם אוטומטית בכל הפעלת container.

### היסטוריית Migrations (51 migrations נכון ל-v3.14.1)

| # | תיאור |
|---|-------------|
| 0001 | Schema ראשוני (investor_profiles, financial_profiles, goals, risk_models) |
| 0002-0006 | טבלאות אסטרטגיה, backtesting, paper trading, הרחבות פרופיל |
| 0007-0010 | Holdings, שערי מטבע, price snapshots, portfolio snapshots |
| 0011-0023 | מצבי מעקב אחר יעדים, פנסיה, קרן השתלמות, רכב, התראות, watchlist, משפחה, עסקאות, price alerts |
| 0024 | **טבלת users + JWT auth** (email, password_hash, role) |
| 0025-0033 | סנכרון auto, עמלות, אופציות, weekly digest, fx_rate, makdam, ai_usage_logs, family invites |
| 0034-0036 | CHECK constraints, live_trading_sessions, אינדקסים |
| 0037-0040 | fx_rate_history, paper_trading v2, market_research_reports, net_worth_snapshots, coach_insights |
| 0041-0049 | recommendation_decisions, investor_maturity_snapshots, financial_twin_snapshots, behavioral_risk_events, simulation_runs, command_center_checkpoints, ai_memory_entries, households, advisor_share_tokens |
| 0050 | **staged_orders** — Order Builder, pre-flight review, tax sequencing, goal-linked execution |
| 0051 | **order_templates** + עמודת outcome_snapshots — Template Library ו-Outcome Tracking |

### יצירת migration חדש

```bash
docker compose -f infra/docker-compose.yml exec backend alembic revision --autogenerate -m "תיאור"
```

סקור את הקובץ שנוצר ב-`backend/alembic/versions/` לפני הפעלתו.

### חזרה לגרסה קודמת

```bash
docker compose -f infra/docker-compose.yml exec backend alembic downgrade -1
```

### חיבור ישיר ל-PostgreSQL

```bash
docker compose -f infra/docker-compose.yml exec db psql -U tradeops -d tradeops
```

שאילתות שימושיות:

```sql
-- רשימת כל המשקיעים
SELECT id, full_name, country, base_currency, created_at FROM investor_profiles ORDER BY created_at;

-- חשבונות שמסומנים כקרן חירום
SELECT ia.provider_name, ia.account_type, ia.is_emergency_fund
FROM investment_accounts ia
WHERE ia.is_emergency_fund = true;

-- אירועי audit אחרונים
SELECT investor_profile_id, action, created_at FROM audit_events ORDER BY created_at DESC LIMIT 20;

-- סטטוס staged orders לפי משקיע
SELECT investor_id, status, COUNT(*) FROM staged_orders GROUP BY investor_id, status;
```

### גיבוי מסד הנתונים

```bash
docker compose -f infra/docker-compose.yml exec db pg_dump -U tradeops tradeops > backup_$(date +%Y%m%d).sql
```

שחזור:

```bash
cat backup_YYYYMMDD.sql | docker compose -f infra/docker-compose.yml exec -T db psql -U tradeops tradeops
```

---

## 7. אימות משתמשים וניהול חשבונות

### ארכיטקטורת אימות

- **JWT HS256** עם HttpOnly cookie (`SameSite=Strict`)
- **ביטול session**: Redis JTI blacklist בעת logout (עם fallback ל-in-memory)
- **Rate limiting**: 5 ניסיונות כניסה לכל IP בחלון של 5 דקות (מגובה Redis)
- **תפקידים**: `user` ו-`admin` — כל 35+ נתיבי משקיע אוכפים בעלות

### יצירת חשבון ראשון

1. עבור ל-http://localhost:3000
2. לחץ **Register**
3. הקלד אימייל וסיסמה
4. המשתמש הראשון שנרשם מקבל תפקיד `user`. תפקיד `admin` מוקצה ידנית:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

### לוח בקרת מנהל (Admin Panel)

ניתן לגשת אל `/admin` (דורש תפקיד `admin`):

- ניהול משתמשים: הצגה, עדכון, מחיקה
- מעקב עלויות AI לפי פיצ'ר ולפי משקיע
- ניהול live trading: אישור / ביטול אישור עם אימות 5-שלבי
- audit log: כל הפעולות עם הקשר מלא

---

## 8. ניטור ולוגים

### לוגים

```bash
# כל השירותים
docker compose -f infra/docker-compose.yml logs -f

# backend בלבד
docker compose -f infra/docker-compose.yml logs -f backend

# N שורות אחרונות
docker compose -f infra/docker-compose.yml logs --tail=100 backend
```

### Prometheus ו-Grafana

הפעל עם `--monitoring` flag:

```bash
# Windows
.\deploy.ps1 -Monitoring

# Linux / macOS
./deploy.sh --monitoring
```

| שירות | כתובת | אישורים |
|---------|-------|---------|
| Prometheus | http://localhost:9090 | ללא |
| Grafana | http://localhost:3001 | admin / tradeops |

dashboard של TradeOps מתוקנן מראש ב-Grafana ומציג:
- קצב בקשות
- אחוזוני latency (p50/p95/p99)
- שיעור שגיאות
- כמות בקשות בתהליך

### נקודת קצה `GET /metrics` (Prometheus)

```bash
curl http://localhost:8000/metrics
```

### Great Expectations — בדיקות איכות נתונים

5 suites לבדיקת שלמות הנתונים הפיננסיים רצות יומית בשעה 02:00 UTC:

| Suite | מה נבדק |
|-------|---------|
| Investment Holdings | כמויות חיוביות, מחירים תקינים |
| FX Rates | שערי מטבע חיוביים, קודים תקינים |
| Portfolio Snapshots | ערכי תיק עקביים |
| Financial Goals | סכומי יעד תקינים |
| Financial Profiles | הכנסות ותשלומים חיוביים |

כשלונות נרשמים ל-`audit_events`.

---

## 9. עצירה ואיפוס

### עצירת השירותים

```bash
# Windows
.\deploy.ps1 -Stop

# Linux / macOS
./deploy.sh --stop

# ישיר
docker compose -f infra/docker-compose.yml down
```

### עצירה ומחיקת volumes (אפס הכל)

```bash
docker compose -f infra/docker-compose.yml down -v
```

> **אזהרה:** פעולה זו מוחקת את מסד הנתונים וכל הנתונים. בצע גיבוי לפני ביצוע.

### הפעלה מחדש עם איפוס סודות

```bash
# Windows
.\deploy.ps1 -Reset

# Linux / macOS
./deploy.sh --reset
```

---

## 10. פריסת Kubernetes עם Helm

ה-Helm chart נמצא ב-`helm/tradeops/`.

### התקנה בסיסית

```bash
helm install tradeops ./helm/tradeops \
  --set secrets.jwtSecret="your-secret" \
  --set secrets.dbPassword="your-db-password" \
  --set secrets.anthropicKey="sk-ant-..." \
  --namespace tradeops \
  --create-namespace
```

### הגדרות Helm עיקריות (`values.yaml`)

| מפתח | ברירת מחדל | תיאור |
|------|-----------|-------|
| `backend.replicaCount` | `2` | מספר replicas לbackend |
| `frontend.replicaCount` | `1` | מספר replicas לfrontend |
| `ingress.enabled` | `false` | הפעל nginx Ingress |
| `ingress.tls.enabled` | `false` | הפעל TLS |
| `networkPolicy.enabled` | `true` | הפעל NetworkPolicy (ממליץ להשאיר כן) |
| `podDisruptionBudget.enabled` | `true` | PDB לzero-downtime upgrades |

### עדכון פריסה

```bash
helm upgrade tradeops ./helm/tradeops --reuse-values
```

### הסרה

```bash
helm uninstall tradeops --namespace tradeops
```

---

## 11. פתרון תקלות

### Backend לא עולה

```bash
docker compose -f infra/docker-compose.yml logs backend
```

**שגיאות נפוצות:**

| שגיאה | סיבה | פתרון |
|-------|------|-------|
| `connection refused` ל-DB | PostgreSQL לא מוכן עדיין | המתן — ה-healthcheck מסדר את הסדר |
| `alembic.util.exc.CommandError` | migration נכשל | בדוק את `backend/alembic/versions/` וודא שאין קבצי migration שבורים |
| `ModuleNotFoundError` | חבילה חסרה | בנה מחדש: `docker compose build backend` |
| `permission denied` ל-yfinance cache | ה-container לא יכול לכתוב ל-`/nonexistent` | שגיאה לא קריטית — yfinance עובד ללא cache |

### Frontend לא עולה

```bash
docker compose -f infra/docker-compose.yml logs frontend
```

| שגיאה | פתרון |
|-------|-------|
| `cannot find module` | מחק את `node_modules` ובנה מחדש |
| פורט 3000 תפוס | `netstat -ano | findstr :3000` (Windows) או `lsof -i :3000` (Linux/macOS) |

### Command Center מחזיר HTTP 500

גרסה 3.14.1 תיקנה את הסיבה העיקרית — שיתוף SQLAlchemy Session בין threads מרובים.
אם השגיאה חוזרת, בדוק את לוגי ה-backend:

```bash
docker compose -f infra/docker-compose.yml logs backend | grep -i "500\|error\|exception"
```

### AI features לא עובדים

1. ודא ש-`ANTHROPIC_API_KEY` מוגדר ב-`backend/.env`
2. ודא שהמפתח תקין: `sk-ant-...`
3. בדוק מגבלת תקציב: `AI_MONTHLY_BUDGET_USD` לא אמור להיות נמוך מדי

### 401 Unauthorized

- הtoken פג — התחבר מחדש
- ודא ש-`JWT_SECRET_KEY` זהה בין הפעלות (אל תאפס אותו תוך כדי sessions פעילים)

### מסד הנתונים — ניקוי cache וחיבור מחדש

```bash
docker compose -f infra/docker-compose.yml restart backend
```

---

## 12. רשימת פיצ'רים

### פלטפורמת הליבה

| פיצ'ר | תיאור |
|-------|-------|
| פרופיל משקיע ומשפחה | ניהול פיננסי של משק בית, תלויים, מצב חינוך לקטינים |
| פרופיל פיננסי | הכנסות, הוצאות, חסכונות, חובות, נכסים, התחייבויות |
| ציון יציבות פיננסית | ציון דטרמיניסטי 0–100 — מגביל אסטרטגיות אגרסיביות בעת שבריריות |
| מודל הקצאת סיכון | הקצאה אחוזית של הון לפי tier סיכון (לא "נמוך/בינוני/גבוה" סתמי) |
| מנוע יעדים | חשבונות מקושרים, מעקב התקדמות, ניתוח פערי תרומה חודשית |
| לוח מחוונים | שווי נקי, מגמות 12 חודשים, הקרנת עצמאות פיננסית |

### אינטליגנציית תיק השקעות

| פיצ'ר | תיאור |
|-------|-------|
| חשבונות והחזקות | רב-חשבוני, רב-מטבעי, כל סוגי הנכסים |
| רענון מחירים בזמן אמת | Alpha Vantage / yfinance עם cache 24 שעות |
| ייחוס ביצועים | TWR, MWR (IRR), alpha מול benchmark |
| מנוע איזון | הצעות BUY/SELL לפי tier; עמוד `/rebalance` עם פסי tier |
| בדיקות עמידות | 5 תרחישי קריסה היסטוריים + Monte Carlo P10/P50/P90 |
| קציר הפסדי מס | מועמדים ממוינים לפי חיסכון משוער, אזהרות wash-sale |
| Order Builder | ניתוח תיק מפורט, pre-flight review, מעקב תוצאות |
| Paper Trading — מסחר מדומה | תיק ניסיוני בכסף וירטואלי; הזמנות קנייה/מכירה; reprice בזמן אמת; היסטוריית ticks; מעבר להזמנה אמיתית |

### פיצ'רים חדשים — גרסאות v3.15.0 עד v3.21.0

| גרסה | פיצ'ר | תיאור |
|------|-------|-------|
| v3.15.0 | מנוע התראות | `GET /notifications` — אירועי milestone לכל יעד (50%/75%/100%), התראות מחיר שהופעלו, סיכון התנהגותי HIGH, ריפרוף נדרש, אופציות הפוקעות תוך 7 ימים |
| v3.15.0 | ניהול התראות מחיר | טופס יצירה/מחיקה בעמוד `/notifications`; רשימת התראות פעילות + היסטוריית התראות שהופעלו |
| v3.15.0 | לוח סנכרון ברוקר | `/broker-sync` — כרטיסי בריאות לכל חשבון: Fresh/Stale/Outdated/Never, טבלת חריגות בין הזמנות ממתינות לחזקה בפועל |
| v3.16.0 | מעקב תוצאות הזמנות | job יומי 22:00 UTC — מחשב ומשווה snapshots ב-30/90/180 יום לכל StagedOrder מבוצע עם projected_metrics |
| v3.16.0 | עוזר הקצאה חכם | כפתור "Smart Assist" ב-Order Builder — Claude Haiku מציע 3–5 הקצאות עם עדיפות, הנמקה וקישור יעד; fallback דטרמיניסטי ללא API key |
| v3.17.0 | תוכניות השקעה חוזרות (SIP) | `/recurring-plans` — תוכניות חודשיות/שבועיות לפי ticker ו-asset type; job 06:30 UTC מבצע staging אוטומטי; migration 0052 |
| v3.18.0 | ייצוא CSV | ייצוא מהחזקות (`/investments`), עסקאות (`/transactions`), וסיכום מס שנתי — כולם בצד הלקוח, ללא endpoint חדש |
| v3.19.0 | תוכנית פעולה לפי יעדים | `GET /goals-analysis/action-plan` — רשימת פעולות חודשית לפי עדיפות לכל יעד; כפתור "Stage" מחבר ישירות ל-Order Builder |
| v3.19.0 | Sparklines ברשימת המעקב | sparklines SVG ל-30 יום לכל ticker ב-Watchlist מ-Yahoo Finance; % שינוי ירוק/אדום |
| v3.19.0 | רכישה ישירה מרשימת המעקב | כפתור "Stage Buy" על כל כרטיס watchlist — staging ישיר מהרשימה ל-Order Builder |
| v3.20.0 | השוואת תיק לאורך זמן | `GET /portfolio/comparison?period=1w\|1m\|3m` — השוואת snapshot נוכחי מול עבר: delta שווי, % שינוי, P&L, drift הקצאה לפי סוג נכס |
| v3.20.0 | תקציר בוקר | `GET /morning-brief` — delta לילי, בריאות יעדים, התראות שהופעלו, תוכנית קרובה, סיגנלים התנהגותיים — ללא קריאת AI |
| v3.20.0 | ציר זמן התקדמות יעד | `GET /goals/{id}/progress-timeline` — 12 חודשים planned vs actual; modal עם גרף עמודות כפולות לכל יעד |
| v3.20.0 | פעולות bulk להזמנות | `POST /bulk-execute` + `POST /bulk-cancel`; Order Builder: checkboxes, Select All, Execute/Cancel/ייצוא CSV ל-N הזמנות בבת אחת |
| v3.21.0 | Paper Trading גרסה 2 | שם מותאם אישית לתיק (migration 0053), rename בלחיצה על עיפרון, P&L חי לפוזיציה (מחיר נוכחי, רווח/הפסד, %), תאריך כניסה לפוזיציה, כפתור Reprice All, "Stage Real Order" לכל פוזיציה — מעבר להשקעה אמיתית, "End Test" במקום "Close" עם הסבר ואישור, גרף ticks SVG |
| v3.22.0 | היסטוריית מחיר לפוזיציה | כפתור "Chart" לכל פוזיציה ב-Paper Trading — פותח גרף SVG של מחיר הנכס האמיתי בשוק מאז תאריך הכניסה; קו כניסה מקווקוו, תשואה מצטברת, בורר תקופה 1m/3m/6m; נתונים מ-Yahoo Finance; caching בצד הלקוח; ללא migration |
| v3.23.0 | שדרוג אבטחה — Next.js 16 | שדרוג Next.js 14 ל-16.2.6 (Turbopack), ESLint 8→9; תיקון 9 פרצות אבטחה (SSRF, DoS, HTTP smuggling, XSS, cache poisoning); הגירת שינויי שוברים: params ב-route handlers כ-Promise, תוספת "use client" ל-layout; תיקון מצב בהיר — sidebar, header, footer עם CSS variables במקום ערכי HSL קשיחים; scrollbar, narrative-bg נגישים לנושא |
| v3.24.0 | יומן עסקאות | לכידת נימוק והשתקפות לכל פקודת staged: עמודות rationale + reflection ב-staged_orders (migration 0054); Order Builder — שדה "למה העסקה הזו?" לפני staging; Paper Trading — מודל לכידת נימוק לפני Stage Real Order; עמוד /journal עם פילטרים, עריכת נימוק inline, כרטיס השתקפות לאחר ביצוע |
| v3.25.0 | Decision Intelligence + תיקוני באגים | ציון איכות החלטה (DQS) 0–100: מדוד תהליך, לא ביצועי שוק; רכיבים: תיעוד (0-35), אינטליגנציית סיכון (0-30), יישור מטרות (0-20), מתאם תוצאות (0-15); מתאם תוצאות מחשב תשואה מפועלת (מחיר נוכחי vs. מחיר כניסה) על פקודות BUY מבוצעות; היסטוריה חודשית; כרטיסי תובנות התנהגותיות. תיקונים: Financial Twin + Health Radar 500 (BehavioralMetrics.short_term_count נגישות שגויה); Attribution 500 (PriceSnapshot.investor_id לא קיים). Paper Trading: כפתור "Buy more", Reprice לכל הסטטוסים, רמז קריפטו. |
| v3.26.0 | Behavioral Alpha + Monthly Review | **Behavioral Alpha**: מדידת השפעת הרגלי ההחלטה על התשואות — 3 ממדי אלפא (תיעוד, יישור מטרות, ציות לסיכון) עם ממוצע תשואה וwin rate לכל קבוצה; טבלת ההחלטות הטובות/גרועות ביותר; זיהוי תבניות שגיאה; GET /investors/{id}/behavioral-alpha. **Monthly Review**: דוח חודשי דטרמיניסטי לכל חודש עם פעילות — כותרת, DQS עם שינוי vs. חודש קודם, נרטיב איכות החלטה, נרטיב התנהגות, מיקוד שיפור לחודש הבא, הישגים, watch list; GET /investors/{id}/reflection-report?month=YYYY-MM. |
| v3.27.0 | תיקוני באגים — Decision Intelligence | **עקביות DQS**: `_monthly_dqs` ב-reflection_report השתמש בנוסחה שונה (7.5 קשוח לקורלציית תוצאות) — שניהם משתמשים כעת ב-`compute_monthly_dqs()`. **תיקון return tuple**: `_risk_intelligence_score` החזיר `reconsider_total` כפול במקום `reconsider_with_rationale`. **הגנת מחיר**: נוסף guard ל-`snap.price <= 0` בשתי פונקציות הקורלציה. **פילטר executed_at**: `_get_executed_buys` בבהביוראל אלפא מסנן כעת `executed_at IS NOT NULL`. |
| v3.30.0 | Behavioral Confidence Indicator | ציון κ קריא-בלבד (0–1) המוטמע בכל pre_flight_review; מחושב מ-DQS, אלפא תיעוד, יחס override, thesis ו-edge נכס היסטורי; 4 רמות: HIGH_ALPHA / STANDARD / CAUTION_IMPULSE / HIGH_RISK_OVERRIDE + INSUFFICIENT_DATA (פחות מ-5 פקודות מבוצעות); רכיב PreFlightBehavioralShield בממשק (Shield icon צבעוני); לא משנה גודל פוזיציה או verdict של מנוע הסיכון. |
| v3.29.0 | Smart Assist v2 + SIP Price-Alert Triggers + Next.js cleanup | **Smart Assist v2**: `_build_context()` מזריק `dqs_score` ו-`mistake_patterns` לפרומפט AI; כללים חדשים מדריכים את המודל לטפל ב-DQS נמוך, גודל פוזיציה עבור עסקאות ריאקטיביות, ציות סיכון, וביצועים לא מתועדים; fallback דטרמיניסטי מוסיף עצות מבוססות DQS. **SIP Alert Triggers**: `trigger_on_alert: bool` הוסף ל-`PlanAllocation` (JSONB, ללא migration); כאשר מופעל, מדגם קנייה אוטומטי כשהתראת מחיר מופעלת לאותו Ticker; worker חדש `price_alert_sip_trigger.py` רץ 20:45 UTC; deduplication דרך מזהה ב-notes; פעמון Badge מוצג על הקצאות מחוברות. **Next.js**: הוסרה `"use client"` מיותרת מעמוד Help — הפך ל-Server Component. |
| v3.28.0 | אזהרות Broker Sync פעילות + לוח כיול תוצאות | **אזהרות Broker Sync פעילות**: `get_outdated_accounts()` מחזיר חשבונות עם סנכרון ישן (25h+) או מיושן (72h+); Morning Brief כולל `broker_sync_warnings[]` עם שם חשבון, ספק, סטטוס ותאריך סנכרון אחרון — מוצג ככרטיס אזהרה. Pre-flight review על פקודה חדשה מוסיף סיכון "Stale broker data" לחשבונות ישנים 72h+. **לוח כיול תוצאות**: עמוד `/outcome-calibration` — משווה הקצאת הטיירים שהוקרנה לאמיתית ב-30/90/180 יום; כרטיסי סיכום לכל milestone עם ציון דיוק ממוצע; טבלת פירוט לכל פקודה עם פילטר לפי milestone; `GET /investors/{id}/staged-orders/calibration`. |

### AI Intelligence *(דורש `ANTHROPIC_API_KEY`)*

> כל פיצ'רי ה-AI מייצרים **פלטי תמיכה בהחלטות בלבד**. אין AI שמבצע עסקאות או מהווה ייעוץ פיננסי.

| פיצ'ר | תיאור |
|-------|-------|
| AI Coach | תובנות פרואקטיביות על קרן חירום, מזומן סרק, פערי יעדים, סיכון ריכוז |
| AI Report | ניתוח תיק מלא שנוצר על ידי Claude |
| מחקר שוק עמוק | סריקת 63 מכשירים; תזות השקעה AI; היסטוריה מתמשכת |
| AI Agent | עוזר פיננסי חופשי המבוסס על נתוני תיק אמיתיים |
| ניטור אותות שוק | סנטימנט חדשות יומי + זיהוי אזכורי לווייתן |

### Live Trading *(מוגן — מכובה כברירת מחדל)*

| פיצ'ר | תיאור |
|-------|-------|
| בדיקת מוכנות 5 שלבים | רקורד paper trading (Sharpe > 0.5, ≥30 ימים), אישור סיכון, אישור admin, מגבלות סיכון להזמנה, חיבור IBKR |
| kill switch | עוצר את הsession ומבטל את כל ההזמנות הפתוחות מיידית |

---

## 13. רשימת תחזוקה

### יומי
- [ ] בדוק לוגי backend לשגיאות: `docker logs infra-backend-1 --since 24h | grep ERROR`
- [ ] ודא שכל containers רצים: `docker compose -f infra/docker-compose.yml ps`

### שבועי
- [ ] גבה את מסד הנתונים
- [ ] בדוק שימוש בדיסק: `docker system df`
- [ ] עיין בלוגי Great Expectations ב-`audit_events`

### חודשי
- [ ] בדוק עדכוני אבטחה: `pip-audit` (backend), `npm audit` (frontend)
- [ ] עיין בעלויות AI: Admin Panel → AI Usage
- [ ] בדוק לוגים של Great Expectations לכשלי איכות נתונים

### לפני כל עדכון גרסה
- [ ] גבה את מסד הנתונים
- [ ] בדוק `CHANGELOG.md` לשינויי schema
- [ ] הרץ: `docker compose -f infra/docker-compose.yml exec backend alembic current`
- [ ] בנה מחדש: `docker compose -f infra/docker-compose.yml build`
- [ ] עדכן: `docker compose -f infra/docker-compose.yml up -d`
- [ ] ודא: `docker compose -f infra/docker-compose.yml logs backend --tail=50`

---

> לתיעוד נוסף ראה: [אנגלית — Admin Guide](admin-guide.md) | [ארכיטקטורה](architecture.md) | [Schema](schema.md)

</div>
