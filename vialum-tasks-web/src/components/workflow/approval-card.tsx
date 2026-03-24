'use client';
import { useState } from 'react';
import { api, type Approval } from '@/lib/api';

interface Props {
  approval: Approval;
  onDecided: () => void;
}

export function ApprovalCard({ approval, onDecided }: Props) {
  const [loading, setLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    try {
      await api.decideApproval(approval.id, { status: 'approved' });
      onDecided();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setLoading(true);
    try {
      await api.decideApproval(approval.id, { status: 'rejected', reason: rejectReason });
      onDecided();
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  return (
    <div className="rounded-lg border-2 border-danger/30 bg-danger/5 p-4">
      <div className="flex items-start gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-danger mt-1.5 flex-shrink-0 shadow-[0_0_8px_hsl(var(--danger)/0.4)]" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-foreground">{approval.title}</h4>
          {approval.description && (
            <p className="text-xs text-muted-foreground mt-1">{approval.description}</p>
          )}

          {/* Attachments */}
          {approval.attachments.length > 0 && (
            <div className="flex gap-2 mt-2">
              {approval.attachments.map((att, i) => (
                <a
                  key={i}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] rounded border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {att.name}
                </a>
              ))}
            </div>
          )}

          {/* Actions */}
          {!showRejectForm ? (
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleApprove}
                disabled={loading}
                className="px-4 py-1.5 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                Aprovar
              </button>
              <button
                onClick={() => setShowRejectForm(true)}
                disabled={loading}
                className="px-4 py-1.5 text-xs font-semibold rounded-md bg-danger/10 text-danger hover:bg-danger/20 transition-colors disabled:opacity-50"
              >
                Rejeitar
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <input
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motivo da rejeição..."
                className="w-full px-3 py-1.5 text-xs bg-card border border-border rounded-md text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-danger/30"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={loading || !rejectReason.trim()}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-danger text-white hover:bg-danger/90 transition-colors disabled:opacity-50"
                >
                  Confirmar rejeição
                </button>
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
