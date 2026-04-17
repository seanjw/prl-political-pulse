import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const navLinks = [
  { href: '/primary', label: '2026 Primaries' },
  { href: '/citizens', label: 'American Democracy' },
  { href: '/citizens/values', label: 'American Values' },
  { href: '/violence', label: 'Tracking Political Violence' },
  { href: '/elites', label: 'Legislator Quality' },
  { href: '/citizens/international', label: 'Global Democracy' },
  { href: '/reports', label: 'Reports' },
];

const aboutLinks = [
  { href: '/about', label: 'Our Team' },
  { href: '/about/support', label: 'Foundation Support' },
  { href: '/about/news', label: 'In the News' },
  { href: '/data', label: 'Open Data' },
];

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aboutMenuOpen, setAboutMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      {/* Header - always dark */}
      <header className="border-b" style={{ borderColor: '#333333', background: '#242424' }}>
        <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between">
            {/* Left: Logo */}
            <Link to="/" className="shrink-0 pt-[5px]">
              <img
                src="/img/logo-w-text-white.png"
                alt="Polarization Research Lab"
                className="h-8 md:h-10"
              />
            </Link>

            {/* Right: Navigation */}
            <nav className="flex items-center gap-3 pt-[5px]">
              {/* Desktop nav links */}
              <div className="hidden xl:flex items-center gap-3">
                {navLinks.map((link) => {
                  const isActive = location.pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      to={link.href}
                      className="nav-link text-sm transition-all px-2 py-1 rounded whitespace-nowrap hover:outline hover:outline-1 hover:outline-white"
                      style={{
                        color: isActive ? '#ffffff' : '#a3a3a3',
                        fontWeight: isActive ? 600 : 400
                      }}
                    >
                      {link.label}
                    </Link>
                  );
                })}

                {/* About dropdown */}
                <div
                  className="relative"
                  onMouseEnter={() => setAboutMenuOpen(true)}
                  onMouseLeave={() => setAboutMenuOpen(false)}
                >
                  <button
                    className="nav-link text-sm transition-all px-2 py-1 rounded flex items-center gap-1 whitespace-nowrap hover:outline hover:outline-1 hover:outline-white"
                    style={{
                      color: location.pathname.startsWith('/about') ? '#ffffff' : '#a3a3a3',
                      fontWeight: location.pathname.startsWith('/about') ? 600 : 400
                    }}
                  >
                    About
                    <svg className="w-3 h-3 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {aboutMenuOpen && (
                    <div
                      className="absolute top-full right-0 pt-1"
                    >
                      <div
                        className="py-2 rounded-lg shadow-lg min-w-[180px]"
                        style={{ background: '#333333', border: '1px solid #444444' }}
                      >
                        {aboutLinks.map((link) => (
                          <Link
                            key={link.href}
                            to={link.href}
                            className="block px-4 py-2 text-sm transition-colors hover:bg-[#444444]"
                            style={{ color: '#a3a3a3' }}
                            onClick={() => setAboutMenuOpen(false)}
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="xl:hidden p-2 rounded-lg transition-colors hover:bg-[#2d2d2d] flex items-center gap-2"
                style={{ color: '#a3a3a3' }}
              >
                <span className="text-sm">Menu</span>
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-b" style={{ borderColor: '#333333', background: '#242424' }}>
          <div className="max-w-[1600px] mx-auto px-4 py-4">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`text-base py-2 transition-opacity ${
                    location.pathname === link.href ? 'opacity-100' : 'hover:opacity-100'
                  }`}
                  style={{ color: location.pathname === link.href ? '#ffffff' : '#a3a3a3' }}
                >
                  {link.label}
                </Link>
              ))}

              {/* About section in mobile */}
              <div className="pt-2 border-t" style={{ borderColor: '#444444' }}>
                <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#666666' }}>About</p>
                {aboutLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block text-base py-2 transition-opacity ${
                      location.pathname === link.href ? 'opacity-100' : 'hover:opacity-100'
                    }`}
                    style={{ color: location.pathname === link.href ? '#ffffff' : '#a3a3a3' }}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
