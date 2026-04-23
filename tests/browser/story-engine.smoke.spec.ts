import { test, expect } from '@playwright/test';

const LOCATIONS = ['Nar Shaddaa', 'Coruscant', 'Corellia', 'Naboo', 'Bespin', 'Mandalore'];

function extractTurnNumber(body: Record<string, any>): number {
  const text = String(body?.messages?.map((message: { content?: string }) => message.content || '').join('\n') || '');
  const match = text.match(/(?:Tour|chapter_number\s*=)\s*(\d+)/i);
  return Number(match?.[1] || 1);
}

function jsonResponse(content: string) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      choices: [
        {
          message: {
            role: 'assistant',
            content
          }
        }
      ]
    })
  };
}

test('story engine smoke: create a story, play 5 turns, save, reload, keep galaxy events', async ({ page }) => {
  let backgroundTurn = 0;
  const setupPrimaryButton = () => page.locator('.setup-nav .btn.btn-primary').last();

  await page.route('https://openrouter.ai/api/v1/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          { id: 'qwen/qwen3.5-9b' },
          { id: 'google/gemma-4-26b-a4b-it' },
          { id: 'openai/gpt-5.4-mini' }
        ]
      })
    });
  });

  await page.route('https://openrouter.ai/api/v1/chat/completions', async (route) => {
    const body = route.request().postDataJSON() as Record<string, any>;
    const systemPrompt = String(body.messages?.[0]?.content || '');
    const turnNumber = extractTurnNumber(body);
    const location = LOCATIONS[(turnNumber - 1) % LOCATIONS.length];

    if (systemPrompt.includes("OBSERVATEUR hors-écran")) {
      backgroundTurn += 1;
      await route.fulfill(jsonResponse(
        `Tour ${turnNumber}. Hors-écran, ${location} se verrouille pendant que la pression impériale grimpe d’un cran.`
      ));
      return;
    }

    if (systemPrompt.includes("ADJUDICATEUR hors-écran")) {
      await route.fulfill(jsonResponse(JSON.stringify({
        title: `Incident galactique ${backgroundTurn}`,
        summary_public: backgroundTurn % 2 === 1 ? `Des patrouilles serrent ${location}.` : '',
        summary_private: `La tension grimpe sur ${location}.`,
        inject_now: backgroundTurn % 2 === 1,
        prompt_hook: `Le prochain tour doit tenir compte de ${location}.`,
        memory_updates: {
          relations: [],
          places: [location],
          injuries: [],
          resources: [],
          notes: [`Le secteur ${location} devient plus dangereux.`]
        },
        state_update: {
          rumors_new: [`${location} se ferme au trafic libre.`],
          environment_status: `${location} sous surveillance renforcée`
        }
      })));
      return;
    }

    if (systemPrompt.includes('SCRIBE')) {
      await route.fulfill(jsonResponse(
        `Tour ${turnNumber}. ${location} reste le point chaud. Le protagoniste agit vite et les témoins commencent à paniquer.`
      ));
      return;
    }

    if (systemPrompt.includes('DIRECTEUR')) {
      await route.fulfill(jsonResponse(JSON.stringify({
        player_action: `Je prends l’avantage au tour ${turnNumber}.`,
        scene_goal: `Transformer immédiatement le tour ${turnNumber} en scène jouable sur ${location}.`,
        tension: `La fenêtre de survie se referme à ${location}.`,
        must_include: ['Une conséquence immédiate', 'Un signal relationnel', 'Un lieu concret'],
        required_world_signals: ['location', 'npc'],
        section_type: turnNumber % 2 === 0 ? 'dialogue' : 'action',
        atmosphere: 'tense'
      })));
      return;
    }

    if (systemPrompt.includes("ÉCRIVAIN")) {
      await route.fulfill(jsonResponse([
        `Les alarmes fouettent ${location} pendant que tu traces ta route au milieu des regards figés.`,
        `Lira Voss se cale à ton épaule et jauge déjà la prochaine sortie avant même que le blaster adverse ne remonte.`,
        `"Si on attend encore, ${location} nous mâche puis nous recrache," souffle Lira.`,
        `La scène garde juste assez d’oxygène pour donner envie de cliquer au lieu de soupirer.`
      ].join('\n\n')));
      return;
    }

    await route.fulfill(jsonResponse(JSON.stringify({
      chapter_title: `Tour ${turnNumber} sous pression`,
      section_type: turnNumber % 2 === 0 ? 'dialogue' : 'action',
      atmosphere: 'tense',
      scene_description: `Scène critique à ${location}`,
      choices: [
        { text: `Forcer le passage à ${location}`, attribute: 'combat', difficulty: 2, faction_impact: { empire: -1 } },
        { text: `Mentir pour gagner du temps`, attribute: 'diplomacy', difficulty: 3, faction_impact: { rebels: 1 } },
        { text: `Passer par les ombres`, attribute: 'stealth', difficulty: 2, faction_impact: {} }
      ],
      memory_updates: {
        relations: ['Lira Voss garde son sang-froid.'],
        places: [location],
        injuries: [],
        resources: turnNumber % 2 === 0 ? [`Prime du tour ${turnNumber}`] : [],
        notes: [`${location} reste exploitable au tour ${turnNumber}.`]
      },
      state_update: {
        location,
        hp: turnNumber % 2 === 0 ? -4 : 2,
        credits: turnNumber % 2 === 0 ? 30 : -15,
        npcs: [{ name: 'Lira Voss', affinity: 35, status: 'ally', alive: true, current_location: location }],
        factions: { empire: -1, rebels: 1 },
        rumors_new: [`Rumeur du tour ${turnNumber}`],
        environment_status: `${location} sous tension`,
        director_instruction: `Maintenir la pression au tour ${turnNumber + 1}`
      }
    })));
  });

  await page.goto('/settings');
  await page.getByLabel('Clé API OpenRouter').fill('test-openrouter-key');
  await page.getByRole('button', { name: /Sauvegarder/i }).click({ force: true });

  await page.goto('/stories/new');
  await expect(page).toHaveURL(/\/editor\/new$/);

  await page.getByRole('button', { name: /Ère Impériale/ }).click();
  await setupPrimaryButton().click();

  await page.getByRole('button', { name: /^Alliance Rebelle$/ }).click();
  await page.locator('button.role-card', { hasText: 'Contrebandier' }).click();
  await setupPrimaryButton().click();

  await page.getByRole('button', { name: /Le Résistant/ }).click();
  await setupPrimaryButton().click();

  await page.getByRole('button', { name: /Cinématique/ }).click();
  await page.getByRole('button', { name: /^Aventure$/ }).click();
  await page.getByRole('button', { name: /3ème personne/ }).click();
  await page.getByRole('button', { name: /^Moyen$/ }).click();
  await page.locator('button.content-mode-card', { hasText: 'Cinéma' }).click();
  await setupPrimaryButton().click();

  await setupPrimaryButton().click();
  await setupPrimaryButton().click();

  await expect(page.locator('.turn-indicator')).toContainText('Tour 1');
  await expect(page.locator('.chapter-title').last()).toContainText('Tour 1 sous pression');
  await expect(page.locator('.choice-btn').first()).toBeVisible();

  for (let turnNumber = 2; turnNumber <= 5; turnNumber += 1) {
    await page.locator('.choice-btn').first().click();
    await expect(page.locator('.turn-indicator')).toContainText(`Tour ${turnNumber}`);
    await expect(page.locator('.chapter-title').last()).toBeVisible();
  }

  await expect(page.locator('.world-events-panel')).toContainText('Mouvements de la galaxie');
  await page.locator('.world-events-panel summary').click();
  await expect(page.locator('.world-events-panel')).toContainText('Incident galactique');

  await page.getByRole('button', { name: /Sauvegarder/i }).click({ force: true });
  await page.reload();

  await expect(page.locator('.turn-indicator')).toContainText('Tour 5');
  await expect(page.locator('.chapter-title').last()).toBeVisible();
  await expect(page.locator('.world-events-panel')).toContainText('Incident galactique');
});
