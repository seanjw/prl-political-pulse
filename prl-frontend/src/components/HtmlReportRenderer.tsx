import { useRef, useEffect } from 'react';

interface HtmlReportRendererProps {
  /** Full raw HTML document string — parsed and rendered inline via shadow DOM */
  html: string;
}

const shareButtonStyles = `
.img-share-wrapper {
  position: relative;
  display: inline-block;
}
.img-share-wrapper .share-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  padding: 0;
  z-index: 10;
}
.img-share-wrapper:hover .share-btn {
  opacity: 1;
}
.img-share-wrapper .share-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}
.img-share-wrapper .share-btn svg {
  width: 16px;
  height: 16px;
}
.img-share-wrapper .share-tooltip {
  position: absolute;
  top: 8px;
  right: 44px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s;
}
.img-share-wrapper .share-tooltip.visible {
  opacity: 1;
}
`;

const shareSvg = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>`;

/**
 * Renders a full HTML document (e.g. Quarto output) inline using shadow DOM.
 * Extracts all styles (including data-URI <link> tags), body content with
 * classes, and re-executes scripts for TOC interactivity.
 */
export function HtmlReportRenderer({ html }: HtmlReportRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !html) return;

    // Parse the full HTML document
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Clear existing shadow content
    if (container.shadowRoot) {
      container.shadowRoot.innerHTML = '';
    }
    const shadow = container.shadowRoot || container.attachShadow({ mode: 'open' });

    // 1. Extract <link href="data:text/css,..."> tags (Quarto embeds CSS this way)
    const linkTags = doc.querySelectorAll('link[rel="stylesheet"]');
    linkTags.forEach((link) => {
      const href = link.getAttribute('href') || '';
      if (href.startsWith('data:text/css,') || href.startsWith('data:text/css;')) {
        const styleEl = document.createElement('style');
        let cssContent = href.startsWith('data:text/css,')
          ? decodeURIComponent(href.slice('data:text/css,'.length))
          : decodeURIComponent(href.replace(/^data:text\/css;[^,]*,/, ''));
        // Rewrite body selectors to target our shadow root div instead
        cssContent = cssContent.replace(/(^|[{},;\s])body(?=[\s:{.,+~>[!])/g, '$1:host > div');
        styleEl.textContent = cssContent;
        shadow.appendChild(styleEl);
      }
    });

    // 2. Extract inline <style> tags from head and body
    const styleTags = doc.querySelectorAll('style');
    styleTags.forEach((tag) => {
      const styleEl = document.createElement('style');
      let cssContent = tag.textContent || '';
      cssContent = cssContent.replace(/(^|[{},;\s])body(?=[\s:{.,+~>[!])/g, '$1:host > div');
      styleEl.textContent = cssContent;
      shadow.appendChild(styleEl);
    });

    // 3. Override styles: show TOC sidebar, match native Quarto layout
    const overrideStyle = document.createElement('style');
    overrideStyle.textContent = `
      :host > div {
        background: #fff;
        color: #212529;
        font-family: "Source Sans Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      #quarto-sidebar-toc-left {
        display: block !important;
      }
      .sidebar.toc-left {
        position: sticky;
        top: 80px;
        max-height: calc(100vh - 100px);
        overflow-y: auto;
        padding-top: 1em;
      }
      /* Section headers — match Quarto's bottom border */
      .content h2 {
        border-bottom: 1px solid #dee2e6;
        padding-bottom: 0.5rem;
        margin-top: 2rem;
      }
    `;
    shadow.appendChild(overrideStyle);

    // 4. Inject share button styles
    const shareStyle = document.createElement('style');
    shareStyle.textContent = shareButtonStyles;
    shadow.appendChild(shareStyle);

    // 5. Create root element with body classes (e.g. "quarto-light")
    const root = document.createElement('div');
    root.className = doc.body?.className || '';
    root.innerHTML = doc.body?.innerHTML || '';
    shadow.appendChild(root);

    // 6. Re-execute script tags so Quarto JS (TOC highlighting, smooth scroll) works
    const scripts = root.querySelectorAll('script');
    scripts.forEach((oldScript) => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.textContent = oldScript.textContent;
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });

    // 7. Wire up TOC anchor links to scroll within the page
    const tocLinks = root.querySelectorAll('a[href^="#"]');
    tocLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;

        const targetId = href.slice(1);
        const target = root.querySelector(`#${CSS.escape(targetId)}`);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });

          // Update active state on TOC links
          root.querySelectorAll('.nav-link.active').forEach((el) => el.classList.remove('active'));
          link.classList.add('active');
        }
      });
    });

    // 8. Add share buttons on images
    const images = root.querySelectorAll('img');
    images.forEach((img) => {
      if (img.width > 0 && img.width < 40) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'img-share-wrapper';
      img.parentNode?.insertBefore(wrapper, img);
      wrapper.appendChild(img);

      const tooltip = document.createElement('span');
      tooltip.className = 'share-tooltip';
      tooltip.textContent = 'Link copied!';
      wrapper.appendChild(tooltip);

      const btn = document.createElement('button');
      btn.className = 'share-btn';
      btn.innerHTML = shareSvg;
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const absoluteUrl = new URL(img.src, window.location.origin).href;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(absoluteUrl).then(() => {
            tooltip.classList.add('visible');
            setTimeout(() => tooltip.classList.remove('visible'), 1500);
          });
        }
      });
      wrapper.appendChild(btn);
    });
  }, [html]);

  return <div ref={containerRef} />;
}
