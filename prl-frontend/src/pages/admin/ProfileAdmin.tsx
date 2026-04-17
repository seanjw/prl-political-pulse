import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ProfileData, Publication, Award, Profile, ProfileBook, Chapter, TeachingEvaluation } from '../../types/admin';
import { publishToS3, FILE_PATHS, uploadFileToS3 } from './utils/publishToS3';
import { parseCV, type ParseResult } from './utils/cvParser';
import { fetchScholarStats } from './utils/fetchScholarStats';
// Lazy-load PDF parser to avoid bundling pdfjs-dist in the main chunk
const lazyParseTeachingEvaluation = (file: File) =>
  import('./utils/parseTeachingEval').then(m => m.parseTeachingEvaluation(file));
import { useAdminToast } from './context/AdminToastContext';

// Sortable Publication Card
function SortablePublicationCard({
  id,
  pub,
  onEdit,
  onDelete,
}: {
  id: string;
  pub: Publication;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      className="flex items-start gap-3 p-3 rounded-lg"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 mt-1" style={{ color: 'var(--text-muted)' }}>
        <i className="bi bi-grip-vertical text-lg"></i>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{pub.title}</div>
          {pub.url && (
            <a
              href={pub.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 p-1 hover:opacity-70"
              style={{ color: '#10b981' }}
              title="View paper"
              onClick={(e) => e.stopPropagation()}
            >
              <i className="bi bi-link-45deg"></i>
            </a>
          )}
        </div>
        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {pub.authors} {pub.year && `(${pub.year})`}
        </div>
        {pub.journal && <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{pub.journal}</div>}
        {!pub.url && (
          <div className="text-xs mt-1 flex items-center gap-1" style={{ color: '#f59e0b' }}>
            <i className="bi bi-exclamation-circle"></i>
            <span>No link added</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onEdit} className="p-1 hover:opacity-70" style={{ color: 'var(--text-secondary)' }} title="Edit publication"><i className="bi bi-pencil"></i></button>
        <button onClick={onDelete} className="p-1 hover:opacity-70" style={{ color: '#ef4444' }} title="Delete publication"><i className="bi bi-trash"></i></button>
      </div>
    </div>
  );
}

// Sortable Award Card
function SortableAwardCard({
  id,
  award,
  onEdit,
  onDelete,
}: {
  id: string;
  award: Award;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      className="flex items-center gap-3 p-3 rounded-lg"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1" style={{ color: 'var(--text-muted)' }}>
        <i className="bi bi-grip-vertical text-lg"></i>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{award.name}</div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{award.institution} ({award.year})</div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onEdit} className="p-1 hover:opacity-70" style={{ color: 'var(--text-secondary)' }}><i className="bi bi-pencil"></i></button>
        <button onClick={onDelete} className="p-1 hover:opacity-70" style={{ color: '#ef4444' }}><i className="bi bi-trash"></i></button>
      </div>
    </div>
  );
}

// Sortable Book Card
function SortableBookCard({
  id,
  book,
  onEdit,
  onDelete,
}: {
  id: string;
  book: ProfileBook;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      className="flex items-start gap-3 p-3 rounded-lg"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 mt-1" style={{ color: 'var(--text-muted)' }}>
        <i className="bi bi-grip-vertical text-lg"></i>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{book.title}</div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{book.authors} ({book.year})</div>
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{book.publisher}</div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onEdit} className="p-1 hover:opacity-70" style={{ color: 'var(--text-secondary)' }}><i className="bi bi-pencil"></i></button>
        <button onClick={onDelete} className="p-1 hover:opacity-70" style={{ color: '#ef4444' }}><i className="bi bi-trash"></i></button>
      </div>
    </div>
  );
}

// Sortable Chapter Card
function SortableChapterCard({
  id,
  chapter,
  onEdit,
  onDelete,
}: {
  id: string;
  chapter: Chapter;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      className="flex items-start gap-3 p-3 rounded-lg"
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 mt-1" style={{ color: 'var(--text-muted)' }}>
        <i className="bi bi-grip-vertical text-lg"></i>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{chapter.title}</div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{chapter.authors} ({chapter.year})</div>
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>In: {chapter.book}</div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onEdit} className="p-1 hover:opacity-70" style={{ color: 'var(--text-secondary)' }}><i className="bi bi-pencil"></i></button>
        <button onClick={onDelete} className="p-1 hover:opacity-70" style={{ color: '#ef4444' }}><i className="bi bi-trash"></i></button>
      </div>
    </div>
  );
}

const STORAGE_KEY = 'admin-profile';

type PublicationCategory = 'publications' | 'otherFieldPublications' | 'underReview' | 'worksInProgress' | 'datasets' | 'technicalReports';

const CATEGORY_LABELS: Record<PublicationCategory, string> = {
  publications: 'Peer Reviewed Publications',
  otherFieldPublications: 'Publications in Other Fields',
  underReview: 'Under Review',
  worksInProgress: 'Works in Progress',
  datasets: 'Datasets',
  technicalReports: 'Technical Reports',
};

const emptyPublication: Publication = {
  authors: '',
  year: '',
  title: '',
  journal: '',
  volume: '',
  pages: '',
  url: '',
  note: '',
};

const emptyAward: Award = {
  name: '',
  year: new Date().getFullYear(),
  institution: '',
};

const emptyBook: ProfileBook = {
  title: '',
  authors: '',
  year: new Date().getFullYear(),
  publisher: '',
  url: '',
};

const emptyChapter: Chapter = {
  authors: '',
  year: new Date().getFullYear(),
  title: '',
  book: '',
  editors: '',
  publisher: '',
  url: '',
};

function downloadJSON(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ProfileAdmin() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'publications' | 'awards' | 'teaching' | 'import'>('profile');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['publications']));

  // Import state
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [bibFile, setBibFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);

  // Modal state
  const [showPubForm, setShowPubForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PublicationCategory | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [pubFormData, setPubFormData] = useState<Publication>(emptyPublication);

  const [showAwardForm, setShowAwardForm] = useState(false);
  const [editingAwardIndex, setEditingAwardIndex] = useState<number | null>(null);
  const [awardFormData, setAwardFormData] = useState<Award>(emptyAward);

  // Book form state
  const [showBookForm, setShowBookForm] = useState(false);
  const [editingBookIndex, setEditingBookIndex] = useState<number | null>(null);
  const [bookFormData, setBookFormData] = useState<ProfileBook>(emptyBook);

  // Chapter form state
  const [showChapterForm, setShowChapterForm] = useState(false);
  const [editingChapterIndex, setEditingChapterIndex] = useState<number | null>(null);
  const [chapterFormData, setChapterFormData] = useState<Chapter>(emptyChapter);

  // Interest editing
  const [newInterest, setNewInterest] = useState('');

  // Publishing state
  const [publishing, setPublishing] = useState(false);
  const { showError, showSuccess, showToast } = useAdminToast();

  // Scholar stats state
  const [refreshingScholar, setRefreshingScholar] = useState(false);
  const [scholarError, setScholarError] = useState<string | null>(null);

  // CV upload state
  const [uploadingCV, setUploadingCV] = useState(false);
  const [cvUploadError, setCvUploadError] = useState<string | null>(null);

  // Preprint upload state (for publication form)
  const [uploadingPreprint, setUploadingPreprint] = useState(false);

  // Teaching evaluation state
  const [showTeachingForm, setShowTeachingForm] = useState(false);
  const [editingTeachingIndex, setEditingTeachingIndex] = useState<number | null>(null);
  const [teachingCourse, setTeachingCourse] = useState('');
  const [teachingTerm, setTeachingTerm] = useState('');
  const [teachingYear, setTeachingYear] = useState(new Date().getFullYear());
  const [teachingFile, setTeachingFile] = useState<File | null>(null);
  const [uploadingTeaching, setUploadingTeaching] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEndPub = (event: DragEndEvent, category: PublicationCategory) => {
    const { active, over } = event;
    if (!data || !over || active.id === over.id) return;
    const oldIndex = data[category].findIndex((_, i) => `${category}-${i}` === active.id);
    const newIndex = data[category].findIndex((_, i) => `${category}-${i}` === over.id);
    const updated = { ...data, [category]: arrayMove(data[category], oldIndex, newIndex) };
    setData(updated);
    saveToStorage(updated);
  };

  const handleDragEndAwards = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!data || !over || active.id === over.id) return;
    const oldIndex = data.awards.findIndex((_, i) => `award-${i}` === active.id);
    const newIndex = data.awards.findIndex((_, i) => `award-${i}` === over.id);
    const updated = { ...data, awards: arrayMove(data.awards, oldIndex, newIndex) };
    setData(updated);
    saveToStorage(updated);
  };

  const handleDragEndBooks = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!data || !over || active.id === over.id) return;
    const oldIndex = data.books.findIndex((_, i) => `book-${i}` === active.id);
    const newIndex = data.books.findIndex((_, i) => `book-${i}` === over.id);
    const updated = { ...data, books: arrayMove(data.books, oldIndex, newIndex) };
    setData(updated);
    saveToStorage(updated);
  };

  const handleDragEndChapters = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!data || !over || active.id === over.id) return;
    const oldIndex = data.chapters.findIndex((_, i) => `chapter-${i}` === active.id);
    const newIndex = data.chapters.findIndex((_, i) => `chapter-${i}` === over.id);
    const updated = { ...data, chapters: arrayMove(data.chapters, oldIndex, newIndex) };
    setData(updated);
    saveToStorage(updated);
  };

  useEffect(() => {
    async function loadData() {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setData(JSON.parse(stored));
        setIsDirty(true);
      } else {
        try {
          const res = await fetch('/data/westwood-publications.json');
          const json: ProfileData = await res.json();
          setData(json);
        } catch (error) {
          showError('Failed to load profile data', error);
        }
      }
      setLoading(false);
    }
    loadData();
  }, [showError]);

  const saveToStorage = (newData: ProfileData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
    setIsDirty(true);
  };

  const updateProfile = (updates: Partial<Profile>) => {
    if (!data) return;
    const updated = { ...data, profile: { ...data.profile, ...updates } };
    setData(updated);
    saveToStorage(updated);
  };

  // Book CRUD
  const handleAddBook = () => {
    setEditingBookIndex(null);
    setBookFormData({ ...emptyBook });
    setShowBookForm(true);
  };

  const handleEditBook = (index: number) => {
    if (!data) return;
    setEditingBookIndex(index);
    setBookFormData({ ...data.books[index] });
    setShowBookForm(true);
  };

  const handleDeleteBook = (index: number) => {
    if (!data || !confirm('Are you sure you want to delete this book?')) return;
    const updated = { ...data, books: data.books.filter((_, i) => i !== index) };
    setData(updated);
    saveToStorage(updated);
  };

  const handleSubmitBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    const updated = { ...data };
    if (editingBookIndex !== null) {
      updated.books[editingBookIndex] = { ...bookFormData };
    } else {
      updated.books = [{ ...bookFormData }, ...updated.books];
    }
    setData(updated);
    saveToStorage(updated);
    resetBookForm();
  };

  const resetBookForm = () => {
    setShowBookForm(false);
    setEditingBookIndex(null);
    setBookFormData({ ...emptyBook });
  };

  // Chapter CRUD
  const handleAddChapter = () => {
    setEditingChapterIndex(null);
    setChapterFormData({ ...emptyChapter });
    setShowChapterForm(true);
  };

  const handleEditChapter = (index: number) => {
    if (!data) return;
    setEditingChapterIndex(index);
    setChapterFormData({ ...data.chapters[index] });
    setShowChapterForm(true);
  };

  const handleDeleteChapter = (index: number) => {
    if (!data || !confirm('Are you sure you want to delete this chapter?')) return;
    const updated = { ...data, chapters: data.chapters.filter((_, i) => i !== index) };
    setData(updated);
    saveToStorage(updated);
  };

  const handleSubmitChapter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    const updated = { ...data };
    if (editingChapterIndex !== null) {
      updated.chapters[editingChapterIndex] = { ...chapterFormData };
    } else {
      updated.chapters = [{ ...chapterFormData }, ...updated.chapters];
    }
    setData(updated);
    saveToStorage(updated);
    resetChapterForm();
  };

  const resetChapterForm = () => {
    setShowChapterForm(false);
    setEditingChapterIndex(null);
    setChapterFormData({ ...emptyChapter });
  };

  const addInterest = () => {
    if (!data || !newInterest.trim()) return;
    const updated = {
      ...data,
      profile: {
        ...data.profile,
        researchInterests: [...data.profile.researchInterests, newInterest.trim()],
      },
    };
    setData(updated);
    saveToStorage(updated);
    setNewInterest('');
  };

  const removeInterest = (index: number) => {
    if (!data) return;
    const updated = {
      ...data,
      profile: {
        ...data.profile,
        researchInterests: data.profile.researchInterests.filter((_, i) => i !== index),
      },
    };
    setData(updated);
    saveToStorage(updated);
  };

  const updateBio = (index: number, text: string) => {
    if (!data) return;
    const newBio = [...data.profile.bio];
    newBio[index] = text;
    updateProfile({ bio: newBio });
  };

  const addBioParagraph = () => {
    if (!data) return;
    updateProfile({ bio: [...data.profile.bio, ''] });
  };

  const removeBioParagraph = (index: number) => {
    if (!data) return;
    updateProfile({ bio: data.profile.bio.filter((_, i) => i !== index) });
  };

  // Publication CRUD
  const toggleCategory = (cat: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(cat)) {
      newExpanded.delete(cat);
    } else {
      newExpanded.add(cat);
    }
    setExpandedCategories(newExpanded);
  };

  const handleAddPublication = (category: PublicationCategory) => {
    setEditingCategory(category);
    setEditingIndex(null);
    setPubFormData({ ...emptyPublication });
    setShowPubForm(true);
  };

  const handleEditPublication = (category: PublicationCategory, index: number) => {
    if (!data) return;
    setEditingCategory(category);
    setEditingIndex(index);
    setPubFormData({ ...data[category][index] });
    setShowPubForm(true);
  };

  const handleDeletePublication = (category: PublicationCategory, index: number) => {
    if (!data || !confirm('Are you sure you want to delete this publication?')) return;
    const updated = { ...data, [category]: data[category].filter((_, i) => i !== index) };
    setData(updated);
    saveToStorage(updated);
  };

  const handleSubmitPublication = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !editingCategory) return;

    const updated = { ...data };
    if (editingIndex !== null) {
      updated[editingCategory][editingIndex] = { ...pubFormData };
    } else {
      updated[editingCategory] = [{ ...pubFormData }, ...updated[editingCategory]];
    }
    setData(updated);
    saveToStorage(updated);
    resetPubForm();
  };

  const resetPubForm = () => {
    setShowPubForm(false);
    setEditingCategory(null);
    setEditingIndex(null);
    setPubFormData({ ...emptyPublication });
  };

  // Award CRUD
  const handleAddAward = () => {
    setEditingAwardIndex(null);
    setAwardFormData({ ...emptyAward });
    setShowAwardForm(true);
  };

  const handleEditAward = (index: number) => {
    if (!data) return;
    setEditingAwardIndex(index);
    setAwardFormData({ ...data.awards[index] });
    setShowAwardForm(true);
  };

  const handleDeleteAward = (index: number) => {
    if (!data || !confirm('Are you sure you want to delete this award?')) return;
    const updated = { ...data, awards: data.awards.filter((_, i) => i !== index) };
    setData(updated);
    saveToStorage(updated);
  };

  const handleSubmitAward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;

    const updated = { ...data };
    if (editingAwardIndex !== null) {
      updated.awards[editingAwardIndex] = { ...awardFormData };
    } else {
      updated.awards = [{ ...awardFormData }, ...updated.awards];
    }
    setData(updated);
    saveToStorage(updated);
    resetAwardForm();
  };

  const resetAwardForm = () => {
    setShowAwardForm(false);
    setEditingAwardIndex(null);
    setAwardFormData({ ...emptyAward });
  };

  const handleExport = () => {
    if (!data) return;
    downloadJSON(data, 'westwood-publications.json');
  };

  const handlePublish = async () => {
    if (!data) return;
    setPublishing(true);

    const result = await publishToS3(FILE_PATHS.profile, data);

    if (result.success) {
      showSuccess('Published to live site!');
      localStorage.removeItem(STORAGE_KEY);
      setIsDirty(false);
    } else {
      showError('Failed to publish profile', result.error);
    }

    setPublishing(false);
  };

  const handleResetToSource = async () => {
    if (!confirm('This will discard all local changes. Continue?')) return;
    localStorage.removeItem(STORAGE_KEY);
    try {
      const res = await fetch('/data/westwood-publications.json');
      const json: ProfileData = await res.json();
      setData(json);
      setIsDirty(false);
      showSuccess('Reset to source data');
    } catch (error) {
      showError('Failed to reload data', error);
    }
  };

  const handleRefreshScholar = async () => {
    if (!data?.profile.googleScholar) {
      showToast('warning', 'No Google Scholar URL configured');
      setScholarError('No Google Scholar URL configured');
      return;
    }

    setRefreshingScholar(true);
    setScholarError(null);

    try {
      const stats = await fetchScholarStats(data.profile.googleScholar);
      const today = new Date().toISOString().split('T')[0];

      updateProfile({
        googleCitations: stats.citations,
        hIndex: stats.hIndex,
        citationsLastUpdated: today,
      });

      setScholarError(null);
      showSuccess('Scholar stats updated');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch scholar stats';
      setScholarError(message);
      showError('Failed to fetch scholar stats', error);
    } finally {
      setRefreshingScholar(false);
    }
  };

  const handleCVUpload = async (file: File) => {
    setUploadingCV(true);
    setCvUploadError(null);

    try {
      const result = await uploadFileToS3(file, 'files/westwood-cv.pdf');
      if (result.success && result.url) {
        updateProfile({ cvUrl: result.url });
        setCvUploadError(null);
        showSuccess('CV uploaded successfully');
      } else {
        setCvUploadError(result.error || 'Failed to upload CV');
        showError('Failed to upload CV', result.error);
      }
    } catch (error) {
      setCvUploadError(error instanceof Error ? error.message : 'Failed to upload CV');
      showError('Failed to upload CV', error);
    } finally {
      setUploadingCV(false);
    }
  };

  const handlePreprintUpload = async (file: File, paperTitle: string): Promise<string | null> => {
    setUploadingPreprint(true);
    try {
      // Create a sanitized filename from the paper title
      const sanitizedTitle = paperTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
      const filename = `files/preprints/${sanitizedTitle}.pdf`;

      const result = await uploadFileToS3(file, filename);
      if (result.success && result.url) {
        return result.url;
      }
      return null;
    } catch {
      return null;
    } finally {
      setUploadingPreprint(false);
    }
  };

  const resetTeachingForm = () => {
    setShowTeachingForm(false);
    setEditingTeachingIndex(null);
    setTeachingCourse('');
    setTeachingTerm('');
    setTeachingYear(new Date().getFullYear());
    setTeachingFile(null);
  };

  const startEditTeaching = (index: number) => {
    const ev = (data!.teachingEvaluations || [])[index];
    setEditingTeachingIndex(index);
    setTeachingCourse(ev.course);
    setTeachingTerm(ev.term);
    setTeachingYear(ev.year);
    setTeachingFile(null);
    setShowTeachingForm(true);
  };

  const handleTeachingUpload = async () => {
    if (!data || !teachingCourse.trim() || !teachingTerm.trim()) return;
    // New evaluations require a file; edits can optionally re-upload
    if (editingTeachingIndex === null && !teachingFile) return;

    setUploadingTeaching(true);
    try {
      let pdfUrl: string;
      let parsed: Partial<TeachingEvaluation> = {};

      if (teachingFile) {
        // Parse PDF to extract scores and comments
        parsed = await lazyParseTeachingEvaluation(teachingFile).catch((): Partial<TeachingEvaluation> => ({}));

        const sanitized = `${teachingYear}-${teachingTerm.toLowerCase()}-${teachingCourse.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
        const result = await uploadFileToS3(teachingFile, `files/teaching-evaluations/${sanitized}.pdf`);
        if (!result.success || !result.url) {
          showError('Failed to upload evaluation', result.error);
          return;
        }
        pdfUrl = result.url;
      } else {
        // Editing without new file — keep existing URL and extracted data
        const existing = (data.teachingEvaluations || [])[editingTeachingIndex!];
        pdfUrl = existing.pdfUrl;
        parsed = {
          courseQualityMean: existing.courseQualityMean,
          teachingEffectivenessMean: existing.teachingEffectivenessMean,
          positiveComments: existing.positiveComments,
        };
      }

      const evaluation: TeachingEvaluation = {
        course: teachingCourse.trim(),
        term: teachingTerm.trim(),
        year: teachingYear,
        pdfUrl,
        ...parsed,
      };

      const evals = [...(data.teachingEvaluations || [])];
      if (editingTeachingIndex !== null) {
        evals[editingTeachingIndex] = evaluation;
      } else {
        evals.push(evaluation);
      }
      evals.sort((a, b) => b.year - a.year || a.term.localeCompare(b.term));

      const updated = { ...data, teachingEvaluations: evals };
      setData(updated);
      saveToStorage(updated);
      resetTeachingForm();

      const extractedParts = [
        parsed.courseQualityMean && `course quality: ${parsed.courseQualityMean}`,
        parsed.teachingEffectivenessMean && `teaching effectiveness: ${parsed.teachingEffectivenessMean}`,
        parsed.positiveComments?.length && `${parsed.positiveComments.length} comments`,
      ].filter(Boolean);
      const action = editingTeachingIndex !== null ? 'updated' : 'uploaded';
      showSuccess(`Evaluation ${action}${teachingFile && extractedParts.length ? ` (extracted ${extractedParts.join(', ')})` : ''}`);
    } catch (error) {
      showError('Failed to upload evaluation', error);
    } finally {
      setUploadingTeaching(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-48 rounded mb-4" style={{ background: 'var(--bg-secondary)' }} />
        <div className="h-64 rounded" style={{ background: 'var(--bg-secondary)' }} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Profile & Publications
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage Sean Westwood's profile and publications
            {isDirty && <span style={{ color: '#f59e0b' }}> (unsaved changes)</span>}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {isDirty && (
            <button
              onClick={handleResetToSource}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              Reset
            </button>
          )}
          <button
            onClick={handleExport}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            <i className="bi bi-download mr-2"></i>Export
          </button>
          {isDirty && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: '#10b981', color: '#fff', opacity: publishing ? 0.7 : 1 }}
            >
              <i className={`bi ${publishing ? 'bi-arrow-repeat animate-spin' : 'bi-cloud-upload'} mr-2`}></i>
              {publishing ? 'Publishing...' : 'Publish to Site'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
        {(['profile', 'publications', 'awards', 'teaching', 'import'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize"
            style={{
              background: activeTab === tab ? 'var(--accent)' : 'transparent',
              color: activeTab === tab ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {tab === 'import' ? 'Import CV' : tab}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Basic Info */}
          <div
            className="p-4 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h3 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
              Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Name</label>
                <input
                  type="text"
                  value={data.profile.name}
                  onChange={(e) => updateProfile({ name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Title</label>
                <input
                  type="text"
                  value={data.profile.title}
                  onChange={(e) => updateProfile({ title: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Institution</label>
                <input
                  type="text"
                  value={data.profile.institution}
                  onChange={(e) => updateProfile({ institution: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Role</label>
                <input
                  type="text"
                  value={data.profile.role}
                  onChange={(e) => updateProfile({ role: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Photo URL</label>
                <input
                  type="text"
                  value={data.profile.photo}
                  onChange={(e) => updateProfile({ photo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
                <input
                  type="email"
                  value={data.profile.email}
                  onChange={(e) => updateProfile({ email: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Google Scholar URL</label>
                <input
                  type="url"
                  value={data.profile.googleScholar}
                  onChange={(e) => updateProfile({ googleScholar: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
          </div>

          {/* Google Scholar Stats */}
          <div
            className="p-4 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                <i className="bi bi-mortarboard mr-2"></i>
                Google Scholar Metrics
              </h3>
              <button
                onClick={handleRefreshScholar}
                disabled={refreshingScholar}
                className="px-3 py-1 rounded text-sm font-medium flex items-center gap-2"
                style={{ background: 'var(--accent)', color: '#fff', opacity: refreshingScholar ? 0.7 : 1 }}
              >
                <i className={`bi ${refreshingScholar ? 'bi-arrow-repeat animate-spin' : 'bi-arrow-clockwise'}`}></i>
                {refreshingScholar ? 'Fetching...' : 'Refresh from Scholar'}
              </button>
            </div>

            {scholarError && (
              <div
                className="p-3 rounded-lg mb-4 flex items-start gap-2"
                style={{ background: '#ef444420', border: '1px solid #ef444440' }}
              >
                <i className="bi bi-exclamation-triangle mt-0.5" style={{ color: '#ef4444' }}></i>
                <div>
                  <div className="text-sm" style={{ color: '#ef4444' }}>{scholarError}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    You can manually enter values below if automatic fetch fails.
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div
                className="p-4 rounded-lg text-center"
                style={{ background: 'var(--bg-tertiary)' }}
              >
                <div className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>
                  {data.profile.googleCitations?.toLocaleString() || '—'}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Total Citations</div>
              </div>
              <div
                className="p-4 rounded-lg text-center"
                style={{ background: 'var(--bg-tertiary)' }}
              >
                <div className="text-3xl font-bold" style={{ color: 'var(--accent)' }}>
                  {data.profile.hIndex || '—'}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>H-Index</div>
              </div>
              <div
                className="p-4 rounded-lg text-center"
                style={{ background: 'var(--bg-tertiary)' }}
              >
                <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {data.profile.citationsLastUpdated || 'Never'}
                </div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Last Updated</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Citations (manual override)
                </label>
                <input
                  type="number"
                  value={data.profile.googleCitations || ''}
                  onChange={(e) => updateProfile({ googleCitations: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="e.g., 12321"
                />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  H-Index (manual override)
                </label>
                <input
                  type="number"
                  value={data.profile.hIndex || ''}
                  onChange={(e) => updateProfile({ hIndex: e.target.value ? Number(e.target.value) : undefined })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="e.g., 24"
                />
              </div>
            </div>
          </div>

          {/* Bio */}
          <div
            className="p-4 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Biography</h3>
              <button
                onClick={addBioParagraph}
                className="px-3 py-1 rounded text-sm font-medium"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <i className="bi bi-plus-lg mr-1"></i>Add Paragraph
              </button>
            </div>
            <div className="space-y-3">
              {data.profile.bio.map((paragraph, index) => (
                <div key={index} className="flex gap-2">
                  <textarea
                    value={paragraph}
                    onChange={(e) => updateBio(index, e.target.value)}
                    rows={4}
                    className="flex-1 px-3 py-2 rounded-lg resize-none"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                  <button
                    onClick={() => removeBioParagraph(index)}
                    className="p-2 hover:opacity-70 self-start"
                    style={{ color: '#ef4444' }}
                    title="Remove paragraph"
                  >
                    <i className="bi bi-trash"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Research Interests */}
          <div
            className="p-4 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h3 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Research Interests</h3>
            <div className="flex flex-wrap gap-2 mb-3">
              {data.profile.researchInterests.map((interest, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  {interest}
                  <button onClick={() => removeInterest(index)} className="hover:opacity-70" style={{ color: '#ef4444' }}>
                    <i className="bi bi-x"></i>
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addInterest())}
                placeholder="Add new interest..."
                className="flex-1 px-3 py-2 rounded-lg"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
              <button
                onClick={addInterest}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                Add
              </button>
            </div>
          </div>

          {/* Books */}
          <div
            className="p-4 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Books ({data.books?.length || 0})
              </h3>
              <button
                onClick={handleAddBook}
                className="px-3 py-1 rounded text-sm font-medium"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <i className="bi bi-plus-lg mr-1"></i>Add Book
              </button>
            </div>
            <div className="space-y-2">
              {(!data.books || data.books.length === 0) ? (
                <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  No books added yet
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndBooks}>
                  <SortableContext items={data.books.map((_, i) => `book-${i}`)} strategy={verticalListSortingStrategy}>
                    {data.books.map((book, index) => (
                      <SortableBookCard
                        key={`book-${index}`}
                        id={`book-${index}`}
                        book={book}
                        onEdit={() => handleEditBook(index)}
                        onDelete={() => handleDeleteBook(index)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

          {/* Chapters */}
          <div
            className="p-4 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Book Chapters ({data.chapters?.length || 0})
              </h3>
              <button
                onClick={handleAddChapter}
                className="px-3 py-1 rounded text-sm font-medium"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <i className="bi bi-plus-lg mr-1"></i>Add Chapter
              </button>
            </div>
            <div className="space-y-2">
              {(!data.chapters || data.chapters.length === 0) ? (
                <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  No chapters added yet
                </div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndChapters}>
                  <SortableContext items={data.chapters.map((_, i) => `chapter-${i}`)} strategy={verticalListSortingStrategy}>
                    {data.chapters.map((chapter, index) => (
                      <SortableChapterCard
                        key={`chapter-${index}`}
                        id={`chapter-${index}`}
                        chapter={chapter}
                        onEdit={() => handleEditChapter(index)}
                        onDelete={() => handleDeleteChapter(index)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Publications Tab */}
      {activeTab === 'publications' && (
        <div className="space-y-4">
          {(Object.keys(CATEGORY_LABELS) as PublicationCategory[]).map((category) => (
            <div
              key={category}
              className="rounded-xl overflow-hidden"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                style={{ borderBottom: expandedCategories.has(category) ? '1px solid var(--border)' : 'none' }}
              >
                <div className="flex items-center gap-2">
                  <i className={`bi bi-chevron-${expandedCategories.has(category) ? 'down' : 'right'}`} style={{ color: 'var(--text-muted)' }}></i>
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {CATEGORY_LABELS[category]}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    ({data[category].length})
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddPublication(category);
                  }}
                  className="px-3 py-1 rounded text-sm font-medium"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  <i className="bi bi-plus-lg mr-1"></i>Add
                </button>
              </button>
              {expandedCategories.has(category) && (
                <div className="p-4 space-y-2">
                  {data[category].length === 0 ? (
                    <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>
                      No publications in this category
                    </div>
                  ) : (
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleDragEndPub(e, category)}>
                      <SortableContext items={data[category].map((_, i) => `${category}-${i}`)} strategy={verticalListSortingStrategy}>
                        {data[category].map((pub, index) => (
                          <SortablePublicationCard
                            key={`${category}-${index}`}
                            id={`${category}-${index}`}
                            pub={pub}
                            onEdit={() => handleEditPublication(category, index)}
                            onDelete={() => handleDeletePublication(category, index)}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Awards Tab */}
      {activeTab === 'awards' && (
        <div
          className="rounded-xl p-4"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
              Awards & Honors ({data.awards.length})
            </h3>
            <button
              onClick={handleAddAward}
              className="px-3 py-1 rounded text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <i className="bi bi-plus-lg mr-1"></i>Add Award
            </button>
          </div>
          <div className="space-y-2">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndAwards}>
              <SortableContext items={data.awards.map((_, i) => `award-${i}`)} strategy={verticalListSortingStrategy}>
                {data.awards.map((award, index) => (
                  <SortableAwardCard
                    key={`award-${index}`}
                    id={`award-${index}`}
                    award={award}
                    onEdit={() => handleEditAward(index)}
                    onDelete={() => handleDeleteAward(index)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>
      )}

      {/* Teaching Tab */}
      {activeTab === 'teaching' && (
        <div className="space-y-6">
          <div
            className="p-4 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Teaching Evaluations
              </h3>
              <button
                onClick={() => setShowTeachingForm(true)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <i className="bi bi-plus-lg mr-1"></i>
                Add Evaluation
              </button>
            </div>

            {showTeachingForm && (
              <div
                className="p-4 rounded-lg mb-4 space-y-3"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
              >
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Course Name</label>
                    <input
                      type="text"
                      value={teachingCourse}
                      onChange={(e) => setTeachingCourse(e.target.value)}
                      placeholder="e.g. Gov 10"
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Term</label>
                    <input
                      type="text"
                      value={teachingTerm}
                      onChange={(e) => setTeachingTerm(e.target.value)}
                      placeholder="e.g. Fall, Winter, Spring"
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Year</label>
                    <input
                      type="number"
                      value={teachingYear}
                      onChange={(e) => setTeachingYear(parseInt(e.target.value) || new Date().getFullYear())}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Evaluation PDF</label>
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setTeachingFile(e.target.files?.[0] || null)}
                    className="w-full text-sm"
                    style={{ color: 'var(--text-secondary)' }}
                  />
                </div>
                {editingTeachingIndex !== null && !teachingFile && (
                  <p className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                    Select a new PDF to re-extract scores and comments, or save to update course/term/year only.
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={resetTeachingForm}
                    className="px-3 py-1.5 rounded-lg text-sm"
                    style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTeachingUpload}
                    disabled={uploadingTeaching || (editingTeachingIndex === null && !teachingFile) || !teachingCourse.trim() || !teachingTerm.trim()}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {uploadingTeaching ? 'Uploading...' : editingTeachingIndex !== null ? 'Save' : 'Upload'}
                  </button>
                </div>
              </div>
            )}

            {(data.teachingEvaluations || []).length === 0 ? (
              <p className="text-sm italic py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                No teaching evaluations yet. Click "Add Evaluation" to upload one.
              </p>
            ) : (
              <div className="space-y-2">
                {(data.teachingEvaluations || []).map((ev, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-3">
                      <i className="bi bi-file-earmark-pdf text-lg" style={{ color: 'var(--accent)' }}></i>
                      <div>
                        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{ev.course}</div>
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {ev.term} {ev.year}
                          {ev.courseQualityMean != null && <span className="ml-2">Course: {ev.courseQualityMean}/5</span>}
                          {ev.teachingEffectivenessMean != null && <span className="ml-2">Teaching: {ev.teachingEffectivenessMean}/5</span>}
                          {ev.positiveComments && <span className="ml-2">{ev.positiveComments.length} comments</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={ev.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 hover:opacity-70"
                        style={{ color: 'var(--text-secondary)' }}
                        title="View PDF"
                      >
                        <i className="bi bi-box-arrow-up-right"></i>
                      </a>
                      <button
                        onClick={() => startEditTeaching(index)}
                        className="p-1 hover:opacity-70"
                        style={{ color: 'var(--text-secondary)' }}
                        title="Edit / Re-extract"
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button
                        onClick={() => {
                          const evals = (data.teachingEvaluations || []).filter((_, i) => i !== index);
                          const updated = { ...data, teachingEvaluations: evals };
                          setData(updated);
                          saveToStorage(updated);
                        }}
                        className="p-1 hover:opacity-70"
                        style={{ color: '#ef4444' }}
                        title="Remove"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* CV PDF Upload Section */}
          <div
            className="p-4 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>
                <i className="bi bi-file-earmark-pdf mr-2"></i>
                Upload CV PDF
              </h3>
              {data.profile.cvUrl && (
                <a
                  href={data.profile.cvUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm flex items-center gap-1"
                  style={{ color: 'var(--accent)' }}
                >
                  <i className="bi bi-box-arrow-up-right"></i>
                  View Current CV
                </a>
              )}
            </div>

            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Upload a PDF version of your CV to be hosted on the site and linked from your profile page.
            </p>

            {cvUploadError && (
              <div
                className="p-3 rounded-lg mb-4 flex items-start gap-2"
                style={{ background: '#ef444420', border: '1px solid #ef444440' }}
              >
                <i className="bi bi-exclamation-triangle mt-0.5" style={{ color: '#ef4444' }}></i>
                <div className="text-sm" style={{ color: '#ef4444' }}>{cvUploadError}</div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Upload CV (PDF)
                </label>
                <div
                  className="relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-tertiary)' }}
                >
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleCVUpload(file);
                    }}
                    disabled={uploadingCV}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {uploadingCV ? (
                    <div className="flex items-center justify-center gap-2" style={{ color: 'var(--accent)' }}>
                      <i className="bi bi-arrow-repeat animate-spin"></i>
                      <span className="text-sm">Uploading...</span>
                    </div>
                  ) : (
                    <div>
                      <i className="bi bi-cloud-arrow-up text-2xl mb-2 block" style={{ color: 'var(--text-muted)' }}></i>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Click to upload PDF</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Or enter CV URL manually
                </label>
                <input
                  type="url"
                  value={data.profile.cvUrl}
                  onChange={(e) => updateProfile({ cvUrl: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  placeholder="https://..."
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Current: {data.profile.cvUrl || 'Not set'}
                </p>
              </div>
            </div>
          </div>

          {/* LaTeX Import Section */}
          <div
            className="p-4 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h3 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
              <i className="bi bi-file-earmark-code mr-2"></i>
              Import from LaTeX CV
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Upload your LaTeX CV (.tex) and BibTeX (.bib) files to automatically import publications, awards, grants, and more.
            </p>
            <div
              className="p-3 rounded-lg mb-4 flex items-start gap-2"
              style={{ background: '#10b98115', border: '1px solid #10b98130' }}
            >
              <i className="bi bi-shield-check mt-0.5" style={{ color: '#10b981' }}></i>
              <div>
                <div className="text-sm font-medium" style={{ color: '#10b981' }}>Paper URLs are preserved</div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Any paper links you've added manually will be preserved when importing a new CV.
                  The import matches papers by title and keeps existing URLs.
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                  CV File (.tex) *
                </label>
                <div
                  className="relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ borderColor: cvFile ? '#10b981' : 'var(--border)', background: 'var(--bg-tertiary)' }}
                >
                  <input
                    type="file"
                    accept=".tex"
                    onChange={(e) => {
                      setCvFile(e.target.files?.[0] || null);
                      setParseResult(null);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {cvFile ? (
                    <div className="flex items-center justify-center gap-2" style={{ color: '#10b981' }}>
                      <i className="bi bi-check-circle"></i>
                      <span className="text-sm">{cvFile.name}</span>
                    </div>
                  ) : (
                    <div>
                      <i className="bi bi-file-earmark-text text-2xl mb-2 block" style={{ color: 'var(--text-muted)' }}></i>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Click to select .tex file</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                  BibTeX File (.bib) *
                </label>
                <div
                  className="relative border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ borderColor: bibFile ? '#10b981' : 'var(--border)', background: 'var(--bg-tertiary)' }}
                >
                  <input
                    type="file"
                    accept=".bib"
                    onChange={(e) => {
                      setBibFile(e.target.files?.[0] || null);
                      setParseResult(null);
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {bibFile ? (
                    <div className="flex items-center justify-center gap-2" style={{ color: '#10b981' }}>
                      <i className="bi bi-check-circle"></i>
                      <span className="text-sm">{bibFile.name}</span>
                    </div>
                  ) : (
                    <div>
                      <i className="bi bi-file-earmark-code text-2xl mb-2 block" style={{ color: 'var(--text-muted)' }}></i>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Click to select .bib file</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={async () => {
                if (!cvFile || !bibFile) return;
                setParsing(true);
                try {
                  const cvContent = await cvFile.text();
                  const bibContent = await bibFile.text();
                  const result = parseCV(cvContent, bibContent, data || undefined);
                  setParseResult(result);
                } catch (error) {
                  console.error('Parse error:', error);
                  setParseResult({
                    data: {},
                    summary: { books: 0, publications: 0, otherFieldPublications: 0, underReview: 0, worksInProgress: 0, datasets: 0, technicalReports: 0, chapters: 0, awards: 0, grants: 0, invitedTalks: 0, conferencePresentations: 0, service: 0 },
                    warnings: [`Error parsing files: ${error}`],
                  });
                }
                setParsing(false);
              }}
              disabled={!cvFile || !bibFile || parsing}
              className="w-full py-2 rounded-lg font-medium transition-opacity"
              style={{
                background: cvFile && bibFile ? 'var(--accent)' : 'var(--bg-tertiary)',
                color: cvFile && bibFile ? '#fff' : 'var(--text-muted)',
                opacity: parsing ? 0.7 : 1,
              }}
            >
              {parsing ? (
                <>
                  <i className="bi bi-arrow-repeat animate-spin mr-2"></i>
                  Parsing...
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-arrow-up mr-2"></i>
                  Parse Files
                </>
              )}
            </button>
          </div>

          {/* Parse Results */}
          {parseResult && (
            <div
              className="p-4 rounded-xl"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
            >
              <h3 className="font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
                Parse Results
              </h3>

              {parseResult.warnings.length > 0 && (
                <div
                  className="p-3 rounded-lg mb-4"
                  style={{ background: '#f59e0b20', border: '1px solid #f59e0b40' }}
                >
                  <div className="flex items-start gap-2">
                    <i className="bi bi-exclamation-triangle" style={{ color: '#f59e0b' }}></i>
                    <div>
                      <div className="font-medium text-sm" style={{ color: '#f59e0b' }}>Warnings</div>
                      {parseResult.warnings.map((warning, i) => (
                        <div key={i} className="text-sm" style={{ color: 'var(--text-secondary)' }}>{warning}</div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3 mb-4">
                {Object.entries(parseResult.summary).map(([key, value]) => (
                  <div
                    key={key}
                    className="p-3 rounded-lg text-center"
                    style={{ background: 'var(--bg-tertiary)' }}
                  >
                    <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{value}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!parseResult.data || !data) return;
                    const merged: ProfileData = {
                      ...data,
                      ...parseResult.data,
                      profile: data.profile, // Keep existing profile
                    } as ProfileData;
                    setData(merged);
                    saveToStorage(merged);
                    setParseResult(null);
                    setCvFile(null);
                    setBibFile(null);
                    setActiveTab('publications');
                  }}
                  className="flex-1 py-2 rounded-lg font-medium"
                  style={{ background: '#10b981', color: '#fff' }}
                >
                  <i className="bi bi-check-lg mr-2"></i>
                  Apply Import
                </button>
                <button
                  onClick={() => {
                    setParseResult(null);
                    setCvFile(null);
                    setBibFile(null);
                  }}
                  className="px-4 py-2 rounded-lg font-medium"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Publication Form Modal */}
      {showPubForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-lg p-6 rounded-xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {editingIndex !== null ? 'Edit' : 'Add'} Publication
            </h2>
            <form onSubmit={handleSubmitPublication}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Title *</label>
                  <input
                    type="text"
                    value={pubFormData.title}
                    onChange={(e) => setPubFormData({ ...pubFormData, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Authors *</label>
                  <input
                    type="text"
                    value={pubFormData.authors}
                    onChange={(e) => setPubFormData({ ...pubFormData, authors: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                    placeholder="e.g., Westwood, S.J., & Smith, J."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Year</label>
                    <input
                      type="text"
                      value={pubFormData.year || ''}
                      onChange={(e) => setPubFormData({ ...pubFormData, year: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      placeholder="e.g., 2024 or in press"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Journal</label>
                    <input
                      type="text"
                      value={pubFormData.journal || ''}
                      onChange={(e) => setPubFormData({ ...pubFormData, journal: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Volume</label>
                    <input
                      type="text"
                      value={pubFormData.volume || ''}
                      onChange={(e) => setPubFormData({ ...pubFormData, volume: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Pages</label>
                    <input
                      type="text"
                      value={pubFormData.pages || ''}
                      onChange={(e) => setPubFormData({ ...pubFormData, pages: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Paper URL / Pre-print
                    <span className="ml-2 text-xs" style={{ color: '#10b981' }}>
                      <i className="bi bi-shield-check mr-1"></i>
                      Preserved on CV import
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={pubFormData.url || ''}
                      onChange={(e) => setPubFormData({ ...pubFormData, url: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      placeholder="https://doi.org/... or direct link"
                    />
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file && pubFormData.title) {
                            const url = await handlePreprintUpload(file, pubFormData.title);
                            if (url) {
                              setPubFormData({ ...pubFormData, url });
                            }
                          } else if (file && !pubFormData.title) {
                            showToast('warning', 'Please enter a title first before uploading a pre-print');
                          }
                        }}
                        disabled={uploadingPreprint}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <button
                        type="button"
                        disabled={uploadingPreprint}
                        className="px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-secondary)',
                          opacity: uploadingPreprint ? 0.7 : 1
                        }}
                      >
                        {uploadingPreprint ? (
                          <><i className="bi bi-arrow-repeat animate-spin mr-1"></i>Uploading...</>
                        ) : (
                          <><i className="bi bi-cloud-arrow-up mr-1"></i>Upload PDF</>
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Enter a URL or upload a pre-print PDF (will be hosted on the site)
                  </p>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Note</label>
                  <input
                    type="text"
                    value={pubFormData.note || ''}
                    onChange={(e) => setPubFormData({ ...pubFormData, note: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    placeholder="e.g., Revise and Resubmit at..."
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={resetPubForm}
                  className="flex-1 py-2 rounded-lg font-medium"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg font-medium"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {editingIndex !== null ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Award Form Modal */}
      {showAwardForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-md p-6 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {editingAwardIndex !== null ? 'Edit' : 'Add'} Award
            </h2>
            <form onSubmit={handleSubmitAward}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Name *</label>
                  <input
                    type="text"
                    value={awardFormData.name}
                    onChange={(e) => setAwardFormData({ ...awardFormData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Year *</label>
                  <input
                    type="number"
                    value={awardFormData.year}
                    onChange={(e) => setAwardFormData({ ...awardFormData, year: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Institution *</label>
                  <input
                    type="text"
                    value={awardFormData.institution}
                    onChange={(e) => setAwardFormData({ ...awardFormData, institution: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={resetAwardForm}
                  className="flex-1 py-2 rounded-lg font-medium"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg font-medium"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {editingAwardIndex !== null ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Book Form Modal */}
      {showBookForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-lg p-6 rounded-xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {editingBookIndex !== null ? 'Edit' : 'Add'} Book
            </h2>
            <form onSubmit={handleSubmitBook}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Title *</label>
                  <input
                    type="text"
                    value={bookFormData.title}
                    onChange={(e) => setBookFormData({ ...bookFormData, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Authors *</label>
                  <input
                    type="text"
                    value={bookFormData.authors}
                    onChange={(e) => setBookFormData({ ...bookFormData, authors: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                    placeholder="e.g., Westwood, S.J., & Smith, J."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Year *</label>
                    <input
                      type="number"
                      value={bookFormData.year}
                      onChange={(e) => setBookFormData({ ...bookFormData, year: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Publisher *</label>
                    <input
                      type="text"
                      value={bookFormData.publisher}
                      onChange={(e) => setBookFormData({ ...bookFormData, publisher: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>URL</label>
                  <input
                    type="url"
                    value={bookFormData.url || ''}
                    onChange={(e) => setBookFormData({ ...bookFormData, url: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={resetBookForm}
                  className="flex-1 py-2 rounded-lg font-medium"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg font-medium"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {editingBookIndex !== null ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Chapter Form Modal */}
      {showChapterForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-lg p-6 rounded-xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {editingChapterIndex !== null ? 'Edit' : 'Add'} Book Chapter
            </h2>
            <form onSubmit={handleSubmitChapter}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Chapter Title *</label>
                  <input
                    type="text"
                    value={chapterFormData.title}
                    onChange={(e) => setChapterFormData({ ...chapterFormData, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Authors *</label>
                  <input
                    type="text"
                    value={chapterFormData.authors}
                    onChange={(e) => setChapterFormData({ ...chapterFormData, authors: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                    placeholder="e.g., Westwood, S.J., & Smith, J."
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Book Title *</label>
                  <input
                    type="text"
                    value={chapterFormData.book}
                    onChange={(e) => setChapterFormData({ ...chapterFormData, book: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                    placeholder="Title of the book containing this chapter"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Editors</label>
                  <input
                    type="text"
                    value={chapterFormData.editors || ''}
                    onChange={(e) => setChapterFormData({ ...chapterFormData, editors: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    placeholder="e.g., J. N. Druckman & D. P. Green"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Year *</label>
                    <input
                      type="number"
                      value={chapterFormData.year}
                      onChange={(e) => setChapterFormData({ ...chapterFormData, year: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Publisher *</label>
                    <input
                      type="text"
                      value={chapterFormData.publisher}
                      onChange={(e) => setChapterFormData({ ...chapterFormData, publisher: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>URL</label>
                  <input
                    type="url"
                    value={chapterFormData.url || ''}
                    onChange={(e) => setChapterFormData({ ...chapterFormData, url: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button
                  type="button"
                  onClick={resetChapterForm}
                  className="flex-1 py-2 rounded-lg font-medium"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-lg font-medium"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {editingChapterIndex !== null ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
