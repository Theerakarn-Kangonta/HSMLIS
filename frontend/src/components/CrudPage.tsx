import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { useI18n } from '../lib/i18n'
import {
  Button,
  Card,
  DataTable,
  DialogActions,
  EmptyState,
  ErrorNote,
  IconButton,
  Modal,
  PageHeader,
  SearchInput,
  SkeletonRows,
  Toggle,
  Toolbar,
  tableBodyClass,
  tableHeadClass,
  tableRowClass,
  tdClass,
  thClass,
  useToast,
} from './ui'

type Row = { id: string; isActive: boolean }

export type Column<T> = { header: string; cell: (row: T) => ReactNode; className?: string; title?: boolean }

/**
 * A settings list: search, a table, an "active" switch per row, and a dialog to add or edit.
 * Every settings page of the catalog is one of these with its own columns and form.
 */
export function CrudPage<T extends Row, TInput extends { isActive: boolean }>({
  title,
  description,
  queryKey,
  service,
  columns,
  blank,
  toInput,
  form,
  matches,
  addLabel,
  dialogSize = 'md',
  canDelete = true,
}: {
  title: string
  description: string
  queryKey: string
  service: { list: () => Promise<T[]>; create: (body: TInput) => Promise<T>; update: (id: string, body: TInput) => Promise<T>; remove: (id: string) => Promise<void> }
  columns: Column<T>[]
  blank: TInput
  toInput: (row: T) => TInput
  form: (value: TInput, set: (patch: Partial<TInput>) => void) => ReactNode
  matches: (row: T, needle: string) => boolean
  addLabel: string
  dialogSize?: 'md' | 'lg' | 'xl'
  canDelete?: boolean
}) {
  const { t, errorText } = useI18n()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<{ row: T | null; value: TInput } | null>(null)
  const [deleting, setDeleting] = useState<T | null>(null)
  const list = useQuery({ queryKey: [queryKey], queryFn: service.list })
  const refresh = () => queryClient.invalidateQueries({ queryKey: [queryKey] })

  const save = useMutation({
    mutationFn: ({ row, value }: { row: T | null; value: TInput }) => (row ? service.update(row.id, value) : service.create(value)),
    onSuccess: () => {
      refresh()
      toast(t('common.savedToast'))
      setEditing(null)
    },
  })
  const toggle = useMutation({
    mutationFn: (row: T) => service.update(row.id, { ...toInput(row), isActive: !row.isActive }),
    onSuccess: refresh,
    onError: (e) => toast(errorText(e), 'error'),
  })
  const remove = useMutation({
    mutationFn: (row: T) => service.remove(row.id),
    onSuccess: () => {
      refresh()
      toast(t('common.deletedToast'))
      setDeleting(null)
    },
  })

  const needle = search.trim().toLowerCase()
  const rows = (list.data ?? []).filter((r) => !needle || matches(r, needle))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (editing) save.mutate(editing)
  }

  return (
    <div className="space-y-5">
      <PageHeader title={title} description={description}>
        <Button onClick={() => (save.reset(), setEditing({ row: null, value: blank }))}>
          <Plus className="size-4" />
          {addLabel}
        </Button>
      </PageHeader>
      <Card>
        <Toolbar actions={<span className="text-xs text-ink-muted">{t('common.itemCount', { n: rows.length })}</span>}>
          <SearchInput value={search} onChange={setSearch} placeholder={t('common.search')} className="w-full max-w-sm" />
        </Toolbar>
        <ErrorNote error={list.error} />
        {list.data && rows.length === 0 ? (
          <EmptyState icon={Inbox} title={t(needle ? 'common.noMatches' : 'common.emptyList')} />
        ) : (
          <DataTable>
            <thead className={tableHeadClass}>
              <tr>
                {columns.map((c) => (
                  <th key={c.header} className={`${thClass} ${c.className ?? ''}`}>
                    {c.header}
                  </th>
                ))}
                <th className={thClass}>{t('common.status')}</th>
                <th className={thClass} />
              </tr>
            </thead>
            <tbody className={tableBodyClass}>
              {list.isLoading ? <SkeletonRows columns={columns.length + 2} /> : null}
              {rows.map((row) => (
                <tr key={row.id} className={tableRowClass}>
                  {columns.map((c) => (
                    <td key={c.header} className={`${tdClass} ${c.className ?? ''}`} data-label={c.title ? undefined : c.header} data-title={c.title || undefined}>
                      {c.cell(row)}
                    </td>
                  ))}
                  <td className={tdClass} data-label={t('common.status')}>
                    <Toggle checked={row.isActive} onChange={() => toggle.mutate(row)} label={t(row.isActive ? 'common.active' : 'common.inactive')} disabled={toggle.isPending} />
                  </td>
                  <td className={`${tdClass} text-right`} data-actions>
                    <div className="flex justify-end">
                      <IconButton label={t('common.edit')} onClick={() => (save.reset(), setEditing({ row, value: toInput(row) }))}>
                        <Pencil className="size-4" />
                      </IconButton>
                      {canDelete ? (
                        <IconButton label={t('common.delete')} danger onClick={() => (remove.reset(), setDeleting(row))}>
                          <Trash2 className="size-4" />
                        </IconButton>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      {editing ? (
        <Modal title={editing.row ? t('common.editItem', { item: title }) : addLabel} size={dialogSize} onClose={() => setEditing(null)}>
          <form onSubmit={submit} className="space-y-4">
            {form(editing.value, (patch) => setEditing({ ...editing, value: { ...editing.value, ...patch } }))}
            <ErrorNote error={save.error} />
            <DialogActions onClose={() => setEditing(null)} pending={save.isPending} submitLabel={t('common.save')} />
          </form>
        </Modal>
      ) : null}

      {deleting ? (
        <Modal title={t('common.deleteConfirmTitle')} onClose={() => setDeleting(null)}>
          <p className="text-sm text-ink">{t('common.deleteConfirm')}</p>
          <ErrorNote error={remove.error} />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={() => remove.mutate(deleting)} loading={remove.isPending}>
              {t('common.delete')}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
