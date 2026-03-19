import React, { useEffect, useState } from 'react';
import { defaultStore, useStore } from '../store/store';

export default function Toc({ htmlContent }) {
  const [state] = useStore(defaultStore);
  const [headings, setHeadings] = useState([]);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (!state.loaded || !htmlContent) {
      setHeadings([]);
      return;
    }

    const articleContent = document.getElementById('article-content');
    if (!articleContent) return;

    const elements = Array.from(
      articleContent.querySelectorAll('h1, h2, h3, h4, .subtitle'),
    );

    if (elements.length === 0) return;

    const tocItems = elements
      .map((el, i) => {
        if (!el.id) {
          const textId = el.innerText
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
          el.id = `toc-${i}-${textId || 'heading'}`;
        }

        let level = 2;
        if (el.tagName.match(/^H[1-6]$/)) {
          level = parseInt(el.tagName.substring(1), 10);
        } else if (el.classList.contains('subtitle')) {
          level = 3;
        }

        return {
          id: el.id,
          text: el.innerText.trim(),
          level: level,
        };
      })
      .filter((item) => item.text.length > 0);

    setHeadings(tocItems);
  }, [state.loaded, htmlContent]);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-10% 0px -60% 0px', threshold: 0 },
    );

    headings.forEach((h) => {
      const el = document.getElementById(h.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  useEffect(() => {
    if (headings.length === 0) return;

    const handleScroll = () => {
      const isAtBottom =
        window.innerHeight + Math.round(window.scrollY) >=
        document.documentElement.scrollHeight - 50;

      if (isAtBottom) {
        setActiveId(headings[headings.length - 1].id);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [headings]);

  if (headings.length < 2) return null;

  const scrollToSection = (e, id) => {
    e.preventDefault();
    const target = document.getElementById(id);

    if (target) {
      const offset = 80;

      const elementPosition = target.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
    }
  };

  return (
    <>
      {}
      <details className="lg:hidden collapse collapse-arrow bg-base-200/50 border border-primary/20 mb-8 mt-2 max-w-2xl print:hidden">
        <summary className="collapse-title text-base-content font-medium cursor-pointer flex items-center gap-2">
          <svg
            aria-hidden="true"
            className="w-5 h-5 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
          Table of Contents
        </summary>
        <div className="collapse-content">
          <ul className="flex flex-col gap-3 pt-2">
            {headings.map((h) => (
              <li
                key={`mobile-${h.id}`}
                style={{ marginLeft: `${(h.level - 1) * 1}rem` }}
              >
                <a
                  href={`#${h.id}`}
                  className={`text-sm hover:text-info transition-colors block truncate ${
                    activeId === h.id
                      ? 'text-primary font-semibold'
                      : 'text-base-content/80'
                  }`}
                  onClick={(e) => scrollToSection(e, h.id)}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </details>

      {}
      <div className="hidden lg:flex fixed right-4 xl:right-8 top-32 z-40 print:hidden">
        <div className="group flex flex-col items-end w-10 hover:w-64 transition-all duration-300 ease-in-out">
          {}
          <div className="w-10 h-10 flex items-center justify-center bg-base-100 rounded-full shadow-sm text-primary mb-4 shrink-0 pointer-events-none">
            <svg
              aria-hidden="true"
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h7"
              />
            </svg>
          </div>

          {}
          <ul className="flex flex-col gap-3 w-full relative">
            {headings.map((h) => {
              const isActive = activeId === h.id;

              return (
                <li
                  key={`desktop-${h.id}`}
                  className="flex items-center justify-end w-full cursor-pointer py-1"
                  onClick={(e) => scrollToSection(e, h.id)}
                >
                  <div
                    className={`
                    w-3 h-0.5 z-10 shrink-0 transition-all duration-300 shadow-sm 
                    ${isActive ? 'bg-primary scale-125' : 'bg-secondary/30 hover:bg-secondary'}
                    mr-4
                  `}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
