import { usePageTitle } from '../hooks/usePageTitle';

function VariableEntry({
  name,
  type,
  questionText,
  description,
  values,
  note,
}: {
  name: string;
  type: string;
  questionText?: string;
  description?: string;
  values: string;
  note?: string;
}) {
  return (
    <div
      className="p-5 rounded-xl mb-4"
      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
    >
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <code
          className="px-2 py-1 rounded text-sm font-semibold"
          style={{ background: 'var(--bg-secondary)', color: '#2563eb' }}
        >
          {name}
        </code>
        <span
          className="px-2 py-0.5 rounded text-xs"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
        >
          {type}
        </span>
      </div>
      {questionText && (
        <p className="text-sm mb-2" style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
          {questionText}
        </p>
      )}
      {description && (
        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          {description}
        </p>
      )}
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Values: </span>
        {values}
      </p>
      {note && (
        <p
          className="text-xs mt-2 p-3 rounded-lg italic"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', lineHeight: '1.5' }}
        >
          {note}
        </p>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="font-bold mt-10 mb-4 pb-2"
      style={{ color: 'var(--text-primary)', fontSize: '1.25rem', borderBottom: '1px solid var(--border)' }}
    >
      {children}
    </h2>
  );
}

function SubSectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="font-semibold mt-8 mb-4"
      style={{ color: 'var(--text-primary)', fontSize: '1.1rem' }}
    >
      {children}
    </h3>
  );
}

export function Codebook() {
  usePageTitle('Survey Codebook');

  return (
    <div className="max-w-[900px] mx-auto px-4 md:px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-bold mb-4" style={{ color: 'var(--text-primary)', fontSize: '1.75rem' }}>
          Survey Codebook
        </h1>
        <p className="mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          Variable definitions, question wording, and response options for the{' '}
          <a href="/data" style={{ color: '#2563eb', textDecoration: 'underline' }}>
            U.S. survey dataset
          </a>.
        </p>
      </div>

      {/* About */}
      <div
        className="p-6 rounded-xl mb-8"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>About</h2>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          We are a cross-university research lab (Dartmouth College, University of Pennsylvania and Stanford University). The lab exists to serve as a nexus for work on affective polarization, social trust, and political violence.
        </p>
        <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>Our lab focuses on addressing the following critical questions:</p>
        <ul className="text-sm list-disc ml-5" style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
          <li>What are the principal causes of affective polarization and what can be done to treat it?</li>
          <li>When and where does affective polarization alter behavior? Why?</li>
          <li>How effective and durable are approaches to reducing affective polarization?</li>
        </ul>
      </div>

      {/* Methods */}
      <div
        className="p-6 rounded-xl mb-8"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Methods</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          Data were collected from a nationally representative sample of 162,000 American adults via YouGov. Data collection is ongoing, but we present results for between September 2022 and March 2026 for this report. All results are weighted.
        </p>
      </div>

      {/* Demographics Summary Table */}
      <div
        className="p-6 rounded-xl mb-8 overflow-x-auto"
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      >
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Sample Demographics</h2>
        <table className="w-full text-sm" style={{ color: 'var(--text-secondary)' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th className="text-left py-2 pr-4 font-semibold" style={{ color: 'var(--text-primary)' }}></th>
              <th className="text-right py-2 px-4 font-semibold" style={{ color: 'var(--text-primary)' }}>N</th>
              <th className="text-right py-2 pl-4 font-semibold" style={{ color: 'var(--text-primary)' }}>%</th>
            </tr>
          </thead>
          <tbody>
            {([
              ['Partisanship', null, null],
              ['Democrat', '54,984', '37.6%'],
              ['Independent/Other', '51,905', '35.5%'],
              ['Republican', '39,465', '27.0%'],
              ['Sex', null, null],
              ['Female', '76,846', '52.5%'],
              ['Male', '69,508', '47.5%'],
              ['Race', null, null],
              ['Asian', '3,984', '2.7%'],
              ['Black', '17,113', '11.7%'],
              ['Hispanic', '18,845', '12.9%'],
              ['Middle Eastern', '428', '0.3%'],
              ['Native American', '1,690', '1.2%'],
              ['Other', '3,063', '2.1%'],
              ['Two or more races', '4,350', '3.0%'],
              ['White', '96,881', '66.2%'],
              ['Age', null, null],
              ['18-34', '36,465', '24.9%'],
              ['35-50', '36,108', '24.7%'],
              ['51-69', '51,897', '35.5%'],
              ['70+', '21,884', '15.0%'],
              ['Highest Education', null, null],
              ['2-year', '15,577', '10.6%'],
              ['4-year', '31,171', '21.3%'],
              ['High school graduate', '47,254', '32.3%'],
              ['No HS', '5,444', '3.7%'],
              ['Post-grad', '18,393', '12.6%'],
              ['Some college', '28,515', '19.5%'],
              ['2020 Vote Choice', null, null],
              ['Did not vote for President', '37,708', '25.8%'],
              ['Donald Trump', '45,416', '31.0%'],
              ['Howie Hawkins', '587', '0.4%'],
              ['Jo Jorgensen', '1,561', '1.1%'],
              ['Joe Biden', '59,724', '40.8%'],
              ['Other', '1,357', '0.9%'],
              ['Born Again', null, null],
              ['No', '101,680', '69.5%'],
              ['Yes', '44,674', '30.5%'],
            ] as [string, string | null, string | null][]).map(([label, n, pct], i) =>
              n === null ? (
                <tr key={i}>
                  <td
                    colSpan={3}
                    className="pt-4 pb-1 font-semibold"
                    style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}
                  >
                    {label}
                  </td>
                </tr>
              ) : (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-1.5 pr-4 pl-4">{label}</td>
                  <td className="py-1.5 px-4 text-right font-mono text-xs">{n}</td>
                  <td className="py-1.5 pl-4 text-right font-mono text-xs">{pct}</td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* DATABASE VARIABLES */}
      <h1
        className="font-bold mt-12 mb-2 pb-2"
        style={{ color: 'var(--text-primary)', fontSize: '1.5rem', borderBottom: '2px solid var(--border)' }}
      >
        Database Variables
      </h1>

      {/* Democratic Norms */}
      <SectionHeading>Democratic Norms</SectionHeading>

      <VariableEntry name="norm_judges" type="Character" questionText="Do you agree or disagree: {inparty} elected officials should sometimes consider ignoring court decisions when the judges who issued those decisions were appointed by {outparty} presidents." values="Strongly agree / Agree / Neither agree nor disagree / Disagree / Strongly disagree" />
      <VariableEntry name="norm_judges_perception" type="Numeric" questionText="What percent of {outparty} voters do you think agree with the following: {outparty} elected officials should sometimes consider ignoring court decisions when the judges who issued those decisions were appointed by {inparty} presidents." values="0\u2013100" />
      <VariableEntry name="norm_polling" type="Character" questionText="Do you agree or disagree: {inparty} should reduce the number of polling stations in areas that typically support {outparty}." values="Strongly agree / Agree / Neither agree nor disagree / Disagree / Strongly disagree" />
      <VariableEntry name="norm_polling_perception" type="Numeric" questionText="What percent of {outparty} voters do you think agree with the following: {outparty} should reduce the number of polling stations in areas that typically support {inparty}." values="0\u2013100" />
      <VariableEntry name="norm_executive" type="Character" questionText="Do you agree or disagree: If a {inparty} president can't get cooperation from {outparty} members of congress to pass new laws, the {inparty} president should circumvent Congress and issue executive orders on their own to accomplish their priorities." values="Strongly agree / Agree / Neither agree nor disagree / Disagree / Strongly disagree" />
      <VariableEntry name="norm_executive_perception" type="Numeric" questionText="What percent of {outparty} voters do you think agree with the following: If a {outparty} president can't get cooperation from {inparty} members of congress to pass new laws, the {outparty} president should issue executive orders on their own to accomplish their priorities." values="0\u2013100" />
      <VariableEntry name="norm_censorship" type="Character" questionText="Do you agree or disagree with the following: The government should be able to censor media sources that spend more time attacking {inparty} than {outparty}." values="Strongly agree / Agree / Neither agree nor disagree / Disagree / Strongly disagree" />
      <VariableEntry name="norm_censorship_perception" type="Numeric" questionText="What percent of {outparty} voters do you think agree with the following: The government should be able to censor media sources that spend more time attacking {outparty} than {inparty}." values="0\u2013100" />
      <VariableEntry name="norm_loyalty" type="Character" questionText="Do you agree or disagree with the following: When a {inparty} candidate questions the outcome of an election other {inparty} should be more loyal to the {inparty} party than to election rules and the constitution." values="Strongly agree / Agree / Neither agree nor disagree / Disagree / Strongly disagree" />
      <VariableEntry name="norm_loyalty_perception" type="Numeric" questionText="What percent of {outparty} voters do you think agree with the following: When a {outparty} questions the outcome of an election other {outparty} should be more loyal to the {outparty} party than to election rules and the constitution." values="0\u2013100" />
      <VariableEntry name="norm_companies" type="Character" questionText="Do you agree or disagree: {inparty: Democratic/Republican} elected officials should punish companies that speak out against the political priorities of {inparty: Democrats/Republicans}." values="Strongly agree / Agree / Neither agree nor disagree / Disagree / Strongly disagree" />
      <VariableEntry name="norm_companies_perception" type="Numeric" questionText="What percent of {outparty} voters do you think agree with the following: {inparty: Democratic/Republican} elected officials should punish companies that speak out against the political priorities of {inparty: Democrats/Republicans}." values="0\u2013100" />
      <VariableEntry name="norm_violation_justification" type="Character" questionText='Earlier in this survey, you said that living in a representative democracy was {democracy_importance_answer} to you. However, you also {norm_violation_answer}d that {norm_violation_question}. Given that living in a representative democracy is {democracy_importance_answer} to you, can you explain why you {norm_violation_answer} that {norm_violation_question}?' values="Open-ended" note='Question is only asked of participants who answered "Important" or "Very Important" to democracy_importance and answered "Agree" or "Strongly Agree" to at least one of the other questions with the prefix "norm_". A randomly selected norm question is used for {norm_violation_question}.' />

      {/* Affect and Trust */}
      <SectionHeading>Affect and Trust</SectionHeading>

      <VariableEntry name="democrat_therm_1" type="Numeric" questionText="We'd like you to rate how you feel towards some groups on a scale of 0 to 100. Zero means very unfavorable and 100 means very favorable. Fifty means you do not feel favorable or unfavorable. How would you rate your feeling toward Democrats?" values="0\u2013100" />
      <VariableEntry name="republican_therm_1" type="Numeric" questionText="We'd like you to rate how you feel towards some groups on a scale of 0 to 100. Zero means very unfavorable and 100 means very favorable. Fifty means you do not feel favorable or unfavorable. How would you rate your feeling toward Republicans?" values="0\u2013100" />
      <VariableEntry name="general_trust" type="Character" questionText="Do you think your wallet (or your valuables) would be returned to you if it were found by a stranger?" values="Yes / No" />
      <VariableEntry name="institutional_corruption" type="Character" questionText="If a member of Congress were offered a bribe to influence the awarding of a government contract, do you think that the member of Congress would accept or refuse the bribe?" values="Extremely likely to refuse / Likely to refuse / Equally likely to refuse or accept / Likely to accept / Extremely likely to accept" />
      <VariableEntry name="institutional_response" type="Character" questionText="If you were to complain about the poor quality of a public service, how likely or unlikely is it that the problem would be easily resolved?" values="Extremely unlikely / Unlikely / Equally likely or unlikely / Likely / Extremely likely" />
      <VariableEntry name="vote_importance" type="Character" questionText="How important or unimportant is it to vote in every election?" values="Very important / Important / Neither important nor unimportant / Unimportant / Very unimportant" />
      <VariableEntry name="pride" type="Character" questionText="How proud are you to be an American?" values="Extremely proud / Very proud / Moderately proud / Only a little proud / Not at all proud" />
      <VariableEntry name="fair_treatment" type="Character" questionText="Do you agree or disagree that you can expect fair treatment from government authorities?" values="Strongly agree / Agree / Neither agree nor disagree / Disagree / Strongly disagree" />

      {/* Political Violence */}
      <SectionHeading>Political Violence</SectionHeading>

      <VariableEntry name="violence1" type="Character" questionText="Please consider the following scenarios: {permuted name 1} was convicted of protesting without a permit. He was arrested by police after leading a protest against {outparty} on the grounds of the county courthouse. He made no effort to acquire the necessary permit for the protest and refused to leave when asked by police. Do you support or oppose {permuted name 1}'s actions?" values="Strongly support / Support / Neither support nor oppose / Oppose / Strongly oppose" note="Permuted names: Allen Franklin, Josh Kalan, Brendan Carey, Nick Polan, Edgar Herman, Jack Kessol" />
      <VariableEntry name="violence2" type="Character" questionText="{permuted name 2} was convicted of vandalism. He was arrested by police after he vandalized several large signs expressing support for candidates of the {outparty} party. Do you support or oppose {permuted name 2}'s actions?" values="Strongly support / Support / Neither support nor oppose / Oppose / Strongly oppose" note='This question was asked only of respondents who selected "Support" or "Strongly support" for violence1.' />
      <VariableEntry name="violence3" type="Character" questionText="{permuted name 3} was convicted of assault. He was arrested by police for throwing rocks at peaceful {outparty} protesters. Although no one was seriously injured, paramedics bandaged a man with a head wound. Do you support or oppose {permuted name 3}'s actions?" values="Strongly support / Support / Neither support nor oppose / Oppose / Strongly oppose" note='This question was asked only of respondents who selected "Support" or "Strongly support" for violence2.' />
      <VariableEntry name="violence4" type="Character" questionText="{permuted name 4} was convicted of arson. He was arrested by police as he attempted to run from a fire he started at the local {outparty} headquarters. Although he waited for the building to close for the night, several adjacent buildings were still occupied. Do you support or oppose {permuted name 4}'s actions?" values="Strongly support / Support / Neither support nor oppose / Oppose / Strongly oppose" note='This question was asked only of respondents who selected "Support" or "Strongly support" for violence3.' />
      <VariableEntry name="violence5" type="Character" questionText="{permuted name 5} was convicted of assault with a deadly weapon. He was arrested by police after driving his car into a crowd of {outparty} protesters. Although no one was killed, several individuals were seriously injured and one spent a month in the hospital. Do you support or oppose {permuted name 5}'s actions?" values="Strongly support / Support / Neither support nor oppose / Oppose / Strongly oppose" note='This question was asked only of respondents who selected "Support" or "Strongly support" for violence4.' />
      <VariableEntry name="violence6" type="Character" questionText="{permuted name 6} was convicted of murder. He was arrested by police after surveillance footage was found showing him stabbing a prominent {outparty} to death. {permuted name 6} targeted the victim because he believed the victim had prevented him from voting in the last election as part of a conspiracy to stop {inparty} voters. Do you support or oppose {permuted name 6}'s actions?" values="Strongly support / Support / Neither support nor oppose / Oppose / Strongly oppose" note='This question was asked only of respondents who selected "Support" or "Strongly support" for violence5.' />
      <VariableEntry name="violence3_perception" type="Numeric" questionText="What percent of {outparty} voters do you think support {name}'s actions?" values="0\u2013100" />
      <VariableEntry name="violence6_perception" type="Numeric" questionText="What percent of {outparty} voters do you think support {name}'s actions?" values="0\u2013100" />

      {/* Policy Preferences */}
      <SectionHeading>Policy Preferences</SectionHeading>
      <p className="text-sm mb-4 italic" style={{ color: 'var(--text-muted)' }}>
        Each respondent was randomly assigned five of the ten policy questions.
      </p>

      <VariableEntry name="policy_graduated_taxes" type="Character" questionText="Some believe that richer people should pay a larger percentage of their income in taxes, as compared to poorer people. Others believe that every person should pay the same percentage of their income in taxes, regardless of how much they earn. Still others fall somewhere between these two positions. Where do you stand on this issue?" values="1 (Tax richer people at a higher rate) \u2014 4 (Middle of the road) \u2014 7 (Tax everyone at the same rate)" />
      <VariableEntry name="policy_energy_ind" type="Character" questionText="Some believe that the federal government should decrease U.S. production of natural gas and coal. Others believe that the federal government should increase U.S. production of natural gas and coal. Still others fall somewhere between these two positions. Where do you stand on this issue?" values="1 (Decrease U.S. production of natural gas and coal) \u2014 4 (Middle of the road) \u2014 7 (Increase U.S. production of natural gas and coal)" />
      <VariableEntry name="policy_labor_power" type="Character" questionText="Some believe that the federal government should allow workers to unionize and bargain collectively without fear of backlash from employers. Others believe that the federal government should allow employers to discourage unionization and collective bargaining, including by firing employees. Still others fall somewhere between these two positions. Where do you stand on this issue?" values="1 (Allow workers to unionize and bargain collectively) \u2014 4 (Middle of the road) \u2014 7 (Allow employers to discourage unionization and collective bargaining)" />
      <VariableEntry name="policy_health_insur" type="Character" questionText="Some believe that there should be a government insurance plan that covers all medical expenses for everyone. Others believe that medical expenses should be paid by individuals and through private insurance plans. Still others fall somewhere between these two positions. Where do you stand on this issue?" values="1 (Implement government health insurance for everyone) \u2014 4 (Middle of the road) \u2014 7 (Have individuals and private insurance pay medical expenses)" />
      <VariableEntry name="policy_free_trade" type="Character" questionText="Some believe that the U.S. should limit imports from other countries to protect American industries and jobs. Others believe that the U.S. should allow free trade to keep prices low, no matter what country a product comes from. Still others fall somewhere between these two positions. Where do you stand on this issue?" values="1 (Limit free trade) \u2014 4 (Middle of the road) \u2014 7 (Allow free trade)" />
      <VariableEntry name="policy_trans_athletes" type="Character" questionText="Some believe that transgender athletes should be allowed to compete on teams that match the gender they identify with. Others believe that transgender athletes should be required to compete on teams that match the sex they were assigned at birth. Still others fall somewhere between these two positions. Where do you stand on this issue?" values="1 (Allow transgender athletes to compete on teams matching their gender identity) \u2014 4 (Middle of the road) \u2014 7 (Require transgender athletes to compete on teams matching their sex assigned at birth)" />
      <VariableEntry name="policy_abortion" type="Character" questionText="Some believe that abortions should always be legal no matter what the reason. Others believe that abortions should never be legal no matter what the reason. Still others fall somewhere between these two positions. Where do you stand on this issue?" values="1 (Allow all abortions no matter their reason) \u2014 4 (Middle of the road) \u2014 7 (Outlaw all abortions no matter their reason)" />
      <VariableEntry name="policy_defund_police" type="Character" questionText="Some believe that local governments should defund police departments and transfer the money to social and community-based programs. Others believe that local governments should not defund police departments and should not transfer the money to social and community-based programs. Still others fall somewhere between these two positions. Where do you stand on this issue?" values="1 (Defund police departments) \u2014 4 (Middle of the road) \u2014 7 (Don't defund police departments)" />
      <VariableEntry name="policy_gun_rights" type="Character" questionText="Some believe that manufacturing, possessing, and selling assault rifles and semi-automatic weapons should be banned. Others believe that manufacturing, possessing, and selling assault rifles and semi-automatic weapons should not be restricted. Still others fall somewhere between these two positions. Where do you stand on this issue?" values="1 (Ban the manufacture, possession, and sale of assault rifles and semi-automatic weapons) \u2014 4 (Middle of the road) \u2014 7 (Do not restrict the manufacture, possession, and sale of assault rifles and semi-automatic weapons)" />
      <VariableEntry name="policy_marijuana_legal" type="Character" questionText="Some believe that the federal government should legalize marijuana throughout the U.S. Others believe that the federal government should ban marijuana throughout the U.S. Still others fall somewhere between these two positions. Where do you stand on this issue?" values="1 (Legalize marijuana throughout the U.S.) \u2014 4 (Middle of the road) \u2014 7 (Ban marijuana throughout the U.S.)" />

      {/* American Values */}
      <SectionHeading>American Values</SectionHeading>

      <VariableEntry name="CPA1" type="Character" questionText="Have you ever avoided asking for help at work because you thought the person might disagree with your political views?" values="Never / Rarely / Sometimes / Often / Always" />
      <VariableEntry name="CPA2" type="Character" questionText="To what extent does political disagreement at work affect your job satisfaction?" values="Not at all / A little / Somewhat / Quite a bit / A great deal" />
      <VariableEntry name="CPA3" type="Character" questionText="Do you agree or disagree: Companies should take public positions on social issues." values="Strongly agree / Agree / Neither agree nor disagree / Disagree / Strongly disagree" />

      <SubSectionHeading>Should businesses take a public stance on...</SubSectionHeading>
      <VariableEntry name="CPA4_a" type="Character" questionText="Climate change" values="Yes / No / Don't know" />
      <VariableEntry name="CPA4_b" type="Character" questionText="Mental health" values="Yes / No / Don't know" />
      <VariableEntry name="CPA4_c" type="Character" questionText="Racial issues" values="Yes / No / Don't know" />
      <VariableEntry name="CPA4_d" type="Character" questionText="Gun laws" values="Yes / No / Don't know" />
      <VariableEntry name="CPA4_e" type="Character" questionText="LGBTQ+ issues" values="Yes / No / Don't know" />
      <VariableEntry name="CPA4_f" type="Character" questionText="Immigration policy" values="Yes / No / Don't know" />
      <VariableEntry name="CPA4_g" type="Character" questionText="International conflicts" values="Yes / No / Don't know" />
      <VariableEntry name="CPA4_h" type="Character" questionText="Abortion" values="Yes / No / Don't know" />
      <VariableEntry name="CPA4_i" type="Character" questionText="Political candidates" values="Yes / No / Don't know" />

      <VariableEntry name="CPA5" type="Character" questionText="Which of the following best describes the impact businesses have on people's lives?" values="Extremely positive / Positive / Neither positive nor negative / Negative / Extremely negative" />

      <SubSectionHeading>When considering a new job, how important would each factor be?</SubSectionHeading>
      <VariableEntry name="CPA6_a" type="Character" questionText="Offers fair wages to workers of all types" values="Very unimportant / Unimportant / Neither important nor unimportant / Important / Very important" />
      <VariableEntry name="CPA6_b" type="Character" questionText="Offers high-quality healthcare benefits" values="Very unimportant / Unimportant / Neither important nor unimportant / Important / Very important" />
      <VariableEntry name="CPA6_c" type="Character" questionText="Is close to where I live" values="Very unimportant / Unimportant / Neither important nor unimportant / Important / Very important" />
      <VariableEntry name="CPA6_d" type="Character" questionText="Has a commitment to promoting current employees" values="Very unimportant / Unimportant / Neither important nor unimportant / Important / Very important" />
      <VariableEntry name="CPA6_e" type="Character" questionText="Offers remote working options" values="Very unimportant / Unimportant / Neither important nor unimportant / Important / Very important" />
      <VariableEntry name="CPA6_f" type="Character" questionText="Promotes diversity, equity, and inclusion (DEI)" values="Very unimportant / Unimportant / Neither important nor unimportant / Important / Very important" />

      <VariableEntry name="immigration1" type="Character" questionText="On the whole, do you think immigration is a good thing or a bad thing for America today?" values="Good thing / Bad thing / Don't know" />
      <VariableEntry name="immigration2" type="Character" questionText="Do you agree or disagree: immigrants currently living in the United States illegally should be deported." values="Strongly agree / Somewhat agree / Neither agree nor disagree / Somewhat disagree / Strongly disagree" />
      <VariableEntry name="immigration3" type="Character" questionText="Do you agree or disagree: undocumented immigrants currently living in the United States should be granted amnesty." values="Strongly agree / Somewhat agree / Neither agree nor disagree / Somewhat disagree / Strongly disagree" />

      <VariableEntry name="economy1" type="Character" questionText="How do you expect the economy to perform in the next 6 months?" values="Very good / Somewhat good / Neither good nor bad / Somewhat bad / Very bad" />
      <VariableEntry name="economy2" type="Character" questionText="How do you think the economy performed in the previous 6 months?" values="Very good / Somewhat good / Neither good nor bad / Somewhat bad / Very bad" />

      <VariableEntry name="tariffs1" type="Character" questionText="Do you agree or disagree: America would be better off if more Americans worked in manufacturing than they do today." values="Strongly agree / Somewhat agree / Neither agree nor disagree / Somewhat disagree / Strongly disagree" />
      <VariableEntry name="tariffs2a" type="Character" questionText="Would you support or oppose the US government putting new tariffs on things made in other countries?" values="Strongly support / Somewhat support / Neither support nor oppose / Somewhat oppose / Strongly oppose" note="Each respondent was randomly assigned to receive either tariffs2a or tariffs2b." />
      <VariableEntry name="tariffs2b" type="Character" questionText="Would you support or oppose the US government putting new tariffs on things made in other countries even if it increased the price of things you buy at the store?" values="Strongly support / Somewhat support / Neither support nor oppose / Somewhat oppose / Strongly oppose" note="Each respondent was randomly assigned to receive either tariffs2a or tariffs2b." />

      <SubSectionHeading>Do free trade agreements increase or decrease...</SubSectionHeading>
      <VariableEntry name="tariffs3_a" type="Character" questionText="The variety of products Americans buy at the store" values="Increase / Decrease / No difference" />
      <VariableEntry name="tariffs3_b" type="Character" questionText="Prices of products Americans buy at the store" values="Increase / Decrease / No difference" />
      <VariableEntry name="tariffs3_c" type="Character" questionText="The number of American jobs" values="Increase / Decrease / No difference" />
      <VariableEntry name="tariffs3_d" type="Character" questionText="Americans' wages" values="Increase / Decrease / No difference" />

      <VariableEntry name="freespeech" type="Character" questionText="How secure do you think the right to freedom of speech is in America today?" values="Not at all secure / Somewhat secure / Very secure / Completely secure" />

      {/* Additional Miscellaneous Questions */}
      <SectionHeading>Additional Miscellaneous Questions</SectionHeading>

      <VariableEntry name="maga" type="Character" questionText="Would you describe yourself as a..." values="MAGA Republican / Never Trumper / Neither" note='This question was asked only of respondents who selected "Republican" or "Lean Republican" when asked about their party identification.' />

      <SubSectionHeading>Group Feeling Thermometers</SubSectionHeading>
      <p className="text-sm mb-4 italic" style={{ color: 'var(--text-muted)' }}>
        Each respondent was randomly assigned two of the six group thermometer questions. Scale: 0 (very unfavorable) to 100 (very favorable).
      </p>
      <VariableEntry name="group_therms_black_1" type="Numeric" questionText="How would you rate your feelings toward Black Americans?" values="0\u2013100" />
      <VariableEntry name="group_therms_white_1" type="Numeric" questionText="How would you rate your feelings toward White Americans?" values="0\u2013100" />
      <VariableEntry name="group_therms_jewish_1" type="Numeric" questionText="How would you rate your feelings toward Jewish Americans?" values="0\u2013100" />
      <VariableEntry name="group_therms_hispanic_1" type="Numeric" questionText="How would you rate your feelings toward Hispanic Americans?" values="0\u2013100" />
      <VariableEntry name="group_therms_illegal_immigrants_1" type="Numeric" questionText="How would you rate your feelings toward illegal immigrants?" values="0\u2013100" />
      <VariableEntry name="group_therms_trans_1" type="Numeric" questionText="How would you rate your feelings toward Transgender people?" values="0\u2013100" />

      <VariableEntry name="accuracy" type="Character" questionText="Do you agree or disagree with the following: The 2020 midterm election outcome will/did accurately reflect(ed) the preferences of those who voted." values="Strongly agree / Agree / Neither agree nor disagree / Disagree / Strongly disagree" note="Question wording varies based on survey timing relative to 11/8: future tense before, past tense after." />
      <VariableEntry name="accuracy_perception" type="Numeric" questionText="What percent of {outparty} voters do you think agree with the above?" values="0\u2013100" />
      <VariableEntry name="democracy_importance" type="Character" questionText="A representative democracy is a system of government where citizens elect officials who make and enforce laws on their behalf, such as the United States. How important or unimportant is it to you that you live in a representative democracy?" values="Very important / Important / Neither important nor unimportant / Unimportant / Very unimportant" />

      {/* Demographics Variables */}
      <SectionHeading>Demographics</SectionHeading>

      <VariableEntry name="matchup2024" type="Character" questionText="If the 2024 election for president were held today between Donald Trump and Kamala Harris, would you vote for Trump or Harris?" values="Another candidate / Donald Trump / Joe Biden / Kamala Harris / Not going to vote / Not sure" />
      <VariableEntry name="birthyr" type="Integer" questionText="In what year were you born?" values="Year value" />
      <VariableEntry name="gender" type="Character" questionText="Are you male or female?" values="Male / Female" />
      <VariableEntry name="race" type="Character" questionText="What racial or ethnic group best describes you?" values="White / Black / Hispanic/Latino / Asian / Native American / Middle Eastern / Mixed Race / Other" />
      <VariableEntry name="hispanic" type="Character" questionText="Are you of Spanish, Latino, or Hispanic origin or descent?" values="Yes / No" />
      <VariableEntry name="speakspanish" type="Character" questionText="Do you speak Spanish on a regular basis?" values="I speak Spanish primarily / I speak both Spanish and English equally / I speak English primarily but can speak Spanish / I cannot speak Spanish" />
      <VariableEntry name="educ" type="Character" questionText="What is the highest level of education you have completed?" values="No high school degree / High school graduate / Some college, but no degree (yet) / 2-year college degree / 4-year college degree / Postgraduate degree" />
      <VariableEntry name="marstat" type="Character" questionText="What is your marital status?" values="Married, living with spouse / Separated / Divorced / Widowed / Single, never married / Domestic partnership" />
      <VariableEntry name="employ" type="Character" questionText="Which of the following best describes your current employment status?" values="Working full time now / Working part time now / Temporarily laid off / Unemployed / Retired / Permanently disabled / Taking care of home or family / Student / Other" />
      <VariableEntry name="faminc_new" type="Character" questionText="Thinking back over the last year, what was your family's annual income?" values="Less than $10,000 / $10,000\u2013$19,999 / $20,000\u2013$29,999 / $30,000\u2013$39,999 / $40,000\u2013$49,999 / $50,000\u2013$59,999 / $60,000\u2013$69,999 / $70,000\u2013$79,999 / $80,000\u2013$99,999 / $100,000\u2013$119,999 / $120,000\u2013$149,999 / $150,000\u2013$199,999 / $200,000\u2013$249,999 / $250,000\u2013$349,999 / $350,000\u2013$499,999 / $500,000 or more / Prefer not to say" />
      <VariableEntry name="child18" type="Character" questionText="Are you the parent or guardian of any children under the age of 18?" values="Yes / No" />
      <VariableEntry name="pid3" type="Character" questionText="Generally speaking, do you think of yourself as a...?" values="Democrat / Republican / Independent / Other / Not sure" />
      <VariableEntry name="pid7" type="Character" description="Coded from pid3 and follow-up questions." values="Strong Democrat / Not very strong Democrat / Lean Democrat / Independent / Lean Republican / Not very strong Republican / Strong Republican / Not sure" />
      <VariableEntry name="presvote16post" type="Character" questionText="Who did you vote for in the election for President in 2016?" values="Hillary Clinton / Donald Trump / Gary Johnson / Jill Stein / Evan McMullin / Other / Did not vote for President" />
      <VariableEntry name="republican_primary" type="Character" questionText="Who would you vote for in the Republican primary for President in 2024?" values="Chris Christie / Donald Trump / I would not vote / Mike Pence / Nikki Haley / Not sure / Ron DeSantis / Tim Scott / Vivek Ramaswamy" />
      <VariableEntry name="presvote20post" type="Character" questionText="Who did you vote for in the election for President in 2020?" values="Joe Biden / Donald Trump / Jo Jorgensen / Howie Hawkins / Other / Did not vote for President" />
      <VariableEntry name="presvote24post" type="Character" questionText="Who did you vote for in the election for President in 2024?" values="Kamala Harris / Donald Trump / Robert F. Kennedy, Jr. / Jill Stein / Cornel West / Chase Oliver / Other / Did not vote for President" />
      <VariableEntry name="turnout24post" type="Character" questionText="Did you vote in the November 2024 general election?" values="Yes / No" />
      <VariableEntry name="inputstate" type="Character" questionText="What is your State of Residence?" values="All 50 states + District of Columbia" />
      <VariableEntry name="urbanicity2" type="Character" questionText="Would you describe the place where you live as..." values="Big city / Rural area / Small town / Smaller city / Suburban area" />
      <VariableEntry name="votereg" type="Character" questionText="Are you registered to vote?" values="Yes / No / Don't know" />
      <VariableEntry name="ideo5" type="Character" questionText="In general, how would you describe your own political viewpoint?" values="Very liberal / Liberal / Moderate / Conservative / Very conservative / Not sure" />
      <VariableEntry name="newsint" type="Character" questionText="Some people seem to follow what's going on in government and public affairs most of the time, whether there's an election going on or not. Others aren't that interested. Would you say you follow what's going on in government and public affairs..." values="Most of the time / Some of the time / Only now and then / Hardly at all / Don't know" />
      <VariableEntry name="religpew" type="Character" questionText="What is your present religion, if any?" values="Protestant / Roman Catholic / Mormon / Eastern or Greek Orthodox / Jewish / Muslim / Buddhist / Hindu / Atheist / Agnostic / Nothing in particular / Something else" />
      <VariableEntry name="pew_churatd" type="Character" questionText="Aside from weddings and funerals, how often do you attend religious services?" values="More than once a week / Once a week / Once or twice a month / A few times a year / Seldom / Never / Don't know" />
      <VariableEntry name="pew_bornagain" type="Character" questionText='Would you describe yourself as a "born-again", or evangelical Christian, or not?' values="Yes / No" />
      <VariableEntry name="pew_religimp" type="Character" questionText="How important is religion in your life?" values="Very important / Somewhat important / Not too important / Not at all important" />
      <VariableEntry name="pew_prayer" type="Character" questionText="People practice their religion in different ways. Outside of attending religious services, how often do you pray?" values="Several times a day / Once a day / A few times a week / Once a week / A few times a month / Seldom / Never / Don't know" />

      {/* Survey Metadata */}
      <SectionHeading>Survey Metadata</SectionHeading>

      <VariableEntry name="weight" type="Numeric" description="Survey weight. Weights are constructed using propensity scores." values="Numeric" />
      <VariableEntry name="party_rand_cat" type="Character" description='Respondents who identified as "Independent" on pid3 were assigned to an outparty for questions where an outparty specification was necessary.' values="Independent assigned Democrat / Independent assigned Republican" />
      <VariableEntry name="starttime" type="Character" description="Timestamp indicating when the respondent started the survey." values="Timestamp" />
      <VariableEntry name="endtime" type="Character" description="Timestamp indicating when the respondent ended the survey." values="Timestamp" />
      <VariableEntry name="engaged" type="Numeric" description="Indicates whether the respondent passed the attention check." values="0 = Failed / 1 = Passed" />
      <VariableEntry name="year" type="Integer" description="Numeric value indicating the year the survey was conducted." values="Year" />
      <VariableEntry name="week" type="Numeric" description="Numeric value indicating the week the survey was conducted." values="Numeric" />
      <VariableEntry name="survey" type="Numeric" description="Numeric value indicating the survey wave." values="Numeric" />
      <VariableEntry name="uid_public" type="Character" description="Unique respondent identifier." values="String" />
      <VariableEntry name="id" type="Numeric" description="Numeric value indicating the row number." values="Numeric" />
      <VariableEntry name="county_fips" type="Numeric" description="County FIPS code." values="Numeric" />
      <VariableEntry name="statecd_zip" type="Numeric" description="Congressional district respondent resides in." values="Numeric" />
      <VariableEntry name="chosen_norm_question" type="Character" description="The randomly selected norm question used for the norm_violation_justification question." values="norm_censorship / norm_executive / norm_judges / norm_loyalty / norm_polling" />
      <VariableEntry name="party" type="Character" description="Party respondent belongs to." values="dems / reps" />
      <VariableEntry name="aff_pol" type="Numeric" description="Respondent's affective polarization — difference between a respondent's in-party thermometer score and their out-party thermometer score." values="Numeric" />
    </div>
  );
}
