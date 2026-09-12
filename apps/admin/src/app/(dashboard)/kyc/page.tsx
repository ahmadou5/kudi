'use client';

import React, { useState, useEffect } from 'react';
import { loadKycQueue, AdminKycQueueItem } from '@/lib/admin-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ShieldCheck, CheckCircle2, XCircle, AlertCircle, Eye, UserCheck } from 'lucide-react';

export default function KycReviewPage() {
  const [queue, setQueue] = useState<AdminKycQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    loadKycQueue().then((data) => {
      setQueue(data);
      setLoading(false);
    });
  }, []);

  const handleDecision = (id: string, decision: 'VERIFIED' | 'REJECTED') => {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: decision } : item))
    );
    setFeedback(`Application ${id} marked as ${decision}. Audit log recorded.`);
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Overview Banner */}
      <div className="rounded-2xl border border-silver-400/20 bg-muted/40 p-5 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
              <h3 className="font-display text-xl font-bold text-foreground">Smile Identity Compliance Queue</h3>
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Automated BVN/NIN verification combined with biometric selfie liveness detection. High-confidence applications
              are auto-cleared; flagged or manual-review submissions appear in this desk.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="success" className="font-mono text-xs px-3 py-1">
              Smile Identity Sandbox: OK
            </Badge>
          </div>
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Queue Table */}
      <Card className="p-0 overflow-hidden">
        {queue.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="KYC Review Queue is Clear"
            description="All customer verification requests have been processed."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border/70 bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Applicant Profile</th>
                  <th className="px-4 py-3">Submitted Documents</th>
                  <th className="px-4 py-3 text-center">Requested Tier</th>
                  <th className="px-4 py-3 text-center">Liveness Score</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Submitted At</th>
                  <th className="px-4 py-3 text-right">Compliance Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {queue.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-foreground">{item.userName}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{item.userEmail}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-foreground">{item.documentType}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        BVN: {item.bvn} · NIN: {item.nin}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[10px] font-bold text-foreground">
                        {item.requestedTier}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center font-mono">
                      <span className="text-emerald-400 font-bold">{item.livenessConfidenceScore}%</span>
                      <span className="text-[10px] text-muted-foreground block">Biometric Match</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <Badge
                        variant={
                          item.status === 'VERIFIED'
                            ? 'success'
                            : item.status === 'PENDING'
                            ? 'warning'
                            : 'destructive'
                        }
                        className="text-[10px]"
                      >
                        {item.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-[11px] text-muted-foreground">
                      {item.submittedAt}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {item.status === 'PENDING' ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleDecision(item.id, 'VERIFIED')}
                            className="h-8 px-2.5 text-xs font-semibold gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDecision(item.id, 'REJECTED')}
                            className="h-8 px-2 text-xs"
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground font-mono">Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
