'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
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
      e.slug = 'slug 只能包含小写字母、数字和连字符';
    }
    if (!f.nameZh.trim() && !f.nameEn.trim() && !f.nameJa.trim()) {
      e.nameZh = '请至少填写一种语言的分类名称';
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
        setErrors({ form: data.error || '保存失败' });
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
        <h1 className="text-xl font-semibold">分类管理</h1>
        <Button
          onClick={openCreate}
          className="ml-auto bg-[#ff2d78] hover:bg-[#ff2d78]/90 text-white"
          style={{ boxShadow: '0 0 16px rgba(255,45,120,0.3)' }}
        >
          <PlusIcon className="size-4 mr-2" />
          新增分类
        </Button>
      </div>

      <div className="rounded-xl bg-[#14141f] border border-white/[0.06] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.01]">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">图标</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">名称</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">slug</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">排序</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">操作</th>
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
                    暂无分类
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
                          aria-label="编辑"
                        >
                          <PencilIcon className="size-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(c.id)}
                          className="size-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          aria-label="删除"
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
        <DialogContent className="bg-[#14141f] border-white/[0.08] sm:max-w-lg w-[calc(100vw-2rem)] max-h-[92vh] overflow-hidden scrollbar-hide">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-lg" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              {editing ? '编辑分类' : '新增分类'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-4 py-2 pr-1">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">slug（URL/标识，小写字母、数字、连字符）</Label>
              <Input
                value={form.slug}
                onChange={(e) => updateForm('slug', e.target.value)}
                className="bg-white/[0.03] border-white/[0.08] font-mono text-sm"
                style={{ minHeight: 40 }}
                placeholder="如：game"
              />
              {errors.slug && <p className="text-xs text-red-400">{errors.slug}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {([
                { key: 'nameZh', label: '名称（中文）' },
                { key: 'nameEn', label: '名称（英文）' },
                { key: 'nameJa', label: '名称（日文）' },
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
                <Label className="text-xs text-muted-foreground">图标（emoji）</Label>
                <Input
                  value={form.icon}
                  onChange={(e) => updateForm('icon', e.target.value)}
                  className="bg-white/[0.03] border-white/[0.08] text-lg"
                  style={{ minHeight: 40 }}
                  placeholder="📷"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">排序（数字越小越靠前）</Label>
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
              取消
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
              {editing ? '保存修改' : '创建分类'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="bg-[#14141f] border-white/[0.08] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            此操作不可撤销。确定要删除这个分类吗？已使用该分类的图包不会被删除，仅失去分类关联。
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteConfirm(null)}
              className="text-muted-foreground"
            >
              取消
            </Button>
            <Button
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
