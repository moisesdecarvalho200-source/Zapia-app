import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selectNextVoice,
  buildVoiceStylePrompt,
  scanFileContent,
  sanitizeFirestoreId,
  validateVaultDocumentBounds,
  processOfflineCommand,
  getPortugueseGreeting,
  getThreadColorHex,
  buildThreadTitleFromMessage,
  generateProactiveRadarCards,
  speedToPlaybackRate,
  toneToPitchRatio,
  VOICE_MODEL_CATALOG,
  VOICE_EFFECT_PRESETS,
  CONNECTOR_CATALOG,
  filterConnectorCatalog,
  validateSafeExternalUrl,
} from './zapiaLogic';

test('selectNextVoice alternates male and female voices in alternada mode', () => {
  const turn0 = selectNextVoice('alternada', 0, 'Fenrir', 'Kore');
  const turn1 = selectNextVoice('alternada', 1, 'Fenrir', 'Kore');
  const turn2 = selectNextVoice('alternada', 2, 'Fenrir', 'Kore');
  assert.equal(turn0.voiceName, 'Fenrir');
  assert.equal(turn0.genderLabel, 'Masculina');
  assert.equal(turn1.voiceName, 'Kore');
  assert.equal(turn1.genderLabel, 'Feminina');
  assert.equal(turn2.voiceName, 'Fenrir');
});

test('selectNextVoice respects fixed masculine and feminine modes', () => {
  assert.equal(selectNextVoice('masculina', 1, 'Charon', 'Zephyr').voiceName, 'Charon');
  assert.equal(selectNextVoice('feminina', 0, 'Charon', 'Zephyr').voiceName, 'Zephyr');
});

test('buildVoiceStylePrompt includes persona, pace, and vocal pitch', () => {
  const style = buildVoiceStylePrompt('executivo', 20, 80, 20);
  assert.match(style, /Executivo/i);
  assert.match(style, /cadência ágil/i);
  assert.match(style, /tom sóbrio/i);
  assert.match(style, /mais grave/i);
});

test('speedToPlaybackRate and toneToPitchRatio map 0-100 sliders cleanly', () => {
  assert.equal(speedToPlaybackRate(0), 0.75);
  assert.equal(speedToPlaybackRate(50), 1.05);
  assert.equal(speedToPlaybackRate(100), 1.35);

  assert.equal(toneToPitchRatio(0), 0.8);
  assert.equal(toneToPitchRatio(50), 1.0);
  assert.equal(toneToPitchRatio(100), 1.2);

  assert.ok(VOICE_MODEL_CATALOG.some((v) => v.gender === 'masculina'));
  assert.ok(VOICE_MODEL_CATALOG.some((v) => v.gender === 'feminina'));
  assert.ok(VOICE_EFFECT_PRESETS.some((e) => e.id === 'robot'));
});

test('validateSafeExternalUrl blocks loopback/private metadata IPs and allows public APIs', () => {
  assert.equal(validateSafeExternalUrl('https://api.groq.com/openai/v1').valid, true);
  assert.equal(validateSafeExternalUrl('https://api.telegram.org').valid, true);
  assert.equal(validateSafeExternalUrl('http://127.0.0.1:8080').valid, false);
  assert.equal(validateSafeExternalUrl('http://169.254.169.254/latest/meta-data').valid, false);
  assert.equal(validateSafeExternalUrl('http://192.168.1.10').valid, false);
  assert.equal(validateSafeExternalUrl('ftp://example.com').valid, false);
});

test('filterConnectorCatalog searches social, apps, and free APIs', () => {
  const whats = filterConnectorCatalog(CONNECTOR_CATALOG, 'whats');
  assert.equal(whats.some((c) => c.id === 'whatsapp'), true);

  const freeApis = filterConnectorCatalog(CONNECTOR_CATALOG, 'groq');
  assert.equal(freeApis.some((c) => c.id === 'groq_free'), true);
});

test('scanFileContent quarantines disguised PE executables and script injection', () => {
  const mzBytes = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
  const exeScan = scanFileContent('foto.png', 'image/png', mzBytes);
  assert.equal(exeScan.status, 'quarentena');
  assert.ok(exeScan.riskScore >= 60);

  const cleanPngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const cleanScan = scanFileContent('retrato.png', 'image/png', cleanPngBytes);
  assert.equal(cleanScan.status, 'limpo');
  assert.equal(cleanScan.riskScore, 0);

  const scriptScan = scanFileContent('nota.txt', 'text/plain', new Uint8Array([65, 66]), '<script>eval(atob("a"))</script>');
  assert.equal(scriptScan.status, 'quarentena');
});

test('sanitizeFirestoreId and validateVaultDocumentBounds enforce blueprint limits', () => {
  const cleanId = sanitizeFirestoreId('doc/../../123?abc');
  assert.match(cleanId, /^[a-zA-Z0-9_-]+$/);

  const valid = validateVaultDocumentBounds({
    id: cleanId,
    ownerId: 'user_123',
    title: 'Contrato ZAPIA.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    sha256: 'a'.repeat(64),
    encryptedPayload: 'Zm9vYmFy',
    iv: '123456789012',
  });
  assert.equal(valid.valid, true);

  const invalidHash = validateVaultDocumentBounds({
    id: cleanId,
    ownerId: 'user_123',
    title: 'Contrato',
    mimeType: 'text/plain',
    sizeBytes: 10,
    sha256: 'short',
    encryptedPayload: 'abc',
    iv: '123456789012',
  });
  assert.equal(invalidHash.valid, false);
});

test('processOfflineCommand handles reminders, notes, and diagnostics locally', () => {
  const rem = processOfflineCommand('lembrar reunião às 15h', 'Moisés de Carvalho');
  assert.equal(rem.actionType, 'reminder');
  assert.match(rem.actionPayload || '', /reunião às 15h/);

  const note = processOfflineCommand('anotar chave do projeto');
  assert.equal(note.actionType, 'vault_note');

  const opt = processOfflineCommand('otimizar memória do aparelho');
  assert.equal(opt.actionType, 'optimize');
});

test('getPortugueseGreeting formats time-aware first-name greeting', () => {
  assert.equal(getPortugueseGreeting('Moisés de Carvalho', 9), 'Bom dia, Moisés!');
  assert.equal(getPortugueseGreeting('Moisés de Carvalho', 15), 'Boa tarde, Moisés!');
  assert.equal(getPortugueseGreeting('Moisés de Carvalho', 21), 'Boa noite, Moisés!');
});

test('buildThreadTitleFromMessage and generateProactiveRadarCards build clean drawer data', () => {
  assert.equal(buildThreadTitleFromMessage('  Proposta inicial do sistema Android  '), 'Proposta inicial do sistema Android');
  assert.ok(getThreadColorHex(0).startsWith('#'));

  const cards = generateProactiveRadarCards({
    pendingRemindersCount: 1,
    nextReminderTitle: 'Revisar backup semanal',
    vaultCount: 2,
    quarantinedCount: 1,
    hasGoogleConnected: false,
    isOnline: true,
  });
  assert.ok(cards.length >= 3);
  assert.equal(cards[0].id, 'radar_quarantine');
});
