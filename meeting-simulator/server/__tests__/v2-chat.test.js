const fs = require('fs');
const os = require('os');
const path = require('path');
const request = require('supertest');

describe('v2 chat flow', () => {
  let app;
  let tempDir;
  let openAiMock;

  beforeEach(() => {
    jest.resetModules();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'meetinghero-chat-'));
    process.env.DB_PATH = path.join(tempDir, 'meeting-simulator.test.db');

    openAiMock = jest.fn();
    jest.doMock('../services/openai', () => ({
      callOpenAIJson: openAiMock,
    }));

    ({ createApp: app } = require('../index'));
    app = app();
  });

  afterEach(() => {
    delete process.env.DB_PATH;
    jest.dontMock('../services/openai');
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('supports join -> hint -> respond x3 -> complete -> settlement -> dm banner', async () => {
    openAiMock
      .mockResolvedValueOnce({ hint: 'I think we should slow down and check the details first.' })
      .mockResolvedValueOnce({ speaker: 'npc_a', text: 'That makes sense.', textZh: '这很有道理。', emotion: 'supportive' })
      .mockResolvedValueOnce({
        betterVersion: 'I think we should review the details before we decide.',
        feedbackType: '更地道的说法',
        learningType: 'pattern',
        pattern: 'I think we should...',
        highlights: ['review the details'],
      })
      .mockResolvedValueOnce({ speaker: 'npc_b', text: 'I can work with that.', textZh: '这个我可以接受。', emotion: 'neutral' })
      .mockResolvedValueOnce({
        betterVersion: 'I can support that direction if we keep the timeline realistic.',
        feedbackType: '进阶表达',
        learningType: 'collocations',
        collocations: [{ phrase: 'keep the timeline realistic', meaning: '保持时间预期合理' }],
        highlights: ['keep the timeline realistic'],
      })
      .mockResolvedValueOnce({ speaker: 'npc_a', text: 'Let us lock that in.', textZh: '那我们就这么定。', emotion: 'decisive' })
      .mockResolvedValueOnce({
        betterVersion: 'Let us lock that in and move to execution.',
        feedbackType: '同样好用的说法',
        learningType: 'pattern',
        pattern: 'Let us...',
        highlights: ['lock that in'],
      })
      .mockResolvedValueOnce({
        headline: '群聊定调，项目推进加速',
        epilogue: ['群内意见快速收敛', '你提出的表述被反复引用'],
        title: '气氛定调人',
      });

    const feedRes = await request(app).get('/api/v2/feed?page=1&pageSize=1');
    expect(feedRes.status).toBe(200);
    const roomId = feedRes.body.items[0].roomId;

    const userId = 'user-001';
    const initRes = await request(app)
      .post('/api/v2/users/init')
      .send({ userId, nickname: 'Alex' });
    expect(initRes.status).toBe(201);

    const joinRes = await request(app)
      .post('/api/v2/chat/join')
      .send({ userId, roomId });
    expect(joinRes.status).toBe(201);
    expect(joinRes.body.chatSessionId).toBeTruthy();
    const chatSessionId = joinRes.body.chatSessionId;

    const hintRes = await request(app).post(`/api/v2/chat/${chatSessionId}/generate-hint`).send({});
    expect(hintRes.status).toBe(200);
    expect(hintRes.body.hint).toContain('slow down');

    const turnInputs = [
      'I think we should check the details first.',
      'We can move if the timing stays realistic.',
      'Okay, let us decide and move on.',
    ];

    for (let index = 0; index < turnInputs.length; index += 1) {
      const respondRes = await request(app)
        .post('/api/v2/chat/respond')
        .send({
          chatSessionId,
          turnIndex: index + 1,
          userInput: turnInputs[index],
        });

      expect(respondRes.status).toBe(200);
      expect(respondRes.body.npcReply.text).toBeTruthy();
      expect(respondRes.body.isLastTurn).toBe(index === 2);
    }

    const completeRes = await request(app)
      .post('/api/v2/chat/complete')
      .send({ chatSessionId });
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.success).toBe(true);

    const settlementRes = await request(app).get(`/api/v2/chat/${chatSessionId}/settlement`);
    expect(settlementRes.status).toBe(200);
    expect(settlementRes.body.newsletter.headline).toBe('群聊定调，项目推进加速');
    expect(settlementRes.body.stats.wordCount).toBeGreaterThan(0);
    expect(settlementRes.body.expressionCards).toHaveLength(3);
    expect(settlementRes.body.expressionCards.every((card) => card.isSaved)).toBe(true);
    expect(settlementRes.body.expressionCards.some((card) => card.isFeatured)).toBe(true);

    const bannerRes = await request(app).get(`/api/v2/chat/${chatSessionId}/dm-banner`);
    expect(bannerRes.status).toBe(200);
    expect(bannerRes.body.hasBanner).toBe(true);
    expect(bannerRes.body.banner.npcName).toBeTruthy();
  });
});
