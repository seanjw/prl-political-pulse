import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
import type { Report, ReportsData } from '../../types/admin';
import { publishToS3, uploadFileToS3, FILE_PATHS } from './utils/publishToS3';
import { uploadHtmlReport, type HtmlUploadProgress } from './utils/htmlReportUpload';
import { useAdminToast } from './context/AdminToastContext';
import { HtmlReportRenderer } from '../../components/HtmlReportRenderer';

// Sortable Report Card Component
function SortableReportCard({
  report,
  getThumbnailPreview,
  onPreview,
  onEdit,
  onDelete,
}: {
  report: Report;
  getThumbnailPreview: (path: string | null) => string | null;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: report.slug });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      className="flex items-center gap-3 p-3 rounded-lg"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 flex-shrink-0"
        style={{ color: 'var(--text-muted)' }}
      >
        <i className="bi bi-grip-vertical text-lg"></i>
      </div>
      {report.thumbnail && (
        <img
          src={getThumbnailPreview(report.thumbnail) || report.thumbnail}
          alt=""
          className="w-16 h-12 object-cover rounded flex-shrink-0"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-medium px-2 py-0.5 rounded flex-shrink-0"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {report.category}
          </span>
          {report.contentType === 'html' && (
            <span
              className="text-xs font-medium px-2 py-0.5 rounded flex-shrink-0"
              style={{ background: '#8b5cf6', color: '#fff' }}
            >
              HTML
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{report.date}</span>
        </div>
        <div className="font-medium text-sm mt-1 truncate" style={{ color: 'var(--text-primary)' }}>
          {report.title}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onPreview}
          className="p-2 rounded hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
          title="Preview"
        >
          <i className="bi bi-eye"></i>
        </button>
        <button
          onClick={onEdit}
          className="p-2 rounded hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
          title="Edit"
        >
          <i className="bi bi-pencil"></i>
        </button>
        <button
          onClick={onDelete}
          className="p-2 rounded hover:opacity-70"
          style={{ color: '#ef4444' }}
          title="Delete"
        >
          <i className="bi bi-trash"></i>
        </button>
      </div>
    </div>
  );
}

const STORAGE_KEY = 'admin-reports';
const STORAGE_KEY_CONTENT = 'admin-reports-content';
const STORAGE_KEY_IMAGES = 'admin-reports-images';

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

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

function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

const CATEGORIES = ['Report', 'Blog', 'News', 'Commentary', 'Research-article', 'Article'];

export function ReportsAdmin() {
  const [reports, setReports] = useState<Report[]>([]);
  const [markdownContents, setMarkdownContents] = useState<Record<string, string>>({});
  const [uploadedImages, setUploadedImages] = useState<Record<string, string>>({}); // path -> dataUrl
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    url: '',
    date: '',
    category: 'Report',
    thumbnail: '',
    markdownContent: '',
    contentType: 'markdown' as 'markdown' | 'html',
  });
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [, setHtmlUploadProgress] = useState<HtmlUploadProgress | null>(null);
  // Track pending HTML files per slug for publish flow
  const [pendingHtmlFiles, setPendingHtmlFiles] = useState<Record<string, File>>({});

  // Publishing state
  const [publishing, setPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState('');
  const { showError, showSuccess, showToast } = useAdminToast();

  // Publish preview state
  const [showPublishPreview, setShowPublishPreview] = useState(false);
  const [previewingSlug, setPreviewingSlug] = useState<string | null>(null);
  const [previewHtmlContent, setPreviewHtmlContent] = useState<string | null>(null);
  const [previewMdContent, setPreviewMdContent] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = reports.findIndex((r) => r.slug === active.id);
    const newIndex = reports.findIndex((r) => r.slug === over.id);
    const reordered = arrayMove(reports, oldIndex, newIndex);
    setReports(reordered);
    saveToStorage(reordered, markdownContents, uploadedImages);
  };

  useEffect(() => {
    async function loadData() {
      // Try localStorage first
      const storedReports = localStorage.getItem(STORAGE_KEY);
      const storedContent = localStorage.getItem(STORAGE_KEY_CONTENT);
      const storedImages = localStorage.getItem(STORAGE_KEY_IMAGES);

      if (storedReports) {
        setReports(JSON.parse(storedReports));
        setMarkdownContents(storedContent ? JSON.parse(storedContent) : {});
        setUploadedImages(storedImages ? JSON.parse(storedImages) : {});
        setIsDirty(true);
      } else {
        try {
          const res = await fetch('/news/index.json');
          const data: ReportsData = await res.json();
          setReports(data.articles);
        } catch (error) {
          showError('Failed to load reports', error);
        }
      }
      setLoading(false);
    }
    loadData();
  }, [showError]);

  const saveToStorage = (reportsData: Report[], contents: Record<string, string>, images?: Record<string, string>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reportsData));
    localStorage.setItem(STORAGE_KEY_CONTENT, JSON.stringify(contents));
    if (images) {
      localStorage.setItem(STORAGE_KEY_IMAGES, JSON.stringify(images));
    }
    setIsDirty(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast('warning', 'Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast('warning', 'Image must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const ext = file.name.split('.').pop() || 'png';
      const slug = editingSlug || generateSlug(formData.title) || `image-${Date.now()}`;
      const imagePath = `/news/images/${slug}-thumb.${ext}`;

      setFormData({ ...formData, thumbnail: imagePath });
      const newImages = { ...uploadedImages, [imagePath]: dataUrl };
      setUploadedImages(newImages);
      localStorage.setItem(STORAGE_KEY_IMAGES, JSON.stringify(newImages));
    };
    reader.readAsDataURL(file);
  };

  const handleHtmlFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      showToast('warning', 'Please select an HTML file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('warning', 'HTML file must be less than 10MB');
      return;
    }

    setHtmlFile(file);
  };

  const handleHtmlDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.html') || file.name.endsWith('.htm'))) {
      if (file.size > 10 * 1024 * 1024) {
        showToast('warning', 'HTML file must be less than 10MB');
        return;
      }
      setHtmlFile(file);
    } else {
      showToast('warning', 'Please drop an HTML file');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = editingSlug || generateSlug(formData.title);
    const isHtml = formData.contentType === 'html';

    // Upload HTML file to S3 immediately so preview works
    if (isHtml && htmlFile) {
      setPublishing(true);
      setPublishStatus('Uploading HTML report...');
      const result = await uploadHtmlReport(
        htmlFile,
        slug,
        setHtmlUploadProgress,
        setPublishStatus
      );
      setPublishing(false);
      setPublishStatus('');
      setHtmlUploadProgress(null);
      if (!result.success) {
        showError('Failed to upload HTML report', result.error);
        return;
      }
      showSuccess('HTML report uploaded to staging');
    }

    const report: Report = {
      slug,
      title: formData.title,
      description: formData.description,
      url: formData.url,
      date: formData.date,
      thumbnail: formData.thumbnail || null,
      category: formData.category,
      markdownFile: isHtml ? '' : `/news/articles/${slug}.md`,
      contentType: isHtml ? 'html' : undefined,
      htmlFile: isHtml ? `/news/html/${slug}.html` : undefined,
    };

    let updatedReports: Report[];
    if (editingSlug) {
      updatedReports = reports.map((r) => (r.slug === editingSlug ? report : r));
    } else {
      updatedReports = [report, ...reports];
    }

    const updatedContents = { ...markdownContents };
    if (!isHtml) {
      updatedContents[slug] = formData.markdownContent;
    }

    setReports(updatedReports);
    setMarkdownContents(updatedContents);
    saveToStorage(updatedReports, updatedContents);
    resetForm();
  };

  const handleEdit = async (report: Report) => {
    let content = markdownContents[report.slug] || '';
    const isHtml = report.contentType === 'html';

    // Try to fetch existing content if not in localStorage
    if (!isHtml && !content && report.markdownFile) {
      try {
        const res = await fetch(report.markdownFile);
        if (res.ok) {
          content = await res.text();
          // Strip frontmatter
          content = content.replace(/^---[\s\S]*?---\n*/, '');
        }
      } catch {
        console.log('Could not load existing markdown');
      }
    }

    setFormData({
      title: report.title,
      description: report.description,
      url: report.url,
      date: report.date,
      category: report.category,
      thumbnail: report.thumbnail || '',
      markdownContent: content,
      contentType: isHtml ? 'html' : 'markdown',
    });
    setHtmlFile(pendingHtmlFiles[report.slug] || null);
    setEditingSlug(report.slug);
    setShowForm(true);
  };

  const handleDelete = (slug: string) => {
    if (confirm('Are you sure you want to delete this report?')) {
      const updatedReports = reports.filter((r) => r.slug !== slug);
      const updatedContents = { ...markdownContents };
      delete updatedContents[slug];

      setReports(updatedReports);
      setMarkdownContents(updatedContents);
      saveToStorage(updatedReports, updatedContents);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      url: '',
      date: '',
      category: 'Report',
      thumbnail: '',
      markdownContent: '',
      contentType: 'markdown',
    });
    setHtmlFile(null);
    setHtmlUploadProgress(null);
    setEditingSlug(null);
    setShowForm(false);
    setPreviewMode(false);
  };

  const handleExport = () => {
    // Export index.json
    const indexData: ReportsData = {
      lastUpdated: new Date().toISOString(),
      articles: reports,
    };
    downloadJSON(indexData, 'index.json');

    // Export each markdown file that has content
    Object.entries(markdownContents).forEach(([slug, content]) => {
      if (content) {
        const report = reports.find((r) => r.slug === slug);
        if (report) {
          const frontmatter = `---
title: "${report.title}"
date: "${report.date}"
url: "${report.url}"
category: "${report.category}"
thumbnail: "${report.thumbnail || ''}"
description: "${report.description}"
---

`;
          downloadMarkdown(frontmatter + content, `${slug}.md`);
        }
      }
    });

    // Export uploaded images
    Object.entries(uploadedImages).forEach(([path, dataUrl]) => {
      const filename = path.split('/').pop() || 'image.png';
      downloadDataUrl(dataUrl, filename);
    });
  };

  const handlePublish = async () => {
    setPublishing(true);
    setPublishStatus('');

    try {
      // Step 1: Upload pending HTML report files
      const htmlSlugs = Object.keys(pendingHtmlFiles);
      for (let i = 0; i < htmlSlugs.length; i++) {
        const slug = htmlSlugs[i];
        const file = pendingHtmlFiles[slug];
        setPublishStatus(`Uploading HTML report "${slug}" (${i + 1}/${htmlSlugs.length})...`);
        const result = await uploadHtmlReport(
          file,
          slug,
          setHtmlUploadProgress,
          setPublishStatus
        );
        if (!result.success) {
          showError(`Failed to upload HTML report "${slug}"`, result.error);
          setPublishing(false);
          setPublishStatus('');
          return;
        }
      }

      // Step 2: Upload pending markdown content via /upload
      for (const [slug, content] of Object.entries(markdownContents)) {
        if (!content) continue;
        const report = reports.find((r) => r.slug === slug);
        if (!report || report.contentType === 'html') continue;

        setPublishStatus(`Uploading markdown for "${slug}"...`);
        const mdBlob = new Blob([content], { type: 'text/markdown' });
        const mdFile = new File([mdBlob], `${slug}.md`, { type: 'text/markdown' });
        const result = await uploadFileToS3(mdFile, `news/articles/${slug}.md`);
        if (!result.success) {
          showError(`Failed to upload markdown for "${slug}"`, result.error);
          setPublishing(false);
          setPublishStatus('');
          return;
        }
      }

      // Step 3: Upload pending thumbnail images via /upload
      for (const [path, dataUrl] of Object.entries(uploadedImages)) {
        setPublishStatus(`Uploading image "${path}"...`);
        // Convert dataUrl to File
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const filename = path.split('/').pop() || 'image.png';
        const file = new File([blob], filename, { type: blob.type });
        const s3Path = path.startsWith('/') ? path.slice(1) : path;
        const result = await uploadFileToS3(file, s3Path);
        if (!result.success) {
          showError(`Failed to upload image "${path}"`, result.error);
          setPublishing(false);
          setPublishStatus('');
          return;
        }
      }

      // Step 4: Publish index.json
      setPublishStatus('Publishing index...');
      const indexData: ReportsData = {
        lastUpdated: new Date().toISOString(),
        articles: reports,
      };

      const result = await publishToS3(FILE_PATHS.reports, indexData);

      if (result.success) {
        showSuccess('Published to live site!');
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(STORAGE_KEY_CONTENT);
        localStorage.removeItem(STORAGE_KEY_IMAGES);
        setMarkdownContents({});
        setUploadedImages({});
        setPendingHtmlFiles({});
        setIsDirty(false);
      } else {
        showError('Failed to publish reports index', result.error);
      }
    } catch (error) {
      showError('Publish failed', error);
    }

    setPublishing(false);
    setPublishStatus('');
    setHtmlUploadProgress(null);
  };

  const handleResetToSource = async () => {
    if (confirm('This will discard all local changes. Continue?')) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY_CONTENT);
      localStorage.removeItem(STORAGE_KEY_IMAGES);
      try {
        const res = await fetch('/news/index.json');
        const data: ReportsData = await res.json();
        setReports(data.articles);
        setMarkdownContents({});
        setUploadedImages({});
        setIsDirty(false);
        showSuccess('Reset to source data');
      } catch (error) {
        showError('Failed to reload data', error);
      }
    }
  };

  const handlePreviewReport = async (slug: string) => {
    const report = reports.find((r) => r.slug === slug);
    if (!report) return;

    setPreviewingSlug(slug);
    setPreviewHtmlContent(null);
    setPreviewMdContent(null);
    setPreviewLoading(true);

    try {
      if (report.contentType === 'html') {
        // Use pending file if available, otherwise fetch from server
        const pendingFile = pendingHtmlFiles[slug];
        let htmlText: string | null = null;
        if (pendingFile) {
          htmlText = await pendingFile.text();
        } else if (report.htmlFile) {
          const res = await fetch(report.htmlFile);
          if (res.ok) htmlText = await res.text();
        }

        if (htmlText) {
          setPreviewHtmlContent(htmlText);
        }
      } else {
        // Use local content if available, otherwise fetch from server
        const localContent = markdownContents[slug];
        if (localContent) {
          setPreviewMdContent(localContent);
        } else if (report.markdownFile) {
          const res = await fetch(report.markdownFile);
          if (res.ok) {
            let text = await res.text();
            text = text.replace(/^---[\s\S]*?---\n*/, '');
            setPreviewMdContent(text);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load preview:', error);
    }
    setPreviewLoading(false);
  };

  // Get thumbnail preview URL (either uploaded dataUrl or existing path)
  const getThumbnailPreview = (path: string | null): string | null => {
    if (!path) return null;
    if (uploadedImages[path]) return uploadedImages[path];
    return path;
  };

  const filteredReports = reports.filter(
    (r) =>
      r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-48 rounded mb-4" style={{ background: 'var(--bg-secondary)' }} />
        <div className="h-64 rounded" style={{ background: 'var(--bg-secondary)' }} />
      </div>
    );
  }

  return (
    <div>
      {!showPublishPreview && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Reports
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              {reports.length} items {isDirty && <span style={{ color: '#f59e0b' }}>(unsaved changes)</span>}
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
            {(isDirty || Object.keys(pendingHtmlFiles).length > 0) && (
              <button
                onClick={() => setShowPublishPreview(true)}
                disabled={publishing}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: '#10b981', color: '#fff', opacity: publishing ? 0.7 : 1 }}
              >
                <i className={`bi ${publishing ? 'bi-arrow-repeat animate-spin' : 'bi-cloud-upload'} mr-2`}></i>
                {publishing ? (publishStatus || 'Publishing...') : 'Publish to Site'}
              </button>
          )}
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <i className="bi bi-plus-lg mr-2"></i>Add New
            </button>
          </div>
        </div>
      )}

      {/* Publish Preview — inline, replaces main content while sidebar stays */}
      {showPublishPreview && (previewingSlug ? (
        /* Individual report preview */
        (() => {
          const report = reports.find((r) => r.slug === previewingSlug);
          if (!report) return null;
          const isHtml = report.contentType === 'html';

          return (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setPreviewingSlug(null); setPreviewHtmlContent(null); setPreviewMdContent(null); }}
                    className="p-2 rounded hover:opacity-70"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <i className="bi bi-arrow-left text-lg"></i>
                  </button>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                    Preview: {report.title}
                  </h2>
                </div>
                <button
                  onClick={() => { setShowPublishPreview(false); setPreviewingSlug(null); setPreviewHtmlContent(null); setPreviewMdContent(null); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                >
                  <i className="bi bi-x-lg mr-2"></i>Close Preview
                </button>
              </div>

              {/* Report metadata */}
              <div className="flex items-center gap-3 mb-4 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
                {report.thumbnail && (
                  <img
                    src={getThumbnailPreview(report.thumbnail) || ''}
                    alt=""
                    className="w-20 h-14 object-cover rounded"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                )}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ background: 'var(--accent)', color: '#fff' }}>
                      {report.category}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{report.date}</span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{report.description}</p>
                </div>
              </div>

              {/* Rendered content */}
              <div
                className="rounded-lg p-4"
                style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)', minHeight: '300px' }}
              >
                {previewLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <i className="bi bi-arrow-repeat animate-spin text-2xl" style={{ color: 'var(--text-muted)' }}></i>
                  </div>
                ) : isHtml && previewHtmlContent ? (
                  <HtmlReportRenderer html={previewHtmlContent} />
                ) : isHtml && !previewHtmlContent ? (
                  <p className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                    No HTML content available for preview.
                    {!pendingHtmlFiles[previewingSlug] && ' Upload an HTML file first.'}
                  </p>
                ) : previewMdContent ? (
                  <div className="prose prose-lg dark:prose-invert max-w-none" style={{ color: 'var(--text-primary)' }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{previewMdContent}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                    No content available for preview.
                  </p>
                )}
              </div>
            </div>
          );
        })()
      ) : (
        /* Summary view */
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
              <i className="bi bi-eye mr-2"></i>Review Before Publishing
            </h2>
            <button
              onClick={() => setShowPublishPreview(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              <i className="bi bi-x-lg mr-2"></i>Back to Reports
            </button>
          </div>

          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Review the changes below, then confirm to publish to the live site.
          </p>

          {/* Pending changes summary */}
          <div className="space-y-2 mb-6">
            {Object.keys(pendingHtmlFiles).length > 0 && (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <i className="bi bi-filetype-html" style={{ color: '#8b5cf6' }}></i>
                {Object.keys(pendingHtmlFiles).length} HTML report{Object.keys(pendingHtmlFiles).length > 1 ? 's' : ''} to upload
              </div>
            )}
            {Object.keys(markdownContents).filter((slug) => {
              const r = reports.find((rp) => rp.slug === slug);
              return r && r.contentType !== 'html' && markdownContents[slug];
            }).length > 0 && (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <i className="bi bi-markdown" style={{ color: 'var(--accent)' }}></i>
                {Object.keys(markdownContents).filter((slug) => {
                  const r = reports.find((rp) => rp.slug === slug);
                  return r && r.contentType !== 'html' && markdownContents[slug];
                }).length} markdown article{Object.keys(markdownContents).filter((slug) => {
                  const r = reports.find((rp) => rp.slug === slug);
                  return r && r.contentType !== 'html' && markdownContents[slug];
                }).length > 1 ? 's' : ''} to upload
              </div>
            )}
            {Object.keys(uploadedImages).length > 0 && (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                <i className="bi bi-image" style={{ color: '#f59e0b' }}></i>
                {Object.keys(uploadedImages).length} image{Object.keys(uploadedImages).length > 1 ? 's' : ''} to upload
              </div>
            )}
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <i className="bi bi-journal-text" style={{ color: '#10b981' }}></i>
              Reports index ({reports.length} total reports)
            </div>
          </div>

          {/* Reports list with preview buttons */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
              Reports to Publish
            </h3>
            <div className="space-y-2">
              {reports.map((report) => {
                const hasPendingContent = !!(
                  pendingHtmlFiles[report.slug] ||
                  (markdownContents[report.slug] && report.contentType !== 'html')
                );
                return (
                  <div
                    key={report.slug}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                  >
                    {report.thumbnail && (
                      <img
                        src={getThumbnailPreview(report.thumbnail) || report.thumbnail}
                        alt=""
                        className="w-12 h-9 object-cover rounded flex-shrink-0"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-medium px-1.5 py-0.5 rounded"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                          {report.category}
                        </span>
                        {report.contentType === 'html' && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: '#8b5cf6', color: '#fff' }}>
                            HTML
                          </span>
                        )}
                        {hasPendingContent && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded" style={{ background: '#f59e0b', color: '#fff' }}>
                            New content
                          </span>
                        )}
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{report.date}</span>
                      </div>
                      <div className="text-sm mt-1 truncate" style={{ color: 'var(--text-primary)' }}>
                        {report.title}
                      </div>
                    </div>
                    <button
                      onClick={() => handlePreviewReport(report.slug)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0"
                      style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                    >
                      <i className="bi bi-eye mr-1"></i>Preview
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={() => setShowPublishPreview(false)}
              className="flex-1 py-2.5 rounded-lg font-medium"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
            >
              Cancel
            </button>
            <button
              onClick={() => { setShowPublishPreview(false); handlePublish(); }}
              disabled={publishing}
              className="flex-1 py-2.5 rounded-lg font-medium"
              style={{ background: '#10b981', color: '#fff', opacity: publishing ? 0.7 : 1 }}
            >
              <i className="bi bi-cloud-upload mr-2"></i>
              Confirm &amp; Publish
            </button>
          </div>
        </div>
      ))}

      {/* Add/Edit Form Modal */}
      {!showPublishPreview && showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {editingSlug ? 'Edit Report' : 'Add Report'}
              </h2>
              <button onClick={resetForm} style={{ color: 'var(--text-muted)' }}>
                <i className="bi bi-x-lg text-xl"></i>
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Date *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Thumbnail
                  </label>
                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      <div className="flex gap-2 mb-2">
                        <label
                          className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                        >
                          <i className="bi bi-upload mr-2"></i>Upload Image
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                          />
                        </label>
                        {formData.thumbnail && (
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, thumbnail: '' })}
                            className="px-3 py-2 rounded-lg text-sm"
                            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                          >
                            <i className="bi bi-x-lg"></i>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={formData.thumbnail}
                        onChange={(e) => setFormData({ ...formData, thumbnail: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg text-sm"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                        placeholder="Or enter path: /news/images/thumbnail.png"
                      />
                    </div>
                    {formData.thumbnail && (
                      <div
                        className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                      >
                        <img
                          src={getThumbnailPreview(formData.thumbnail) || ''}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Description *
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    rows={2}
                    required
                  />
                </div>
              </div>

              {/* Content Type Toggle */}
              <div className="mb-4">
                <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Content Type
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, contentType: 'markdown' })}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      background: formData.contentType === 'markdown' ? 'var(--accent)' : 'var(--bg-tertiary)',
                      color: formData.contentType === 'markdown' ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <i className="bi bi-markdown mr-2"></i>Markdown
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, contentType: 'html' })}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    style={{
                      background: formData.contentType === 'html' ? '#8b5cf6' : 'var(--bg-tertiary)',
                      color: formData.contentType === 'html' ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <i className="bi bi-filetype-html mr-2"></i>HTML Upload
                  </button>
                </div>
              </div>

              {/* Content Editor */}
              {formData.contentType === 'html' ? (
                <div className="mb-4">
                  <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                    HTML File
                  </label>
                  <div
                    onDrop={handleHtmlDrop}
                    onDragOver={(e) => e.preventDefault()}
                    className="rounded-lg p-8 text-center cursor-pointer transition-colors"
                    style={{
                      background: 'var(--bg-tertiary)',
                      border: `2px dashed ${htmlFile ? '#8b5cf6' : 'var(--border)'}`,
                    }}
                    onClick={() => document.getElementById('html-file-input')?.click()}
                  >
                    <input
                      id="html-file-input"
                      type="file"
                      accept=".html,.htm"
                      onChange={handleHtmlFileSelect}
                      className="hidden"
                    />
                    {htmlFile ? (
                      <div>
                        <i className="bi bi-file-earmark-code text-3xl mb-2" style={{ color: '#8b5cf6' }}></i>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {htmlFile.name}
                        </p>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                          {(htmlFile.size / 1024).toFixed(1)} KB
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHtmlFile(null);
                          }}
                          className="mt-2 text-sm px-3 py-1 rounded"
                          style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : editingSlug && reports.find((r) => r.slug === editingSlug)?.htmlFile ? (
                      <div>
                        <i className="bi bi-check-circle text-3xl mb-2" style={{ color: '#10b981' }}></i>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          HTML already uploaded
                        </p>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                          Drop a new file to replace
                        </p>
                      </div>
                    ) : (
                      <div>
                        <i className="bi bi-cloud-upload text-3xl mb-2" style={{ color: 'var(--text-muted)' }}></i>
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          Drop HTML file here or click to browse
                        </p>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                          Self-contained HTML only (e.g. Quarto output). Max 10MB.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Content (Markdown)
                    </label>
                    <button
                      type="button"
                      onClick={() => setPreviewMode(!previewMode)}
                      className="text-sm px-3 py-1 rounded"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}
                    >
                      {previewMode ? 'Edit' : 'Preview'}
                    </button>
                  </div>
                  {previewMode ? (
                    <div
                      className="prose max-w-none p-4 rounded-lg min-h-[300px]"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {formData.markdownContent || '*No content*'}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <textarea
                      value={formData.markdownContent}
                      onChange={(e) => setFormData({ ...formData, markdownContent: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg font-mono text-sm"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      rows={12}
                      placeholder="# Report Title&#10;&#10;Write your report content here using Markdown..."
                    />
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetForm}
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
                  {editingSlug ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search & Reports List — hidden during publish preview */}
      {!showPublishPreview && (
        <>
          <div className="mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title or category..."
              className="w-full px-4 py-2 rounded-lg"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </div>

          <div className="space-y-2">
            {filteredReports.length === 0 ? (
              <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
                No reports found
              </div>
            ) : searchTerm ? (
              filteredReports.map((report) => (
                <SortableReportCard
                  key={report.slug}
                  report={report}
                  getThumbnailPreview={getThumbnailPreview}
                  onPreview={() => { setShowPublishPreview(true); handlePreviewReport(report.slug); }}
                  onEdit={() => handleEdit(report)}
                  onDelete={() => handleDelete(report.slug)}
                />
              ))
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={reports.map((r) => r.slug)} strategy={verticalListSortingStrategy}>
                  {reports.map((report) => (
                    <SortableReportCard
                      key={report.slug}
                      report={report}
                      getThumbnailPreview={getThumbnailPreview}
                      onPreview={() => { setShowPublishPreview(true); handlePreviewReport(report.slug); }}
                      onEdit={() => handleEdit(report)}
                      onDelete={() => handleDelete(report.slug)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </div>
        </>
      )}
    </div>
  );
}
