'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  Loader2Icon,
  ArrowLeftIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface CategoryRow {
  id: string;
  slug: string;
  icon: string;
  name: { zh?: string; en?: string; ja?: string };
  sortOrder: number;
}

interface CategoryForm {
  id?: string;
  slug: string;
  icon: string;
  sortOrder: number;
  nameZh: string;
  nameEn: string;
  nameJa: string;
}

const emptyForm: CategoryForm = {
  slug: '',
  icon: '📷',
  sortOrder: 0,
  nameZh: '',
  nameEn: '',
  nameJa: '',
};

export default function AdminCategoriesPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('admin.categories');
  const tCommon = useTranslations('admin.common');
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryRow | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/admin/api/categories');
      if (res.status === 401) {
        router.push(`/${locale}/admin/login`);
        return;
      }
      const data = await res.json();
      setCategories(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Fetch categories failed:', e);
    } finally {
      setLoading(false);
    }
  }, [router, locale]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const openCreate = () => {
    setEditing(null);
    setErrors({});
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (c: CategoryRow) => {
    setEditing(c);
    setErrors({});
    setForm({
      id: c.id,
      slug: c.slug,
      icon: c.icon || '📷',
      sortOrder: c.sortOrder || 0,
      nameZh: c.name?.zh || '',
      nameEn: c.name?.en || '',
      nameJa: c.name?.ja || '',
    });
    setDialogOpen(true);
  };

  const validate = (f: CategoryForm): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!/^[a-z0-9-]+$/.test(f.slug.trim())) {
      e.slug = t('errorSlug');
    }
    if (!f.nameZh.trim() && !f.nameEn.trim() && !f.nameJa.trim()) {
      e.nameZh = t('errorName');
    }
    return e;
  };

  const handleSave = async () => {
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSaving(true);
    try {
      const payload = {
        ...(form.id ? { id: form.id } : {}),
        slug: form.slug.trim(),
        icon: form.icon || '📷',
        sortOrder: Number(form.sortOrder) || 0,
        name: {
          ...(form.nameZh.trim() ? { zh: form.nameZh.trim() } : {}),
          ...(form.nameEn.trim() ? { en: form.nameEn.trim() } : {}),
          ...(form.nameJa.trim() ? { ja: form.nameJa.trim() } : {}),
        },
      };
      const res = await fetch('/admin/api/categories', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.status === 401) {
        router.push(`/${locale}/admin/login`);
        return;
      }
      if (res.ok) {
        setDialogOpen(false);
        fetchCategories();
      } else {
        const data = await res.json().catch(() => ({}));
        setErrors({ form: data.error || t('saveFailed') });
      }
    } catch (e) {
      console.error('Save category failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/admin/api/categories?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(null);
        fetchCategories();
      }
    } catch (e) {
      console.error('Delete category failed:', e);
    }
  };

  const updateForm = (key: keyof CategoryForm, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key as string]) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/${locale}/admin`)}
          className="size-9"
        >
          <ArrowLeftIcon className="size-4" />
        </Button>
        <h1 className="text-xl font-semibold">{t('title')}</h1>
        <Button
          onClick={openCreate}
          className="ml-auto bg-[#ff2d78] hover:bg-[#ff2d78]/90 text-white"
          style={{ boxShadow: '0 0 16px rgba(255,45,120,0.3)' }}
        >
          <PlusIcon className="size-4 mr-2" />
          {t('create')}
        </Button>
      </div>

      <div className="rounded-xl bg-[#262633] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{t('colIcon')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{t('colName')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{t('colSlug')}</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">{t('colSort')}</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Loader2Icon className="size-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3 text-xl">{c.icon}</td>
                    <td className="px-4 py-3">
                      <p className="text-foreground font-medium">
                        {c.name?.zh || c.name?.en || c.slug}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[c.name?.en, c.name?.ja].filter(Boolean).join(' / ') || '—'}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {c.slug}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.sortOrder}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="size-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-[#00d4ff] hover:bg-[#00d4ff]/10 transition-colors"
                          aria-label={t('edit')}
                        >
                          <PencilIcon className="size-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(c.id)}
                          className="size-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          aria-label={t('delete')}
                        >
                          <Trash2Icon className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-[#262633] border-white/[0.08] sm:max-w-lg w-[calc(100vw-2rem)] max-h-[92vh] overflow-hidden scrollbar-hide">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-lg" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              {editing ? t('editTitle') : t('create')}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-4 py-2 pr-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('fieldSlug')}</Label>
              <Input
                value={form.slug}
                onChange={(e) => updateForm('slug', e.target.value)}
                className="bg-white/[0.03] border-white/[0.08] font-mono text-sm"
                style={{ minHeight: 40 }}
                placeholder={t('fieldSlugPlaceholder')}
              />
              {errors.slug && <p className="text-xs text-red-400">{errors.slug}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { key: 'nameZh', label: t('fieldNameZh') },
                { key: 'nameEn', label: t('fieldNameEn') },
                { key: 'nameJa', label: t('fieldNameJa') },
              ] as const).map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">{label}</Label>
                  <Input
                    value={form[key]}
                    onChange={(e) => updateForm(key, e.target.value)}
                    className="bg-white/[0.03] border-white/[0.08]"
                    style={{ minHeight: 40 }}
                  />
                </div>
              ))}
            </div>
            {errors.nameZh && <p className="text-xs text-red-400">{errors.nameZh}</p>}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('fieldIcon')}</Label>
                <Input
                  value={form.icon}
                  onChange={(e) => updateForm('icon', e.target.value)}
                  className="bg-white/[0.03] border-white/[0.08] text-lg"
                  style={{ minHeight: 40 }}
                  placeholder="📷"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('fieldSort')}</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => updateForm('sortOrder', parseInt(e.target.value) || 0)}
                  className="bg-white/[0.03] border-white/[0.08]"
                  style={{ minHeight: 40 }}
                />
              </div>
            </div>

            {errors.form && (
              <p className="text-xs text-red-400">{errors.form}</p>
            )}
          </div>

          <div className="shrink-0 flex justify-end gap-3 pt-3 border-t border-white/[0.06]">
            <Button
              variant="ghost"
              onClick={() => setDialogOpen(false)}
              className="text-muted-foreground"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#ff2d78] hover:bg-[#ff2d78]/90 text-white"
              style={{ boxShadow: '0 0 16px rgba(255,45,120,0.3)' }}
            >
              {saving ? (
                <Loader2Icon className="size-4 animate-spin mr-2" />
              ) : null}
              {editing ? t('saveEdit') : t('saveCreate')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-[#262633] border-white/[0.08] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">{t('confirmDeleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t('confirmDeleteDesc')}
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteConfirm(null)}
              className="text-muted-foreground"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {t('confirmDelete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
