import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const rulesContent = fs.readFileSync('firestore.rules', 'utf8');

test('firestore.rules enforces rules_version 2 and default deny catch-all', () => {
  assert.match(rulesContent, /rules_version = '2';/);
  assert.match(rulesContent, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
});

test('firestore.rules enforces email_verified and isValidId across user collections', () => {
  assert.match(rulesContent, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesContent, /function isValidId\(id\)/);
  assert.match(rulesContent, /allow list: if isOwner\(userId\) && isVerifiedUser\(\) && resource\.data\.ownerId == request\.auth\.uid;/);
});

test('firestore.rules enforces terminal state locking and immutable audit logs', () => {
  assert.match(rulesContent, /existing\(\)\.status != 'concluido'/);
  assert.match(rulesContent, /match \/auditLogs\/\{logId\}[\s\S]*allow update: if false;/);
  assert.match(rulesContent, /match \/messages\/\{messageId\}[\s\S]*allow update: if false;/);
});
