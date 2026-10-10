NHÀ CỦA BÔNG — V16 · NGUYỄN ĐÌNH KHANG (NHÀ NỘI)

ĐÂY LÀ PATCH WEBSITE, KHÔNG PHẢI FILE GGAI PROMPT.

A. Nếu thư mục D:\BNL đang chạy V15 Cian hoặc tương thích:
  1. Sao lưu D:\BNL\index.html trước khi đổi.
  2. Copy index.html vào D:\BNL\index.html.
  3. Copy assets/js/khang-data.js vào D:\BNL\assets\js\khang-data.js.
  4. KHÔNG ghi đè/xóa các file ảnh, nhạc, stories.js, characters.js, app.js, playground-data.js, Supabase config.

B. Nếu index.html của bạn đã được tùy chỉnh sau V15, KHÔNG ghi đè index.html.
Thêm dòng sau ngay giữa script cian-data.js và app.js:
  <script src="assets/js/khang-data.js"></script>

C. File MEDIA NGƯỜI DÙNG ĐÃ CÓ Ở MÁY (không nằm trong ZIP):
  assets/images/khang/profile.jpg
  assets/images/khang/1.jpg
  assets/images/khang/2.jpg
  assets/images/khang/3.jpg
  assets/images/khang/4.jpg
  assets/images/khang/5.jpg
  assets/music/khang.mp3

D. Có gì mới:
  - Nhà nội, Nguyễn Đình Khang, 18 tuổi, học sinh THPT Hải Vân Đà Nẵng.
  - Card, profile, 5 hình gallery, nhạc khang.mp3.
  - FULL Background Story + Opening Scene từ file gốc, không cắt bớt.
  - Bạn trong plot, 8 NPC/nhóm NPC, 26 event có prompt copy riêng.
  - Chức năng save, review, share, GGAI/link notification dùng lại frontend cũ.
  - GGAI của Khang hiện chưa được cung cấp: để trống và hiện chờ link.

E. Để đăng GitHub: nhớ upload file khang-data.js VÀ 6 ảnh, khang.mp3 thật.
Sau khi deploy, link share: https://seramya68.github.io/bongnilao/?char=nguyen-dinh-khang

Đề xuất chạy local: cd D:\BNL rồi python -m http.server 5500; mở http://localhost:5500/

Ghi chú kỹ thuật: Tệp data này chỉ thêm nhân vật thông qua window.CHARACTERS,
window.STORIES và window.CHARACTER_PLAYGROUND, không sửa admin/login/review
hoặc Supabase schema; tránh tạo nhân vật trùng bằng biểu mẫu Admin.
