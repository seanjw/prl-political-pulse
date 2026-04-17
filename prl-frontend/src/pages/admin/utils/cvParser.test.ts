import { describe, it, expect } from 'vitest';
import { parseCV } from './cvParser';

describe('cvParser', () => {
  describe('parseCV', () => {
    describe('BibTeX parsing', () => {
      it('parses a simple article entry', () => {
        const bib = `
@article{smith2024,
  author = {John Smith and Jane Doe},
  title = {A Study of Something},
  journal = {Journal of Studies},
  year = {2024},
  volume = {10},
  pages = {1--20}
}`;
        const cv = `
\\section{Publications}
\\publication{smith2024}
`;
        const result = parseCV(cv, bib);

        expect(result.data.publications).toHaveLength(1);
        expect(result.data.publications![0].title).toBe('A Study of Something');
        expect(result.data.publications![0].journal).toBe('Journal of Studies');
        expect(result.data.publications![0].year).toBe('2024');
        expect(result.data.publications![0].volume).toBe('10');
        expect(result.data.publications![0].pages).toBe('1–20');
      });

      it('cleans LaTeX formatting from fields', () => {
        const bib = `
@article{test2024,
  author = {John \\textbf{Smith}},
  title = {A {Study} of \\uppercase{something}},
  journal = {Journal of Studies},
  year = {2024}
}`;
        const cv = `
\\section{Publications}
\\publication{test2024}
`;
        const result = parseCV(cv, bib);

        expect(result.data.publications![0].title).toBe('A Study of SOMETHING');
        expect(result.data.publications![0].authors).toContain('John Smith');
      });

      it('handles escaped special characters', () => {
        const bib = `
@article{test2024,
  author = {Smith \\& Jones},
  title = {100\\% Effective Methods},
  journal = {Test Journal},
  year = {2024}
}`;
        const cv = `
\\section{Publications}
\\publication{test2024}
`;
        const result = parseCV(cv, bib);

        expect(result.data.publications![0].authors).toContain('Smith & Jones');
        expect(result.data.publications![0].title).toContain('100% Effective');
      });

      it('converts author "and" to proper format', () => {
        const bib = `
@article{multi2024,
  author = {Alice Smith and Bob Jones and Carol White},
  title = {Collaboration Paper},
  journal = {Test},
  year = {2024}
}`;
        const cv = `
\\section{Publications}
\\publication{multi2024}
`;
        const result = parseCV(cv, bib);

        expect(result.data.publications![0].authors).toBe('Alice Smith, & Bob Jones, & Carol White');
      });
    });

    describe('book parsing', () => {
      it('parses book entries', () => {
        const bib = `
@book{mybook2023,
  author = {John Author},
  title = {The Great Book},
  publisher = {Academic Press},
  year = {2023}
}`;
        const cv = `
\\section{Books}
\\publication{mybook2023}
`;
        const result = parseCV(cv, bib);

        expect(result.data.books).toHaveLength(1);
        expect(result.data.books![0].title).toBe('The Great Book');
        expect(result.data.books![0].publisher).toBe('Academic Press');
        expect(result.data.books![0].year).toBe(2023);
      });

      it('extracts reviewed in note from CV', () => {
        const bib = `
@book{mybook2023,
  author = {John Author},
  title = {The Great Book},
  publisher = {Academic Press},
  year = {2023}
}`;
        const cv = `
\\section{Books}
\\publication{mybook2023}
\\textbf{Reviewed in:} New York Times, Washington Post
`;
        const result = parseCV(cv, bib);

        expect(result.data.books![0].reviewedIn).toBe('New York Times, Washington Post');
      });
    });

    describe('chapter parsing', () => {
      it('parses incollection entries as chapters', () => {
        const bib = `
@incollection{chapter2024,
  author = {Jane Writer},
  title = {My Chapter},
  booktitle = {The Edited Volume},
  editor = {Ed Editor},
  publisher = {Big Publisher},
  year = {2024}
}`;
        const cv = `
\\section{Chapter}
\\publication{chapter2024}
`;
        const result = parseCV(cv, bib);

        expect(result.data.chapters).toHaveLength(1);
        expect(result.data.chapters![0].title).toBe('My Chapter');
        expect(result.data.chapters![0].book).toBe('The Edited Volume');
        expect(result.data.chapters![0].editors).toBe('Ed Editor');
      });
    });

    describe('under review section', () => {
      it('parses under review publications', () => {
        const bib = `
@article{pending2024,
  author = {Researcher},
  title = {New Findings},
  journal = {Under Review},
  year = {2024}
}`;
        const cv = `
\\section{Under Review}
\\publication{pending2024}
`;
        const result = parseCV(cv, bib);

        expect(result.data.underReview).toHaveLength(1);
        expect(result.data.underReview![0].title).toBe('New Findings');
        expect(result.data.underReview![0].status).toBe('Under Review');
      });

      it('detects R&R status from journal field', () => {
        const bib = `
@article{rr2024,
  author = {Researcher},
  title = {Revised Paper},
  journal = {Revise and Resubmit at Top Journal},
  year = {2024}
}`;
        const cv = `
\\section{Under Review}
\\publication{rr2024}
`;
        const result = parseCV(cv, bib);

        expect(result.data.underReview![0].status).toBe('R&R');
        expect(result.data.underReview![0].journal).toBe('Top Journal');
      });
    });

    describe('works in progress', () => {
      it('parses works in progress', () => {
        const bib = `
@article{wip2024,
  author = {Busy Researcher},
  title = {Ongoing Work},
  journal = {In Progress},
  year = {2024}
}`;
        const cv = `
\\section{Work in Progress}
\\publication{wip2024}
`;
        const result = parseCV(cv, bib);

        expect(result.data.worksInProgress).toHaveLength(1);
        expect(result.data.worksInProgress![0].title).toBe('Ongoing Work');
      });
    });

    describe('publication notes', () => {
      it('extracts withStudent note', () => {
        const bib = `
@article{student2024,
  author = {Prof and Student},
  title = {Student Collaboration},
  journal = {Journal},
  year = {2024}
}`;
        const cv = `
\\section{Publications}
\\publication{student2024}
* written with a student
`;
        const result = parseCV(cv, bib);

        expect(result.data.publications![0].withStudent).toBe(true);
      });

      it('extracts media coverage note', () => {
        const bib = `
@article{famous2024,
  author = {Famous Author},
  title = {Viral Paper},
  journal = {Top Journal},
  year = {2024}
}`;
        const cv = `
\\section{Publications}
\\publication{famous2024}
\\textbf{Covered in:} New York Times, CNN
`;
        const result = parseCV(cv, bib);

        expect(result.data.publications![0].mediaCoverage).toBe('New York Times, CNN');
      });
    });

    describe('awards extraction', () => {
      it('extracts awards from WorkEntry format', () => {
        const cv = `
\\section{Awards}
\\WorkEntry{Best Paper Award}{APSA}{2023}{}
\\WorkEntry{Teaching Award}{Duke University}{2022}{}
`;
        const result = parseCV(cv, '');

        expect(result.data.awards).toHaveLength(2);
        expect(result.data.awards![0].name).toBe('Best Paper Award');
        expect(result.data.awards![0].institution).toBe('APSA');
        expect(result.data.awards![0].year).toBe(2023);
      });
    });

    describe('grants extraction', () => {
      it('extracts grants with PI role', () => {
        const cv = `
\\section{Grants}
\\WorkEntry{Research Grant}{NSF}{PI - \\$500,000 2023-2025}{}
`;
        const result = parseCV(cv, '');

        expect(result.data.grants).toHaveLength(1);
        expect(result.data.grants![0].title).toBe('Research Grant');
        expect(result.data.grants![0].funder).toBe('NSF');
        expect(result.data.grants![0].role).toBe('PI');
        expect(result.data.grants![0].amount).toBe('$500,000');
        expect(result.data.grants![0].year).toBe('2023-2025');
      });

      it('extracts grants with Co-PI role', () => {
        const cv = `
\\section{Grants}
\\WorkEntry{Collaborative Grant}{NIH}{Co-PI - \\$200,000 2024}{}
`;
        const result = parseCV(cv, '');

        expect(result.data.grants![0].role).toBe('Co-PI');
      });
    });

    describe('invited talks extraction', () => {
      it('extracts invited talks from itemize format', () => {
        const cv = `
\\section{Invited Talks}
\\begin{itemize}
\\item Harvard University, 2024
\\item Stanford University, 2023
\\end{itemize}
`;
        const result = parseCV(cv, '');

        expect(result.data.invitedTalks).toHaveLength(2);
        expect(result.data.invitedTalks![0].institution).toBe('Harvard University');
        expect(result.data.invitedTalks![0].year).toBe(2024);
        expect(result.data.invitedTalks![1].institution).toBe('Stanford University');
        expect(result.data.invitedTalks![1].year).toBe(2023);
      });
    });

    describe('conference presentations extraction', () => {
      it('extracts conference presentations with year counts', () => {
        const cv = `
\\section{Conference Presentations}
\\begin{itemize}
\\item APSA: 2024, 2023 (2), 2022
\\end{itemize}
`;
        const result = parseCV(cv, '');

        // Should have 4 presentations (1 for 2024, 2 for 2023, 1 for 2022)
        expect(result.data.conferencePresentations).toHaveLength(4);
        expect(result.data.conferencePresentations!.filter(p => p.year === 2023)).toHaveLength(2);
      });
    });

    describe('service extraction', () => {
      it('extracts service items', () => {
        const cv = `
\\section{Service}
\\begin{itemize}
\\item Editorial Board, Journal of Politics (2020-)
\\item Reviewer, APSR
\\end{itemize}
`;
        const result = parseCV(cv, '');

        expect(result.data.service).toHaveLength(2);
        expect(result.data.service![0].role).toContain('Editorial Board');
        expect(result.data.service![0].year).toBe('2020-');
      });
    });

    describe('summary statistics', () => {
      it('returns accurate summary counts', () => {
        const bib = `
@article{pub1,
  author = {Author},
  title = {Paper 1},
  journal = {Journal},
  year = {2024}
}
@article{pub2,
  author = {Author},
  title = {Paper 2},
  journal = {Journal},
  year = {2024}
}
@book{book1,
  author = {Author},
  title = {Book 1},
  publisher = {Press},
  year = {2023}
}`;
        const cv = `
\\section{Books}
\\publication{book1}

\\section{Publications}
\\publication{pub1}
\\publication{pub2}

\\section{Awards}
\\WorkEntry{Award 1}{Inst}{2024}{}
`;
        const result = parseCV(cv, bib);

        expect(result.summary.books).toBe(1);
        expect(result.summary.publications).toBe(2);
        expect(result.summary.awards).toBe(1);
      });
    });

    describe('warnings', () => {
      it('warns about missing BibTeX entries', () => {
        const cv = `
\\section{Publications}
\\publication{missing_key}
`;
        const result = parseCV(cv, '');

        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toContain('Missing BibTeX entries');
        expect(result.warnings[0]).toContain('missing_key');
      });
    });

    describe('URL preservation', () => {
      it('preserves existing URLs when parsing new data', () => {
        const bib = `
@article{test2024,
  author = {Author},
  title = {Test Paper},
  journal = {Journal},
  year = {2024}
}`;
        const cv = `
\\section{Publications}
\\publication{test2024}
`;
        const existingData = {
          publications: [
            {
              authors: 'Author',
              title: 'Test Paper',
              year: '2024',
              citationKey: 'test2024',
              url: 'https://example.com/paper',
            },
          ],
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = parseCV(cv, bib, existingData as any);

        expect(result.data.publications![0].url).toBe('https://example.com/paper');
      });

      it('uses URL from BibTeX if available', () => {
        const bib = `
@article{test2024,
  author = {Author},
  title = {Test Paper},
  journal = {Journal},
  year = {2024},
  url = {https://bibtex-url.com}
}`;
        const cv = `
\\section{Publications}
\\publication{test2024}
`;
        const existingData = {
          publications: [
            {
              authors: 'Author',
              title: 'Test Paper',
              year: '2024',
              citationKey: 'test2024',
              url: 'https://example.com/paper',
            },
          ],
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = parseCV(cv, bib, existingData as any);

        // BibTeX URL should take precedence
        expect(result.data.publications![0].url).toBe('https://bibtex-url.com');
      });

      it('generates DOI URL when available', () => {
        const bib = `
@article{test2024,
  author = {Author},
  title = {Test Paper},
  journal = {Journal},
  year = {2024},
  doi = {10.1234/test}
}`;
        const cv = `
\\section{Publications}
\\publication{test2024}
`;
        const result = parseCV(cv, bib);

        expect(result.data.publications![0].url).toBe('https://doi.org/10.1234/test');
      });
    });

    describe('LaTeX comment handling', () => {
      it('ignores LaTeX comments in CV', () => {
        const bib = `
@article{pub2024,
  author = {Author},
  title = {Paper},
  journal = {Journal},
  year = {2024}
}`;
        const cv = `
\\section{Publications}
% This is a comment
\\publication{pub2024}
% \\publication{commented_out}
`;
        const result = parseCV(cv, bib);

        expect(result.data.publications).toHaveLength(1);
        expect(result.warnings).not.toContain('commented_out');
      });
    });
  });
});
