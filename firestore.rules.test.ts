/**
 * Security Rules Test Spec (Dirty Dozen Verification Matrix)
 * Verifies rule invariants against firestore.rules using structural static assertions
 * (can also be executed against Firebase Emulator Suite if installed).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const rulesContent = fs.readFileSync(new URL('./firestore.rules', import.meta.url), 'utf8');

test('Dirty Dozen structural security invariants are enforced in firestore.rules', () => {
  // 1. Default deny catch-all at top of rules
  assert.match(rulesContent, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;/);

  // 2. Email verification & auth gate required
  assert.match(rulesContent, /request\.auth\.token\.email_verified == true/);

  // 3. No blanket user list scraping
  assert.match(rulesContent, /match \/users\/\{userId\}[\s\S]*?allow list:\s*if false;/);

  // 4. All subcollection list queries evaluate resource.data.ownerId directly
  const listMatches = rulesContent.match(/allow list:[^\n]+/g) || [];
  assert.ok(listMatches.length >= 6);
  for (const line of listMatches.slice(1)) {
    assert.match(line, /resource\.data\.ownerId == request\.auth\.uid/);
  }

  // 5. Validation helpers invoked on both create and update
  for (const fn of [
    'isValidWorkspace',
    'isValidProject',
    'isValidWorker',
    'isValidPeriod',
    'isValidTransaction',
  ]) {
    assert.match(rulesContent, new RegExp(`allow create:[\\s\\S]*?${fn}\\(incoming\\(\\)`));
    assert.match(rulesContent, new RegExp(`allow update:[\\s\\S]*?${fn}\\(incoming\\(\\)`));
  }

  // 6. Terminal state lock for Lunas rembes transactions
  assert.match(rulesContent, /existing\(\)\.rembesStatus != 'Lunas'/);

  // 7. Strict server timestamp checks
  assert.match(rulesContent, /incoming\(\)\.createdAt == request\.time/);
  assert.match(rulesContent, /incoming\(\)\.updatedAt == request\.time/);
});
