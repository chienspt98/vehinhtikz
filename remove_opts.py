import re

with open('promptTikz.txt', 'r', encoding='utf-8') as f:
    content = f.read()

# We want to clean up all tikzpicture options from the examples,
# removing things like join=round, cap=round, thick, font=\small, font=\footnotesize
# >=stealth, scale=1, transform shape, etc.
# But keeping declare function, and scale if it's not 1

def clean_options(match):
    options = match.group(1)
    if not options:
        return r"\begin{tikzpicture}"
    
    # Split by comma but be careful with declare function={...}
    # It's safer to use regex to remove specific bad strings
    
    bad_patterns = [
        r'join\s*=\s*round',
        r'cap\s*=\s*round',
        r'line\s*join\s*=\s*round',
        r'line\s*cap\s*=\s*round',
        r'thick',
        r'line\s*width=[^,]+',
        r'font\s*=\s*\\small',
        r'font\s*=\s*\\footnotesize',
        r'>=\s*stealth',
        r'transform\s*shape',
        r'scale\s*=\s*1(?!\.)'  # remove scale=1 but keep scale=1.5 or scale=0.5
    ]
    
    for p in bad_patterns:
        options = re.sub(p, '', options)
        
    # Clean up empty commas
    options = re.sub(r',\s*,', ',', options)
    options = re.sub(r'^,\s*', '', options)
    options = re.sub(r',\s*$', '', options)
    options = options.strip()
    
    if options:
        return rf"\begin{{tikzpicture}}[{options}]"
    else:
        return r"\begin{tikzpicture}"

content = re.sub(r'\\begin\{tikzpicture\}\[([^\]]*)\]', clean_options, content)

# Also let's append a rule to the system prompt text
rule = "\n- TUYỆT ĐỐI KHÔNG dùng `join=round, cap=round, thick, font=\\small` hay `font=\\footnotesize` trong tùy chọn của `\\begin{tikzpicture}` (chỉ dùng cho bảng biến thiên nếu cần)."

if "ĐỊNH DẠNG ĐẦU RA:" in content:
    content = content.replace("6. ĐỊNH DẠNG ĐẦU RA:\n--\nYêu cầu:", "6. ĐỊNH DẠNG ĐẦU RA:\n--\nYêu cầu:" + rule)

with open('promptTikz.txt', 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed bad options")
