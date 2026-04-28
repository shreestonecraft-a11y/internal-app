import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Settings as SettingsIcon, LogOut, User, Users, Shield, Trash2, ExternalLink, Loader2, Building2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth, logout, type Profile } from "@/lib/auth";
import { useBusinessSettings, useUpdateBusinessSettings } from "@/lib/hooks/useBusinessSettings";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

const SUPABASE_USERS_URL = `${import.meta.env.VITE_SUPABASE_URL?.replace('.supabase.co', '')}.supabase.co`;
const projectRef = import.meta.env.VITE_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
const usersDashboardUrl = projectRef ? `https://supabase.com/dashboard/project/${projectRef}/auth/users` : SUPABASE_USERS_URL;

async function fetchProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .order('email');
  if (error) throw error;
  return data as Profile[];
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { profile, isOwner } = useAuth();
  const qc = useQueryClient();
  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: fetchProfiles,
    enabled: isOwner,
  });

  const { data: business } = useBusinessSettings();
  const updateBusiness = useUpdateBusinessSettings();
  const [biz, setBiz] = useState({
    businessName: '', gstin: '', address: '', state: '', phone: '', email: '',
    defaultGstPercent: 18, defaultHsn: '6802',
  });
  useEffect(() => { if (business) setBiz(business); }, [business]);

  function saveBusiness() {
    updateBusiness.mutate(biz, {
      onSuccess: () => toast.success("Business details saved"),
      onError: (e) => toast.error(`Save failed: ${(e as Error).message}`),
    });
  }

  const setRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: 'owner' | 'staff' }) => {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });

  const removeUser = useMutation({
    mutationFn: async (id: string) => {
      // Removes the profile. Auth user remains; remove via Supabase Dashboard if you want full deletion.
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles'] }),
  });

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <AppLayout>
      <div className="px-4 md:px-8 lg:px-10 py-6 max-w-3xl mx-auto space-y-6">
        <h1 className="font-display text-xl md:text-2xl font-bold text-foreground">Settings</h1>

        {/* Profile */}
        <section className="glass-card rounded-xl p-5">
          <h2 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-accent" />Your Account
          </h2>
          {profile ? (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium text-foreground">{profile.email}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Name</span>
                <span className="font-medium text-foreground">{profile.full_name || '—'}</span>
              </div>
              <div className="flex justify-between border-b border-border pb-2">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium text-foreground capitalize">{profile.role}</span>
              </div>
              <Button onClick={handleLogout} variant="outline" className="rounded-xl mt-2">
                <LogOut className="h-4 w-4 mr-2" />Sign Out
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
        </section>

        {/* Business Details — owner only */}
        {isOwner && (
          <section className="glass-card rounded-xl p-5">
            <h2 className="font-display text-base font-semibold text-foreground mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-accent" />Business Details
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              These appear on your invoices. GSTIN and address are required for valid tax invoices.
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Business Name</Label>
                  <Input value={biz.businessName} onChange={e => setBiz({ ...biz, businessName: e.target.value })} className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">GSTIN</Label>
                  <Input
                    value={biz.gstin}
                    onChange={e => setBiz({ ...biz, gstin: e.target.value.toUpperCase() })}
                    placeholder="15-character GSTIN"
                    maxLength={15}
                    className="rounded-xl font-mono uppercase"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Address</Label>
                <Textarea
                  value={biz.address}
                  onChange={e => setBiz({ ...biz, address: e.target.value })}
                  placeholder="Full business address"
                  className="rounded-xl min-h-[60px]"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">State</Label>
                  <Input value={biz.state} onChange={e => setBiz({ ...biz, state: e.target.value })} placeholder="e.g. Rajasthan" className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Phone</Label>
                  <Input value={biz.phone} onChange={e => setBiz({ ...biz, phone: e.target.value })} className="rounded-xl" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Email</Label>
                  <Input type="email" value={biz.email} onChange={e => setBiz({ ...biz, email: e.target.value })} className="rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Default GST %</Label>
                  <Input
                    type="number"
                    value={biz.defaultGstPercent}
                    onChange={e => setBiz({ ...biz, defaultGstPercent: parseFloat(e.target.value) || 0 })}
                    className="rounded-xl"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Default HSN</Label>
                  <Input value={biz.defaultHsn} onChange={e => setBiz({ ...biz, defaultHsn: e.target.value })} className="rounded-xl font-mono" />
                </div>
              </div>
              <Button onClick={saveBusiness} disabled={updateBusiness.isPending} className="bg-accent text-accent-foreground rounded-xl">
                {updateBusiness.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Business Details
              </Button>
            </div>
          </section>
        )}

        {/* User Management — owner only */}
        {isOwner && (
          <section className="glass-card rounded-xl p-5">
            <h2 className="font-display text-base font-semibold text-foreground mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-accent" />Team Members
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              Owners can manage roles. To add a new staff member, create them in the Supabase Dashboard, then they'll appear here.
            </p>

            <a
              href={usersDashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline mb-4"
            >
              Open Supabase Auth Dashboard <ExternalLink className="h-3.5 w-3.5" />
            </a>

            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-2">
                {profiles.map(p => (
                  <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/40">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">{p.email}</p>
                      <p className="text-xs text-muted-foreground">{p.full_name || 'No name set'}</p>
                    </div>
                    <select
                      value={p.role}
                      onChange={e => setRole.mutate({ id: p.id, role: e.target.value as 'owner' | 'staff' })}
                      disabled={p.id === profile?.id || setRole.isPending}
                      className="text-xs rounded-lg border border-border bg-background px-2 py-1 font-medium"
                      title={p.id === profile?.id ? "You can't change your own role" : ""}
                    >
                      <option value="staff">Staff</option>
                      <option value="owner">Owner</option>
                    </select>
                    {p.id !== profile?.id && (
                      <button
                        onClick={() => {
                          if (!confirm(`Remove ${p.email} from the app? Their auth account remains until you delete it from the Supabase Dashboard.`)) return;
                          removeUser.mutate(p.id, {
                            onSuccess: () => toast.success("User removed"),
                            onError: (e) => toast.error(`Remove failed: ${(e as Error).message}`),
                          });
                        }}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title="Remove user from app"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
                {profiles.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No team members yet.</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* Footer info */}
        <section className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            Data is stored in Supabase. Daily backups are managed by Supabase.
          </div>
        </section>

        {!isOwner && profile && (
          <div className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
            <SettingsIcon className="h-3 w-3" /> Contact an owner to manage team members.
          </div>
        )}
      </div>
    </AppLayout>
  );
}
