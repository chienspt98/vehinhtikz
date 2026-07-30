const code = `\\documentclass[tikz,border=2mm]{standalone}
\\usepackage{amsmath}
\\begin{document}
\\begin{tikzpicture}
  \\draw (0,0) -- (1,1);
  \\node at (0,0) {$A$};
\\end{tikzpicture}
\\end{document}`;

const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
const body = [
  `--${boundary}`,
  'Content-Disposition: form-data; name="file[]"; filename="main.tex"',
  'Content-Type: application/x-tex',
  '',
  code,
  `--${boundary}`,
  'Content-Disposition: form-data; name="return"',
  '',
  'png',
  `--${boundary}--`
].join('\r\n');

fetch("https://texlive.net/cgi-bin/latexcgi", {
  method: "POST",
  headers: {
    "Content-Type": `multipart/form-data;boundary=${boundary}`,
  },
  body: body,
})
  .then(async res => {
    console.log("STATUS:", res.status);
    console.log("HEADERS:", [...res.headers.entries()]);
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("image") || contentType.includes("pdf")) {
      const buffer = await res.arrayBuffer();
      console.log("Received binary data of size:", buffer.byteLength);
    } else {
      const text = await res.text();
      console.log("RESPONSE TEXT:", text.substring(0, 500));
    }
  })
  .catch(err => {
    console.error("ERROR:", err);
  });
