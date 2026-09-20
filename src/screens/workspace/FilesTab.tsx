import { useState } from 'react'
import { fmtDate } from '../../domain/dates'
import { stageDef } from '../../domain/lifecycle'
import { userById } from '../../domain/logic'
import type { Project, ProjectFile } from '../../domain/types'
import { useApp } from '../../store/store'
import { Badge, Button, Card, CardHead, EmptyState, Field, Modal } from '../../components/ui'

const KIND_LABEL: Record<ProjectFile['kind'], string> = {
  document: 'Document',
  design: 'Design',
  test_result: 'Test result',
  link: 'Link',
  release: 'Release',
}

export function FilesTab({ project }: { project: Project }) {
  const { db, role, run, pending, actorFor } = useApp()
  const actor = actorFor(project)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ProjectFile['kind']>('document')

  return (
    <Card>
      <CardHead
        title="Files & deliverables"
        sub="The evidence behind each stage gate"
        right={
          <Button size="sm" disabled={role === 'management'} onClick={() => setAdding(true)}>
            + Add deliverable
          </Button>
        }
      />
      <div className="table-wrap">
        {project.files.length === 0 ? (
          <EmptyState
            title="No deliverables uploaded yet"
            body="Discovery reports, designs, test results and release notes are attached here as the project progresses."
            action={
              role !== 'management' ? (
                <Button onClick={() => setAdding(true)}>Add the first deliverable</Button>
              ) : undefined
            }
          />
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>Deliverable</th>
                <th>Type</th>
                <th>Stage</th>
                <th>Added by</th>
                <th>Date</th>
                <th>Size</th>
              </tr>
            </thead>
            <tbody>
              {project.files.map((f) => (
                <tr key={f.id}>
                  <td className="cell-main">{f.name}</td>
                  <td>
                    <Badge tone={f.kind === 'release' ? 'ok' : 'muted'}>{KIND_LABEL[f.kind]}</Badge>
                  </td>
                  <td>
                    <span className="pill-stage">{stageDef(f.stage).short}</span>
                  </td>
                  <td>{userById(db, f.uploadedById)?.name}</td>
                  <td className="nowrap">{fmtDate(f.uploadedAt)}</td>
                  <td className="muted">{f.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adding && (
        <Modal
          title="Add a deliverable"
          sub="Prototype upload — the file name and type are recorded against the current stage"
          onClose={() => setAdding(false)}
          footer={
            <>
              <Button onClick={() => setAdding(false)}>Cancel</Button>
              <Button
                variant="primary"
                disabled={!name.trim()}
                loading={pending === 'add_file'}
                onClick={async () => {
                  await run({ type: 'add_file', projectId: project.id, name, kind, actorId: actor.id }, { success: 'Deliverable added.' })
                  setName('')
                  setAdding(false)
                }}
              >
                Add deliverable
              </Button>
            </>
          }
        >
          <Field label="File or link name" required>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HR Assistant — UAT test results.xlsx" />
          </Field>
          <Field label="Type">
            <select className="select" value={kind} onChange={(e) => setKind(e.target.value as ProjectFile['kind'])}>
              {(Object.keys(KIND_LABEL) as ProjectFile['kind'][]).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </Field>
        </Modal>
      )}
    </Card>
  )
}
