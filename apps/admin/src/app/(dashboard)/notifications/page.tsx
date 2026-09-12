'use client';

import React, { useState, useEffect } from 'react';
import { loadNotifications, AdminNotification } from '@/lib/admin-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bell, Send, CheckCircle2, Users, Smartphone, Mail } from 'lucide-react';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<'ALL' | 'TIER_2' | 'ACTIVE_DEPOSITORS'>('ALL');
  const [channel, setChannel] = useState<'PUSH' | 'EMAIL' | 'IN_APP'>('PUSH');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    loadNotifications().then(setNotifications);
  }, []);

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !body) return;
    setSending(true);

    const newNotif: AdminNotification = {
      id: `nt_${Date.now()}`,
      title,
      body,
      audience,
      channel,
      sentAt: 'Just now',
      deliveredCount: 1428,
    };

    try {
      await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNotif),
      });
    } catch {
      // In-memory update
    }

    setNotifications([newNotif, ...notifications]);
    setSending(false);
    setTitle('');
    setBody('');
    setNotice(`Broadcast alert sent to ${audience} users across ${channel} channel!`);
    setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Overview Banner */}
      <div className="rounded-2xl border border-silver-400/20 bg-muted/40 p-5 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-silver-300" />
          <h3 className="font-display text-xl font-bold text-foreground">Global Push Broadcasts & Alerts</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
          Send high-priority notifications to users on their mobile Expo wallets or via email channels for deposit confirmation,
          rate changes, and security advisories.
        </p>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Broadcast Composer Form */}
      <Card title="Compose Global Broadcast" subtitle="Target all active wallet holders or specific KYC tiers">
        <form onSubmit={handleSendBroadcast} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Notification Title</label>
              <Input
                placeholder="e.g., Monad Metropolis AUSD Deposit Live"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Target Audience</label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-border/80 bg-card/60 px-3 text-xs text-foreground focus:outline-none"
                >
                  <option value="ALL">All Customers (1,428)</option>
                  <option value="TIER_2">Tier 2 KYC Verified Only</option>
                  <option value="ACTIVE_DEPOSITORS">Active Depositors (Last 7d)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Channel</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as any)}
                  className="w-full h-10 rounded-xl border border-border/80 bg-card/60 px-3 text-xs text-foreground focus:outline-none"
                >
                  <option value="PUSH">Expo Push Notification</option>
                  <option value="IN_APP">In-App Banner</option>
                  <option value="EMAIL">Transactional Email</option>
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Notification Message Body</label>
            <textarea
              rows={3}
              placeholder="Enter message text that will display on the user's mobile lock screen..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-xl border border-border/80 bg-card/60 p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-silver-400"
              required
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button type="submit" loading={sending} className="font-semibold text-xs gap-2">
              <Send className="h-4 w-4" />
              <span>Send Broadcast Alert</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* Broadcast History Table */}
      <Card title="Past Broadcast Dispatches" subtitle="Audit trail of sent announcements and delivery rates">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/70 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="pb-3 pt-1">Title & Message</th>
                <th className="pb-3 pt-1 text-center">Audience</th>
                <th className="pb-3 pt-1 text-center">Channel</th>
                <th className="pb-3 pt-1 text-center">Delivered</th>
                <th className="pb-3 pt-1 text-right">Sent At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {notifications.map((n) => (
                <tr key={n.id} className="hover:bg-muted/40 transition-colors">
                  <td className="py-3.5 max-w-md">
                    <div className="font-semibold text-foreground">{n.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>
                  </td>
                  <td className="py-3.5 text-center font-mono">
                    <Badge variant="outline" className="text-[10px]">
                      {n.audience}
                    </Badge>
                  </td>
                  <td className="py-3.5 text-center font-mono text-[11px] text-muted-foreground">
                    {n.channel}
                  </td>
                  <td className="py-3.5 text-center font-mono text-emerald-400 font-bold">
                    {n.deliveredCount.toLocaleString()} devices
                  </td>
                  <td className="py-3.5 text-right font-mono text-muted-foreground text-[11px]">
                    {n.sentAt}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
