# Image to LaTeX / TikZ Converter

Ứng dụng Vite + React, có ba Vercel Functions:

- `POST /api/convert-image`
- `POST /api/render-tikz`
- `POST /api/fix-tikz`

## Chạy trên máy

Yêu cầu Node.js 22.

```bash
npm install
npm run dev
```

Mở `http://localhost:3000`, vào **Cài đặt** và nhập Gemini API Key cá nhân.
Không cần tạo `.env.local`.

## Deploy lên Vercel

1. Đưa toàn bộ thư mục này lên một repository GitHub.
2. Trên Vercel, chọn **Add New → Project** và import repository.
3. Kiểm tra **Root Directory** đang trỏ tới đúng thư mục có `package.json`, `vercel.json` và thư mục `api`.
4. Giữ Framework Preset là **Vite**; Build Command là `npm run build`; Output Directory là `dist`.
5. Không cần thêm biến môi trường `GEMINI_API_KEY`.
6. Nhấn **Deploy**.

Nếu dự án Vercel đã từng deploy bản cũ, hãy Redeploy và bỏ chọn dùng lại build cache.

## Lưu ý

- Mỗi người dùng nhập Gemini API Key riêng trong trình duyệt.
- Ảnh lớn được tự động thu nhỏ/nén trước khi gửi để không vượt giới hạn payload của Vercel Functions.
- `promptTikz.txt` được Vercel tự phát hiện và đóng gói cùng các Functions.
- Thời lượng tối đa 60 giây được khai báo ngay trong từng file API.
- `vercel.json` không dùng mẫu `functions` nên không còn lỗi `api/*.ts doesn't match any Serverless Functions`.
