# Supabase Email OTP setup

This app uses a six-digit Email OTP. Secrets must stay in Supabase and must never be added to `.env`, frontend code, or Git.

## 1. Create a Gmail App Password

For `slowpoke.0226@gmail.com`:

1. Turn on Google Account two-step verification.
2. Open Google Account → Security → App passwords.
3. Create an app password named `Fitness App Supabase SMTP`.
4. Copy the 16-character password once and enter it only in Supabase.

## 2. Configure Supabase Custom SMTP

Open Supabase → Authentication → Emails → SMTP Settings:

- Enable Custom SMTP: on
- Sender email: `slowpoke.0226@gmail.com`
- Sender name: `訓練日記`
- Host: `smtp.gmail.com`
- Port: `465`
- Username: `slowpoke.0226@gmail.com`
- Password: the Gmail App Password from step 1

Do not use the normal Gmail password.

## 3. Send a six-digit code

Open Supabase → Authentication → Email Templates → Magic Link.

Subject:

```text
你的訓練日記登入驗證碼
```

Body:

```html
<h2>訓練日記登入驗證碼</h2>
<p>請回到 App 輸入以下驗證碼：</p>
<p style="font-size:32px;font-weight:800;letter-spacing:8px">{{ .Token }}</p>
<p>如果不是你本人操作，可以忽略這封信。</p>
```

For legacy anonymous accounts, also update the Change Email template to include `{{ .Token }}` so the same six-digit input can convert the existing account without changing its user id.

## 4. Recommended Auth settings

- Email provider: enabled
- Allow new users to sign up: enabled
- OTP expiry: 600 seconds
- Minimum resend interval: 60 seconds
- Site URL: `https://yungchiiiiii.github.io/fitness-app/`
- Redirect URLs: add `https://yungchiiiiii.github.io/fitness-app/` exactly
