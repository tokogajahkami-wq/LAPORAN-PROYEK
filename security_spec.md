# Firestore Security Specification (`security_spec.md`)

## 1. Data Invariants
1. **Default Deny**: Every unmatched path in Firestore is denied (`allow read, write: if false`).
2. **Strict Ownership & Verified Email**: All documents live under `/users/{userId}/...`. Access requires `request.auth != null`, `request.auth.token.email_verified == true`, and `request.auth.uid == userId`. No user can read, list, create, update, or delete another user's workspace or subcollections.
3. **Master Gate Relational Integrity**: Subcollection single-doc operations (`projects`, `workers`, `periods`, `transactions`, `receipts`) verify parent workspace existence via `exists(/databases/$(database)/documents/users/$(userId))` and `get(...).data.ownerId == request.auth.uid`. Furthermore, `workers` and `periods` creation verify parent `projectId` exists; `transactions` creation verifies `projectId` and `periodId` exist; `receipts` creation verifies `transactionId` exists.
4. **Immutable Ownership & Timestamps**: `ownerId`, `id`, and `createdAt` are immutable on updates. `createdAt == request.time` is enforced on creation, and `updatedAt == request.time` is enforced on updates.
5. **Bounded Arrays & Strings**: Every string field enforces `.size() <= MAX`. Every array (`attendanceDates`, `dropingList`, `cashflowItems`, `items`) enforces `.size() <= MAX`. Every document ID matches `^[a-zA-Z0-9_\-]+$`.
6. **Terminal State Locking**: Rembes transactions whose `rembesStatus` reaches `'Lunas'` cannot have their `rembesStatus` reverted or modified via update.
7. **Secure List Queries**: No `allow list` exists on `/users`. All subcollection `allow list` rules explicitly check `request.auth.uid == userId && resource.data.ownerId == request.auth.uid` without `get()` or `exists()`.

## 2. Dirty Dozen Attack Payloads
1. **Cross-User Workspace Read/Write**: User B (`uid-b`) reads/writes `/users/uid-a/projects/proj-1` -> **DENIED**.
2. **Unverified Email Write**: Authenticated user with `email_verified: false` creates `/users/{uid}` -> **DENIED**.
3. **UID Spoofing on Create**: User A sets `ownerId: "uid-b"` inside `/users/uid-a/projects/proj-1` -> **DENIED**.
4. **Shadow Field Injection**: Client sends extra undeclared key `isAdmin: true` on `UserWorkspace` or `Project` -> **DENIED** (`hasOnly`).
5. **ID Poisoning**: Client writes `/users/{uid}/projects/bad$id..1500chars` -> **DENIED** (`isValidId`).
6. **Orphan Worker/Period Create**: Client creates `/users/{uid}/workers/w-1` with non-existent `projectId: "proj-missing"` -> **DENIED** (`exists` parent check).
7. **Orphan Transaction Create**: Client creates `/users/{uid}/transactions/tx-1` with missing `periodId` -> **DENIED**.
8. **Timestamp Forgery**: Client creates document with backdated `createdAt: Timestamp(2020-01-01)` instead of `request.time` -> **DENIED**.
9. **Immutable Owner Mutation**: Client updates `ownerId` or `createdAt` on an existing project -> **DENIED**.
10. **Terminal Rembes Unlock**: Client updates a `REMBES` transaction whose existing `rembesStatus == 'Lunas'` back to `'Menunggu'` -> **DENIED**.
11. **Oversized Receipt / Denial-of-Wallet**: Client writes `dataUrl` > 350,000 chars in `/receipts/{id}` or `nama` > 120 chars -> **DENIED**.
12. **Blanket User List Scraping**: Client attempts `list` on `/users` collection -> **DENIED**.
