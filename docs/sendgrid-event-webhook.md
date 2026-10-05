# SendGrid campaign delivery tracking

Reference: [Twilio SendGrid Event Webhook Reference](https://www.twilio.com/docs/sendgrid/for-developers/tracking-events/event) and [Mail Send API](https://www.twilio.com/docs/sendgrid/api-reference/mail-send/mail-send).

- SendGrid Event Webhook reports delivery lifecycle events: `processed`, `delivered`, `deferred`, `bounce`, `blocked`, and `dropped`, as well as engagement events.
- The V3 Mail Send API permits `custom_args` inside each `personalizations` object. The Event Webhook returns those values in the event payload.
- SendGrid treats custom arguments as non-PII and stores them long-term. The platform therefore sends only the internal numeric `campaignId`; no email, name, recipient key, or other personal data is placed in `custom_args`.
- Configure the Event Webhook at `https://learn.allaboutultrasound.com/api/webhooks/sendgrid`, select delivery events plus spam reports/unsubscribes, and enable Signed Event Webhook with the public key stored as `SENDGRID_WEBHOOK_PUBLIC_KEY`.
