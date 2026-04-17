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
import type { MediaMention, ResearcherTag } from '../../types/admin';
import { RESEARCHER_TAGS } from '../../types/admin';
import { publishToS3, FILE_PATHS } from './utils/publishToS3';
import { useAdminToast } from './context/AdminToastContext';

const STORAGE_KEY = 'admin-media-mentions';

function generateId(): string {
  return `mm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

// Sortable Mention Row Component
function SortableMentionRow({
  mention,
  onEdit,
  onDelete,
}: {
  mention: MediaMention;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: mention.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderBottom: '1px solid var(--border)' }}
      className="flex items-center gap-3 px-4 py-3"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1 flex-shrink-0"
        style={{ color: 'var(--text-muted)' }}
      >
        <i className="bi bi-grip-vertical text-lg"></i>
      </div>
      <div className="flex-shrink-0 w-32">
        <span className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
          {mention.publication}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <a
          href={mention.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm hover:underline truncate block"
          style={{ color: 'var(--text-primary)' }}
        >
          {mention.title}
        </a>
        {mention.tags && mention.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {mention.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--accent)', color: '#fff', opacity: 0.85, fontSize: '0.65rem' }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex-shrink-0 w-24 text-sm" style={{ color: 'var(--text-muted)' }}>
        {mention.date}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-1 hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
        >
          <i className="bi bi-pencil"></i>
        </button>
        <button
          onClick={onDelete}
          className="p-1 hover:opacity-70"
          style={{ color: '#ef4444' }}
        >
          <i className="bi bi-trash"></i>
        </button>
      </div>
    </div>
  );
}

export function MediaMentionsAdmin() {
  const [mentions, setMentions] = useState<MediaMention[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [publishing, setPublishing] = useState(false);
  const { showError, showSuccess } = useAdminToast();

  // Form state
  const [formData, setFormData] = useState<Omit<MediaMention, 'id'>>({
    publication: '',
    title: '',
    date: '',
    url: '',
    tags: [],
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    async function loadData() {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setMentions(JSON.parse(stored));
        setIsDirty(true);
      } else {
        try {
          const res = await fetch('/data/mediaMentions.json');
          const data: MediaMention[] = await res.json();
          setMentions(data);
        } catch (error) {
          showError('Failed to load media mentions', error);
        }
      }
      setLoading(false);
    }
    loadData();
  }, [showError]);

  const saveToStorage = (data: MediaMention[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setIsDirty(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = mentions.findIndex((m) => m.id === active.id);
      const newIndex = mentions.findIndex((m) => m.id === over.id);
      const reordered = arrayMove(mentions, oldIndex, newIndex);
      setMentions(reordered);
      saveToStorage(reordered);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      const updated = mentions.map((m) =>
        m.id === editingId ? { ...formData, id: editingId } : m
      );
      setMentions(updated);
      saveToStorage(updated);
    } else {
      const newMention: MediaMention = { ...formData, id: generateId() };
      const updated = [newMention, ...mentions];
      setMentions(updated);
      saveToStorage(updated);
    }

    resetForm();
  };

  const handleEdit = (mention: MediaMention) => {
    setFormData({
      publication: mention.publication,
      title: mention.title,
      date: mention.date,
      url: mention.url,
      tags: mention.tags || [],
    });
    setEditingId(mention.id);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this item?')) {
      const updated = mentions.filter((m) => m.id !== id);
      setMentions(updated);
      saveToStorage(updated);
    }
  };

  const resetForm = () => {
    setFormData({ publication: '', title: '', date: '', url: '', tags: [] });
    setEditingId(null);
    setShowForm(false);
  };

  const handleExport = () => {
    downloadJSON(mentions, 'mediaMentions.json');
  };

  const handlePublish = async () => {
    setPublishing(true);

    const result = await publishToS3(FILE_PATHS.mediaMentions, mentions);

    if (result.success) {
      showSuccess('Published to live site!');
      localStorage.removeItem(STORAGE_KEY);
      setIsDirty(false);
    } else {
      showError('Failed to publish media mentions', result.error);
    }

    setPublishing(false);
  };

  const handleResetToSource = async () => {
    if (confirm('This will discard all local changes. Continue?')) {
      localStorage.removeItem(STORAGE_KEY);
      try {
        const res = await fetch('/data/mediaMentions.json');
        const data: MediaMention[] = await res.json();
        setMentions(data);
        setIsDirty(false);
        showSuccess('Reset to source data');
      } catch (error) {
        showError('Failed to reload data', error);
      }
    }
  };

  const filteredMentions = mentions.filter(
    (m) =>
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.publication.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Media Mentions
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {mentions.length} items {isDirty && <span style={{ color: '#f59e0b' }}>(unsaved changes)</span>}
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
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            <i className="bi bi-plus-lg mr-2"></i>Add New
          </button>
        </div>
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-lg p-6 rounded-xl"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {editingId ? 'Edit Media Mention' : 'Add Media Mention'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Publication *
                  </label>
                  <input
                    type="text"
                    value={formData.publication}
                    onChange={(e) => setFormData({ ...formData, publication: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                    placeholder="e.g., New York Times"
                  />
                </div>
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
                    placeholder="Article title"
                  />
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
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                    URL *
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                    About
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {RESEARCHER_TAGS.map((tag) => {
                      const selected = formData.tags?.includes(tag) ?? false;
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            const current = formData.tags || [];
                            const next = selected
                              ? current.filter((t) => t !== tag)
                              : [...current, tag as ResearcherTag];
                            setFormData({ ...formData, tags: next });
                          }}
                          className="px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
                          style={{
                            background: selected ? 'var(--accent)' : 'var(--bg-tertiary)',
                            color: selected ? '#fff' : 'var(--text-secondary)',
                            border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
                          }}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
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
                  {editingId ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by title or publication..."
          className="w-full px-4 py-2 rounded-lg"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* List */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="w-6 flex-shrink-0"></div>
          <div className="flex-shrink-0 w-32 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Publication
          </div>
          <div className="flex-1 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Title
          </div>
          <div className="flex-shrink-0 w-24 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Date
          </div>
          <div className="w-16 flex-shrink-0 text-right text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Actions
          </div>
        </div>

        {/* Sortable List */}
        {filteredMentions.length === 0 ? (
          <div className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
            No items found
          </div>
        ) : searchTerm ? (
          // When searching, don't allow drag (filtered results)
          filteredMentions.map((mention) => (
            <SortableMentionRow
              key={mention.id}
              mention={mention}
              onEdit={() => handleEdit(mention)}
              onDelete={() => handleDelete(mention.id)}
            />
          ))
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={mentions.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              {mentions.map((mention) => (
                <SortableMentionRow
                  key={mention.id}
                  mention={mention}
                  onEdit={() => handleEdit(mention)}
                  onDelete={() => handleDelete(mention.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
