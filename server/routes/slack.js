const express = require('express');

/**
 * Server-side proxy for the Slack "quote issued" notification.
 *
 * The webhook URL used to live directly in js/common.js and was sent from
 * the browser, which meant it shipped to every visitor and to the git repo
 * in plain text. It now lives only in the SLACK_WEBHOOK_URL environment
 * variable on the server, and the browser just posts the quote summary to
 * this endpoint.
 */
function buildSlackRouter() {
  const router = express.Router();
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  router.post('/notify-quote', async (req, res) => {
    if (!webhookUrl) return res.status(204).end();

    const { quoteNumber, customerName, quoteTitle, totalAmount, salesRepName, detailUrl } = req.body || {};

    const payload = {
      text: `📄 새 견적서가 발급되었습니다: ${quoteNumber} (${customerName || '-'})`,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: `📄 새 견적서 발급: ${quoteNumber}`, emoji: true },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*견적번호*\n${quoteNumber || '-'}` },
            { type: 'mrkdwn', text: `*고객사명*\n${customerName || '-'}` },
            { type: 'mrkdwn', text: `*견적명*\n${quoteTitle || '-'}` },
            { type: 'mrkdwn', text: `*총 제안 금액 (VAT 포함)*\n${totalAmount || '-'}` },
            { type: 'mrkdwn', text: `*담당자*\n${salesRepName || '-'}` },
          ],
        },
        {
          type: 'section',
          text: { type: 'mrkdwn', text: `🔗 <${detailUrl}|견적서 상세 페이지 바로가기>` },
        },
      ],
    };

    try {
      const resp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`Slack webhook responded with ${resp.status}`);
      res.status(204).end();
    } catch (e) {
      console.error('Slack 알림 전송 실패:', e);
      // Notification failure must never block quote issuance on the client.
      res.status(502).json({ error: 'slack_notify_failed' });
    }
  });

  return router;
}

module.exports = buildSlackRouter;
