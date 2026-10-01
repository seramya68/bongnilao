NHÀ CỦA BÔNG — V12 CHARACTER PLAYGROUND

Cách dùng:
1. Giải nén ZIP.
2. Copy đè vào D:\BNL theo đúng cấu trúc thư mục.
3. GIỮ NGUYÊN các file/asset đang có của bạn, đặc biệt:
   - assets/js/characters.js
   - assets/js/stories.js
   - assets/js/supabase-config.js
   - assets/images/
   - assets/music/

V12 chỉ thay/đưa thêm:
- index.html
- assets/css/style.css
- assets/js/app.js
- assets/js/playground-data.js (MỚI)

MỚI TRONG V12
- Card nhỏ hơn, thiên về character discovery.
- Card chỉ giữ: ảnh, category, tên, tuổi + nghề, location, hook ngắn, rating/link state.
- Profile chia tab:
  Tổng quan / Cốt truyện / NPC / Chơi gì? / Review
- Có "Bạn trong plot" để user biết vai của mình.
- Có NPC Guide riêng cho 5 char gốc.
- Có Event Playground riêng cho 5 char gốc.
- Filter event theo mood/context.
- Nút "Bốc event".
- Mỗi event có tin nhắn mở màn copy-paste được sang GGAI.
- Review + Admin reply + waitlist mail giữ nguyên logic cũ.

5 CHAR ĐÃ CÓ PLAYGROUND DATA
- Milan Nguyễn van Dijk
- James “Jamie” Whitmore
- Noah Minh Nguyễn
- Nguyễn Minh Khải
- Lê Hải Phong

Char mới từ Supabase vẫn chạy bình thường; nếu chưa có playground data sẽ hiện fallback thay vì lỗi.
