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
import type { TeamMember, TeamData } from '../../types/admin';
import { publishToS3, FILE_PATHS } from './utils/publishToS3';
import { useAdminToast } from './context/AdminToastContext';

const STORAGE_KEY = 'admin-team';

type TeamCategory = 'faculty' | 'staff' | 'postdocs' | 'gradStudents' | 'advisoryBoard' | 'globalAdvisors';

const CATEGORY_LABELS: Record<TeamCategory, string> = {
  faculty: 'Faculty',
  staff: 'Staff',
  postdocs: 'Postdocs',
  gradStudents: 'Graduate Students',
  advisoryBoard: 'Advisory Board',
  globalAdvisors: 'Global Advisors',
};

const emptyTeamData: TeamData = {
  faculty: [],
  staff: [],
  postdocs: [],
  gradStudents: [],
  undergrads: [],
  advisoryBoard: [],
  globalAdvisors: [],
};

const emptyMember: Omit<TeamMember, 'name'> & { name: string } = {
  name: '',
  title: '',
  institution: '',
  photo: '',
  website: '',
  profileLink: '',
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

// Sortable Member Card Component
function SortableMemberCard({
  id,
  member,
  onEdit,
  onDelete,
}: {
  id: string;
  member: TeamMember;
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
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      className="flex items-center gap-3 p-3 rounded-lg"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1"
        style={{ color: 'var(--text-muted)' }}
      >
        <i className="bi bi-grip-vertical text-lg"></i>
      </div>
      {member.photo && (
        <img
          src={member.photo}
          alt={member.name}
          className="w-12 h-12 rounded-full object-cover flex-shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {member.name}
          {member.profileLink && (
            <a href={member.profileLink} className="ml-2 text-xs" style={{ color: 'var(--accent)' }}>
              (profile)
            </a>
          )}
        </div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {member.title}
        </div>
        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {member.institution}
          {member.website && (
            <>
              {' · '}
              <a href={member.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
                website
              </a>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={onEdit}
          className="p-1 hover:opacity-70"
          style={{ color: 'var(--text-secondary)' }}
          title="Edit"
        >
          <i className="bi bi-pencil"></i>
        </button>
        <button
          onClick={onDelete}
          className="p-1 hover:opacity-70"
          style={{ color: '#ef4444' }}
          title="Delete"
        >
          <i className="bi bi-trash"></i>
        </button>
      </div>
    </div>
  );
}

// Sortable Undergrad Card Component
function SortableUndergradCard({
  id,
  name,
  onEdit,
  onDelete,
}: {
  id: string;
  name: string;
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
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
      className="flex items-center gap-3 p-3 rounded-lg"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing p-1"
        style={{ color: 'var(--text-muted)' }}
      >
        <i className="bi bi-grip-vertical text-lg"></i>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
          {name}
        </div>
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

export function TeamAdmin() {
  const [teamData, setTeamData] = useState<TeamData>(emptyTeamData);
  const [loading, setLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['faculty', 'staff']));

  // Modal state
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TeamCategory | 'undergrads' | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<TeamMember>(emptyMember);
  const [undergradName, setUndergradName] = useState('');
  const [publishing, setPublishing] = useState(false);
  const { showError, showSuccess } = useAdminToast();

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
        setTeamData(JSON.parse(stored));
        setIsDirty(true);
      } else {
        try {
          const res = await fetch('/data/team.json');
          const data: TeamData = await res.json();
          setTeamData(data);
        } catch (error) {
          showError('Failed to load team data', error);
        }
      }
      setLoading(false);
    }
    loadData();
  }, [showError]);

  const saveToStorage = (data: TeamData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setIsDirty(true);
  };

  const toggleCategory = (cat: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(cat)) {
      newExpanded.delete(cat);
    } else {
      newExpanded.add(cat);
    }
    setExpandedCategories(newExpanded);
  };

  const handleDragEnd = (event: DragEndEvent, category: TeamCategory | 'undergrads') => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const updated = { ...teamData };

      if (category === 'undergrads') {
        const oldIndex = updated.undergrads.findIndex((_, i) => `undergrad-${i}` === active.id);
        const newIndex = updated.undergrads.findIndex((_, i) => `undergrad-${i}` === over.id);
        updated.undergrads = arrayMove(updated.undergrads, oldIndex, newIndex);
      } else {
        const oldIndex = updated[category].findIndex((_, i) => `${category}-${i}` === active.id);
        const newIndex = updated[category].findIndex((_, i) => `${category}-${i}` === over.id);
        updated[category] = arrayMove(updated[category], oldIndex, newIndex);
      }

      setTeamData(updated);
      saveToStorage(updated);
    }
  };

  const handleAddMember = (category: TeamCategory | 'undergrads') => {
    setEditingCategory(category);
    setEditingIndex(null);
    if (category === 'undergrads') {
      setUndergradName('');
    } else {
      setFormData({ ...emptyMember });
    }
    setShowForm(true);
  };

  const handleEditMember = (category: TeamCategory | 'undergrads', index: number) => {
    setEditingCategory(category);
    setEditingIndex(index);
    if (category === 'undergrads') {
      setUndergradName(teamData.undergrads[index]);
    } else {
      setFormData({ ...teamData[category][index] });
    }
    setShowForm(true);
  };

  const handleDeleteMember = (category: TeamCategory | 'undergrads', index: number) => {
    if (!confirm('Are you sure you want to delete this member?')) return;

    const updated = { ...teamData };
    if (category === 'undergrads') {
      updated.undergrads = updated.undergrads.filter((_, i) => i !== index);
    } else {
      updated[category] = updated[category].filter((_, i) => i !== index);
    }
    setTeamData(updated);
    saveToStorage(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    const updated = { ...teamData };

    if (editingCategory === 'undergrads') {
      if (editingIndex !== null) {
        updated.undergrads[editingIndex] = undergradName;
      } else {
        updated.undergrads = [...updated.undergrads, undergradName];
      }
    } else {
      if (editingIndex !== null) {
        updated[editingCategory][editingIndex] = { ...formData };
      } else {
        updated[editingCategory] = [...updated[editingCategory], { ...formData }];
      }
    }

    setTeamData(updated);
    saveToStorage(updated);
    resetForm();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingCategory(null);
    setEditingIndex(null);
    setFormData({ ...emptyMember });
    setUndergradName('');
  };

  const handleExport = () => {
    downloadJSON(teamData, 'team.json');
  };

  const handlePublish = async () => {
    setPublishing(true);

    const result = await publishToS3(FILE_PATHS.team, teamData);

    if (result.success) {
      showSuccess('Published to live site!');
      localStorage.removeItem(STORAGE_KEY);
      setIsDirty(false);
    } else {
      showError('Failed to publish team data', result.error);
    }

    setPublishing(false);
  };

  const handleResetToSource = async () => {
    if (!confirm('This will discard all local changes. Continue?')) return;
    localStorage.removeItem(STORAGE_KEY);
    try {
      const res = await fetch('/data/team.json');
      const data: TeamData = await res.json();
      setTeamData(data);
      setIsDirty(false);
      showSuccess('Reset to source data');
    } catch (error) {
      showError('Failed to reload data', error);
    }
  };

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
            Team
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage team members across all categories
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

      {/* Categories */}
      <div className="space-y-4">
        {/* Team Member Categories */}
        {(Object.keys(CATEGORY_LABELS) as TeamCategory[]).map((category) => (
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
                  ({teamData[category].length})
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAddMember(category);
                }}
                className="px-3 py-1 rounded text-sm font-medium"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                <i className="bi bi-plus-lg mr-1"></i>Add
              </button>
            </button>
            {expandedCategories.has(category) && (
              <div className="p-4 space-y-2">
                {teamData[category].length === 0 ? (
                  <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>
                    No members in this category
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(e) => handleDragEnd(e, category)}
                  >
                    <SortableContext
                      items={teamData[category].map((_, i) => `${category}-${i}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {teamData[category].map((member, index) => (
                        <SortableMemberCard
                          key={`${category}-${index}`}
                          id={`${category}-${index}`}
                          member={member}
                          onEdit={() => handleEditMember(category, index)}
                          onDelete={() => handleDeleteMember(category, index)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Undergrads - Simple names */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
        >
          <button
            onClick={() => toggleCategory('undergrads')}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            style={{ borderBottom: expandedCategories.has('undergrads') ? '1px solid var(--border)' : 'none' }}
          >
            <div className="flex items-center gap-2">
              <i className={`bi bi-chevron-${expandedCategories.has('undergrads') ? 'down' : 'right'}`} style={{ color: 'var(--text-muted)' }}></i>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                Undergraduates
              </span>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                ({teamData.undergrads.length})
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAddMember('undergrads');
              }}
              className="px-3 py-1 rounded text-sm font-medium"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              <i className="bi bi-plus-lg mr-1"></i>Add
            </button>
          </button>
          {expandedCategories.has('undergrads') && (
            <div className="p-4 space-y-2">
              {teamData.undergrads.length === 0 ? (
                <div className="text-center py-4" style={{ color: 'var(--text-muted)' }}>
                  No undergraduates listed
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(e) => handleDragEnd(e, 'undergrads')}
                >
                  <SortableContext
                    items={teamData.undergrads.map((_, i) => `undergrad-${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {teamData.undergrads.map((name, index) => (
                      <SortableUndergradCard
                        key={`undergrad-${index}`}
                        id={`undergrad-${index}`}
                        name={name}
                        onEdit={() => handleEditMember('undergrads', index)}
                        onDelete={() => handleDeleteMember('undergrads', index)}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div
            className="w-full max-w-lg p-6 rounded-xl max-h-[90vh] overflow-y-auto"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              {editingIndex !== null ? 'Edit' : 'Add'}{' '}
              {editingCategory === 'undergrads' ? 'Undergraduate' : 'Team Member'}
            </h2>
            <form onSubmit={handleSubmit}>
              {editingCategory === 'undergrads' ? (
                <div className="mb-4">
                  <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                    Name *
                  </label>
                  <input
                    type="text"
                    value={undergradName}
                    onChange={(e) => setUndergradName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    required
                    placeholder="Full name"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      required
                      placeholder="Full name"
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
                      placeholder="e.g., Associate Professor of Government"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Institution *
                    </label>
                    <input
                      type="text"
                      value={formData.institution}
                      onChange={(e) => setFormData({ ...formData, institution: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      required
                      placeholder="e.g., Dartmouth College"
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Photo URL
                    </label>
                    <input
                      type="url"
                      value={formData.photo || ''}
                      onChange={(e) => setFormData({ ...formData, photo: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      placeholder="https://..."
                    />
                    {formData.photo && (
                      <div className="mt-2">
                        <img
                          src={formData.photo}
                          alt="Preview"
                          className="w-16 h-16 rounded-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={formData.website || ''}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                      Profile Link (internal)
                    </label>
                    <input
                      type="text"
                      value={formData.profileLink || ''}
                      onChange={(e) => setFormData({ ...formData, profileLink: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                      placeholder="/about/name"
                    />
                  </div>
                </div>
              )}
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
                  {editingIndex !== null ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
