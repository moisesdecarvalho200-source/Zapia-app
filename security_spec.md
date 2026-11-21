# ZAPIA Firestore Security Specification

## 1. Data Invariants
1. **Strict Ownership & Verified Identity**: All user documents and subcollections live under `/users/{userId}` and require `request.auth != null`, `request.auth.uid == userId`, and `request.auth.token.email_verified == true`.
2. **Master Gate Relational Sync**: Every subcollection (`preferences`, `vaultItems`, `messages`, `reminders`, `auditLogs`, `devices`) verifies parent `/users/{userId}` exists and `uid == request.auth.uid` on single-document operations (`get`, `create`, `update`, `delete`).
3. **Immutable Ownership & Timestamps**: `uid`, `ownerId`, `id`, and `createdAt` are immutable after creation; `createdAt` and `updatedAt` must equal `request.time`.
4. **Terminal State Locking**: `reminders` with `status == 'concluido'` cannot be updated afterward; `messages` and `auditLogs` are append-only (`allow update: if false`).
5. **PII Isolation**: User emails and display names live exclusively inside `/users/{userId}` which has no public read and no `allow list`.
6. **Payload Bounding & Regex IDs**: Every document ID matches `^[a-zA-Z0-9_-]+$` (`<= 128` chars), and every string/number field enforces explicit bounds matching `firebase-blueprint.json` (including `devices` E2EE fingerprint `^[A-F0-9:]+$` and valid platform/sync status enums).

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Cross-Tenant Read**: User B attempts `get(/users/userA/vaultItems/doc1)` -> DENIED.
2. **Unverified Email Spoof**: User with `email_verified: false` attempts to create `/users/userA` -> DENIED.
3. **Owner Spoofing**: User A creates `/users/userA/vaultItems/doc1` with `ownerId: "userB"` -> DENIED.
4. **Shadow Field Injection**: User A creates `/users/userA` with extra field `isAdmin: true` -> DENIED (`hasOnly` check).
5. **Path ID Poisoning**: User A writes `/users/userA/vaultItems/../../other` or 200-char ID -> DENIED (`isValidId`).
6. **Client Timestamp Forgery**: User A creates message with backdated `createdAt` != `request.time` -> DENIED.
7. **Immutable Field Mutation**: User A updates `/users/userA/vaultItems/doc1` changing `sha256` or `ownerId` -> DENIED.
8. **Terminal State Bypass**: User A updates reminder from `status: 'concluido'` back to `'pendente'` -> DENIED.
9. **Append-Only Log Tampering**: User A attempts to update an existing `auditLogs` or `messages` entry -> DENIED.
10. **Oversized Payload DoS**: User A attempts to write 500KB `encryptedPayload` (> 250,000 limit) -> DENIED.
11. **Invalid Enum Value**: User A sets `preferredPersona: "hacker"` or `scanStatus: "bypass"` -> DENIED.
12. **Blanket List Query**: User B queries `collection('users/userA/vaultItems')` without ownership -> DENIED.
