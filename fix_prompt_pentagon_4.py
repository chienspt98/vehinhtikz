import re

with open('promptTikz.txt', 'r', encoding='utf-8') as f:
    content = f.read()

old_text = r"""- ĐỐI VỚI ĐÁY LÀ ĐA GIÁC BẤT KỲ (tứ giác thường, ngũ giác, lục giác...): BẮT BUỘC dùng tọa độ Descartes để dễ căn chỉnh. Ví dụ hình chóp ngũ giác S.AEDCB: `\path (0,0) coordinate (A) (1.5,-1) coordinate (E) (5,-1.2) coordinate (D) (7,0) coordinate (C) (2,1.5) coordinate (B) (3,5) coordinate (S); \draw[dashed] (A)--(B)--(C) (S)--(B); \draw (A)--(E)--(D)--(C)--(S)--(A) (S)--(E) (S)--(D);`. Đỉnh ngoài cùng bên trái (thường là A) làm gốc `(0,0)`, đỉnh ngoài cùng bên phải (thường là C) nằm trên trục hoành `(c,0)`. Các đỉnh KHUẤT phía sau (như B) phải có tọa độ y dương. Các đỉnh NHÌN THẤY phía trước (như D, E) phải có tọa độ y âm."""

new_text = r"""- ĐỐI VỚI ĐÁY LÀ ĐA GIÁC BẤT KỲ (tứ giác thường, ngũ giác, lục giác...): BẮT BUỘC dùng tọa độ Descartes để căn chỉnh.
  + Lấy đỉnh ngoài cùng bên trái (thường là A) làm gốc `(0,0)`.
  + Đỉnh ngoài cùng bên phải (thường là C) có y gần 0 (VD: `(6, 0.5)`).
  + Các đỉnh KHUẤT phía sau (như B) phải có tọa độ y dương (VD: `(2.5, 1.5)`).
  + Các đỉnh NHÌN THẤY phía trước (như D, E) phải có tọa độ y âm (VD E thấp nhất: `(1.5, -1.5)`, D cao hơn một chút: `(5, -0.5)`).
  + Đỉnh S ở trên cao (VD: `(1.5, 5)`).
  + TUYỆT ĐỐI KHÔNG sao chép y nguyên tọa độ ví dụ này. BẠN PHẢI TỰ PHÂN TÍCH HÌNH ẢNH GỐC ĐỂ ƯỚC LƯỢNG TỌA ĐỘ (x,y) CHO TỪNG ĐỈNH SAO CHO ĐÚNG TỶ LỆ, ĐÚNG ĐIỂM NÀO THẤP NHẤT, ĐIỂM NÀO CAO NHẤT, ĐỈNH S NẰM LỆCH VỀ BÊN NÀO."""

content = content.replace(old_text, new_text)

with open('promptTikz.txt', 'w', encoding='utf-8') as f:
    f.write(content)
