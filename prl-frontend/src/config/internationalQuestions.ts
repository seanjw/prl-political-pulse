// Country-specific violence and norm violation questions for international surveys
// These questions are adapted based on each country's unique democratic challenges

export interface CountryQuestion {
  key: string;
  label: string;
  question: string;
  color: string;
}

export interface CountryQuestionConfig {
  code: string;
  name: string;
  color: string;
  violenceQuestions: CountryQuestion[];
  normQuestions: CountryQuestion[];
}

// Brazil: Focus on institutional threats, Bolsonaro-era tensions, environmental conflicts
const BRAZIL_QUESTIONS: CountryQuestionConfig = {
  code: 'BR',
  name: 'Brazil',
  color: '#009c3b',
  violenceQuestions: [
    { key: 'violence1', label: 'Blocking Roads', color: '#dc2626', question: 'A person was convicted of blocking federal highways. They were arrested after organizing a blockade to protest against the opposing political party.' },
    { key: 'violence2', label: 'Property Damage', color: '#dc2626', question: 'A person was convicted of property damage. They were arrested after vandalizing the headquarters of the opposing political party.' },
    { key: 'violence3', label: 'Assault', color: '#dc2626', question: 'A person was convicted of assault. They were arrested for attacking supporters of the opposing political party during a rally.' },
    { key: 'violence4', label: 'Arson', color: '#dc2626', question: 'A person was convicted of arson. They were arrested after setting fire to vehicles belonging to supporters of the opposing party.' },
    { key: 'violence5', label: 'Armed Intimidation', color: '#dc2626', question: 'A person was convicted of armed intimidation. They were arrested for threatening voters at a polling station with a weapon.' },
    { key: 'violence6', label: 'Storming Government Buildings', color: '#dc2626', question: 'A person was convicted of invading public buildings. They were arrested after participating in the storming of government institutions.' },
  ],
  normQuestions: [
    { key: 'norm_judges', label: 'Ignoring Judges', color: '#8b5cf6', question: 'Do you agree: The president should be able to ignore court decisions that obstruct their agenda.' },
    { key: 'norm_polling', label: 'Restricting Polling', color: '#8b5cf6', question: 'Do you agree: The government should restrict opinion polling during election periods.' },
    { key: 'norm_executive', label: 'Executive Power', color: '#8b5cf6', question: 'Do you agree: The president should use emergency powers to bypass Congress when necessary.' },
    { key: 'norm_censorship', label: 'Media Censorship', color: '#8b5cf6', question: 'Do you agree: The government should restrict media outlets that are hostile to the ruling party.' },
    { key: 'norm_loyalty', label: 'Party Loyalty', color: '#8b5cf6', question: 'Do you agree: Government employees should be required to support the ruling party.' },
  ],
};

// Germany: Focus on extremism, AfD tensions, historical sensitivities
const GERMANY_QUESTIONS: CountryQuestionConfig = {
  code: 'DE',
  name: 'Germany',
  color: '#dd0000',
  violenceQuestions: [
    { key: 'violence1', label: 'Illegal Demonstration', color: '#dc2626', question: 'A person was convicted of participating in an illegal demonstration. They were arrested after joining an unauthorized protest against the opposing party.' },
    { key: 'violence2', label: 'Property Damage', color: '#dc2626', question: 'A person was convicted of property damage. They were arrested after vandalizing campaign materials of the opposing party.' },
    { key: 'violence3', label: 'Assault', color: '#dc2626', question: 'A person was convicted of assault. They were arrested for attacking a politician from the opposing party during a public event.' },
    { key: 'violence4', label: 'Arson', color: '#dc2626', question: 'A person was convicted of arson. They were arrested after setting fire to the local office of the opposing party.' },
    { key: 'violence5', label: 'Threatening Officials', color: '#dc2626', question: 'A person was convicted of threatening public officials. They were arrested for sending death threats to local politicians from the opposing party.' },
    { key: 'violence6', label: 'Attacking Refugees', color: '#dc2626', question: 'A person was convicted of assault. They were arrested for attacking individuals they believed supported immigration policies of the opposing party.' },
  ],
  normQuestions: [
    { key: 'norm_media_censorship', label: 'Media Censorship', color: '#8b5cf6', question: 'Do you agree: The government should have more power to regulate media outlets that spread misinformation.' },
    { key: 'norm_nomination', label: 'Nomination Control', color: '#8b5cf6', question: 'Do you agree: The government should have more control over judicial nominations.' },
    { key: 'norm_eu', label: 'EU Independence', color: '#8b5cf6', question: 'Do you agree: Germany should ignore EU rulings that conflict with German interests.' },
    { key: 'norm_dissolve', label: 'Dissolve Parliament', color: '#8b5cf6', question: 'Do you agree: The chancellor should be able to dissolve parliament to call new elections.' },
    { key: 'norm_extremists', label: 'Banning Extremists', color: '#8b5cf6', question: 'Do you agree: Political parties that threaten democratic values should be banned, even without full legal process.' },
  ],
};

// India: Focus on religious tensions, BJP-opposition conflicts, federalism issues
const INDIA_QUESTIONS: CountryQuestionConfig = {
  code: 'IN',
  name: 'India',
  color: '#ff9933',
  violenceQuestions: [
    { key: 'violence1', label: 'Unauthorized Protest', color: '#dc2626', question: 'A person was convicted of holding an unauthorized protest. They were arrested after organizing a demonstration against the ruling party without permission.' },
    { key: 'violence2', label: 'Property Damage', color: '#dc2626', question: 'A person was convicted of property damage. They were arrested after vandalizing shops belonging to supporters of the opposing party.' },
    { key: 'violence3', label: 'Communal Violence', color: '#dc2626', question: 'A person was convicted of assault. They were arrested for attacking members of a community they associated with the opposing party.' },
    { key: 'violence4', label: 'Arson', color: '#dc2626', question: 'A person was convicted of arson. They were arrested after setting fire to homes in a neighborhood known for supporting the opposing party.' },
    { key: 'violence5', label: 'Mob Violence', color: '#dc2626', question: 'A person was convicted of participating in mob violence. They were arrested after joining a group that attacked opposition party members.' },
    { key: 'violence6', label: 'Armed Attack', color: '#dc2626', question: 'A person was convicted of armed assault. They were arrested after attacking a political rally with weapons.' },
  ],
  normQuestions: [
    { key: 'norm_judges', label: 'Ignoring Judges', color: '#8b5cf6', question: 'Do you agree: The government should have more control over judicial appointments to ensure courts align with the majority view.' },
    { key: 'norm_polling', label: 'Restricting Polling', color: '#8b5cf6', question: 'Do you agree: The government should restrict opinion polling during election periods.' },
    { key: 'norm_executive', label: 'Executive Power', color: '#8b5cf6', question: 'Do you agree: The central government should be able to override state government decisions when they conflict with national policy.' },
    { key: 'norm_censorship', label: 'Media Censorship', color: '#8b5cf6', question: 'Do you agree: The government should be able to shut down media outlets that spread content against national interest.' },
    { key: 'norm_loyalty', label: 'Party Loyalty', color: '#8b5cf6', question: 'Do you agree: Government employees should be required to support the ruling party.' },
  ],
};

// Israel: Focus on judicial reform, religious-secular tensions, territorial issues
const ISRAEL_QUESTIONS: CountryQuestionConfig = {
  code: 'IL',
  name: 'Israel',
  color: '#0038b8',
  violenceQuestions: [
    { key: 'violence1', label: 'Blocking Roads', color: '#dc2626', question: 'A person was convicted of blocking roads. They were arrested after participating in protests that shut down major highways.' },
    { key: 'violence2', label: 'Property Damage', color: '#dc2626', question: 'A person was convicted of property damage. They were arrested after vandalizing property belonging to supporters of the opposing political bloc.' },
    { key: 'violence3', label: 'Assault', color: '#dc2626', question: 'A person was convicted of assault. They were arrested for attacking demonstrators from the opposing political camp.' },
    { key: 'violence4', label: 'Disrupting Services', color: '#dc2626', question: 'A person was convicted of disrupting public services. They were arrested after shutting down the airport to protest government policy.' },
    { key: 'violence5', label: 'Threatening Officials', color: '#dc2626', question: 'A person was convicted of threatening public officials. They were arrested for sending threats to Supreme Court justices.' },
    { key: 'violence6', label: 'Armed Confrontation', color: '#dc2626', question: 'A person was convicted of armed confrontation. They were arrested after bringing weapons to a political demonstration.' },
  ],
  normQuestions: [
    { key: 'norm_judges', label: 'Overriding Courts', color: '#8b5cf6', question: 'Do you agree: The Knesset should be able to override Supreme Court decisions with a simple majority.' },
    { key: 'norm_polling', label: 'Restricting Polling', color: '#8b5cf6', question: 'Do you agree: The government should restrict opinion polling during election periods.' },
    { key: 'norm_executive', label: 'Executive Power', color: '#8b5cf6', question: 'Do you agree: The government should have full control over judicial appointments without judicial committee input.' },
    { key: 'norm_censorship', label: 'Media Censorship', color: '#8b5cf6', question: 'Do you agree: The government should restrict media outlets that are hostile to the ruling coalition.' },
    { key: 'norm_loyalty', label: 'Party Loyalty', color: '#8b5cf6', question: 'Do you agree: Government employees should be required to support the ruling coalition.' },
  ],
};

// Poland: Focus on judicial independence, EU tensions, media freedom
const POLAND_QUESTIONS: CountryQuestionConfig = {
  code: 'PL',
  name: 'Poland',
  color: '#dc143c',
  violenceQuestions: [
    { key: 'violence1', label: 'Illegal Protest', color: '#dc2626', question: 'A person was convicted of participating in an illegal protest. They were arrested after joining an unauthorized demonstration against the government.' },
    { key: 'violence2', label: 'Property Damage', color: '#dc2626', question: 'A person was convicted of property damage. They were arrested after defacing government buildings with political messages.' },
    { key: 'violence3', label: 'Assault', color: '#dc2626', question: 'A person was convicted of assault. They were arrested for attacking politicians from the opposing party at a public event.' },
    { key: 'violence4', label: 'Disrupting Parliament', color: '#dc2626', question: 'A person was convicted of disrupting parliamentary proceedings. They were arrested after blocking access to the Sejm.' },
    { key: 'violence5', label: 'Threatening Journalists', color: '#dc2626', question: 'A person was convicted of threatening journalists. They were arrested for sending threats to reporters critical of the government.' },
    { key: 'violence6', label: 'Violent Confrontation', color: '#dc2626', question: 'A person was convicted of violent confrontation. They were arrested after clashing with police during a political demonstration.' },
  ],
  normQuestions: [
    { key: 'norm_1', label: 'Court Reform', color: '#8b5cf6', question: 'Do you agree: The government should be able to replace judges who rule against its policies.' },
    { key: 'norm_2', label: 'Media Repolonization', color: '#8b5cf6', question: 'Do you agree: The government should take control of private media outlets to ensure Polish ownership.' },
    { key: 'norm_3', label: 'Ignoring EU', color: '#8b5cf6', question: 'Do you agree: Poland should ignore EU rulings that conflict with Polish law or values.' },
    { key: 'norm_4', label: 'Constitutional Tribunal', color: '#8b5cf6', question: 'Do you agree: The ruling party should control the Constitutional Tribunal to ensure it supports government policies.' },
    { key: 'norm_5', label: 'Election Rules', color: '#8b5cf6', question: 'Do you agree: The government should be able to change election rules to disadvantage opposition parties.' },
  ],
};

export const INTERNATIONAL_QUESTIONS: Record<string, CountryQuestionConfig> = {
  'Brazil': BRAZIL_QUESTIONS,
  'Germany': GERMANY_QUESTIONS,
  'India': INDIA_QUESTIONS,
  'Israel': ISRAEL_QUESTIONS,
  'Poland': POLAND_QUESTIONS,
};

// Country tabs for the UI
export const COUNTRY_TABS = [
  { key: 'brazil', label: 'Brazil', color: '#009c3b' },
  { key: 'germany', label: 'Germany', color: '#dd0000' },
  { key: 'india', label: 'India', color: '#ff9933' },
  { key: 'israel', label: 'Israel', color: '#0038b8' },
  { key: 'poland', label: 'Poland', color: '#dc143c' },
];

// Map from tab key to country name
export const TAB_KEY_TO_COUNTRY: Record<string, string> = {
  'brazil': 'Brazil',
  'germany': 'Germany',
  'india': 'India',
  'israel': 'Israel',
  'poland': 'Poland',
};
