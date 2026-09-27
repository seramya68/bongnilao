# NHÀ CỦA BÔNG — SUPABASE SETUP

V6 đã chuyển các phần sau sang Supabase:

- Sign up / login
- profile + role user/admin
- tin nhắn gửi Bông
- nhân vật do Admin thêm
- Background Story
- Opening Scene
- PRO5 riêng tư

## 1. Tạo / chọn Supabase project

Bạn cần một Supabase project.

## 2. Chạy schema

Trong Supabase:

SQL Editor → New query

Dán toàn bộ file:

`supabase/schema.sql`

→ Run.

Schema có Row Level Security (RLS).

Đặc biệt:

`character_pro5`

KHÔNG có policy public. Chỉ profile có `role = admin` mới đọc được.

## 3. Auth — dùng username + password

UI của web vẫn là:

- username
- password

Supabase Auth bên dưới dùng email/password.

Web tự đổi username thành một email ảo dạng:

`username@users.nhacuabong.local`

Vì vậy vào:

Authentication → Providers → Email

và TẮT yêu cầu `Confirm email`.

Đây là web pseudonymous nên không cần gửi mail xác nhận.

## 4. Điền URL và public key

Supabase project → Project Settings / API.

Lấy:

- Project URL
- anon/public/publishable key

Mở:

`assets/js/supabase-config.js`

và điền:

```js
window.BONG_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_PUBLIC_KEY"
};
```

AN TOÀN:

Anon / publishable key được phép nằm trong frontend nếu RLS đúng.

KHÔNG BAO GIỜ đưa `service_role` key lên GitHub.

## 5. Tạo Admin Bông

Mở website.

Sign up username:

`bongnilao`

với password Admin bạn muốn dùng.

Sau khi sign up thành công, mở Supabase SQL Editor và chạy:

`supabase/promote-admin.sql`

Nó chỉ đổi profile `bongnilao` thành role `admin`.

Password KHÔNG nằm trong repository.

Đăng xuất rồi đăng nhập lại.

Nút góc phải sẽ thành:

`Bông Admin ⚙`

## 6. PRO5

Admin → Thêm nhân vật có ô:

`PRO5 — chỉ Admin được xem`

Nó được lưu ở:

`public.character_pro5`

Không nằm chung với Background/Opening để tránh vô tình public system prompt.

## 7. Tin nhắn

User phải đăng nhập trước khi gửi Bông.

Tin nhắn lưu ở:

`public.messages`

User chỉ đọc được thread của chính họ.

Admin đọc được toàn bộ.

## 8. Ảnh và nhạc

V6 CHƯA đưa binary asset vào Supabase Storage.

Hiện giữ cấu trúc GitHub:

`assets/images/<folder>/profile.jpg`
`assets/images/<folder>/1.jpg ... 4.jpg`

và:

`assets/music/<file>.mp3`

Mình có thể chuyển ảnh/nhạc lên Supabase Storage ở bước sau.
