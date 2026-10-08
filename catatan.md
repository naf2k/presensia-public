## 🧩 Workflow yang aku sarankan

```
📄 PRD.md
   │
   ▼
1️⃣ GRILL-ME
   │
   │  "Apakah requirement-nya sudah jelas?"
   ▼
2️⃣ TO-SPEC
   │
   │  "Bagaimana cara membangunnya?"
   ▼
3️⃣ IMPLEMENTATION PLAN
   │
   │  "Apa saja yang harus dikerjakan?"
   ▼
4️⃣ FRONTEND
   │
   │  + skill frontend kamu
   ▼
5️⃣ BACKEND
   │
   ▼
6️⃣ INTEGRATION
   │
   ▼
7️⃣ TESTING / VERIFICATION
   │
   ▼
8️⃣ CODE REVIEW
   │
   │  "Apakah kode ini sehat?"
   ▼
9️⃣ CLEANUP / FIX
   │
   ▼
🔟 DEPLOY
```

Sekarang kita bedah satu-satu.

---

# 1. 📄 Mulai dari PRD

Ini **workflow kamu yang sekarang**, dan menurutku sudah benar.

Misalnya:

```
docs/PRD.md
```

Isinya:

```
# Subscription System

## Goal
...

## User Flow
...

## Features
...

## Requirements
...
```

Kamu masuk OpenCode dan bilang:

> "Baca dan pahami [PRD.md](http://PRD.md). Jangan coding dulu."

**Skill:** belum perlu skill.

Tujuannya cuma membuat agent memahami konteks.

---

# 2. 🧠 Setelah itu → `grill-me`

Nah ini skill pertama yang aku sarankan.

Kamu bilang:

> "Sekarang gunakan skill grill-me untuk mereview PRD ini. Cari requirement yang ambigu, asumsi yang belum ditentukan, edge case, dan keputusan yang perlu aku tentukan. Jangan implementasikan dulu."

### AI akan melakukan:

```
PRD
 ↓
❓ Apa yang belum jelas?
 ↓
❓ Apa yang berpotensi bikin salah implementasi?
 ↓
❓ Apa edge case-nya?
 ↓
Kamu jawab
```

Misalnya AI bertanya:

```
1. Subscription monthly atau yearly?

2. Apakah user bisa cancel?

3. Kalau payment gagal bagaimana?

4. Apakah subscription otomatis expire?

5. Apakah admin bisa mengubah subscription?
```

Kamu jawab satu-satu.

### Hasilnya:

```
PRD
+
Jawaban kamu
=
Requirement yang lebih jelas
```

**Skill:** `grill-me`

---

# 3. 📐 Setelah requirement jelas → `to-spec`

Sekarang AI sudah ngerti **APA yang kamu mau**.

Tapi belum menentukan secara detail **BAGAIMANA cara membuatnya**.

Di sinilah `to-spec` berguna.

Kamu bilang:

> "Sekarang gunakan skill to-spec untuk mengubah requirement yang sudah kita sepakati menjadi implementation spec. Jangan coding dulu."

AI kemudian membuat sesuatu seperti:

```
docs/specs/subscription.md
```

Contohnya:

```
# Subscription Specification

## Database

subscriptions
payments

## Backend

SubscriptionController
SubscriptionService
PaymentWebhookController

## API

POST /api/subscriptions
GET /api/subscription
POST /api/subscription/cancel

## Frontend

SubscriptionPage
PricingCard
SubscriptionStatus

## Business Rules

...
```

Jadi:

```
GRILL
   ↓
"Apa yang harus dibuat?"
   ↓
TO-SPEC
   ↓
"Bagaimana kita akan membuatnya?"
```

**Skill:** `to-spec`

---

# 4. 🗺️ Buat implementation plan

Sekarang sudah ada:

```
PRD
 ↓
Requirement jelas
 ↓
SPEC
```

Sekarang AI membuat **urutan pekerjaan**.

Misalnya:

```
Phase 1
Database
 ├─ migration
 └─ model

Phase 2
Backend
 ├─ service
 ├─ controller
 └─ API

Phase 3
Frontend
 ├─ pricing
 ├─ subscription page
 └─ status

Phase 4
Integration

Phase 5
Testing
```

Untuk bagian ini kamu **nggak harus memakai skill khusus**. Bisa cukup meminta OpenCode membuat implementation plan berdasarkan spec.

Kalau project-mu besar, skill seperti `to-tickets` juga bisa digunakan untuk memecah pekerjaan menjadi task/ticket.

Jadi:

```
SPEC
 ↓
TASKS
 ↓
IMPLEMENT
```

**Skill:** `to-tickets` *(opsional)*

---

# 5. 🎨 Sekarang baru frontend

Nah, di sini workflow kamu **tetap sama**.

Kamu sudah punya skill frontend sendiri.

Kamu bilang:

> "Implementasikan bagian frontend berdasarkan PRD dan spec yang sudah dibuat. Gunakan frontend skill yang tersedia."

Agent bekerja:

```
SPEC
 ↓
Frontend
 ↓
Components
 ↓
Pages
 ↓
State
 ↓
API integration preparation
```

**Skill: frontend skill kamu**

---

# 6. ⚙️ Setelah frontend → backend

Sekarang backend.

Kamu bilang:

> "Implementasikan backend berdasarkan spec. Ikuti arsitektur dan convention project yang sudah ada."

Agent membuat:

```
Migration
 ↓
Model
 ↓
Service
 ↓
Controller
 ↓
API
 ↓
Validation
```

Untuk backend **nggak harus menggunakan skill Matt Pocock tertentu**.

Justru lebih penting kamu punya **aturan arsitektur project**.

Misalnya:

```
Controller
   ↓
Service
   ↓
Model / Repository
```

bukan:

```
Controller
 └── 800 baris business logic 💀
```

Ini nantinya bisa kamu taruh di [`AGENTS.md`](http://AGENTS.md).

---

# 7. 🔗 Integrasikan frontend + backend

Sekarang:

```
Frontend
     +
Backend
     ↓
Integration
```

Kamu bilang:

> "Integrasikan frontend dengan backend berdasarkan API contract di spec. Pastikan loading, error, validation, authentication, dan empty states ditangani."

Agent mengerjakan:

```
Frontend
    ↓
API Client
    ↓
Laravel API
    ↓
Database
```

Kemudian verifikasi flow end-to-end.

**Skill khusus:** nggak wajib.

---

# 8. 🧪 Testing / Verification

Ini workflow kamu yang lama juga tetap dipakai.

Tapi di sini kamu bisa menggunakan `tdd` **untuk bagian yang penting**.

Misalnya:

```
Payment
Authentication
Authorization
Subscription
Order
Financial logic
```

Kamu bilang:

> "Gunakan TDD untuk business logic subscription dan pastikan test mencakup happy path dan edge cases."

Workflow:

```
Test
 ↓
Implement
 ↓
Run test
 ↓
Fix
 ↓
Run again
```

Sedangkan untuk fitur UI kecil, nggak perlu memaksakan TDD.

**Skill:** `tdd` **— conditional**

---

# 9. 🔍 Setelah semuanya selesai → `code-review`

**Ini tambahan yang menurutku paling penting untuk masalah codebase kamu.**

Sebelum deploy:

> "Sekarang gunakan skill code-review untuk mereview seluruh perubahan fitur ini. Fokus pada architecture, duplication, unnecessary complexity, naming, security, error handling, testing, dan consistency dengan codebase. Jangan hanya mencari syntax error."

AI bisa menemukan:

```
🔴 Critical
Payment webhook tidak idempotent.

🟠 Architecture
Business logic masih berada di controller.

🟡 Maintainability
Logic X duplicated di 3 tempat.

🟡 Frontend
Component terlalu besar.

🟡 Testing
Edge case belum dites.
```

Kemudian:

> "Perbaiki semua issue yang memang valid."

AI memperbaiki.

**Skill:** `code-review`

---

# 10. 🧹 Setelah review → cleanup

Ini bagian yang sering dilewati AI.

Setelah review, suruh:

> "Sekarang lakukan cleanup terhadap perubahan yang baru dibuat. Jangan mengubah behavior. Hapus duplication, dead code, unnecessary abstraction, dan rapikan struktur jika memang diperlukan."

Hasilnya:

```
Before:

Controller
 └── 600 lines

After:

Controller
 └── Service
      ├── SubscriptionService
      └── PaymentService
```

Atau:

```
Before:

ComponentA
ComponentB
ComponentC

semuanya punya logic yang sama.

After:

shared hook / utility
```

**Skill:** bisa menggunakan `code-review`, tidak perlu skill khusus.

---

# 11. 🚀 Baru deploy

Kalau:

```
PRD ✅
Spec ✅
Frontend ✅
Backend ✅
Integration ✅
Tests ✅
Code review ✅
Cleanup ✅
```

baru:

```
🚀 DEPLOY
```

Dan deploy workflow kamu tetap seperti biasa.

---

# 🔄 Jadi kalau dibuat seperti pipeline

Ini yang menurutku paling gampang kamu ingat:

```
┌─────────────────────┐
│      PRD.md         │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 🧠 GRILL-ME         │
│ Klarifikasi         │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 📐 TO-SPEC          │
│ Technical spec      │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 🗺️ PLAN / TICKETS   │
│ Pecah pekerjaan     │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 🎨 FRONTEND         │
│ + frontend skill    │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ ⚙️ BACKEND          │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 🔗 INTEGRATION      │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 🧪 TEST / VERIFY    │
│ + TDD jika perlu    │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 🔍 CODE REVIEW      │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 🧹 CLEANUP          │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ 🚀 DEPLOY           │
└─────────────────────┘
```



```
                    PROJECT KNOWLEDGE
                          │
        ┌─────────────────┼─────────────────┐
        ↓                 ↓                 ↓
     PRD.md       DESIGN_SYSTEM.md    ARCHITECTURE.md
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ↓
                     AGENTS.md
                 (aturan AI bekerja)
                          │
                          ↓
                    ┌───────────┐
                    │   SKILLS  │
                    └───────────┘
                          │
        ┌─────────────────┼──────────────────┐
        ↓                 ↓                  ↓
    grill-me           to-spec          frontend skill
        │                 │                  │
        └─────────────────┼──────────────────┘
                          ↓
                     IMPLEMENTASI
                          ↓
                       TESTING
                          ↓
                    code-review
                          ↓
                       REFACTOR
                          ↓
                       DEPLOY
```



```
skills/
├── grill-me
├── to-spec
├── frontend
├── tdd
├── diagnosing-bugs
├── code-review
└── improve-codebase-architecture
```

