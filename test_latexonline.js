const code = `\\documentclass[tikz,border=2mm]{standalone}
\\usepackage{amsmath}
\\begin{document}
\\begin{tikzpicture}
  \\draw (0,0) -- (1,1);
  \\node at (0,0) {$A$};
\\end{tikzpicture}
\\end{document}`;

const params = new URLSearchParams();
params.append("text", code);

fetch("https://latexonline.cc/compile?" + params.toString())
  .then(async res => {
    console.log("STATUS:", res.status);
    console.log("CONTENT-TYPE:", res.headers.get("content-type"));
    if (res.status === 200) {
      const buffer = await res.arrayBuffer();
      console.log("Received PDF buffer of size:", buffer.byteLength);
    } else {
      const text = await res.text();
      console.log("RESPONSE TEXT:", text);
    }
  })
  .catch(err => {
    console.error("ERROR:", err);
  });
