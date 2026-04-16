import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Trash2, Edit2, X, Check, Tag } from 'lucide-react';
import { templatesApi } from '../lib/api';
import { TemplateComponentSchema, type TemplateComponentInput, type ComponentType } from '@freelancer-os/shared';
import type { TemplateComponent } from '@freelancer-os/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import clsx from 'clsx';

const TYPES: { value: ComponentType; label: string; desc: string }[] = [
  { value: 'greeting', label: 'Greeting', desc: 'Opening salutation' },
  { value: 'opening', label: 'Opening', desc: 'Hook line / problem statement' },
  { value: 'strategy', label: 'Strategy', desc: 'Approach & methodology' },
  { value: 'closing', label: 'Closing', desc: 'Call to action' },
  { value: 'regards', label: 'Regards', desc: 'Sign-off line' },
  { value: 'ps', label: 'P.S.', desc: 'Bonus / social proof' },
];

export default function Templates() {
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState<ComponentType>('greeting');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const { data: components = [], isLoading } = useQuery({
    queryKey: ['components'],
    queryFn: () => templatesApi.listComponents(),
  });

  const createMutation = useMutation({
    mutationFn: (data: TemplateComponentInput) => templatesApi.createComponent({ ...data, tags }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['components'] }); closeForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: TemplateComponentInput }) =>
      templatesApi.updateComponent(id, { ...data, tags }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['components'] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => templatesApi.deleteComponent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['components'] }),
  });

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<TemplateComponentInput>({
    resolver: zodResolver(TemplateComponentSchema),
    defaultValues: { type: activeType, tags: [] },
  });

  function openCreate() {
    reset({ type: activeType, tags: [], content: '' });
    setTags([]);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(c: TemplateComponent) {
    reset({ type: c.type, content: c.content, tags: c.tags });
    setValue('type', c.type);
    setTags(c.tags);
    setEditingId(c.id);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setTags([]);
    setTagInput('');
    reset();
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((p) => [...p, t]);
    setTagInput('');
  }

  function onSubmit(data: TemplateComponentInput) {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  }

  const filtered = components.filter((c: TemplateComponent) => c.type === activeType);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-dark">Template Components</h1>
          <p className="text-slate-500 mt-0.5">Build your reusable proposal building blocks</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-xs px-3 py-2">
          <Plus size={14} /> New Component
        </button>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-1 flex-wrap mb-5">
        {TYPES.map(({ value, label }) => {
          const count = components.filter((c: TemplateComponent) => c.type === value).length;
          return (
            <button
              key={value}
              onClick={() => setActiveType(value)}
              className={clsx(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors',
                activeType === value
                  ? 'bg-primary text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300',
              )}
            >
              {label}
              <span className={clsx('text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center',
                activeType === value ? 'bg-white/20' : 'bg-slate-100 text-slate-500')}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse h-28" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Tag size={20} className="text-slate-300" />
          </div>
          <p className="text-slate-500">No {activeType} components yet.</p>
          <button onClick={openCreate} className="btn-primary mt-4 text-sm">
            <Plus size={14} /> Create First Component
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((c: TemplateComponent) => (
            <div key={c.id} className="card p-4 group">
              <p className="text-sm text-dark leading-relaxed whitespace-pre-wrap mb-3">{c.content}</p>
              {c.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {c.tags.map((t) => (
                    <span key={t} className="badge badge-blue text-xs">{t}</span>
                  ))}
                </div>
              )}
              <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => openEdit(c)}
                  className="p-1.5 text-slate-400 hover:text-primary rounded hover:bg-primary/10 transition-colors"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => { if (confirm('Delete this component?')) deleteMutation.mutate(c.id); }}
                  className="p-1.5 text-slate-400 hover:text-danger rounded hover:bg-danger/10 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-dark">
                {editingId ? 'Edit Component' : 'New Component'}
              </h2>
              <button onClick={closeForm} className="text-slate-400 hover:text-dark">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              <div>
                <label className="label">Type</label>
                <select {...register('type')} className="input">
                  {TYPES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Content</label>
                <textarea {...register('content')} rows={5} className="input resize-none" placeholder="Write your component text..." />
                {errors.content && <p className="mt-1 text-xs text-danger">{errors.content.message}</p>}
              </div>

              <div>
                <label className="label">Tags <span className="text-slate-400 font-normal">(optional)</span></label>
                <div className="flex gap-2 mb-2">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    className="input flex-1"
                    placeholder="e.g. Fixed Price, Agency..."
                  />
                  <button type="button" onClick={addTag} className="btn-secondary text-xs px-3">Add</button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <span key={t} className="badge badge-blue gap-1">
                        {t}
                        <button type="button" onClick={() => setTags((p) => p.filter((x) => x !== t))}>
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button type="button" onClick={closeForm} className="btn-secondary">Cancel</button>
                <button type="submit" disabled={isSubmitting || createMutation.isPending || updateMutation.isPending} className="btn-primary">
                  <Check size={14} />
                  {editingId ? 'Save Changes' : 'Create Component'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
