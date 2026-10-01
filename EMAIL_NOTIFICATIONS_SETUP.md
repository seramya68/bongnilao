# EMAIL NOTIFICATIONS — ONE LAST SETUP

V10 đã có database subscription, subscriber count, UI đăng ký/hủy, Admin publish link và Edge Function `notify-character-link`.

Để gửi mail thật, thêm Supabase Edge Function Secret:

- RESEND_API_KEY = API key từ Resend
- NOTIFY_FROM_EMAIL = Bông <hello@domain-cua-ban.com>
- SITE_URL = https://seramya68.github.io/bongnilao/

Không đưa RESEND_API_KEY lên GitHub.

Flow:
User đăng ký email → Supabase lưu waitlist → Admin dán GGAI ở tab “🔔 Link & thông báo” → Edge Function lưu link + gửi email → notified_at được đánh dấu.
