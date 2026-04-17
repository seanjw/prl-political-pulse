---
geometry: margin=.5cm
header-includes:
  - \usepackage{booktabs}
  - \usepackage{graphicx}
  - \usepackage{xcolor}
  - \usepackage{adjustbox}
  - \usepackage[T1]{fontenc}
  - \usepackage[utf8]{inputenc}
  - \usepackage{helvet}
  - \usepackage{longtable}
  - \usepackage{array}
  - \usepackage{caption}
  - \renewcommand{\familydefault}{\sfdefault}
  - \setlength{\LTleft}{0pt}
  - \setlength{\LTright}{0pt}
  - \captionsetup{font=small,labelfont=bf}
---

\includegraphics[width=.5\linewidth]{images/logo.pdf}
\vspace{2cm}
\begin{center}
\huge{\textbf{Global Political Pulse --- {{ country_display }}}}\\~\\
\huge{ {{ date }} }\\~\\
\vspace{2cm}
\centering
\includegraphics[width=\textwidth]{images/team.png}
\end{center}
\newpage
\thispagestyle{empty}
\newpage
\setcounter{tocdepth}{2}
\tableofcontents
\newpage

{{content}}
