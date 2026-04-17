import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { usePageTitle } from '../hooks/usePageTitle';
import type { TeamMember, TeamData } from '../types/admin';

function TeamMemberCard({ member }: { member: TeamMember }) {
  const { isDarkMode } = useTheme();

  const cardContent = (
    <>
      {member.photo && (
        <img
          src={member.photo}
          alt={member.name}
          className="w-full aspect-square object-cover rounded-lg mb-3"
        />
      )}
      <h3 className="font-bold text-sm" style={{ color: member.profileLink ? 'var(--accent)' : 'var(--text-primary)' }}>
        {member.website && !member.profileLink ? (
          <a
            href={member.website}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            {member.name}
          </a>
        ) : (
          member.name
        )}
      </h3>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {member.title}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>
        {member.institution}
      </p>
    </>
  );

  const cardStyle = {
    background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
    border: '1px solid var(--border)',
  };

  if (member.profileLink) {
    return (
      <Link
        to={member.profileLink}
        className="rounded-xl p-4 transition-all hover:scale-[1.02] block"
        style={{ ...cardStyle, textDecoration: 'none' }}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <div
      className="rounded-xl p-4 transition-all hover:scale-[1.02]"
      style={cardStyle}
    >
      {cardContent}
    </div>
  );
}

function TeamSection({ title, members }: { title: string; members: TeamMember[] }) {
  return (
    <div className="mb-12">
      <h2
        className="font-bold mb-6 pb-2 border-b"
        style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
      >
        {title}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {members.map((member) => (
          <TeamMemberCard key={member.name} member={member} />
        ))}
      </div>
    </div>
  );
}

export function About() {
  usePageTitle('Our Team');
  const { isDarkMode } = useTheme();
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeamData() {
      try {
        const res = await fetch('/data/team.json');
        const data: TeamData = await res.json();
        setTeamData(data);
      } catch (error) {
        console.error('Error loading team data:', error);
      } finally {
        setLoading(false);
      }
    }
    loadTeamData();
  }, []);

  if (loading || !teamData) {
    return (
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12">
        <div className="animate-pulse">
          <div className="h-8 w-48 rounded mb-4" style={{ background: 'var(--bg-secondary)' }} />
          <div className="h-4 w-96 rounded mb-8" style={{ background: 'var(--bg-secondary)' }} />
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-64 rounded-xl" style={{ background: 'var(--bg-secondary)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-12">
      <div className="mb-8">
        <h1 className="font-bold mb-2" style={{ color: 'var(--text-primary)', fontSize: '1.5rem' }}>
          Our Team
        </h1>
        <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
          The Polarization Research Lab is a multi-institutional research initiative studying political division in America and around the world.
        </p>
      </div>

      <TeamSection title="Faculty" members={teamData.faculty} />
      <TeamSection title="Staff & Pre-docs" members={teamData.staff} />
      <TeamSection title="Postdoctoral Researchers" members={teamData.postdocs} />
      <TeamSection title="Graduate Students" members={teamData.gradStudents} />

      {/* Undergrad RAs - simpler list */}
      <div className="mb-12">
        <h2
          className="font-bold mb-6 pb-2 border-b"
          style={{ color: 'var(--text-primary)', borderColor: 'var(--border)' }}
        >
          Undergraduate Research Assistants
        </h2>
        <p className="text-sm mb-2" style={{ color: 'var(--text-tertiary)' }}>
          Dartmouth College
        </p>
        <div className="flex flex-wrap gap-2">
          {teamData.undergrads.map((name) => (
            <span
              key={name}
              className="px-3 py-1 rounded-full text-sm"
              style={{
                background: isDarkMode ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>

      <TeamSection title="Advisory Board" members={teamData.advisoryBoard} />
      <TeamSection title="Global Advisors" members={teamData.globalAdvisors} />
    </div>
  );
}
