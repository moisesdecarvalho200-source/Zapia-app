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
  normalizeTrainedVoiceAnalysis,
  buildTrainedVoiceStylePrompt,
  detectDeviceMetadata,
  formatE2EEFingerprint,
  mergeDeviceSessions,
  validateExportPassphrase,
  analyzeSensitiveContent,
  summarizeSelfKnowledgeInsights,
  analyzeSentiment,
  buildWeeklySummary,
  DeviceSessionRecord,
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

test('normalizeTrainedVoiceAnalysis clamps sliders and enforces valid base voice per gender', () => {
  const fem = normalizeTrainedVoiceAnalysis({
    profileName: 'Voz Clara',
    gender: 'feminina',
    recommendedBaseVoice: 'Fenrir', // mismatched male voice -> corrected to Kore
    recommendedSpeed: 150,
    recommendedPitch: -20,
    recommendedWarmth: 85,
    sampleCount: 3,
  });
  assert.equal(fem.baseModelId, 'Kore');
  assert.equal(fem.recommendedSpeed, 100);
  assert.equal(fem.recommendedPitch, 0);
  assert.equal(fem.recommendedWarmth, 85);
  assert.equal(fem.sampleCount, 3);

  const styled = buildTrainedVoiceStylePrompt('tom natural', fem);
  assert.match(styled, /Voz Clara/);
});

test('validateSafeExternalUrl blocks loopback/private metadata IPs and allows public APIs', () => {
  assert.equal(validateSafeExternalUrl('https://api.groq.com/openai/v1').valid, true);
  assert.equal(validateSafeExternalUrl('https://api.telegram.org').valid, true);
  assert.equal(validateSafeExternalUrl('https://api.openai.com/v1').valid, true);
  assert.equal(validateSafeExternalUrl('https://image.pollinations.ai').valid, true);
  assert.equal(validateSafeExternalUrl('http://127.0.0.1:8080').valid, false);
  assert.equal(validateSafeExternalUrl('http://169.254.169.254/latest/meta-data').valid, false);
  assert.equal(validateSafeExternalUrl('http://192.168.1.10').valid, false);
  assert.equal(validateSafeExternalUrl('ftp://example.com').valid, false);
});

test('filterConnectorCatalog searches social, apps, GPT, Gemini, Dola, Suno, and free media APIs', () => {
  const whats = filterConnectorCatalog(CONNECTOR_CATALOG, 'whats');
  assert.equal(whats.some((c) => c.id === 'whatsapp'), true);

  const freeApis = filterConnectorCatalog(CONNECTOR_CATALOG, 'groq');
  assert.equal(freeApis.some((c) => c.id === 'groq_free'), true);

  for (const term of ['gpt', 'gemini', 'dola', 'suno', 'pexels', 'pixabay', 'pollinations']) {
    const matches = filterConnectorCatalog(CONNECTOR_CATALOG, term);
    assert.ok(matches.length > 0, `Expected catalog match for ${term}`);
  }
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

test('detectDeviceMetadata and formatE2EEFingerprint produce valid device descriptors', () => {
  const androidMeta = detectDeviceMetadata('Mozilla/5.0 (Linux; Android 14) Chrome/126.0 Mobile');
  assert.equal(androidMeta.platform, 'android');
  assert.match(androidMeta.deviceName, /Android/);

  const winMeta = detectDeviceMetadata('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/126.0', 'Win32');
  assert.equal(winMeta.platform, 'windows');
  assert.match(winMeta.deviceName, /Windows/);

  const fp = formatE2EEFingerprint('abcd1234ef567890abcd1234');
  assert.equal(fp, 'ABCD:1234:EF56:7890');
  assert.match(fp, /^[A-F0-9:]+$/);
});

test('mergeDeviceSessions pins current device and flags divergent E2EE fingerprints', () => {
  const current: DeviceSessionRecord = {
    id: 'dev_local',
    ownerId: 'uid_1',
    deviceName: 'PC Windows · Chrome',
    platform: 'windows',
    e2eeFingerprint: 'ABCD:1234:EF56:7890',
    e2eeStatus: 'sincronizado',
    syncedVaultCount: 4,
    syncedRemindersCount: 2,
    syncedPreferencesCount: 3,
    lastSyncIso: '2026-11-20T12:00:00.000Z',
    isCurrentDevice: true,
  };
  const cloud: DeviceSessionRecord[] = [
    {
      ...current,
      lastSyncIso: '2026-11-20T10:00:00.000Z',
      isCurrentDevice: false,
    },
    {
      id: 'dev_mobile',
      ownerId: 'uid_1',
      deviceName: 'Smartphone Android · Chrome',
      platform: 'android',
      e2eeFingerprint: '9999:8888:7777:6666',
      e2eeStatus: 'sincronizado',
      syncedVaultCount: 3,
      syncedRemindersCount: 2,
      syncedPreferencesCount: 3,
      lastSyncIso: '2026-11-20T11:30:00.000Z',
    },
  ];
  const merged = mergeDeviceSessions(current, cloud);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, 'dev_local');
  assert.equal(merged[0].isCurrentDevice, true);
  assert.equal(merged[0].e2eeStatus, 'sincronizado');
  assert.equal(merged[1].id, 'dev_mobile');
  assert.equal(merged[1].e2eeStatus, 'chave_divergente');
});

test('validateExportPassphrase rejects short passwords and scores strong passwords', () => {
  assert.equal(validateExportPassphrase('12345').valid, false);
  assert.equal(validateExportPassphrase('       ').valid, false);
  assert.equal(validateExportPassphrase('zapia123').valid, true);
  assert.equal(validateExportPassphrase('Zapia@2026Seguro!').strength, 'forte');
});

test('analyzeSensitiveContent avoids false positives on normal conversation', () => {
  const safe1 = analyzeSensitiveContent('Bom dia ZAPIA, me ajude a criar um jogo 2D em HTML5 Canvas hoje às 15h.');
  assert.equal(safe1.hasSensitiveData, false);
  assert.equal(safe1.riskLevel, 'nenhum');
  assert.equal(safe1.findings.length, 0);

  const safe2 = analyzeSensitiveContent('Como faço para recuperar minha senha de forma segura?');
  assert.equal(safe2.hasSensitiveData, false);
});

test('analyzeSensitiveContent detects API keys, CPF, passwords, and Luhn credit cards with clean masking', () => {
  const msg =
    'Guarda isso: chave OpenAI sk-proj-AbCdEf123456789012345678, CPF 123.456.789-01, senha: MinhaSenha@99 e cartão 4532 0151 1283 0366';
  const res = analyzeSensitiveContent(msg);
  assert.equal(res.hasSensitiveData, true);
  assert.equal(res.riskLevel, 'alto');
  assert.ok(res.findings.some((f) => f.category === 'api_key'));
  assert.ok(res.findings.some((f) => f.category === 'cpf'));
  assert.ok(res.findings.some((f) => f.category === 'password'));
  assert.ok(res.findings.some((f) => f.category === 'credit_card'));
  assert.doesNotMatch(res.maskedText, /sk-proj-AbCdEf/);
  assert.doesNotMatch(res.maskedText, /123\.456\.789-01/);
  assert.doesNotMatch(res.maskedText, /MinhaSenha@99/);
  assert.doesNotMatch(res.maskedText, /4532 0151 1283 0366/);
  assert.match(res.maskedText, /\[CHAVE API PROTEGIDA\]/);
  assert.match(res.maskedText, /\[CPF PROTEGIDO\]/);
  assert.match(res.maskedText, /\[SENHA PROTEGIDA\]/);
  assert.match(res.maskedText, /\[CARTÃO PROTEGIDO\]/);

  const ptBrPass = analyzeSensitiveContent('Senha do banco: BancoZapia@2026');
  assert.equal(ptBrPass.hasSensitiveData, true);
  assert.match(ptBrPass.maskedText, /Senha do banco: \[SENHA PROTEGIDA\]/);
});

test('summarizeSelfKnowledgeInsights computes energy average, dominant mood, and coaching prompt', () => {
  const empty = summarizeSelfKnowledgeInsights([]);
  assert.equal(empty.totalCheckins, 0);
  assert.match(empty.suggestedCoachPrompt, /autoconhecimento/i);

  const populated = summarizeSelfKnowledgeInsights([
    {
      dateIso: '2026-11-20',
      mood: 'focado',
      energy: 9,
      focusGoal: 'Finalizar painel E2EE do ZAPIA',
      reflection: 'Produtividade alta pela manhã',
    },
    {
      dateIso: '2026-11-19',
      mood: 'focado',
      energy: 7,
      focusGoal: 'Revisar conectores de IA',
      reflection: 'Bom progresso',
    },
  ]);
  assert.equal(populated.totalCheckins, 2);
  assert.equal(populated.averageEnergy, 8);
  assert.equal(populated.dominantMood, 'focado');
  assert.match(populated.summaryText, /Energia média 8\/10/);
});

test('analyzeSentiment detects positive, negative, negated, mixed, and neutral pt-BR text', () => {
  const pos = analyzeSentiment('Estou muito feliz, motivado e produtivo com o ZAPIA MS hoje!');
  assert.equal(pos.polarity, 'positivo');
  assert.ok(pos.score > 0.3);

  const neg = analyzeSentiment('Estou cansado, estressado e com muito problema atrasado.');
  assert.equal(neg.polarity, 'negativo');
  assert.ok(neg.score < -0.3);

  const negatedPos = analyzeSentiment('Hoje não estou feliz e não consegui avançar.');
  assert.equal(negatedPos.polarity, 'negativo');

  const negatedNeg = analyzeSentiment('Sem medo e sem problema nenhum, sigo tranquilo.');
  assert.equal(negatedNeg.polarity, 'positivo');

  const neutral = analyzeSentiment('Abrir relatório financeiro às 14h na pasta documentos.');
  assert.equal(neutral.polarity, 'neutro');
  assert.equal(neutral.score, 0);
});

test('buildWeeklySummary aggregates last 7 days metrics and excludes older records', () => {
  const nowIso = '2026-11-20T18:00:00.000Z';
  const summary = buildWeeklySummary({
    nowIso,
    checkins: [
      {
        dateIso: '2026-11-20',
        mood: 'motivado',
        energy: 9,
        focusGoal: 'Lançar ZAPIA MS',
        reflection: 'Muito satisfeito e animado com a evolução!',
        createdAtIso: '2026-11-20T10:00:00.000Z',
      },
      {
        dateIso: '2026-11-18',
        mood: 'focado',
        energy: 7,
        focusGoal: 'Revisar cofre',
        reflection: 'Bom ritmo produtivo.',
        createdAtIso: '2026-11-18T10:00:00.000Z',
      },
      {
        dateIso: '2026-11-01', // older than 7 days -> must be ignored
        mood: 'cansado',
        energy: 2,
        focusGoal: 'Antigo',
        reflection: 'Exausto',
        createdAtIso: '2026-11-01T10:00:00.000Z',
      },
    ],
    messages: [
      { role: 'user', content: 'Estou ótimo hoje, quero criar um app!', createdAtIso: '2026-11-19T12:00:00.000Z' },
      { role: 'assistant', content: 'Vamos criar agora!', createdAtIso: '2026-11-19T12:01:00.000Z' },
      { role: 'user', content: 'Mensagem antiga fora da semana', createdAtIso: '2026-11-05T12:00:00.000Z' },
    ],
    vaultItems: [
      { scanStatus: 'limpo', createdAtIso: '2026-11-20T09:00:00.000Z' },
      { scanStatus: 'limpo', createdAtIso: '2026-11-01T09:00:00.000Z' },
    ],
    reminders: [
      { status: 'concluido', createdAtIso: '2026-11-19T08:00:00.000Z' },
      { status: 'pendente', createdAtIso: '2026-11-20T08:00:00.000Z' },
    ],
    auditLogs: [{ verdict: 'alerta', createdAtIso: '2026-11-20T11:00:00.000Z' }],
  });

  assert.equal(summary.checkinCount, 2);
  assert.equal(summary.averageEnergy, 8);
  assert.equal(summary.userMessageCount, 1);
  assert.equal(summary.assistantMessageCount, 1);
  assert.equal(summary.vaultSavedCount, 1);
  assert.equal(summary.completedReminders, 1);
  assert.equal(summary.pendingReminders, 1);
  assert.equal(summary.securityAlertsCount, 1);
  assert.equal(summary.overallSentiment.polarity, 'positivo');
  assert.match(summary.aiPrompt, /ZAPIA MS/);
});



