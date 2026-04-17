---
title:
subtitle:
geometry: margin=1.5cm
header-includes:
  - \usepackage{booktabs}
  - \usepackage{graphicx}
  - \usepackage{xcolor}
  - \usepackage{adjustbox}
  - \usepackage{helvet}
  - \renewcommand{\familydefault}{\sfdefault}
---

\includegraphics[width=.5\linewidth]{images/logo.pdf}
\vspace{2cm}
\begin{center}
\huge{\textbf{America's Political Pulse}}\\~\\
\huge{ {{ date }} }\\~\\
\vspace{2cm}
\centering
\includegraphics[width=\textwidth]{images/team.png}
\end{center}
\newpage
\thispagestyle{empty}
\newpage
\setcounter{tocdepth}{4}
\tableofcontents
\newpage

# About

We are a cross-university research lab (Dartmouth College, University of Pennsylvania and Stanford University). The lab exists to serve as a nexus for work on affective polarization, social trust, and political violence.

Our lab focuses on addressing the following critical questions:

- What are the principal causes of affective polarization and what can be done to treat it?
- When and where does affective polarization alter behavior? Why?
- How effective and durable are approaches to reducing affective polarization?

## Methods

Data were collected from a nationally representative sample of {{ n }} American adults via YouGov. Data were collected between {{ date }}. All results are weighted.

\newpage

## Demographics

{{ demographics_table }}


\newpage

\begin{center}
\vspace*{\fill}
\section{Affect}
\vspace*{\fill}
\end{center}

\newpage

## Democrat Feeling Thermometer Ratings

**Question Label:** democrat_therm_1

**Question text:** We'd like you to rate how you feel towards some groups on a scale of 0 to 100. Zero means very unfavorable and 100 means very favorable. Fifty means you do not feel favorable or unfavorable. How would you rate your feeling toward Democrats?

**Results**

{{ democrat_therm_1 }}

\newpage

## Republican Feeling Thermometer Ratings

**Question Label:** republican_therm_1

**Question text:** We'd like you to rate how you feel towards some groups on a scale of 0 to 100. Zero means very unfavorable and 100 means very favorable. Fifty means you do not feel favorable or unfavorable. How would you rate your feeling toward Republicans?

**Results**

{{ republican_therm_1 }}


\newpage

\begin{center}
\vspace*{\fill}
\section{Trust and Values}
\vspace*{\fill}
\end{center}

\newpage

## General Trust

**Question Label:** general_trust

**Question text:** Do you think your wallet (or your valuables) would be returned to you if it were found by a stranger?

**Results**

{{ general_trust }}


\newpage

## Institutional Corruption

**Question Label:** institutional_corruption

**Question text:** If a member of Congress were offered a bribe to influence the awarding of a government contract, do you think that the member of Congress would accept or refuse the bribe?

**Results**

{{ institutional_corruption }}


\newpage

## Institutional Response

**Question Label:** institutional_response

**Question text:** If you were to complain about the poor quality of a public service, how likely or unlikely is it that the problem would be easily resolved?

**Results**

{{ institutional_response }}


\newpage

## Importance of Voting

**Question Label:** vote_importance

**Question text:** How important or unimportant is it to vote in every election?

**Results**

{{ vote_importance }}


\newpage

## Pride in Citizenship

**Question Label:** pride

**Question text:** How proud are you to be an American?

**Results**

{{ pride }}


\newpage

## Fair Treatment by Govt

**Question Label:** fair_treatment

**Question text:** Do you agree or disagree that you can expect fair treatment from government authorities?

**Results**

{{ fair_treatment }}


\newpage

\begin{center}
\vspace*{\fill}
\section{Democratic Norms}
\vspace*{\fill}
\end{center}
\newpage

## Judge Appointments

**Question Label:** norm_judges

**Question text:** Do you agree or disagree: {inparty} elected officials should sometimes consider ignoring court decisions when the judges who issued those decisions were appointed by {outparty} presidents.

**Results**

{{ norm_judges }}


\newpage

## Outparty: Judge Appointments

**Question Label:** norm_judges_perception

**Question text:** What percent of {outparty} voters do you think agree with the following: {outparty} elected officials should sometimes consider ignoring court decisions when the judges who issued those decisions were appointed by {inparty} presidents.

**Results**

{{ norm_judges_perception }}


\newpage

## Polling Stations

**Question Label:** norm_polling

**Question text:** Do you agree or disagree: {inparty} should reduce the number of polling stations in areas that typically support {outparty}.

**Results**

{{ norm_polling }}


\newpage


## Outparty: Polling Stations

**Question Label:** norm_polling_perception

**Question text:** What percent of {outparty} voters do you think agree with the following: {outparty} should reduce the number of polling stations in areas that typically support {inparty}.

**Results**

{{ norm_polling_perception }}


\newpage

## Use Executive Orders

**Question Label:** norm_executive

**Question text:** Do you agree or disagree: If a {inparty} president can't get cooperation from {outparty} members of congress to pass new laws, the {inparty} president should circumvent Congress and issue executive orders on their own to accomplish their priorities.

**Results**

{{ norm_executive }}


\newpage


## Outparty: Use Executive Orders

**Question Label:** norm_executive_perception

**Question text:** What percent of {outparty} voters do you think agree with the following: If a {outparty} president can't get cooperation from {inparty} members of congress to pass new laws, the {outparty} president should issue executive orders on their own to accomplish their priorities.

**Results**

{{ norm_executive_perception }}


\newpage

## Censorship

**Question Label:** norm_censorship

**Question text:** Do you agree or disagree with the following: The government should be able to censor media sources that spend more time attacking {inparty} than {outparty}.

**Results**

{{ norm_censorship }}


\newpage


## Outparty: Censorship

**Question Label:** norm_censorship_perception

**Question text:** What percent of {outparty} voters do you think agree with the following: The government should be able to censor media sources that spend more time attacking {outparty} than {inparty}.

**Results**

{{ norm_censorship_perception }}


\newpage



## Loyalty to Election Denial

**Question Label:** norm_loyalty

**Question text:** Do you agree or disagree with the following: When a {inparty} candidate questions the outcome of an election other {inparty} should be more loyal to the {inparty} party than to election rules and the constitution.

**Results**

{{ norm_loyalty }}

\newpage


## Outparty: Loyalty to Election Denial

**Question Label:** norm_loyalty_perception

**Question text:** What percent of {outparty} voters do you think agree with the following: When a {outparty} questions the outcome of an election other {outparty} should be more loyal to the {outparty} party than to election rules and the constitution.

**Results**

{{ norm_loyalty_perception }}


\newpage


\begin{center}
\vspace*{\fill}
\section{Political Violence}
\vspace*{\fill}
\end{center}
\newpage

\newpage

## 1. Support for Unlawful Protest

**Question Label:** violence1

**Question text:** Please consider the following scenarios:  {name} was convicted of protesting without a permit. He was arrested by police after leading a protest against {outparty} on the grounds of the county courthouse. He made no effort to acquire the necessary permit for the protest and refused to leave when asked by police. Do you support or oppose {name}'s actions?

**Results**

{{ violence1 }}


\newpage

## 2. Support for Vandalism

**Question Label:** violence2

**Question text:** {name} was convicted of vandalism. He was arrested by police after he vandalized several large signs expressing support for candidates of the {outparty} party. Do you support or oppose {name}'s actions?

**Results**

{{ violence2 }}


\newpage

## 3. Support for Assault

**Question Label:** violence3

**Question text:** {name} was convicted of assault. He was arrested by police for throwing rocks at peaceful {outparty} protesters. Although no one was  seriously injured, paramedics bandaged a man with a head wound. Do you support or oppose {name}'s actions?

**Results**

{{ violence3 }}


\newpage

## 4. Support for Arson

**Question Label:** violence4

**Question text:** {name} was convicted of arson. He was arrested by police as he attempted to run from a fire he started at the local {outparty} headquarters. Although he waited for the building to close for the night, several adjacent buildings were still occupied. Do you support or oppose {name}'s actions?

**Results**

{{ violence4 }}


\newpage

## 5. Support for Assault with a Deadly Weapon

**Question Label:** violence5

**Question text:** {name} was convicted of assault with a deadly weapon.He was arrested by police after driving his car into a crowd of {outparty} protesters. Although no one was killed, several individuals were seriously injured and one spent a month in the hospital. Do you support or oppose {name}'s actions?

**Results**

{{ violence5 }}


\newpage

## 6. Support for Murder

**Question Label:** violence6

**Question text:** {name} was convicted of murder. He was arrested by police after surveillance footage was found showing him stabbing a prominent {outparty} to death. {name} targeted the victim because he believed the victim had prevented him from voting in the last election as part of a conspiracy to stop {inparty} voters. Do you support or oppose {name}'s actions?

**Results**

{{ violence6 }}


\newpage
