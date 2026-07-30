import re

with open('promptTikz.txt', 'r', encoding='utf-8') as f:
    content = f.read()

old_text = r"""- TUYỆT ĐỐI KHÔNG DÙNG TỌA ĐỘ DESCARTES (NHƯ `\coordinate (A) at (2,-1);`) CHO CÁC ĐỈNH CỦA ĐÁY VÌ SẼ LÀM HÌNH BỊ LỆCH PHỐI CẢNH 3D. ĐÂY LÀ LỖI NGHIÊM TRỌNG NHẤT CẦN TRÁNH!"""

new_text = r"""- Đối với đáy là hình bình hành/chữ nhật/vuông, tuân thủ nghiêm ngặt quy tắc tọa độ cực ở trên.
- ĐỐI VỚI ĐÁY LÀ ĐA GIÁC BẤT KỲ (tứ giác thường, ngũ giác, lục giác...): ĐƯỢC PHÉP và NÊN dùng tọa độ Descartes để dễ căn chỉnh. Lấy đỉnh ngoài cùng bên trái (thường là A) làm gốc `(0,0)`, đỉnh ngoài cùng bên phải (thường là C) nằm trên trục hoành `(c,0)`. Các đỉnh KHUẤT phía sau (như B) phải có tọa độ y dương (ví dụ `(2, 1.5)`). Các đỉnh NHÌN THẤY phía trước (như D, E) phải có tọa độ y âm (ví dụ `(3, -1.5)`, `(1, -1)`)."""

content = content.replace(old_text, new_text)

with open('promptTikz.txt', 'w', encoding='utf-8') as f:
    f.write(content)
