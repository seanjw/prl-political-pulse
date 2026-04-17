import { Link } from 'react-router-dom';

const XIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const GitHubIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
  </svg>
);

const LinkedInIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const EmailIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden">
      {/* Main Footer */}
      <div style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16162a 100%)' }}>
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-8">
          {/* Top Section - Logo and Description */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 mb-6">
            <div className="lg:max-w-md">
              <div className="flex items-center gap-3 mb-3">
                <img
                  src="/img/logo-w-text-white.png"
                  alt="Polarization Research Lab"
                  className="h-8"
                />
                <div className="self-start" style={{ marginTop: '20px' }}>
                  <h3 className="text-white font-bold text-sm whitespace-nowrap" style={{ fontFamily: "'Source Serif 4', Georgia, serif" }}>America's Political Pulse</h3>
                  <p className="text-gray-400 text-xs">by Polarization Research Lab</p>
                </div>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed mb-4">
                Tracking democratic health, public opinion, and political polarization through rigorous research and open data.
              </p>

              {/* Social Links */}
              <div className="flex items-center gap-3">
                <a
                  href="https://x.com/PRL_Tweets"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
                  style={{ background: '#ffffff', color: '#1a1a2e' }}
                  aria-label="Follow on X"
                >
                  <XIcon />
                </a>
                <a
                  href="https://github.com/Polarization-Research-Lab"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
                  style={{ background: '#ffffff', color: '#1a1a2e' }}
                  aria-label="View on GitHub"
                >
                  <GitHubIcon />
                </a>
                <a
                  href="https://www.linkedin.com/company/polarization-research-lab/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
                  style={{ background: '#ffffff', color: '#1a1a2e' }}
                  aria-label="Connect on LinkedIn"
                >
                  <LinkedInIcon />
                </a>
                <a
                  href="mailto:seanjwestwood@gmail.com"
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
                  style={{ background: '#ffffff', color: '#1a1a2e' }}
                  aria-label="Email us"
                >
                  <EmailIcon />
                </a>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 lg:gap-12">
              {/* Dashboards */}
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#9ca3af' }}>Dashboards</h5>
                <ul className="space-y-1.5">
                  <li>
                    <Link to="/citizens" className="text-xs hover:text-white transition-colors" style={{ color: '#d1d5db' }}>
                      American Views on Democracy
                    </Link>
                  </li>
                  <li>
                    <Link to="/citizens/values" className="text-xs hover:text-white transition-colors" style={{ color: '#d1d5db' }}>
                      American Values
                    </Link>
                  </li>
                  <li>
                    <Link to="/violence" className="text-xs hover:text-white transition-colors" style={{ color: '#d1d5db' }}>
                      American Political Violence
                    </Link>
                  </li>
                  <li>
                    <Link to="/elites" className="text-xs hover:text-white transition-colors" style={{ color: '#d1d5db' }}>
                      Elected Officials
                    </Link>
                  </li>
                  <li>
                    <Link to="/citizens/international" className="text-xs hover:text-white transition-colors" style={{ color: '#d1d5db' }}>
                      Global Democracy
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Resources */}
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#9ca3af' }}>Resources</h5>
                <ul className="space-y-1.5">
                  <li>
                    <Link to="/data" className="text-xs hover:text-white transition-colors" style={{ color: '#d1d5db' }}>
                      Data
                    </Link>
                  </li>
                  <li>
                    <Link to="/reports" className="text-xs hover:text-white transition-colors" style={{ color: '#d1d5db' }}>
                      Reports
                    </Link>
                  </li>
                </ul>
              </div>

              {/* About */}
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#9ca3af' }}>About</h5>
                <ul className="space-y-1.5">
                  <li>
                    <Link to="/about" className="text-xs hover:text-white transition-colors" style={{ color: '#d1d5db' }}>
                      Our Team
                    </Link>
                  </li>
                  <li>
                    <Link to="/about/support" className="text-xs hover:text-white transition-colors" style={{ color: '#d1d5db' }}>
                      Foundation Support
                    </Link>
                  </li>
                  <li>
                    <Link to="/about/news" className="text-xs hover:text-white transition-colors" style={{ color: '#d1d5db' }}>
                      In the News
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t pt-4 flex items-center justify-center" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <p className="text-xs" style={{ color: '#6b7280' }}>
              © {currentYear} Polarization Research Lab. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Decorative gradient line at very bottom */}
      <div className="h-1 bg-gradient-to-r from-blue-600 via-purple-500 to-blue-600"></div>
    </footer>
  );
}
