import re

with open('promptTikz.txt', 'r', encoding='utf-8') as f:
    content = f.read()

old_text = r"""- ĐỐI VỚI ĐÁY LÀ ĐA GIÁC BẤT KỲ (tứ giác thường, ngũ giác, lục giác...): BẮT BUỘC dùng tọa độ Descartes để dễ căn chỉnh (ví dụ ngũ giác: `(0,0) coordinate (A) (1.5,-1) coordinate (E) (5,-1.2) coordinate (D) (7,0) coordinate (C) (3,1.5) coordinate (B)`). Đỉnh ngoài cùng bên trái (thường là A) làm gốc `(0,0)`, đỉnh ngoài cùng bên phải (thường là C) nằm trên trục hoành `(c,0)`. Các đỉnh KHUẤT phía sau (như B) phải có tọa độ y dương. Các đỉnh NHÌN THẤY phía trước (như D, E) phải có tọa độ y âm."""

new_text = r"""- ĐỐI VỚI ĐÁY LÀ ĐA GIÁC BẤT KỲ (tứ giác thường, ngũ giác, lục giác...): BẮT BUỘC dùng tọa độ Descartes để dễ căn chỉnh. Ví dụ hình chóp ngũ giác S.AEDCB: `\path (0,0) coordinate (A) (1.5,-1) coordinate (E) (5,-1.2) coordinate (D) (7,0) coordinate (C) (2,1.5) coordinate (B) (3,5) coordinate (S); \draw[dashed] (A)--(B)--(C) (S)--(B); \draw (A)--(E)--(D)--(C)--(S)--(A) (S)--(E) (S)--(D);`. Đỉnh ngoài cùng bên trái (thường là A) làm gốc `(0,0)`, đỉnh ngoài cùng bên phải (thường là C) nằm trên trục hoành `(c,0)`. Các đỉnh KHUẤT phía sau (như B) phải có tọa độ y dương. Các đỉnh NHÌN THẤY phía trước (như D, E) phải có tọa độ y âm."""

content = content.replace(old_text, new_text)

with open('promptTikz.txt', 'w', encoding='utf-8') as f:
    f.write(content)
