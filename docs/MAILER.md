# SMTP Mailer with Nodemailer ✉️

This backend starter templates uses **Nodemailer** to dispatch transactional emails (e.g., account verifications, password resets, welcome emails).

## 🛠️ Usage Guide

Import the `sendEmail` helper function from `@/lib/mailer`:

```typescript
import { sendEmail } from '@/lib/mailer';

try {
  await sendEmail({
    to: 'user@example.com',
    subject: 'Welcome to Onpkg Next.js Template!',
    html: '<h1>Account Created</h1><p>Your fullstack template account has been successfully set up.</p>',
    text: 'Account Created. Your fullstack template account has been successfully set up.', // Optional text-only fallback
  });
} catch (error) {
  // Handle mail dispatch error
}
```

---

## 🎛️ Configurations

Update mail settings in `.env` to connect with your SMTP provider (e.g., Mailtrap, SendGrid, Amazon SES, Resend):

```env
# SMTP connection options
SMTP_HOST="smtp.mailtrap.io"
SMTP_PORT=2525
SMTP_USER="your-smtp-username"
SMTP_PASS="your-smtp-password"

# Sender settings
MAIL_FROM="noreply@onpkg.com"
```
In case `SMTP_USER` and `SMTP_PASS` variables are omitted, Nodemailer will attempt to send emails over a local direct SMTP connection.
